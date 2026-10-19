import {
  collection,
  doc,
  writeBatch,
  deleteDoc,
  updateDoc,
  getDoc,
  setDoc,
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
    }
    if (circle.recurringId) {
      docData.recurringId = circle.recurringId
    }
    if (typeof circle.isManager === 'boolean') {
      docData.isManager = circle.isManager
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
      ...(typeof data.isManager === 'boolean' ? { isManager: data.isManager } : {}),
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
  if (partial.recurringId !== undefined) updates.recurringId = partial.recurringId
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
}

export async function checkCirclePayoutExists(uid: string, circleId: string): Promise<boolean> {
  const txRef = doc(db, 'users', uid, 'transactions', `circle_payout_${circleId}`)
  const snap = await getDoc(txRef)
  return snap.exists()
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
  await setDoc(txRef, {
    type: 'income',
    amountFils: netAmountFils,
    categoryId,
    title: `استلام صافي جمعية ${circle.name}`.slice(0, 100),
    note: `استلام صافي الجمعية بعد خصم قسط الشهر (${circle.name})`.slice(0, 500),
    date: Timestamp.fromDate(now),
    createdAt: Timestamp.fromDate(now),
  })

  return payoutTxId
}

export async function deleteCirclePayout(uid: string, circleId: string): Promise<void> {
  const txRef = doc(db, 'users', uid, 'transactions', `circle_payout_${circleId}`)
  await deleteDoc(txRef).catch(() => {})
}

export async function deleteMoneyCircle(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'circles', id)
  await deleteDoc(docRef)
  await deleteCirclePayout(uid, id)
}

/**
 * Calculates which month (1-indexed) the circle is currently in based on start date.
 */
export function getCurrentCircleMonth(circle: MoneyCircle, refDate = new Date()): number {
  const start = circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate)
  const diffMonths =
    (refDate.getFullYear() - start.getFullYear()) * 12 +
    (refDate.getMonth() - start.getMonth()) +
    1

  return Math.max(1, Math.min(circle.membersCount, diffMonths))
}

/**
 * Checks if the current month is the user's turn to receive the payout.
 */
export function isUserTurnMonth(circle: MoneyCircle, refDate = new Date()): boolean {
  const currentMonth = getCurrentCircleMonth(circle, refDate)
  return currentMonth === circle.myTurnMonth
}
