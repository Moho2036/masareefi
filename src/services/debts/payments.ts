import {
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { MAX_AMOUNT_FILS } from '../../lib/money'
import type { Debt, DebtPayment, TxType } from '../../types'
import { debtConverter } from '../converters'
import { commitFirestoreWrite, safeGetDoc } from '../../lib/firestoreOffline'
import {
  serializePayment,
  findLegacyPaymentTransactionId,
  generatePaymentId,
  getOrCreateDebtCategory,
  type AddPaymentOptions,
  type DeletePaymentOptions,
  type UpdatePaymentOptions,
} from './typesAndHelpers'

export async function addDebtPayment(
  uid: string,
  debt: Debt,
  payment: { amountFils: number; date: Date; note?: string },
  options?: AddPaymentOptions
): Promise<string> {
  if ((debt.payments || []).length >= 100) {
    throw new Error('تم الوصول للحد الأقصى لعدد الدفعات (100 دفعة) لهذا الدين')
  }

  const amount = Math.round(Number(payment.amountFils))
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }
  if (amount > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const remaining = Math.max(0, debt.amountFils - (debt.paidFils || 0))
  if (amount > remaining) {
    throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
  }

  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date)
  if (Number.isNaN(debtStartDate.getTime()) || Number.isNaN(paymentDate.getTime())) {
    throw new Error('تاريخ غير صالح')
  }
  const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
  const paymentDay = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate(), 0, 0, 0, 0)
  if (paymentDay < debtStartDay) {
    throw new Error('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
  }

  const paymentId = generatePaymentId()
  const defaultPaymentNote = debt.type === 'lent' ? 'دفعة استرداد دين' : 'دفعة سداد دين'
  const finalPaymentNote = (payment.note?.trim() || defaultPaymentNote).slice(0, 500)
  const txId = `debt_pay_${paymentId}`

  const newPayment: DebtPayment = {
    id: paymentId,
    amountFils: amount,
    date: payment.date,
    note: finalPaymentNote,
    transactionId: options?.syncTransaction ? txId : undefined,
    createdAt: new Date(),
  }

  const updatedPayments = [...(debt.payments || []), newPayment]
  const newPaidFils = (debt.paidFils || 0) + amount
  const newSettled = newPaidFils === debt.amountFils

  const batch = writeBatch(db)
  const debtRef = doc(db, 'users', uid, 'debts', debt.id)

  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  if (options?.syncTransaction) {
    // If lent (recovering money): transaction is income
    // If borrowed (paying back debt): transaction is expense
    const txType: TxType = debt.type === 'lent' ? 'income' : 'expense'
    const categoryId = await getOrCreateDebtCategory(uid, txType)
    const title = (
      debt.type === 'lent'
        ? `استرداد دفعة دين: ${debt.personName}`
        : `سداد دفعة دين: ${debt.personName}`
    ).slice(0, 100)

    const txRef = doc(db, 'users', uid, 'transactions', txId)
    const txData: Record<string, unknown> = {
      type: txType,
      amountFils: amount,
      categoryId,
      date: payment.date instanceof Date ? Timestamp.fromDate(payment.date) : payment.date,
      title,
      note: finalPaymentNote,
      createdAt: serverTimestamp(),
    }
    batch.set(txRef, txData)
  }

  await commitFirestoreWrite(batch.commit())
  return paymentId
}

export async function deleteDebtPayment(
  uid: string,
  debt: Debt,
  paymentId: string,
  options?: DeletePaymentOptions
): Promise<void> {
  const targetPayment = (debt.payments || []).find((p) => p.id === paymentId)
  if (!targetPayment) {
    return
  }
  const updatedPayments = (debt.payments || []).filter((p) => p.id !== paymentId)

  const previousPaymentsSum = (debt.payments || []).reduce((acc, p) => acc + p.amountFils, 0)
  const untrackedPaidFils = Math.max(0, (debt.paidFils || 0) - previousPaymentsSum)
  const updatedPaymentsTotal = updatedPayments.reduce((sum, p) => sum + p.amountFils, 0)
  const newPaidFils = Math.min(debt.amountFils, untrackedPaidFils + updatedPaymentsTotal)
  const newSettled = newPaidFils === debt.amountFils

  const batch = writeBatch(db)
  const debtRef = doc(db, 'users', uid, 'debts', debt.id)

  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  // Synchronize: Delete payment transaction if options?.deleteTransaction !== false
  if (options?.deleteTransaction !== false) {
    const isMerged = Boolean(targetPayment?.isMerged || paymentId.startsWith('compacted_'))
    const txId = targetPayment?.transactionId || `debt_pay_${paymentId}`

    if (targetPayment?.transactionId || (!isMerged && !paymentId.startsWith('compacted_'))) {
      const payTxRef = doc(db, 'users', uid, 'transactions', txId)
      batch.delete(payTxRef)
    }

    if (Array.isArray(targetPayment?.mergedTransactionIds)) {
      for (const mId of targetPayment.mergedTransactionIds) {
        if (mId) {
          batch.delete(doc(db, 'users', uid, 'transactions', mId))
        }
      }
    }

    // Legacy fallback: if targetPayment had no transactionId and deterministic doc might not match,
    // search by note/title/amount/date
    if (!targetPayment?.transactionId && !isMerged && targetPayment) {
      try {
        const legacyTxId = await findLegacyPaymentTransactionId(uid, debt.id, debt, targetPayment)
        if (legacyTxId && legacyTxId !== txId) {
          batch.delete(doc(db, 'users', uid, 'transactions', legacyTxId))
        }
      } catch (err) {
        console.error('Error finding legacy payment transaction to delete:', err)
      }
    }
  }

  await commitFirestoreWrite(batch.commit())
}

export const removeDebtPayment = deleteDebtPayment

export async function updateDebtPayment(
  uid: string,
  debtOrId: string | Debt,
  paymentId: string,
  updatedData: {
    amountFils: number
    date: Date
    note?: string
    title?: string
    syncTransaction?: boolean
    categoryId?: string
  },
  options?: UpdatePaymentOptions
): Promise<void> {
  let debt: Debt
  if (typeof debtOrId === 'string') {
    const docRef = doc(db, 'users', uid, 'debts', debtOrId).withConverter(debtConverter)
    const snap = await safeGetDoc(docRef)
    if (!snap.exists() || !snap.data()) {
      throw new Error('سجل الدين غير موجود')
    }
    debt = snap.data()!
  } else {
    debt = debtOrId
  }

  const payments = debt.payments || []
  const existingPayment = payments.find((p) => p.id === paymentId)
  if (!existingPayment) {
    throw new Error('الدفعة غير موجودة')
  }

  const amount = Math.round(Number(updatedData.amountFils))
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }
  if (amount > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const previousPaymentsSum = payments.reduce((acc, p) => acc + p.amountFils, 0)
  const untrackedPaidFils = Math.max(0, (debt.paidFils || 0) - previousPaymentsSum)

  const otherPaymentsTotal = payments
    .filter((p) => p.id !== paymentId)
    .reduce((sum, p) => sum + p.amountFils, 0)

  const remainingAllowed = Math.max(0, debt.amountFils - (otherPaymentsTotal + untrackedPaidFils))
  if (amount > remainingAllowed) {
    throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
  }

  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const paymentDate = updatedData.date instanceof Date ? updatedData.date : new Date(updatedData.date)
  if (Number.isNaN(debtStartDate.getTime()) || Number.isNaN(paymentDate.getTime())) {
    throw new Error('تاريخ غير صالح')
  }
  const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
  const paymentDay = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate(), 0, 0, 0, 0)
  if (paymentDay < debtStartDay) {
    throw new Error('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
  }

  const defaultPaymentNote = debt.type === 'lent' ? 'دفعة استرداد دين' : 'دفعة سداد دين'
  const finalPaymentNote = (updatedData.note?.trim() || defaultPaymentNote).slice(0, 500)

  const syncTxOption =
    updatedData.syncTransaction !== undefined
      ? updatedData.syncTransaction
      : options?.syncTransaction

  // 1. Look up existing transaction for this payment
  let existingTxId: string | null = null
  let existingTxRef: DocumentReference | null = null

  const candidateIds = [existingPayment.transactionId, `debt_pay_${paymentId}`].filter(Boolean) as string[]
  for (const cId of candidateIds) {
    const candidateRef = doc(db, 'users', uid, 'transactions', cId)
    const snap = await safeGetDoc(candidateRef)
    if (snap.exists()) {
      existingTxId = cId
      existingTxRef = candidateRef
      break
    }
  }

  if (!existingTxRef) {
    const legacyId = await findLegacyPaymentTransactionId(uid, debt.id, debt, existingPayment)
    if (legacyId) {
      const legRef = doc(db, 'users', uid, 'transactions', legacyId)
      const snap = await safeGetDoc(legRef)
      if (snap.exists()) {
        existingTxId = legacyId
        existingTxRef = legRef
      }
    }
  }

  const batch = writeBatch(db)
  let finalTransactionId: string | undefined = existingPayment.transactionId
  let txToDelete: DocumentReference | null = null
  let txToUpdate: {
    ref: DocumentReference
    data: {
      amountFils: number
      date: Timestamp | Date
      note: string
      title?: string
      categoryId?: string
    }
  } | null = null
  let newTxData: {
    ref: DocumentReference
    data: {
      type: TxType
      amountFils: number
      categoryId: string
      date: Timestamp | Date
      title: string
      note: string
      createdAt: ReturnType<typeof serverTimestamp>
    }
  } | null = null

  if (syncTxOption === false) {
    if (existingTxRef) {
      txToDelete = existingTxRef
    }
    finalTransactionId = undefined
  } else if (syncTxOption === true || (syncTxOption === undefined && existingTxRef)) {
    if (existingTxRef) {
      const defaultTitle = (
        debt.type === 'lent'
          ? `استرداد دفعة دين: ${debt.personName}`
          : `سداد دفعة دين: ${debt.personName}`
      ).slice(0, 100)

      const titleUpdate: { title?: string } = {}
      if (updatedData.title !== undefined) {
        const trimmedTitle = updatedData.title.trim()
        titleUpdate.title = trimmedTitle ? trimmedTitle.slice(0, 100) : defaultTitle
      }

      txToUpdate = {
        ref: existingTxRef,
        data: {
          amountFils: amount,
          date: updatedData.date instanceof Date ? Timestamp.fromDate(updatedData.date) : updatedData.date,
          note: finalPaymentNote,
          ...(updatedData.categoryId ? { categoryId: updatedData.categoryId } : {}),
          ...titleUpdate,
        },
      }
      finalTransactionId = existingTxId || existingPayment.transactionId || `debt_pay_${paymentId}`
    } else if (syncTxOption === true) {
      const newTxId = `debt_pay_${paymentId}`
      const newTxRef = doc(db, 'users', uid, 'transactions', newTxId)
      const txType: TxType = debt.type === 'lent' ? 'income' : 'expense'
      const categoryId =
        updatedData.categoryId ||
        options?.categoryId ||
        (await getOrCreateDebtCategory(uid, txType))
      const defaultTitle = (
        debt.type === 'lent'
          ? `استرداد دفعة دين: ${debt.personName}`
          : `سداد دفعة دين: ${debt.personName}`
      ).slice(0, 100)
      const effectiveTitle =
        updatedData.title !== undefined && updatedData.title.trim()
          ? updatedData.title.trim().slice(0, 100)
          : defaultTitle

      newTxData = {
        ref: newTxRef,
        data: {
          type: txType,
          amountFils: amount,
          categoryId,
          date: updatedData.date instanceof Date ? Timestamp.fromDate(updatedData.date) : updatedData.date,
          title: effectiveTitle,
          note: finalPaymentNote,
          createdAt: serverTimestamp(),
        },
      }
      finalTransactionId = newTxId
    }
  } else {
    finalTransactionId = undefined
  }

  const updatedPayments = payments.map((p) => {
    if (p.id !== paymentId) return p
    const item: DebtPayment = {
      ...p,
      amountFils: amount,
      date: updatedData.date,
      note: finalPaymentNote,
      ...(finalTransactionId !== undefined ? { transactionId: finalTransactionId } : {}),
    }
    if (finalTransactionId === undefined) {
      delete item.transactionId
    }
    return item
  })

  const updatedPaymentsTotal = updatedPayments.reduce((sum, p) => sum + p.amountFils, 0)
  const newPaidFils = Math.min(debt.amountFils, untrackedPaidFils + updatedPaymentsTotal)
  const newSettled = newPaidFils === debt.amountFils

  const debtRef = doc(db, 'users', uid, 'debts', debt.id)
  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  if (txToDelete) {
    batch.delete(txToDelete)
  }
  if (txToUpdate) {
    batch.update(txToUpdate.ref, txToUpdate.data)
  }
  if (newTxData) {
    batch.set(newTxData.ref, newTxData.data)
  }

  await commitFirestoreWrite(batch.commit())
}
