import { addMonths } from 'date-fns'
import { getFinancialMonthRange } from '../../lib/dates'
import { getNextCircleDueDate } from '../../lib/recurring'
import {
  collection,
  doc,
  writeBatch,
  deleteField,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { MAX_AMOUNT_FILS } from '../../lib/money'
import type { MoneyCircle } from '../../types'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../../lib/firestoreOffline'
import {
  circleConverter,
  getCircleCycleIndex,
} from './helpers'

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
  if (monthlyAmount > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const membersCount = Math.round(Number(circle.membersCount))
  if (membersCount < 2 || membersCount > 50) {
    throw new Error('عدد الأعضاء يجب أن يكون بين 2 و 50 عضواً')
  }

  const totalAmount = monthlyAmount * membersCount
  if (totalAmount > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }
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
    ...(circle.shareType ? { shareType: circle.shareType } : {}),
    ...(circle.secondTurnMonth !== undefined && circle.secondTurnMonth !== null
      ? { secondTurnMonth: Math.round(Number(circle.secondTurnMonth)) }
      : {}),
    createdAt: new Date(),
  }

  const batch = writeBatch(db)
  batch.set(docRef, newCircle)
  await commitFirestoreWrite(batch.commit())

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
  const circleSnap = await safeGetDoc(docRef)
  if (!circleSnap.exists()) {
    throw new Error('الجمعية غير موجودة')
  }
  const currentCircle = circleConverter.fromFirestore(circleSnap as QueryDocumentSnapshot)
  const batch = writeBatch(db)

  const updates: Record<string, unknown> = {}

  if (partial.name !== undefined) updates.name = partial.name.trim().slice(0, 100)
  if (partial.monthlyAmountFils !== undefined) {
    const monthly = Math.round(partial.monthlyAmountFils)
    if (monthly > MAX_AMOUNT_FILS) {
      throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
    }
    updates.monthlyAmountFils = monthly
  }
  if (partial.membersCount !== undefined) updates.membersCount = Math.round(partial.membersCount)
  if (partial.totalAmountFils !== undefined) {
    const total = Math.round(partial.totalAmountFils)
    if (total > MAX_AMOUNT_FILS) {
      throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
    }
    updates.totalAmountFils = total
  }
  if (partial.myTurnMonth !== undefined) updates.myTurnMonth = Math.round(partial.myTurnMonth)
  if (partial.isManager !== undefined) updates.isManager = Boolean(partial.isManager)
  if (partial.status !== undefined) updates.status = partial.status
  if (partial.expenseCategoryId !== undefined) {
    const trimmed = partial.expenseCategoryId.trim().slice(0, 128)
    updates.expenseCategoryId = trimmed ? trimmed : deleteField()
  }
  if (partial.incomeCategoryId !== undefined) {
    const trimmed = partial.incomeCategoryId.trim().slice(0, 128)
    updates.incomeCategoryId = trimmed ? trimmed : deleteField()
  }
  if (partial.categoryId !== undefined) {
    const trimmed = partial.categoryId.trim().slice(0, 128)
    updates.categoryId = trimmed ? trimmed : deleteField()
  }
  if (partial.shareType !== undefined) updates.shareType = partial.shareType
  if (partial.secondTurnMonth !== undefined) {
    if (
      partial.secondTurnMonth !== null &&
      Number.isFinite(Number(partial.secondTurnMonth)) &&
      Number(partial.secondTurnMonth) >= 1
    ) {
      updates.secondTurnMonth = Math.round(Number(partial.secondTurnMonth))
    } else {
      updates.secondTurnMonth = deleteField()
    }
  }
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
  const effectiveTotal =
    partial.totalAmountFils !== undefined
      ? Math.round(partial.totalAmountFils)
      : (partial.monthlyAmountFils !== undefined || partial.membersCount !== undefined
          ? effectiveMonthly * effectiveMembersCount
          : currentCircle.totalAmountFils)
  if (effectiveMonthly > MAX_AMOUNT_FILS || effectiveTotal > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }
  const effectiveTurn =
    partial.myTurnMonth !== undefined
      ? Math.round(partial.myTurnMonth)
      : currentCircle.myTurnMonth
  const effectiveStartDate =
    partial.startDate instanceof Date
      ? partial.startDate
      : (partial.startDate ? new Date(partial.startDate) : currentCircle.startDate)

  const effectiveShareType =
    partial.shareType !== undefined ? partial.shareType : currentCircle.shareType
  const effectiveSecondTurn =
    partial.secondTurnMonth !== undefined ? partial.secondTurnMonth : currentCircle.secondTurnMonth

  const userInstallmentAmount =
    effectiveShareType === 'half'
      ? Math.round(effectiveMonthly / 2)
      : effectiveShareType === 'double'
        ? effectiveMonthly * 2
        : effectiveMonthly

  const exemptMonths =
    effectiveShareType === 'double' && effectiveSecondTurn
      ? [effectiveTurn, effectiveSecondTurn]
      : [effectiveTurn]

  // 1. Linked recurring rule handling
  const candidateRecId =
    partial.recurringId !== undefined ? partial.recurringId : currentCircle.recurringId

  if ('recurringId' in partial && !partial.recurringId) {
    // Unlink recurring rule explicitly
    updates.recurringId = deleteField()
    if (currentCircle.recurringId) {
      const oldRecRef = doc(db, 'users', uid, 'recurring', currentCircle.recurringId)
      const oldRecSnap = await safeGetDoc(oldRecRef)
      if (oldRecSnap.exists()) {
        batch.delete(oldRecRef)
      }
    }
    // Also clean up any recurring rules linked via circleId
    try {
      const recQuerySnap = await safeGetDocs(
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
    const recSnap = await safeGetDoc(recRef)
    if (recSnap.exists()) {
      const recData = recSnap.data()
      const recUpdates: Record<string, unknown> = {
        amountFils: userInstallmentAmount,
        skipMonth: effectiveTurn,
        skipMonths: exemptMonths,
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
        partial.members !== undefined ||
        partial.shareType !== undefined ||
        partial.secondTurnMonth !== undefined

      if (shouldRecalculateNextDate) {
        const newNextDate = getNextCircleDueDate(
          effectiveStartDate,
          effectiveMembersCount,
          effectiveTurn,
          userMember?.paidMonths || [],
          userMember?.paymentsByMonth,
          exemptMonths
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
          userMember?.paymentsByMonth,
          exemptMonths
        )
        const categoryId =
          options?.defaultCategoryId ||
          currentCircle.expenseCategoryId ||
          currentCircle.categoryId ||
          'cat-custom-circle'

        batch.set(newRecRef, {
          type: 'expense',
          amountFils: userInstallmentAmount,
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
          skipMonths: exemptMonths,
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
      userMember?.paymentsByMonth,
      exemptMonths
    )
    const categoryId =
      options.defaultCategoryId ||
      currentCircle.expenseCategoryId ||
      currentCircle.categoryId ||
      'cat-custom-circle'

    batch.set(newRecRef, {
      type: 'expense',
      amountFils: userInstallmentAmount,
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
      skipMonths: exemptMonths,
      createdAt: serverTimestamp(),
    })
    updates.recurringId = newRecRef.id
  }

  // If circle status is marked as completed, deactivate all recurring rules linked to this circle
  if (partial.status === 'completed') {
    try {
      const recQuerySnap = await safeGetDocs(
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
  let monthStartDay = options?.monthStartDay
  let diffMonths = -1

  const ensureCycleComputed = async () => {
    if (diffMonths >= 0) return
    if (monthStartDay === undefined) {
      try {
        const userSnap = await safeGetDoc(doc(db, 'users', uid))
        if (userSnap?.exists?.()) {
          monthStartDay = userSnap.data()?.monthStartDay
        }
      } catch {
        // fallback
      }
    }
    const now = new Date()
    diffMonths = getCircleCycleIndex(effectiveStartDate, now, monthStartDay)
  }

  const payoutRef = doc(db, 'users', uid, 'transactions', `circle_payout_${id}`)
  try {
    const payoutSnap = await safeGetDoc(payoutRef)
    if (payoutSnap?.exists?.()) {
      await ensureCycleComputed()
      const userMonthly =
        effectiveShareType === 'half'
          ? Math.round(effectiveMonthly / 2)
          : effectiveShareType === 'double'
            ? effectiveMonthly * 2
            : effectiveMonthly
      const userGross =
        effectiveShareType === 'half'
          ? Math.round((effectiveMonthly * effectiveMembersCount) / 2)
          : effectiveMonthly * effectiveMembersCount
      const netAmountFils = userGross - userMonthly
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
  } catch (err) {
    console.error('Failed to sync circle payout transaction:', err)
  }

  // Sync turn 2 payout transaction if it exists (for double share circles)
  const mayHaveSecondPayout =
    currentCircle.shareType === 'double' ||
    partial.shareType === 'double' ||
    currentCircle.secondTurnMonth !== undefined ||
    partial.secondTurnMonth !== undefined

  if (mayHaveSecondPayout) {
    const payoutRef2 = doc(db, 'users', uid, 'transactions', `circle_payout_${id}_t2`)
    try {
      const payoutSnap2 = await safeGetDoc(payoutRef2)
      if (payoutSnap2?.exists?.()) {
        await ensureCycleComputed()
        if (effectiveShareType === 'double' && effectiveSecondTurn) {
          const userMonthly = effectiveMonthly * 2
          const userGross = effectiveMonthly * effectiveMembersCount
          const netAmountFils = userGross - userMonthly
          if (netAmountFils > 0) {
            const payoutUpdates2: Record<string, unknown> = {
              amountFils: netAmountFils,
              title: `استلام صافي جمعية ${effectiveName} (الدور الثاني)`.slice(0, 100),
            }

            const existingPayoutData2 =
              typeof payoutSnap2?.data === 'function'
                ? (payoutSnap2.data() as Record<string, unknown> | undefined)
                : undefined
            const existingNote2 = typeof existingPayoutData2?.note === 'string' ? existingPayoutData2.note.trim() : ''
            const oldDefaultNote2 = currentCircle?.name
              ? `استلام صافي الجمعية بعد خصم قسط الشهر (${currentCircle.name}) (الدور الثاني)`
              : ''
            const isDefaultNote2 = !existingNote2 || existingNote2 === oldDefaultNote2

            if (partial.name !== undefined && isDefaultNote2) {
              payoutUpdates2.note = `استلام صافي الجمعية بعد خصم قسط الشهر (${effectiveName}) (الدور الثاني)`.slice(0, 500)
            }

            if (partial.startDate !== undefined || partial.secondTurnMonth !== undefined) {
              const expectedTurnDate2 = addMonths(
                effectiveStartDate,
                Math.max(0, effectiveSecondTurn - 1)
              )
              payoutUpdates2.date = Timestamp.fromDate(expectedTurnDate2)
            }

            batch.update(payoutRef2, payoutUpdates2)
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync circle payout transaction (turn 2):', err)
    }
  }

  // 3. Update installment transactions if monthly amount or circle name changed
  const oldUserInstallment =
    currentCircle.shareType === 'half'
      ? Math.round(currentCircle.monthlyAmountFils / 2)
      : currentCircle.shareType === 'double'
        ? currentCircle.monthlyAmountFils * 2
        : currentCircle.monthlyAmountFils
  const amountChanged =
    (partial.monthlyAmountFils !== undefined || partial.shareType !== undefined) &&
    userInstallmentAmount !== oldUserInstallment
  const nameChanged = partial.name !== undefined && partial.name.trim() !== currentCircle.name.trim()

  if (amountChanged || nameChanged) {
    const allRecIds = new Set<string>()
    if (currentCircle.recurringId) allRecIds.add(currentCircle.recurringId)
    if (candidateRecId) allRecIds.add(candidateRecId)
    try {
      const recQuerySnap = await safeGetDocs(
        query(collection(db, 'users', uid, 'recurring'), where('circleId', '==', id))
      )
      recQuerySnap.docs.forEach((d) => allRecIds.add(d.id))
    } catch {
      // ignore
    }

    for (const rId of allRecIds) {
      try {
        const txSnap = await safeGetDocs(
          query(collection(db, 'users', uid, 'transactions'), where('recurringId', '==', rId))
        )
        for (const txDoc of txSnap.docs) {
          const verifiedTx =
            typeof txDoc.data === 'function' && typeof txDoc.exists === 'function'
              ? txDoc
              : await safeGetDoc(txDoc.ref)
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
            const { start: currentFinancialStart } = getFinancialMonthRange(now, monthStartDay ?? 1)
            const isPastMonthTx = txDate !== null && txDate < currentFinancialStart

            const txUpdates: Record<string, unknown> = {}
            if (amountChanged && !isPastMonthTx) {
              txUpdates.amountFils = userInstallmentAmount
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
  await commitFirestoreWrite(batch.commit())
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
  const circleSnap = await safeGetDoc(docRef)
  const circleData = circleSnap.data()

  const refsToDelete: DocumentReference[] = [docRef]
  const seenPaths = new Set<string>([docRef.path])
  const addRefToDelete = (ref: DocumentReference) => {
    if (!seenPaths.has(ref.path)) {
      seenPaths.add(ref.path)
      refsToDelete.push(ref)
    }
  }

  const recIds = new Set<string>()

  // 1. Clean up associated recurring transaction if linked by recurringId
  if (circleData?.recurringId) {
    const recRef = doc(db, 'users', uid, 'recurring', circleData.recurringId)
    addRefToDelete(recRef)
    recIds.add(circleData.recurringId)
  }

  // 2. Query any recurring transaction linked via circleId === id
  const recColRef = collection(db, 'users', uid, 'recurring')
  const q = query(recColRef, where('circleId', '==', id))
  const recSnap = await safeGetDocs(q)
  for (const recDoc of recSnap.docs) {
    addRefToDelete(recDoc.ref)
    recIds.add(recDoc.id)
  }

  // 3. Clean up associated transactions ONLY IF deleteWalletTransactions is true
  if (deleteWalletTransactions) {
    // Delete payout transaction if exists
    const payoutTxRef = doc(db, 'users', uid, 'transactions', `circle_payout_${id}`)
    addRefToDelete(payoutTxRef)
    if (circleData?.shareType === 'double') {
      const payoutTxRef2 = doc(db, 'users', uid, 'transactions', `circle_payout_${id}_t2`)
      addRefToDelete(payoutTxRef2)
    }

    // Delete manual installment transactions (circle_${id}_m1 through circle_${id}_m${membersCount})
    const totalMembers = circleData?.membersCount || 0
    for (let m = 1; m <= totalMembers; m++) {
      const manualTxRef = doc(db, 'users', uid, 'transactions', `circle_${id}_m${m}`)
      addRefToDelete(manualTxRef)
    }

    // Delete installment transactions created by the recurring schedules of this circle
    for (const recId of recIds) {
      const txColRef = collection(db, 'users', uid, 'transactions')
      const txQuery = query(txColRef, where('recurringId', '==', recId))
      const txSnap = await safeGetDocs(txQuery)
      if (txSnap?.docs) {
        for (const txDoc of txSnap.docs) {
          addRefToDelete(txDoc.ref)
        }
      }
    }
  }

  const CHUNK_SIZE = 400
  for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
    const chunk = refsToDelete.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const ref of chunk) {
      batch.delete(ref)
    }
    await commitFirestoreWrite(batch.commit())
  }
}

export async function swapMemberTurns(
  uid: string,
  circleId: string,
  memberId1: string,
  memberId2: string,
  options?: { monthStartDay?: number }
): Promise<void> {
  const circleRef = doc(db, 'users', uid, 'circles', circleId)
  const snap = await safeGetDoc(circleRef)
  if (!snap.exists()) {
    throw new Error('الجمعية غير موجودة')
  }

  const circle = circleConverter.fromFirestore(snap as QueryDocumentSnapshot)
  const m1 = circle.members.find((m) => m.id === memberId1)
  const m2 = circle.members.find((m) => m.id === memberId2)

  if (!m1 || !m2) {
    throw new Error('أحد العضوين غير موجود في الجمعية')
  }

  const turn1 = m1.turnMonth
  const turn2 = m2.turnMonth

  if (turn1 === turn2) return

  const isUser1 = turn1 === circle.myTurnMonth || m1.name === 'أنت'
  const isUser2 = turn2 === circle.myTurnMonth || m2.name === 'أنت'

  let newMyTurn = circle.myTurnMonth
  if (isUser1) {
    newMyTurn = turn2
  } else if (isUser2) {
    newMyTurn = turn1
  }

  let newSecondTurn = circle.secondTurnMonth
  if (circle.secondTurnMonth !== undefined) {
    if (turn1 === circle.secondTurnMonth) {
      newSecondTurn = turn2
    } else if (turn2 === circle.secondTurnMonth) {
      newSecondTurn = turn1
    }
  }

  const cleanMemberForNewTurn = (m: typeof m1, newTurn: number) => {
    const cleanedPaid = (m.paidMonths || []).filter((mn) => mn !== newTurn)
    const cleanedMap = m.paymentsByMonth ? { ...m.paymentsByMonth } : undefined
    if (cleanedMap) {
      delete cleanedMap[newTurn]
      delete cleanedMap[String(newTurn)]
    }
    return {
      ...m,
      turnMonth: newTurn,
      paidMonths: cleanedPaid,
      ...(cleanedMap ? { paymentsByMonth: cleanedMap } : {}),
    }
  }

  const updatedMembers = circle.members.map((m) => {
    if (m.id === memberId1) {
      return cleanMemberForNewTurn(m, turn2)
    }
    if (m.id === memberId2) {
      return cleanMemberForNewTurn(m, turn1)
    }
    return m
  })

  await updateMoneyCircle(
    uid,
    circleId,
    {
      members: updatedMembers,
      myTurnMonth: newMyTurn,
      ...(newSecondTurn !== undefined ? { secondTurnMonth: newSecondTurn } : {}),
    },
    {
      monthStartDay: options?.monthStartDay,
      createRecurringRule: Boolean(circle.recurringId),
    }
  )
}
