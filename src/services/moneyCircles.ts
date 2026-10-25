import { addMonths, format } from 'date-fns'
import { getNextCircleDueDate } from '../lib/recurring'
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
    ...(circle.expenseCategoryId ? { expenseCategoryId: circle.expenseCategoryId } : {}),
    ...(circle.incomeCategoryId ? { incomeCategoryId: circle.incomeCategoryId } : {}),
    ...(circle.categoryId ? { categoryId: circle.categoryId } : {}),
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
  if (partial.expenseCategoryId !== undefined) updates.expenseCategoryId = partial.expenseCategoryId
  if (partial.incomeCategoryId !== undefined) updates.incomeCategoryId = partial.incomeCategoryId
  if (partial.categoryId !== undefined) updates.categoryId = partial.categoryId
  if (options?.defaultCategoryId && !currentCircle.expenseCategoryId && partial.expenseCategoryId === undefined) {
    updates.expenseCategoryId = options.defaultCategoryId
  }
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
    // Also clean up any recurring rules linked via circleId
    try {
      const recQuerySnap = await getDocs(
        query(collection(db, 'users', uid, 'recurring'), where('circleId', '==', id))
      )
      for (const d of recQuerySnap.docs) {
        if (d.id !== currentCircle.recurringId) {
          batch.delete(d.ref)
        }
      }
    } catch (err) {
      console.error('Failed to clean up recurring rules matching circleId:', err)
    }
  } else if (candidateRecId) {
    const recRef = doc(db, 'users', uid, 'recurring', candidateRecId)
    const recSnap = await getDoc(recRef)
    if (recSnap.exists()) {
      const recData = recSnap.data()
      const recUpdates: Record<string, unknown> = {
        amountFils: effectiveMonthly,
        skipMonth: effectiveTurn,
      }

      // Only update title/note if circle name explicitly changed or if rule had no title/note
      const circleNameChanged =
        partial.name !== undefined && partial.name.trim() !== currentCircle.name.trim()
      if (circleNameChanged || !recData?.title) {
        recUpdates.title = `قسط ${effectiveName}`.slice(0, 100)
      }
      if (circleNameChanged || !recData?.note) {
        recUpdates.note = `قسط شهري للجمعية - معفى من الخصم في شهر الاستلام (${effectiveTurn})`.slice(0, 500)
      }

      if (options?.createRecurringRule) {
        recUpdates.active = true
      }
      if (partial.status === 'completed') {
        recUpdates.active = false
      }

      let startDateChanged = false
      if (partial.startDate) {
        const pStart = partial.startDate instanceof Date ? partial.startDate : new Date(partial.startDate)
        if (pStart.getTime() !== currentCircle.startDate.getTime()) {
          startDateChanged = true
        }
      }

      const userMember = (partial.members || currentCircle.members || []).find(
        (m) => m.turnMonth === effectiveTurn
      )

      const shouldRecalculateNextDate =
        startDateChanged ||
        partial.myTurnMonth !== undefined ||
        partial.membersCount !== undefined ||
        partial.members !== undefined

      if (shouldRecalculateNextDate) {
        const newNextDate = getNextCircleDueDate(
          effectiveStartDate,
          effectiveMembersCount,
          effectiveTurn,
          userMember?.paidMonths || [],
          userMember?.paymentsByMonth
        )
        recUpdates.nextDate = Timestamp.fromDate(newNextDate)
      }

      if (startDateChanged) {
        recUpdates.startDate = Timestamp.fromDate(effectiveStartDate)
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
        const userMember = (partial.members || currentCircle.members || []).find(
          (m) => m.turnMonth === effectiveTurn
        )
        const nextDate = getNextCircleDueDate(
          effectiveStartDate,
          effectiveMembersCount,
          effectiveTurn,
          userMember?.paidMonths || [],
          userMember?.paymentsByMonth
        )
        const categoryId =
          options?.defaultCategoryId ||
          currentCircle.expenseCategoryId ||
          currentCircle.categoryId ||
          'cat-custom-circle'

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
  } else if (options?.createRecurringRule) {
    const newRecRef = doc(collection(db, 'users', uid, 'recurring'))
    const userMember = (partial.members || currentCircle.members || []).find(
      (m) => m.turnMonth === effectiveTurn
    )
    const nextDate = getNextCircleDueDate(
      effectiveStartDate,
      effectiveMembersCount,
      effectiveTurn,
      userMember?.paidMonths || [],
      userMember?.paymentsByMonth
    )
    const categoryId =
      options.defaultCategoryId ||
      currentCircle.expenseCategoryId ||
      currentCircle.categoryId ||
      'cat-custom-circle'

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
  }

  // If circle status is marked as completed, deactivate all recurring rules linked to this circle
  if (partial.status === 'completed') {
    try {
      const recQuerySnap = await getDocs(
        query(collection(db, 'users', uid, 'recurring'), where('circleId', '==', id))
      )
      for (const d of recQuerySnap.docs) {
        batch.update(d.ref, { active: false })
      }
    } catch (err) {
      console.error('Failed to deactivate recurring items linked to completed circle:', err)
    }
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
          }

          const existingPayoutData =
            typeof payoutSnap?.data === 'function'
              ? (payoutSnap.data() as Record<string, unknown> | undefined)
              : undefined
          const existingNote = typeof existingPayoutData?.note === 'string' ? existingPayoutData.note.trim() : ''
          const oldDefaultNote = currentCircle?.name
            ? `استلام صافي الجمعية بعد خصم قسط الشهر (${currentCircle.name})`
            : ''
          const isDefaultNote = !existingNote || existingNote === oldDefaultNote

          if (partial.name !== undefined && isDefaultNote) {
            payoutUpdates.note = `استلام صافي الجمعية بعد خصم قسط الشهر (${effectiveName})`.slice(0, 500)
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

  // 3. Update installment transactions if monthly amount or circle name changed
  const oldMonthly = currentCircle.monthlyAmountFils
  const amountChanged = partial.monthlyAmountFils !== undefined && effectiveMonthly !== oldMonthly
  const nameChanged = partial.name !== undefined && partial.name.trim() !== currentCircle.name.trim()

  if (amountChanged || nameChanged) {
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
            const txData = typeof verifiedTx.data === 'function' ? verifiedTx.data() : undefined
            const rawDate = txData?.date
            const txDate =
              rawDate && typeof rawDate.toDate === 'function'
                ? rawDate.toDate()
                : rawDate instanceof Date
                  ? rawDate
                  : null
            const now = new Date()
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const isPastMonthTx = txDate !== null && txDate < startOfCurrentMonth

            const txUpdates: Record<string, unknown> = {}
            if (amountChanged && !isPastMonthTx) {
              txUpdates.amountFils = effectiveMonthly
            }
            if (nameChanged) {
              txUpdates.title = ('قسط ' + effectiveName).slice(0, 100)
            }
            if (Object.keys(txUpdates).length > 0) {
              batch.update(txDoc.ref, txUpdates)
            }
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

    // 3. Check manual installment transactions
    const manualSnap = await getDoc(doc(db, 'users', uid, 'transactions', 'circle_' + circleId + '_m1'))
    if (manualSnap?.exists?.()) {
      return true
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

  await batch.commit()

  return payoutTxId
}

export async function deleteCirclePayout(uid: string, circleId: string): Promise<void> {
  const txRef = doc(db, 'users', uid, 'transactions', `circle_payout_${circleId}`)
  await deleteDoc(txRef).catch(() => {})
}

/**
 * Toggles a member's payment status for a specific month.
 * If the member is the current user (member.turnMonth === circle.myTurnMonth):
 * - Paid -> Unpaid: deletes linked transaction (`circle_${circle.id}_m${monthNum}`), rewinds recurring rule nextDate if applicable.
 * - Unpaid -> Paid: creates deterministic expense transaction (`circle_${circle.id}_m${monthNum}`), advances recurring rule nextDate to next unpaid month.
 */
export async function toggleCircleMemberPayment(
  uid: string,
  circleId: string,
  memberId: string,
  monthNum: number,
  defaultCategoryId?: string
): Promise<{ isUser: boolean; paid: boolean }> {
  const circleRef = doc(db, 'users', uid, 'circles', circleId)
  const circleSnap = await getDoc(circleRef)
  if (!circleSnap.exists()) {
    throw new Error('الجمعية غير موجودة')
  }

  const circle = circleConverter.fromFirestore(circleSnap as QueryDocumentSnapshot)
  const targetMember = circle.members.find((m) => m.id === memberId)
  if (!targetMember) {
    throw new Error('العضو غير موجود')
  }

  // The receiver for monthNum is exempt and cannot be toggled
  if (targetMember.turnMonth === monthNum) {
    return { isUser: targetMember.turnMonth === circle.myTurnMonth, paid: false }
  }

  const hasPaid =
    targetMember.paidMonths.includes(monthNum) ||
    targetMember.paymentsByMonth?.[String(monthNum)] === true

  const newPaid = !hasPaid
  const isUser = targetMember.turnMonth === circle.myTurnMonth

  const updatedMembers = circle.members.map((m) => {
    if (m.id !== memberId) return m
    const newPaidMonths = hasPaid
      ? m.paidMonths.filter((mn) => mn !== monthNum)
      : [...m.paidMonths.filter((mn) => mn !== monthNum), monthNum]
    const newPaymentsByMonth = { ...(m.paymentsByMonth || {}) }
    if (hasPaid) {
      delete newPaymentsByMonth[monthNum]
      newPaymentsByMonth[String(monthNum)] = false
    } else {
      newPaymentsByMonth[String(monthNum)] = true
    }
    return {
      ...m,
      paidMonths: newPaidMonths,
      paymentsByMonth: newPaymentsByMonth,
    }
  })

  const batch = writeBatch(db)
  batch.update(circleRef, {
    members: updatedMembers.map((m) => ({
      id: m.id,
      name: m.name.trim().slice(0, 50),
      turnMonth: Math.round(m.turnMonth),
      paidMonths: (m.paidMonths || []).map(Number),
      ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
    })),
  })

  if (isUser) {
    const targetDate = addMonths(
      circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate),
      monthNum - 1
    )
    const deterministicTxId = `circle_${circle.id}_m${monthNum}`
    const txRef = doc(db, 'users', uid, 'transactions', deterministicTxId)

    if (newPaid) {
      const txSnap = await getDoc(txRef)
      if (!txSnap.exists()) {
        batch.set(txRef, {
          type: 'expense',
          amountFils: circle.monthlyAmountFils,
          categoryId: circle.expenseCategoryId || defaultCategoryId || 'cat-custom-circle',
          title: `قسط ${circle.name} (شهر ${monthNum})`.slice(0, 100),
          note: `تسجيل قسط الجمعية يدوياً لشهر ${monthNum}`.slice(0, 500),
          date: Timestamp.fromDate(targetDate),
          createdAt: serverTimestamp(),
          ...(circle.recurringId ? { recurringId: circle.recurringId } : {}),
        })
      }
    } else {
      // Delete manual transaction if exists
      const txSnap = await getDoc(txRef)
      if (txSnap.exists()) {
        batch.delete(txRef)
      }
      // Also check if recurring tx exists for this date and delete it
      if (circle.recurringId) {
        const dateKey = format(targetDate, 'yyyy-MM-dd')
        const recurringTxId = `${circle.recurringId}_${dateKey}`
        const recTxRef = doc(db, 'users', uid, 'transactions', recurringTxId)
        const recTxSnap = await getDoc(recTxRef)
        if (recTxSnap.exists()) {
          batch.delete(recTxRef)
        }
      }
    }

    // Keep linked recurring rule's nextDate aligned with the first unpaid month
    const candidateRecId = circle.recurringId
    if (candidateRecId) {
      const recRef = doc(db, 'users', uid, 'recurring', candidateRecId)
      const recSnap = await getDoc(recRef)
      if (recSnap.exists()) {
        const updatedUserMember = updatedMembers.find((m) => m.turnMonth === circle.myTurnMonth)
        const newNextDate = getNextCircleDueDate(
          circle.startDate,
          circle.membersCount,
          circle.myTurnMonth,
          updatedUserMember?.paidMonths || [],
          updatedUserMember?.paymentsByMonth
        )
        batch.update(recRef, {
          nextDate: Timestamp.fromDate(newNextDate),
        })
      }
    }
  }

  await batch.commit()
  return { isUser, paid: newPaid }
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

    // Delete manual installment transactions (circle_${id}_m1 through circle_${id}_m${membersCount})
    const totalMembers = circleData?.membersCount || 0
    for (let m = 1; m <= totalMembers; m++) {
      const manualTxRef = doc(db, 'users', uid, 'transactions', `circle_${id}_m${m}`)
      batch.delete(manualTxRef)
    }

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
 * Removes an individual circle installment payment from the circle member's records
 * and deletes the corresponding transaction (both deterministic manual and recurring occurrences).
 */
export async function removeCircleInstallmentPayment(
  uid: string,
  circleId: string,
  monthNum: number
): Promise<void> {
  const circleRef = doc(db, 'users', uid, 'circles', circleId)
  const circleSnap = await getDoc(circleRef)
  if (!circleSnap.exists()) return

  const circle = circleConverter.fromFirestore(circleSnap)
  const userMember = circle.members.find((m) => m.turnMonth === circle.myTurnMonth)
  if (!userMember) return

  const updatedMembers = circle.members.map((m) => {
    if (m.turnMonth !== circle.myTurnMonth) return m
    const newPaidMonths = (m.paidMonths || []).filter((mn) => mn !== monthNum)
    const newPaymentsByMonth = { ...(m.paymentsByMonth || {}) }
    delete newPaymentsByMonth[monthNum]
    newPaymentsByMonth[String(monthNum)] = false
    return {
      ...m,
      paidMonths: newPaidMonths,
      paymentsByMonth: newPaymentsByMonth,
    }
  })

  const batch = writeBatch(db)
  batch.update(circleRef, {
    members: updatedMembers.map((m) => ({
      id: m.id,
      name: m.name.trim().slice(0, 50),
      turnMonth: Math.round(m.turnMonth),
      paidMonths: (m.paidMonths || []).map(Number),
      ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
    })),
  })

  // Delete manual transaction if exists
  const manualTxRef = doc(db, 'users', uid, 'transactions', `circle_${circleId}_m${monthNum}`)
  batch.delete(manualTxRef)

  // If there's a recurring rule, delete recurring transaction for that date and keep nextDate aligned
  if (circle.recurringId) {
    const targetDate = addMonths(
      circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate),
      monthNum - 1
    )
    const dateKey = format(targetDate, 'yyyy-MM-dd')
    const recurringTxId = `${circle.recurringId}_${dateKey}`
    const recTxRef = doc(db, 'users', uid, 'transactions', recurringTxId)
    batch.delete(recTxRef)

    const recRef = doc(db, 'users', uid, 'recurring', circle.recurringId)
    const recSnap = await getDoc(recRef)
    if (recSnap.exists()) {
      const updatedUser = updatedMembers.find((m) => m.turnMonth === circle.myTurnMonth)
      const newNextDate = getNextCircleDueDate(
        circle.startDate,
        circle.membersCount,
        circle.myTurnMonth,
        updatedUser?.paidMonths || [],
        updatedUser?.paymentsByMonth
      )
      batch.update(recRef, {
        nextDate: Timestamp.fromDate(newNextDate),
      })
    }
  }

  await batch.commit()
}

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
    const candidateStart = new Date(
      rawStart.getFullYear(),
      rawStart.getMonth(),
      Math.min(28, Math.max(1, Math.round(monthStartDay)))
    )
    if (candidateStart <= target || rawStart > target) {
      start = candidateStart
    }
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

