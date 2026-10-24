import {
  collection,
  doc,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Category } from '../types'
import { categoryConverter } from './converters'

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
  const docRef = await addDoc(colRef, {
    ...category,
    id: '', // converter ignores id and writes document fields
  })
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
    payload.name = data.name.trim().slice(0, 40)
  }
  if (data.icon !== undefined) {
    payload.icon = data.icon.slice(0, 16)
  }
  if (data.color !== undefined) {
    payload.color = data.color
  }
  if (data.archived !== undefined) {
    payload.archived = Boolean(data.archived)
  }
  if (data.order !== undefined) {
    payload.order = Math.max(0, Math.round(data.order))
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(docRef, payload)
  }
}

export async function archiveCategory(
  uid: string,
  id: string,
  archived: boolean = true
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'categories', id)

  if (archived) {
    const snap = await getDoc(docRef)
    if (snap.exists()) {
      const catData = snap.data() as Category | undefined
      if (catData?.type && !catData?.archived) {
        const colRef = collection(db, 'users', uid, 'categories')
        const activeSnap = await getDocs(
          query(colRef, where('type', '==', catData.type), where('archived', '==', false))
        )
        if (activeSnap.docs.length <= 1 && activeSnap.docs.some((d) => d.id === id)) {
          throw new Error('لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.')
        }
      }
    }
  }

  await updateDoc(docRef, { archived })
}

export async function deleteCategory(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'categories', id)
  const catSnap = await getDoc(docRef)
  if (catSnap.exists()) {
    const catData = catSnap.data() as Category | undefined
    if (catData?.type && !catData?.archived) {
      const colRef = collection(db, 'users', uid, 'categories')
      const activeSnap = await getDocs(
        query(colRef, where('type', '==', catData.type), where('archived', '==', false))
      )
      if (activeSnap.docs.length <= 1 && activeSnap.docs.some((d) => d.id === id)) {
        throw new Error('لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.')
      }
    }
  }

  const txsCol = collection(db, 'users', uid, 'transactions')
  const recCol = collection(db, 'users', uid, 'recurring')
  const circlesCol = collection(db, 'users', uid, 'circles')

  const [snapTx, snapRec, snapCircleExp, snapCircleInc, snapCircleCat] = await Promise.all([
    getDocs(query(txsCol, where('categoryId', '==', id), limit(1))),
    getDocs(query(recCol, where('categoryId', '==', id), limit(1))),
    getDocs(query(circlesCol, where('expenseCategoryId', '==', id), limit(1))),
    getDocs(query(circlesCol, where('incomeCategoryId', '==', id), limit(1))),
    getDocs(query(circlesCol, where('categoryId', '==', id), limit(1))),
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

  await deleteDoc(docRef)
}
