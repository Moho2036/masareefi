import { addMonths } from 'date-fns'
import { calculateNextDateOnEdit } from '../lib/recurring'
import {
  collection,
  doc,
  writeBatch,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { MoneyCircle } from '../types'

interface FirestoreCircleMember {
  id: string
  name: string
  turnMonth: number
  paidMonths: number[]
  paymentsByMonth?: Record<string, boolean>
}

interface FirestoreCircleDoc {
  name: string
  monthlyAmountFils: number
  membersCount: number
  totalAmountFils: number
  myTurnMonth: number
  startDate: Timestamp
  members: FirestoreCircleMember[]
  status: 'active' | 'completed'
  recurringId?: string
  isManager?: boolean
  createdAt: Timestamp
  expenseCategoryId?: string
  incomeCategoryId?: string
  categoryId?: string
}

export const circleConverter: FirestoreDataConverter<MoneyCircle> = {
  toFirestore(circle: MoneyCircle): DocumentData {
    const docData: DocumentData = {
      name: circle.name.trim().slice(0, 100),
      monthlyAmountFils: Math.round(circle.monthlyAmountFils),
      membersCount: Math.round(circle.membersCount),
      totalAmountFils: Math.round(circle.totalAmountFils),
      myTurnMonth: Math.round(circle.myTurnMonth),
      startDate:
        circle.startDate instanceof Date
          ? Timestamp.fromDate(circle.startDate)
          : (circle.startDate as unknown as Timestamp),
      members: (circle.members || []).map((m) => ({
        id: m.id,
        name: m.name.trim().slice(0, 50),
        turnMonth: Math.round(m.turnMonth),
        paidMonths: (m.paidMonths || []).map(Number),
        ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
      })),
      status: circle.status,
      createdAt:
        circle.createdAt instanceof Date
          ? Timestamp.fromDate(circle.createdAt)
          : (circle.createdAt as unknown as Timestamp) || serverTimestamp(),
      ...(circle.isManager !== undefined ? { isManager: Boolean(circle.isManager) } : {}),
    }
    if (typeof circle.recurringId === 'string' && circle.recurringId.trim()) {
      docData.recurringId = circle.recurringId.trim().slice(0, 128)
    }
    if (typeof circle.expenseCategoryId === 'string' && circle.expenseCategoryId.trim()) {
      docData.expenseCategoryId = circle.expenseCategoryId.trim().slice(0, 128)
    }
    if (typeof circle.incomeCategoryId === 'string' && circle.incomeCategoryId.trim()) {
      docData.incomeCategoryId = circle.incomeCategoryId.trim().slice(0, 128)
    }
    if (typeof circle.categoryId === 'string' && circle.categoryId.trim()) {
      docData.categoryId = circle.categoryId.trim().slice(0, 128)
    }
    return docData
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): MoneyCircle {
    const data = snapshot.data() as FirestoreCircleDoc
    return {
      id: snapshot.id,
      name: data.name,
      monthlyAmountFils: data.monthlyAmountFils,
      membersCount: data.membersCount,
      totalAmountFils: data.totalAmountFils,
      myTurnMonth: data.myTurnMonth,
      startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(),
      members: (data.members || []).map((m: FirestoreCircleMember) => ({
        id: m.id,
        name: m.name,
        turnMonth: m.turnMonth,
        paidMonths: m.paidMonths || [],
        ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
      })),
      status: data.status || 'active',
      ...(data.recurringId ? { recurringId: data.recurringId } : {}),
      ...(data.expenseCategoryId ? { expenseCategoryId: data.expenseCategoryId } : {}),
      ...(data.incomeCategoryId ? { incomeCategoryId: data.incomeCategoryId } : {}),
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      ...(data.isManager !== undefined ? { isManager: Boolean(data.isManager) } : {}),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    }
  },
}

export function subscribeMoneyCircles(
  uid: string,
  cb: (items: MoneyCircle[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'circles').withConverter(circleConverter)
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      cb(items)
    },
    (err) => {
      if (onError) onError(err)
      else console.error('Error subscribing to money circles:', err)
    }
  )
}

export async function addMoneyCircle(
  uid: string,
  circle: Omit<MoneyCircle, 'id' | 'createdAt'>
): Promise<string> {
  const name = (circle.name || '').trim()
  if (!name || name.length > 100) {
    throw new Error('اسم الجمعية مطلوب ويجب ألا يتجاوز 100 حرف')
  }

  const monthlyAmount = Math.round(Number(circle.monthlyAmountFils))
  if (monthlyAmount <= 0) {
    throw new Error('القسط الشهري يجب أن يكون مبلغاً موجباً')
  }

  const membersCount = Math.round(Number(circle.membersCount))
  if (membersCount < 2 || membersCount > 50) {
    throw new Error('عدد الأعضاء يجب أن يكون بين 2 و 50 عضواً')
  }

  const totalAmount = monthlyAmount * membersCount
  const myTurn = Math.round(Number(circle.myTurnMonth))
  if (myTurn < 1 || myTurn > membersCount) {
    throw new Error('دورك في الاستلام يجب أن يكون بين 1 وعدد الأعضاء')
  }

  const colRef = collection(db, 'users', uid, 'circles').withConverter(circleConverter)
  const docRef = doc(colRef)

  const newCircle: MoneyCircle = {
    id: docRef.id,
    name,
    monthlyAmountFils: monthlyAmount,
    membersCount,
    totalAmountFils: totalAmount,
    myTurnMonth: myTurn,
    startDate: circle.startDate,
    members: circle.members || [],
    status: circle.status || 'active',
    ...(circle.recurringId ? { recurringId: circle.recurringId } : {}),
    ...(circle.isManager !== undefined ? { isManager: Boolean(circle.isManager) } : {}),
    createdAt: new Date(),
  }

  const batch = writeBatch(db)
  batch.set(docRef, newCircle)
  await batch.commit()

  return docRef.id
}

export interface UpdateMoneyCircleOptions {
  monthStartDay?: number
  createRecurringRule?: boolean
  defaultCategoryId?: string
}

export async function updateMoneyCircle(
  uid: string,
  id: string,
  partial: Partial<Omit<MoneyCircle, 'id' | 'createdAt'>>,
  options?: UpdateMoneyCircleOptions
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'circles', id)
  const circleSnap = await getDoc(docRef)
  if (!circleSnap.exists()) {
    throw new Error('الجمعية غير موجودة')
  }
  const currentCircle = circleConverter.fromFirestore(circleSnap as QueryDocumentSnapshot)
  const batch = writeBatch(db)

  const updates: Record<string, unknown> = {}

  if (partial.name !== undefined) updates.name = partial.name.trim().slice(0, 100)
  if (partial.monthlyAmountFils !== undefined) updates.monthlyAmountFils = Math.round(partial.monthlyAmountFils)
  if (partial.membersCount !== undefined) updates.membersCount = Math.round(partial.membersCount)
  if (partial.totalAmountFils !== undefined) updates.totalAmountFils = Math.round(partial.totalAmountFils)
  if (partial.myTurnMonth !== undefined) updates.myTurnMonth = Math.round(partial.myTurnMonth)
  if (partial.isManager !== undefined) updates.isManager = Boolean(partial.isManager)
  if (partial.status !== undefined) updates.status = partial.status
  if (partial.startDate !== undefined) {
    updates.startDate =
      partial.startDate instanceof Date
        ? Timestamp.fromDate(partial.startDate)
        : partial.startDate
  }
  if (partial.members !== undefined) {
    updates.members = partial.members.map((m) => ({
      id: m.id,
      name: m.name.trim().slice(0, 50),
      turnMonth: Math.round(m.turnMonth),
      paidMonths: (m.paidMonths || []).map(Number),
      ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
    }))
  }

  const effectiveName = (partial.name !== undefined ? partial.name : currentCircle.name).trim()
  const effectiveMonthly =
    partial.monthlyAmountFils !== undefined
      ? Math.round(partial.monthlyAmountFils)
      : currentCircle.monthlyAmountFils
  const effectiveMembersCount =
    partial.membersCount !== undefined
      ? Math.round(partial.membersCount)
      : currentCircle.membersCount
  const effectiveTurn =
    partial.myTurnMonth !== undefined
      ? Math.round(partial.myTurnMonth)
      : currentCircle.myTurnMonth
  const effectiveStartDate =
    partial.startDate instanceof Date
      ? partial.startDate
      : (partial.startDate ? new Date(partial.startDate) : currentCircle.startDate)

  // 1. Linked recurring rule handling
  const candidateRecId =
    partial.recurringId !== undefined ? partial.recurringId : currentCircle.recurringId

  if ('recurringId' in partial && !partial.recurringId) {
    // Unlink recurring rule explicitly
    updates.recurringId = deleteField()
    if (currentCircle.recurringId) {
      const oldRecRef = doc(db, 'users', uid, 'recurring', currentCircle.recurringId)
      const oldRecSnap = await getDoc(oldRecRef)
      if (oldRecSnap.exists()) {
        batch.delete(oldRecRef)
      }
    }
  } else if (candidateRecId) {
    const recRef = doc(db, 'users', uid, 'recurring', candidateRecId)
    const recSnap = await getDoc(recRef)
    if (recSnap.exists()) {
      const recUpdates: Record<string, unknown> = {
        title: `قسط ${effectiveName}`.slice(0, 100),
        amountFils: effectiveMonthly,
        skipMonth: effectiveTurn,
        note: `قسط شهري للجمعية - معفى من الخصم في شهر الاستلام (${effectiveTurn})`.slice(0, 500),
      }

      if (options?.createRecurringRule) {
        recUpdates.active = true
      }

      let startDateChanged = false
      if (partial.startDate) {
        const pStart = partial.startDate instanceof Date ? partial.startDate : new Date(partial.startDate)
        if (pStart.getTime() !== currentCircle.startDate.getTime()) {
          startDateChanged = true
        }
      }

      if (startDateChanged) {
        const newNextDate = calculateNextDateOnEdit(effectiveStartDate, 'monthly')
        recUpdates.startDate = Timestamp.fromDate(effectiveStartDate)
        recUpdates.nextDate = Timestamp.fromDate(newNextDate)
        recUpdates.endDate = Timestamp.fromDate(addMonths(effectiveStartDate, effectiveMembersCount - 1))
      } else if (partial.membersCount !== undefined) {
        recUpdates.endDate = Timestamp.fromDate(addMonths(effectiveStartDate, effectiveMembersCount - 1))
      }

      batch.update(recRef, recUpdates)
      if (partial.recurringId) {
        updates.recurringId = candidateRecId
      }
    } else {
      // Document DOES NOT EXIST in Firestore!
      if (options?.createRecurringRule) {
        const newRecRef = doc(collection(db, 'users', uid, 'recurring'))
        const nextDate = calculateNextDateOnEdit(effectiveStartDate, 'monthly')
        const categoryId = options.defaultCategoryId || 'cat-custom-circle'

        batch.set(newRecRef, {
          type: 'expense',
          amountFils: effectiveMonthly,
          categoryId,
          title: `قسط ${effectiveName}`.slice(0, 100),
          note: `قسط شهري للجمعية - معفى من الخصم في شهر الاستلام (${effectiveTurn})`.slice(0, 500),
          frequency: 'monthly',
          startDate: Timestamp.fromDate(effectiveStartDate),
          nextDate: Timestamp.fromDate(nextDate),
          endDate: Timestamp.fromDate(addMonths(effectiveStartDate, effectiveMembersCount - 1)),
          active: true,
          circleId: id,
          skipMonth: effectiveTurn,
          createdAt: serverTimestamp(),
        })
        updates.recurringId = newRecRef.id
      } else {
        updates.recurringId = deleteField()
      }
    }
  } else if (options?.createRecurringRule && options?.defaultCategoryId) {
    const newRecRef = doc(collection(db, 'users', uid, 'recurring'))
    const nextDate = calculateNextDateOnEdit(effectiveStartDate, 'monthly')

    batch.set(newRecRef, {
      type: 'expense',
      amountFils: effectiveMonthly,
      categoryId: options.defaultCategoryId,
      title: `قسط ${effectiveName}`.slice(0, 100),
      note: `قسط شهري للجمعية - معفى من الخصم في شهر الاستلام (${effectiveTurn})`.slice(0, 500),
      frequency: 'monthly',
      startDate: Timestamp.fromDate(effectiveStartDate),
      nextDate: Timestamp.fromDate(nextDate),
      endDate: Timestamp.fromDate(addMonths(effectiveStartDate, effectiveMembersCount - 1)),
      active: true,
      circleId: id,
      skipMonth: effectiveTurn,
      createdAt: serverTimestamp(),
    })
    updates.recurringId = newRecRef.id
  }

  // 2. Sync circle payout transaction if it exists
  const payoutRef = doc(db, 'users', uid, 'transactions', `circle_payout_${id}`)
  try {
    const payoutSnap = await getDoc(payoutRef)
    if (payoutSnap?.exists?.()) {
      let monthStartDay = options?.monthStartDay
      if (monthStartDay === undefined) {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid))
          if (userSnap?.exists?.()) {
            monthStartDay = userSnap.data()?.monthStartDay
          }
        } catch {
          // fallback
        }
      }
      const now = new Date()
      const diffMonths = getCircleCycleIndex(effectiveStartDate, now, monthStartDay)
      const currentMonthIndex = diffMonths + 1

      if (diffMonths < 0 || currentMonthIndex < effectiveTurn) {
        batch.delete(payoutRef)
      } else {
        const netAmountFils = (effectiveMonthly * effectiveMembersCount) - effectiveMonthly
        if (netAmountFils > 0) {
          const payoutUpdates: Record<string, unknown> = {
            amountFils: netAmountFils,
            title: `استلام صافي جمعية ${effectiveName}`.slice(0, 100),
            note: `استلام صافي الجمعية بعد خصم قسط الشهر (${effectiveName})`.slice(0, 500),
          }

          if (partial.startDate !== undefined || partial.myTurnMonth !== undefined) {
            const expectedTurnDate = addMonths(
              effectiveStartDate,
              Math.max(0, effectiveTurn - 1)
            )
            payoutUpdates.date = Timestamp.fromDate(expectedTurnDate)
          }

          batch.update(payoutRef, payoutUpdates)
        }
      }
    }
  } catch (err) {
    console.error('Failed to sync circle payout transaction:', err)
  }

  // 3. Update installment transactions if monthly amount changed
  const oldMonthly = currentCircle.monthlyAmountFils
  if (partial.monthlyAmountFils !== undefined && effectiveMonthly !== oldMonthly) {
    const allRecIds = new Set<string>()
    if (currentCircle.recurringId) allRecIds.add(currentCircle.recurringId)
    if (candidateRecId) allRecIds.add(candidateRecId)
    try {
      const recQuerySnap = await getDocs(
        query(collection(db, 'users', uid, 'recurring'), where('circleId', '==', id))
      )
      recQuerySnap.docs.forEach((d) => allRecIds.add(d.id))
    } catch {
      // ignore
    }

    for (const rId of allRecIds) {
      try {
        const txSnap = await getDocs(
          query(collection(db, 'users', uid, 'transactions'), where('recurringId', '==', rId))
        )
        for (const txDoc of txSnap.docs) {
          const verifiedTx = await getDoc(txDoc.ref)
          if (verifiedTx.exists()) {
            batch.update(txDoc.ref, { amountFils: effectiveMonthly })
          }
        }
      } catch {
        // ignore
      }
    }
  }

  batch.update(docRef, updates)
  await batch.commit()
}

export async function checkCirclePayoutExists(uid: string, circleId: string): Promise<boolean> {
  const txRef = doc(db, 'users', uid, 'transactions', `circle_payout_${circleId}`)
  const snap = await getDoc(txRef)
  return snap.exists()
}

/**
 * Checks whether any financial transactions exist for this circle,
 * either as a net payout transaction or as recurring installment transactions.
 */
export async function checkCircleHasTransactions(
  uid: string,
  circleId: string,
  recurringId?: string
): Promise<boolean> {
  try {
    // 1. Check if net payout transaction exists
    const payoutExists = await checkCirclePayoutExists(uid, circleId)
    if (payoutExists) return true

    // 2. Check if recurring rule transactions exist
    if (recurringId) {
      const txColRef = collection(db, 'users', uid, 'transactions')
      const q = query(txColRef, where('recurringId', '==', recurringId), limit(1))
      const txSnap = await getDocs(q)
      if (!txSnap.empty) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

export async function depositCircleNetPayout(
  uid: string,
  circle: MoneyCircle,
  categoryId: string
): Promise<string> {
  const payoutTxId = `circle_payout_${circle.id}`
  const txRef = doc(db, 'users', uid, 'transactions', payoutTxId)
  const snap = await getDoc(txRef)
  if (snap.exists()) {
    return payoutTxId
  }

  const netAmountFils = circle.totalAmountFils - circle.monthlyAmountFils
  if (netAmountFils <= 0) {
    throw new Error('صافي مبلغ الجمعية غير كافٍ للإيداع')
  }

  const now = new Date()
  const start = circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate)
  const expectedTurnDate = addMonths(start, Math.max(0, circle.myTurnMonth - 1))

  const isSameMonth =
    now.getFullYear() === expectedTurnDate.getFullYear() &&
    now.getMonth() === expectedTurnDate.getMonth()

  const txDate = isSameMonth ? now : expectedTurnDate

  const batch = writeBatch(db)

  batch.set(txRef, {
    type: 'income',
    amountFils: netAmountFils,
    categoryId,
    title: `استلام صافي جمعية ${circle.name}`.slice(0, 100),
    note: `استلام صافي الجمعية بعد خصم قسط الشهر (${circle.name})`.slice(0, 500),
    date: Timestamp.fromDate(txDate),
    createdAt: Timestamp.fromDate(now),
  })

  // Mark user member as having paid their installment for their turn month
  if (circle.members && circle.myTurnMonth) {
    const myTurn = circle.myTurnMonth
    let membersChanged = false
    const updatedMembers = circle.members.map((m) => {
      if (m.turnMonth === myTurn) {
        const currentPaid = m.paidMonths || []
        if (!currentPaid.includes(myTurn)) {
          membersChanged = true
          return {
            ...m,
            paidMonths: [...currentPaid, myTurn],
          }
        }
      }
      return m
    })

    if (membersChanged) {
      const circleRef = doc(db, 'users', uid, 'circles', circle.id)
      batch.update(circleRef, { members: updatedMembers })
    }
  }

  await batch.commit()

  return payoutTxId
}

export async function deleteCirclePayout(uid: string, circleId: string): Promise<void> {
  const txRef = doc(db, 'users', uid, 'transactions', `circle_payout_${circleId}`)
  await deleteDoc(txRef).catch(() => {})
}

export async function deleteMoneyCircle(
  uid: string,
  id: string,
  optionsOrFlag: boolean | { deleteTransactions?: boolean } = false
): Promise<void> {
  const deleteWalletTransactions =
    typeof optionsOrFlag === 'boolean'
      ? optionsOrFlag
      : Boolean(optionsOrFlag?.deleteTransactions)

  const docRef = doc(db, 'users', uid, 'circles', id)
  const circleSnap = await getDoc(docRef)
  const circleData = circleSnap.data()

  const batch = writeBatch(db)
  batch.delete(docRef)

  const recIds = new Set<string>()

  // 1. Clean up associated recurring transaction if linked by recurringId
  if (circleData?.recurringId) {
    const recRef = doc(db, 'users', uid, 'recurring', circleData.recurringId)
    batch.delete(recRef)
    recIds.add(circleData.recurringId)
  }

  // 2. Query any recurring transaction linked via circleId === id
  const recColRef = collection(db, 'users', uid, 'recurring')
  const q = query(recColRef, where('circleId', '==', id))
  const recSnap = await getDocs(q)
  for (const recDoc of recSnap.docs) {
    batch.delete(recDoc.ref)
    recIds.add(recDoc.id)
  }

  // 3. Clean up associated transactions ONLY IF deleteWalletTransactions is true
  if (deleteWalletTransactions) {
    // Delete payout transaction if exists
    const payoutTxRef = doc(db, 'users', uid, 'transactions', `circle_payout_${id}`)
    batch.delete(payoutTxRef)

    // Delete installment transactions created by the recurring schedules of this circle
    for (const recId of recIds) {
      const txColRef = collection(db, 'users', uid, 'transactions')
      const txQuery = query(txColRef, where('recurringId', '==', recId))
      const txSnap = await getDocs(txQuery)
      if (txSnap?.docs) {
        for (const txDoc of txSnap.docs) {
          batch.delete(txDoc.ref)
        }
      }
    }
  }

  await batch.commit()
}

export const deleteCircle = deleteMoneyCircle

/**
 * Calculates the 0-based elapsed monthly cycles from startDate to refDate based on actual monthly cycles.
 * e.g., if start is Jan 20:
 * Jan 20 to Feb 19 -> 0
 * Feb 20 to Mar 19 -> 1
 * Before Jan 20 -> -1
 */
export function getCircleCycleIndex(
  startDate: Date,
  refDate: Date = new Date(),
  monthStartDay?: number
): number {
  const rawStart = startDate instanceof Date ? startDate : new Date(startDate)
  const target = refDate instanceof Date ? refDate : new Date(refDate)

  let start = rawStart
  if (monthStartDay !== undefined && monthStartDay > 1 && rawStart.getDate() === 1) {
    start = new Date(
      rawStart.getFullYear(),
      rawStart.getMonth(),
      Math.min(28, Math.max(1, Math.round(monthStartDay)))
    )
  }

  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0)
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0)

  let approxMonths = (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth())
  while (addMonths(s, approxMonths) > t) {
    approxMonths--
  }
  while (addMonths(s, approxMonths + 1) <= t) {
    approxMonths++
  }
  return approxMonths
}

/**
 * Calculates which month (1-indexed) the circle is currently in based on actual monthly cycles from startDate.
 */
export function getCurrentCircleMonth(
  circle: MoneyCircle,
  refDate = new Date(),
  monthStartDay?: number
): number {
  const diffMonths = getCircleCycleIndex(circle.startDate, refDate, monthStartDay)
  return Math.max(1, Math.min(circle.membersCount, diffMonths + 1))
}

/**
 * Checks if the reference date falls within the user's turn month to receive the payout.
 */
export function isUserTurnMonth(
  circle: MoneyCircle,
  refDate = new Date(),
  monthStartDay?: number
): boolean {
  const diffMonths = getCircleCycleIndex(circle.startDate, refDate, monthStartDay)
  if (diffMonths < 0 || diffMonths + 1 > circle.membersCount) {
    return false
  }
  return diffMonths + 1 === circle.myTurnMonth
}

/**
 * Checks if all member obligations have been fulfilled across all months of the circle.
 * In each month (1..membersCount), all members except the exempt recipient for that month must have paid.
 */
export function isCircleFullyPaid(circle: MoneyCircle): boolean {
  if (!circle.members || circle.members.length === 0 || circle.membersCount <= 0) {
    return false
  }
  for (let month = 1; month <= circle.membersCount; month++) {
    for (const member of circle.members) {
      if (member.turnMonth === month) continue // Exempt receiver for this month
      const isPaid =
        member.paidMonths?.includes(month) ||
        member.paymentsByMonth?.[String(month)] === true
      if (!isPaid) return false
    }
  }
  return true
}

