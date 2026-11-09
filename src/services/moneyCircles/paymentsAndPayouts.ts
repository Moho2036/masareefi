import { addMonths, format } from 'date-fns'
import { getNextCircleDueDate } from '../../lib/recurring'
import {
  collection,
  doc,
  writeBatch,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
  serverTimestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { MoneyCircle } from '../../types'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../../lib/firestoreOffline'
import {
  circleConverter,
} from './helpers'

export async function checkCirclePayoutExists(
  uid: string,
  circleId: string,
  isSecondTurn?: boolean
): Promise<boolean> {
  const txId = isSecondTurn ? `circle_payout_${circleId}_t2` : `circle_payout_${circleId}`
  const txRef = doc(db, 'users', uid, 'transactions', txId)
  const snap = await safeGetDoc(txRef)
  return Boolean(snap?.exists?.())
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
    // 1. Check if net payout transaction exists (turn 1 or turn 2)
    const payoutExists = await checkCirclePayoutExists(uid, circleId)
    if (payoutExists) return true
    const payout2Exists = await checkCirclePayoutExists(uid, circleId, true)
    if (payout2Exists) return true

    // 2. Check if recurring rule transactions exist
    if (recurringId) {
      const txColRef = collection(db, 'users', uid, 'transactions')
      const q = query(txColRef, where('recurringId', '==', recurringId), limit(1))
      const txSnap = await safeGetDocs(q)
      if (!txSnap.empty) {
        return true
      }
    }

    // 3. Check manual installment transactions
    const manualSnap = await safeGetDoc(doc(db, 'users', uid, 'transactions', 'circle_' + circleId + '_m1'))
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
  categoryId: string,
  isSecondTurn?: boolean
): Promise<string> {
  const payoutTxId = isSecondTurn ? `circle_payout_${circle.id}_t2` : `circle_payout_${circle.id}`
  const txRef = doc(db, 'users', uid, 'transactions', payoutTxId)
  const snap = await safeGetDoc(txRef)
  if (snap.exists()) {
    return payoutTxId
  }

  const userMonthly =
    circle.shareType === 'half'
      ? Math.round(circle.monthlyAmountFils / 2)
      : circle.shareType === 'double'
        ? circle.monthlyAmountFils * 2
        : circle.monthlyAmountFils

  const userGross =
    circle.shareType === 'half'
      ? Math.round(circle.totalAmountFils / 2)
      : circle.totalAmountFils

  const netAmountFils = userGross - userMonthly
  if (netAmountFils <= 0) {
    throw new Error('صافي مبلغ الجمعية غير كافٍ للإيداع')
  }

  const now = new Date()
  const start = circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate)
  const turnMonthNum =
    isSecondTurn && circle.secondTurnMonth ? circle.secondTurnMonth : circle.myTurnMonth
  const expectedTurnDate = addMonths(start, Math.max(0, turnMonthNum - 1))

  const isSameMonth =
    now.getFullYear() === expectedTurnDate.getFullYear() &&
    now.getMonth() === expectedTurnDate.getMonth()

  const txDate = isSameMonth ? now : expectedTurnDate

  const titleTurnSuffix = isSecondTurn ? ' (الدور الثاني)' : ''

  const batch = writeBatch(db)

  batch.set(txRef, {
    type: 'income',
    amountFils: netAmountFils,
    categoryId,
    title: `استلام صافي جمعية ${circle.name}${titleTurnSuffix}`.slice(0, 100),
    note: `استلام صافي الجمعية بعد خصم قسط الشهر (${circle.name})${titleTurnSuffix}`.slice(0, 500),
    date: Timestamp.fromDate(txDate),
    createdAt: Timestamp.fromDate(now),
  })

  await commitFirestoreWrite(batch.commit())

  return payoutTxId
}

export async function deleteCirclePayout(
  uid: string,
  circleId: string,
  isSecondTurn?: boolean
): Promise<void> {
  const txId = isSecondTurn ? `circle_payout_${circleId}_t2` : `circle_payout_${circleId}`
  const txRef = doc(db, 'users', uid, 'transactions', txId)
  await commitFirestoreWrite(deleteDoc(txRef)).catch(() => {})
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
  const circleSnap = await safeGetDoc(circleRef)
  if (!circleSnap.exists()) {
    throw new Error('الجمعية غير موجودة')
  }

  const circle = circleConverter.fromFirestore(circleSnap as QueryDocumentSnapshot)
  const targetMember = circle.members.find((m) => m.id === memberId)
  if (!targetMember) {
    throw new Error('العضو غير موجود')
  }

  const isUserMember =
    targetMember.turnMonth === circle.myTurnMonth ||
    (circle.shareType === 'double' &&
      circle.secondTurnMonth !== undefined &&
      targetMember.turnMonth === circle.secondTurnMonth)

  // The receiver for monthNum is exempt and cannot be toggled
  const isTargetExempt =
    targetMember.turnMonth === monthNum ||
    (isUserMember &&
      (monthNum === circle.myTurnMonth ||
        (circle.shareType === 'double' && monthNum === circle.secondTurnMonth)))

  if (isTargetExempt) {
    return { isUser: isUserMember, paid: false }
  }

  const hasPaid =
    targetMember.paidMonths.includes(monthNum) ||
    targetMember.paymentsByMonth?.[String(monthNum)] === true

  const newPaid = !hasPaid
  const isUser = isUserMember

  const userInstallmentAmount =
    circle.shareType === 'half'
      ? Math.round(circle.monthlyAmountFils / 2)
      : circle.shareType === 'double'
        ? circle.monthlyAmountFils * 2
        : circle.monthlyAmountFils

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
      const txSnap = await safeGetDoc(txRef)
      let recurringTxExists = false
      if (circle.recurringId) {
        const dateKey = format(targetDate, 'yyyy-MM-dd')
        const recurringTxId = `${circle.recurringId}_${dateKey}`
        const recTxRef = doc(db, 'users', uid, 'transactions', recurringTxId)
        const recSnap = await safeGetDoc(recTxRef)
        if (recSnap.exists()) {
          recurringTxExists = true
        }
      }

      if (!txSnap.exists() && !recurringTxExists) {
        batch.set(txRef, {
          type: 'expense',
          amountFils: userInstallmentAmount,
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
      const txSnap = await safeGetDoc(txRef)
      if (txSnap.exists()) {
        batch.delete(txRef)
      }
      // Also check if recurring tx exists for this date and delete it
      if (circle.recurringId) {
        const dateKey = format(targetDate, 'yyyy-MM-dd')
        const recurringTxId = `${circle.recurringId}_${dateKey}`
        const recTxRef = doc(db, 'users', uid, 'transactions', recurringTxId)
        const recTxSnap = await safeGetDoc(recTxRef)
        if (recTxSnap.exists()) {
          batch.delete(recTxRef)
        }
      }
    }

    // Keep linked recurring rule's nextDate aligned with the first unpaid month
    const candidateRecId = circle.recurringId
    if (candidateRecId) {
      const recRef = doc(db, 'users', uid, 'recurring', candidateRecId)
      const recSnap = await safeGetDoc(recRef)
      if (recSnap && typeof recSnap.exists === 'function' && recSnap.exists()) {
        const userMembers = updatedMembers.filter(
          (m) =>
            m.turnMonth === circle.myTurnMonth ||
            (circle.shareType === 'double' &&
              circle.secondTurnMonth !== undefined &&
              m.turnMonth === circle.secondTurnMonth)
        )
        const combinedPaidMonths = Array.from(
          new Set(userMembers.flatMap((m) => m.paidMonths || []))
        )
        const combinedPaymentsByMonth: Record<string | number, boolean> = {}
        for (const m of userMembers) {
          if (m.paymentsByMonth) {
            Object.assign(combinedPaymentsByMonth, m.paymentsByMonth)
          }
        }
        const exemptMonths =
          circle.shareType === 'double' && circle.secondTurnMonth
            ? [circle.myTurnMonth, circle.secondTurnMonth]
            : [circle.myTurnMonth]

        const newNextDate = getNextCircleDueDate(
          circle.startDate,
          circle.membersCount,
          circle.myTurnMonth,
          combinedPaidMonths,
          combinedPaymentsByMonth,
          exemptMonths
        )
        batch.update(recRef, {
          nextDate: Timestamp.fromDate(newNextDate),
        })
      }
    }
  }

  await commitFirestoreWrite(batch.commit())
  return { isUser, paid: newPaid }
}

export async function removeCircleInstallmentPayment(
  uid: string,
  circleId: string,
  monthNum: number
): Promise<void> {
  const circleRef = doc(db, 'users', uid, 'circles', circleId)
  const circleSnap = await safeGetDoc(circleRef)
  if (!circleSnap.exists()) return

  const circle = circleConverter.fromFirestore(circleSnap)
  const isUserMemberMatch = (m: { turnMonth: number }) =>
    m.turnMonth === circle.myTurnMonth ||
    (circle.shareType === 'double' &&
      circle.secondTurnMonth !== undefined &&
      m.turnMonth === circle.secondTurnMonth)

  const userMember = circle.members.find(isUserMemberMatch)
  if (!userMember) return

  const updatedMembers = circle.members.map((m) => {
    if (!isUserMemberMatch(m)) return m
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
    const recSnap = await safeGetDoc(recRef)
    if (recSnap && typeof recSnap.exists === 'function' && recSnap.exists()) {
      const userMembers = updatedMembers.filter(isUserMemberMatch)
      const combinedPaidMonths = Array.from(
        new Set(userMembers.flatMap((m) => m.paidMonths || []))
      )
      const combinedPaymentsByMonth: Record<string | number, boolean> = {}
      for (const m of userMembers) {
        if (m.paymentsByMonth) {
          Object.assign(combinedPaymentsByMonth, m.paymentsByMonth)
        }
      }
      const exemptMonths =
        circle.shareType === 'double' && circle.secondTurnMonth
          ? [circle.myTurnMonth, circle.secondTurnMonth]
          : [circle.myTurnMonth]

      const newNextDate = getNextCircleDueDate(
        circle.startDate,
        circle.membersCount,
        circle.myTurnMonth,
        combinedPaidMonths,
        combinedPaymentsByMonth,
        exemptMonths
      )
      batch.update(recRef, {
        nextDate: Timestamp.fromDate(newNextDate),
      })
    }
  }

  await commitFirestoreWrite(batch.commit())
}
