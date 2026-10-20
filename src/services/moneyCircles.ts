import { addMonths } from 'date-fns'
import {
  collection,
  doc,
  writeBatch,
  deleteDoc,
  updateDoc,
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

interface FirestoreCircleDoc {
  name: string
  monthlyAmountFils: number
  membersCount: number
  totalAmountFils: number
  myTurnMonth: number
  startDate: Timestamp
  members: Array<{
    id: string
    name: string
    turnMonth: number
    paidMonths: number[]
  }>
  status: 'active' | 'completed'
  recurringId?: string
  isManager?: boolean
  createdAt: Timestamp
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
      members: (data.members || []).map((m) => ({
        id: m.id,
        name: m.name,
        turnMonth: m.turnMonth,
        paidMonths: m.paidMonths || [],
      })),
      status: data.status || 'active',
      ...(data.recurringId ? { recurringId: data.recurringId } : {}),
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

export async function updateMoneyCircle(
  uid: string,
  id: string,
  partial: Partial<Omit<MoneyCircle, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'circles', id)
  const updates: Record<string, unknown> = {}

  if (partial.name !== undefined) updates.name = partial.name.trim().slice(0, 100)
  if (partial.monthlyAmountFils !== undefined) updates.monthlyAmountFils = Math.round(partial.monthlyAmountFils)
  if (partial.membersCount !== undefined) updates.membersCount = Math.round(partial.membersCount)
  if (partial.totalAmountFils !== undefined) updates.totalAmountFils = Math.round(partial.totalAmountFils)
  if (partial.myTurnMonth !== undefined) updates.myTurnMonth = Math.round(partial.myTurnMonth)
  if ('recurringId' in partial) {
    if (!partial.recurringId) {
      updates.recurringId = deleteField()
    } else {
      updates.recurringId = partial.recurringId
    }
  }
  if (partial.isManager !== undefined) updates.isManager = Boolean(partial.isManager)
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
      paidMonths: m.paidMonths || [],
    }))
  }
  if (partial.status !== undefined) updates.status = partial.status

  await updateDoc(docRef, updates)

  // Sync circle payout transaction if it exists
  const payoutRef = doc(db, 'users', uid, 'transactions', `circle_payout_${id}`)
  try {
    const payoutSnap = await getDoc(payoutRef)
    if (payoutSnap?.exists?.()) {
      const circleSnap = await getDoc(docRef)
      if (circleSnap?.exists?.()) {
        const circleData = circleConverter.fromFirestore(circleSnap as QueryDocumentSnapshot)
        const now = new Date()
        const diffMonths = getCircleCycleIndex(circleData.startDate, now)
        const currentMonthIndex = diffMonths + 1

        // If circle hasn't started yet or turn month is in the future
        if (diffMonths < 0 || currentMonthIndex < circleData.myTurnMonth) {
          await deleteDoc(payoutRef).catch(() => {})
        } else {
          const netAmountFils = circleData.totalAmountFils - circleData.monthlyAmountFils
          if (netAmountFils > 0) {
            await updateDoc(payoutRef, {
              amountFils: netAmountFils,
              title: `استلام صافي جمعية ${circleData.name}`.slice(0, 100),
              note: `استلام صافي الجمعية بعد خصم قسط الشهر (${circleData.name})`.slice(0, 500),
            }).catch(() => {})
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to sync circle payout transaction:', err)
  }
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
  options?: { deleteTransactions?: boolean }
): Promise<void> {
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

  // 3. Clean up associated transactions if deleteTransactions is true
  if (options?.deleteTransactions) {
    // Delete payout transaction
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
