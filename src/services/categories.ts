import {
  collection,
  doc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Category, TxType } from '../types'
import { categoryConverter } from './converters'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../lib/firestoreOffline'

async function assertNotArchivingLastActiveCategory(
  uid: string,
  categoryIdsToArchiveOrDelete: string[]
): Promise<void> {
  const targetIds = Array.from(new Set(categoryIdsToArchiveOrDelete.filter(Boolean)))
  if (targetIds.length === 0) return

  const targetItems = await Promise.all(
    targetIds.map(async (id) => ({
      id,
      snap: await safeGetDoc(doc(db, 'users', uid, 'categories', id)),
    }))
  )

  const activeTargetsByType = new Map<TxType, Set<string>>()
  for (const { id, snap } of targetItems) {
    if (!snap.exists()) continue
    const cat = snap.data() as Category
    if (cat.type && !cat.archived) {
      const set = activeTargetsByType.get(cat.type) || new Set()
      set.add(id)
      activeTargetsByType.set(cat.type, set)
    }
  }

  if (activeTargetsByType.size === 0) return

  const colRef = collection(db, 'users', uid, 'categories')
  for (const [type, activeTargetSet] of activeTargetsByType.entries()) {
    const activeSnap = await safeGetDocs(
      query(colRef, where('type', '==', type), where('archived', '==', false))
    )
    const totalActiveCount = activeSnap.docs.length
    const numTargetsActiveInFirestore = activeSnap.docs.filter((d) => activeTargetSet.has(d.id)).length
    if (totalActiveCount - numTargetsActiveInFirestore <= 0) {
      throw new Error('لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.')
    }
  }
}

export function subscribeCategories(
  uid: string,
  cb: (categories: Category[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'categories').withConverter(categoryConverter)
  const q = query(colRef, orderBy('order', 'asc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const categories = snapshot.docs.map((d) => d.data())
      cb(categories)
    },
    (err) => {
      console.error('subscribeCategories error:', err)
      onError?.(err)
    }
  )
}

export async function addCategory(
  uid: string,
  category: Omit<Category, 'id'>
): Promise<string> {
  const colRef = collection(db, 'users', uid, 'categories').withConverter(categoryConverter)
  const docRef = await commitFirestoreWrite(
    addDoc(colRef, {
      ...category,
      id: '', // converter ignores id and writes document fields
    }),
    { id: 'offline_cat_' + Date.now() } as never
  )
  return docRef.id
}

export async function updateCategory(
  uid: string,
  id: string,
  data: Partial<Omit<Category, 'id' | 'type'>>
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'categories', id)
  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) {
    const trimmed = data.name.trim()
    if (!trimmed) {
      throw new Error('اسم التصنيف لا يمكن أن يكون فارغاً.')
    }
    payload.name = trimmed.slice(0, 40)
  }
  if (data.icon !== undefined) {
    payload.icon = data.icon.slice(0, 16)
  }
  if (data.color !== undefined) {
    payload.color = data.color
  }
  if (data.archived === true) {
    await assertNotArchivingLastActiveCategory(uid, [id])
    payload.archived = true
  } else if (data.archived !== undefined) {
    payload.archived = Boolean(data.archived)
  }
  if (data.order !== undefined) {
    payload.order = Math.max(0, Math.round(data.order))
  }

  if (Object.keys(payload).length > 0) {
    await commitFirestoreWrite(updateDoc(docRef, payload))
  }
}

/**
 * Atomically updates the sort order of multiple categories using a single Firestore batch.
 */
export async function reorderCategories(
  uid: string,
  categoryIds: string[]
): Promise<void> {
  if (categoryIds.length === 0) return
  const batch = writeBatch(db)
  categoryIds.forEach((id, idx) => {
    const docRef = doc(db, 'users', uid, 'categories', id)
    batch.update(docRef, { order: idx })
  })
  await commitFirestoreWrite(batch.commit())
}

export async function archiveCategory(
  uid: string,
  id: string,
  archived: boolean = true
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'categories', id)
  if (archived) {
    await assertNotArchivingLastActiveCategory(uid, [id])
  }
  await commitFirestoreWrite(updateDoc(docRef, { archived }))
}

export async function archiveCategoriesBatch(
  uid: string,
  ids: string[],
  archived: boolean = true
): Promise<void> {
  if (!ids || ids.length === 0) return
  if (archived) {
    await assertNotArchivingLastActiveCategory(uid, ids)
  }
  const batch = writeBatch(db)
  for (const id of ids) {
    if (!id) continue
    const docRef = doc(db, 'users', uid, 'categories', id)
    batch.update(docRef, { archived })
  }
  await commitFirestoreWrite(batch.commit())
}

export async function deleteCategory(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'categories', id)
  await assertNotArchivingLastActiveCategory(uid, [id])

  const txsCol = collection(db, 'users', uid, 'transactions')
  const recCol = collection(db, 'users', uid, 'recurring')
  const circlesCol = collection(db, 'users', uid, 'circles')

  const [snapTx, snapRec, snapCircleExp, snapCircleInc, snapCircleCat] = await Promise.all([
    safeGetDocs(query(txsCol, where('categoryId', '==', id), limit(1))),
    safeGetDocs(query(recCol, where('categoryId', '==', id), limit(1))),
    safeGetDocs(query(circlesCol, where('expenseCategoryId', '==', id), limit(1))),
    safeGetDocs(query(circlesCol, where('incomeCategoryId', '==', id), limit(1))),
    safeGetDocs(query(circlesCol, where('categoryId', '==', id), limit(1))),
  ])

  if (!snapTx.empty) {
    throw new Error('لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات مالية. يمكنك أرشفته بدلاً من ذلك.')
  }
  if (!snapRec.empty) {
    throw new Error('لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات متكررة. يمكنك أرشفته بدلاً من ذلك.')
  }
  if (!snapCircleExp.empty || !snapCircleInc.empty || !snapCircleCat.empty) {
    throw new Error('لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بجمعية مالية. يمكنك أرشفته أو تغيير تصنيف الجمعية أولاً.')
  }

  await commitFirestoreWrite(deleteDoc(docRef))
}

export async function reassignAndDeleteCategory(
  uid: string,
  sourceCatId: string,
  targetCatId: string
): Promise<void> {
  if (!sourceCatId || !targetCatId || sourceCatId === targetCatId) {
    throw new Error('لا يمكن نقل المعاملات إلى نفس التصنيف.')
  }

  const sourceRef = doc(db, 'users', uid, 'categories', sourceCatId)
  const targetRef = doc(db, 'users', uid, 'categories', targetCatId)

  const [sourceSnap, targetSnap] = await Promise.all([
    safeGetDoc(sourceRef),
    safeGetDoc(targetRef),
  ])

  if (!sourceSnap.exists()) {
    throw new Error('التصنيف المراد حذفه غير موجود.')
  }
  if (!targetSnap.exists()) {
    throw new Error('التصنيف البديل غير موجود.')
  }

  const sourceData = sourceSnap.data() as Category
  const targetData = targetSnap.data() as Category

  if (sourceData.type !== targetData.type) {
    throw new Error('يجب أن يكون التصنيف البديل من نفس النوع (مصروف أو دخل).')
  }

  if (!sourceData.archived && targetData.archived) {
    await assertNotArchivingLastActiveCategory(uid, [sourceCatId])
  }

  const txsCol = collection(db, 'users', uid, 'transactions')
  const recCol = collection(db, 'users', uid, 'recurring')
  const circlesCol = collection(db, 'users', uid, 'circles')

  const [snapTxs, snapRecs, snapCircExp, snapCircInc, snapCircCat] = await Promise.all([
    safeGetDocs(query(txsCol, where('categoryId', '==', sourceCatId))),
    safeGetDocs(query(recCol, where('categoryId', '==', sourceCatId))),
    safeGetDocs(query(circlesCol, where('expenseCategoryId', '==', sourceCatId))),
    safeGetDocs(query(circlesCol, where('incomeCategoryId', '==', sourceCatId))),
    safeGetDocs(query(circlesCol, where('categoryId', '==', sourceCatId))),
  ])

  type PendingOp = {
    ref: ReturnType<typeof doc>
    type: 'update' | 'delete'
    data?: Record<string, unknown>
  }
  const ops: PendingOp[] = []

  for (const d of snapTxs.docs) {
    ops.push({ ref: d.ref, type: 'update', data: { categoryId: targetCatId } })
  }
  for (const d of snapRecs.docs) {
    ops.push({ ref: d.ref, type: 'update', data: { categoryId: targetCatId } })
  }

  const circleUpdatesMap = new Map<string, { ref: ReturnType<typeof doc>; data: Record<string, unknown> }>()
  for (const d of snapCircExp.docs) {
    circleUpdatesMap.set(d.id, { ref: d.ref, data: { expenseCategoryId: targetCatId } })
  }
  for (const d of snapCircInc.docs) {
    const existing = circleUpdatesMap.get(d.id)
    if (existing) {
      existing.data.incomeCategoryId = targetCatId
    } else {
      circleUpdatesMap.set(d.id, { ref: d.ref, data: { incomeCategoryId: targetCatId } })
    }
  }
  for (const d of snapCircCat.docs) {
    const existing = circleUpdatesMap.get(d.id)
    if (existing) {
      existing.data.categoryId = targetCatId
    } else {
      circleUpdatesMap.set(d.id, { ref: d.ref, data: { categoryId: targetCatId } })
    }
  }
  for (const item of circleUpdatesMap.values()) {
    ops.push({ ref: item.ref, type: 'update', data: item.data })
  }

  ops.push({ ref: sourceRef, type: 'delete' })

  const CHUNK_SIZE = 400
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const op of chunk) {
      if (op.type === 'update' && op.data) {
        batch.update(op.ref, op.data)
      } else if (op.type === 'delete') {
        batch.delete(op.ref)
      }
    }
    await commitFirestoreWrite(batch.commit())
  }
}

