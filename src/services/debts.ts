import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Debt, DebtPayment, TxType } from '../types'
import { debtConverter, categoryConverter } from './converters'

export function subscribeDebts(
  uid: string,
  cb: (debts: Debt[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const q = query(colRef, orderBy('startDate', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      cb(items)
    },
    (err) => {
      console.error('subscribeDebts error:', err)
      onError?.(err)
    }
  )
}

/**
 * Resolves or creates a suitable category for debt transactions.
 * Expense: looks for 'سداد الديون والأقساط', then 'أخرى', then any expense category.
 * Income: looks for 'أخرى', then any income category.
 */
export async function getOrCreateDebtCategory(
  uid: string,
  type: TxType
): Promise<string> {
  const colRef = collection(db, 'users', uid, 'categories').withConverter(categoryConverter)
  const snap = await getDocs(colRef)
  const categories = snap.docs.map((d) => d.data())

  if (type === 'expense') {
    const debtCat = categories.find(
      (c) => c.type === 'expense' && !c.archived && c.name === 'سداد الديون والأقساط'
    )
    if (debtCat) return debtCat.id

    const otherCat = categories.find(
      (c) => c.type === 'expense' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    const anyCat = categories.find((c) => c.type === 'expense' && !c.archived)
    if (anyCat) return anyCat.id

    const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
    await setDoc(newDocRef, {
      id: '',
      name: 'سداد الديون والأقساط',
      type: 'expense',
      icon: '💳',
      color: '#D97706',
      archived: false,
      order: 0,
    })
    return newDocRef.id
  } else {
    const otherCat = categories.find(
      (c) => c.type === 'income' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    const anyCat = categories.find((c) => c.type === 'income' && !c.archived)
    if (anyCat) return anyCat.id

    const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
    await setDoc(newDocRef, {
      id: '',
      name: 'أخرى',
      type: 'income',
      icon: '➕',
      color: '#64748B',
      archived: false,
      order: 0,
    })
    return newDocRef.id
  }
}

export interface AddDebtOptions {
  syncTransaction?: boolean
}

export async function addDebt(
  uid: string,
  debt: Omit<Debt, 'id' | 'paidFils' | 'settled' | 'payments' | 'createdAt'>,
  options?: AddDebtOptions
): Promise<string> {
  const personName = (debt.personName || '').trim()
  if (!personName || personName.length > 100) {
    throw new Error('اسم الشخص مطلوب ويجب ألا يتجاوز 100 حرف')
  }

  if (!Number.isInteger(debt.amountFils) || debt.amountFils <= 0) {
    throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }

  const debtsCol = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const debtDocRef = doc(debtsCol)
  const debtId = debtDocRef.id

  const defaultDebtNote = debt.type === 'lent' ? 'دين مستحق (لي)' : 'دين مستحق (عليّ)'
  const finalDebtNote = (typeof debt.note === 'string' && debt.note.trim() ? debt.note.trim() : defaultDebtNote).slice(0, 500)

  const debtData = {
    id: debtId,
    personName,
    type: debt.type,
    amountFils: debt.amountFils,
    paidFils: 0,
    settled: false,
    startDate: debt.startDate,
    dueDate: debt.dueDate ?? null,
    note: finalDebtNote,
    payments: [],
    createdAt: new Date(),
  }

  const batch = writeBatch(db)
  batch.set(debtDocRef, debtData)

  if (options?.syncTransaction) {
    const txType: TxType = debt.type === 'lent' ? 'expense' : 'income'
    const categoryId = await getOrCreateDebtCategory(uid, txType)
    const txRef = doc(db, 'users', uid, 'transactions', `debt_init_${debtId}`)
    const title = (debt.type === 'lent' ? `إقراض: ${personName}` : `اقتراض من: ${personName}`).slice(0, 100)

    const txData: Record<string, unknown> = {
      type: txType,
      amountFils: debt.amountFils,
      categoryId,
      date: debt.startDate instanceof Date ? Timestamp.fromDate(debt.startDate) : debt.startDate,
      title,
      note: finalDebtNote,
      createdAt: serverTimestamp(),
    }
    batch.set(txRef, txData)
  }

  await batch.commit()
  return debtId
}

function toTimestamp(d: unknown): Timestamp {
  if (typeof Timestamp === 'function' && d instanceof Timestamp) return d
  if (d instanceof Date) return Timestamp.fromDate(d)
  if (
    d &&
    typeof d === 'object' &&
    'toDate' in d &&
    typeof (d as { toDate: () => Date }).toDate === 'function'
  ) {
    return Timestamp.fromDate((d as { toDate: () => Date }).toDate())
  }
  if (d && typeof d === 'object' && 'seconds' in d) {
    return d as Timestamp
  }
  return Timestamp.fromDate(new Date())
}

function serializePayment(p: DebtPayment): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: p.id,
    amountFils: Math.round(Number(p.amountFils)),
    date: toTimestamp(p.date),
    createdAt: toTimestamp(p.createdAt),
  }
  if (p.note && typeof p.note === 'string' && p.note.trim()) {
    item.note = p.note.trim().slice(0, 500)
  } else {
    item.note = 'دفعة سداد'
  }
  if (p.transactionId && typeof p.transactionId === 'string' && p.transactionId.trim()) {
    item.transactionId = p.transactionId.trim()
  }
  return item
}

export async function checkDebtInitialTransactionExists(
  uid: string,
  debtId: string
): Promise<boolean> {
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${debtId}`)
  const snap = await getDoc(initTxRef)
  return Boolean(snap && typeof snap.exists === 'function' && snap.exists())
}

export async function updateDebt(
  uid: string,
  id: string,
  data: Partial<Omit<Debt, 'id' | 'createdAt'>>,
  options?: { syncTransaction?: boolean }
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'debts', id)
  const debtSnap = await getDoc(docRef)
  if (debtSnap && typeof debtSnap.exists === 'function' && !debtSnap.exists()) {
    throw new Error('الدين غير موجود')
  }
  const currentDebt = debtSnap.data()
  const currentPaidFils = currentDebt?.paidFils ? Math.round(Number(currentDebt.paidFils)) : 0
  const currentAmountFils = currentDebt?.amountFils ? Math.round(Number(currentDebt.amountFils)) : 0

  const effectivePaidFils = data.paidFils !== undefined ? Math.round(Number(data.paidFils)) : currentPaidFils
  const effectiveAmountFils = data.amountFils !== undefined ? Math.round(Number(data.amountFils)) : currentAmountFils

  if (data.amountFils !== undefined) {
    if (effectiveAmountFils < currentPaidFils) {
      throw new Error('لا يمكن أن يكون إجمالي الدين أقل من المبلغ المسدد بالفعل')
    }
  }

  const updates: Record<string, unknown> = {}

  if (data.personName !== undefined) {
    updates.personName = data.personName.trim().slice(0, 100)
  }
  if (data.type !== undefined) {
    updates.type = data.type
  }
  if (data.startDate !== undefined) {
    updates.startDate = data.startDate instanceof Date ? Timestamp.fromDate(data.startDate) : data.startDate
  }
  if (data.dueDate !== undefined) {
    updates.dueDate = data.dueDate ? (data.dueDate instanceof Date ? Timestamp.fromDate(data.dueDate) : data.dueDate) : null
  }
  if (data.note !== undefined) {
    updates.note = data.note.slice(0, 500)
  }
  if (data.amountFils !== undefined) {
    updates.amountFils = effectiveAmountFils
  }
  if (data.paidFils !== undefined) {
    updates.paidFils = effectivePaidFils
  }
  if (data.payments !== undefined) {
    updates.payments = data.payments.map(serializePayment)
  }

  // Always compute settled to satisfy firestore.rules:
  // data.settled == (data.paidFils == data.amountFils)
  const settled = effectivePaidFils === effectiveAmountFils
  updates.settled = settled

  const batch = writeBatch(db)
  batch.update(docRef, updates)

  // Synchronize with transactions/debt_init_${id}
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
  const initTxSnap = await getDoc(initTxRef)
  const initTxExists = Boolean(initTxSnap && typeof initTxSnap.exists === 'function' && initTxSnap.exists())

  if (options?.syncTransaction === false) {
    if (initTxExists) {
      batch.delete(initTxRef)
    }
    const payments: DebtPayment[] = currentDebt?.payments || []
    for (const p of payments) {
      if (p.id) {
        const payTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${p.id}`)
        batch.delete(payTxRef)
      }
    }
  } else if (initTxExists) {
    const txUpdates: Record<string, unknown> = {}
    if (data.amountFils !== undefined) {
      txUpdates.amountFils = Math.round(Number(data.amountFils))
    }
    if (data.startDate !== undefined) {
      txUpdates.date = data.startDate instanceof Date ? Timestamp.fromDate(data.startDate) : data.startDate
    }
    if (data.note !== undefined) {
      txUpdates.note = data.note.slice(0, 500)
    }

    const effectiveType = data.type !== undefined ? data.type : (currentDebt?.type || 'lent')
    const name = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''

    if (data.personName !== undefined || data.type !== undefined) {
      txUpdates.title = (effectiveType === 'lent' ? `إقراض: ${name}` : `اقتراض من: ${name}`).slice(0, 100)
    }

    if (data.type !== undefined && data.type !== currentDebt?.type) {
      const newTxType: TxType = effectiveType === 'lent' ? 'expense' : 'income'
      const newCategoryId = await getOrCreateDebtCategory(uid, newTxType)
      txUpdates.type = newTxType
      txUpdates.categoryId = newCategoryId
    }

    if (Object.keys(txUpdates).length > 0) {
      batch.update(initTxRef, txUpdates)
    }
  } else if (options?.syncTransaction === true) {
    // Transaction did not exist, but user enabled sync to link debt to balance
    const effectiveType = data.type !== undefined ? data.type : (currentDebt?.type || 'lent')
    const newTxType: TxType = effectiveType === 'lent' ? 'expense' : 'income'
    const newCategoryId = await getOrCreateDebtCategory(uid, newTxType)
    const name = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''
    const dateVal =
      data.startDate !== undefined ? toTimestamp(data.startDate) : toTimestamp(currentDebt?.startDate)
    const noteVal = (data.note !== undefined ? data.note : currentDebt?.note) || ''

    batch.set(initTxRef, {
      type: newTxType,
      amountFils: effectiveAmountFils,
      categoryId: newCategoryId,
      title: (effectiveType === 'lent' ? `إقراض: ${name}` : `اقتراض من: ${name}`).slice(0, 100),
      note: noteVal.slice(0, 500),
      date: dateVal,
      createdAt: serverTimestamp(),
    })
  }

  // Synchronize all associated payment transactions debt_pay_${payment.id} if personName or type actually changed
  const nameChanged = data.personName !== undefined && data.personName.trim() !== currentDebt?.personName
  const typeChanged = data.type !== undefined && data.type !== currentDebt?.type

  if (nameChanged || typeChanged) {
    const effectiveType = data.type !== undefined ? data.type : (currentDebt?.type || 'lent')
    const name = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''
    const payments: DebtPayment[] = currentDebt?.payments || []

    let newPayCatId: string | undefined
    if (payments.length > 0 && typeChanged) {
      const payTxType: TxType = effectiveType === 'lent' ? 'income' : 'expense'
      newPayCatId = await getOrCreateDebtCategory(uid, payTxType)
    }

    const validPayments = payments.filter((p) => Boolean(p.id))
    const paymentRefs = validPayments.map((p) => doc(db, 'users', uid, 'transactions', `debt_pay_${p.id}`))
    const paySnaps = await Promise.all(paymentRefs.map((ref) => getDoc(ref)))

    for (let i = 0; i < validPayments.length; i++) {
      const payTxSnap = paySnaps[i]
      const payTxRef = paymentRefs[i]
      if (payTxSnap && typeof payTxSnap.exists === 'function' && payTxSnap.exists()) {
        const payTxUpdates: Record<string, unknown> = {
          title: (effectiveType === 'lent' ? `استرداد دفعة دين: ${name}` : `سداد دفعة دين: ${name}`).slice(0, 100),
        }
        if (typeChanged) {
          payTxUpdates.type = effectiveType === 'lent' ? 'income' : 'expense'
          if (newPayCatId) {
            payTxUpdates.categoryId = newPayCatId
          }
        }
        batch.update(payTxRef, payTxUpdates)
      }
    }
  }

  await batch.commit()
}

export async function deleteDebt(
  uid: string,
  id: string,
  options?: { deleteTransactions?: boolean }
): Promise<void> {
  const debtRef = doc(db, 'users', uid, 'debts', id)
  const snap = await getDoc(debtRef)
  const debt = snap.data()
  const payments: DebtPayment[] = debt?.payments || []

  const batch = writeBatch(db)
  batch.delete(debtRef)

  const shouldDeleteTransactions = options?.deleteTransactions ?? true

  if (shouldDeleteTransactions) {
    // Synchronize: Delete initial transaction
    const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
    batch.delete(initTxRef)

    // Synchronize: Delete all payment transactions
    for (const p of payments) {
      if (p.transactionId) {
        batch.delete(doc(db, 'users', uid, 'transactions', p.transactionId))
      }
      if (p.id && p.id !== p.transactionId) {
        const payTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${p.id}`)
        batch.delete(payTxRef)
      }
    }
  }

  await batch.commit()
}

function generatePaymentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface AddPaymentOptions {
  syncTransaction?: boolean
}

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

  const remaining = Math.max(0, debt.amountFils - (debt.paidFils || 0))
  if (amount > remaining) {
    throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
  }

  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date)
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

  await batch.commit()
  return paymentId
}

async function findLegacyPaymentTransactionId(
  uid: string,
  payment: DebtPayment,
  debt: Debt
): Promise<string | null> {
  try {
    const txColRef = collection(db, 'users', uid, 'transactions')
    const q = query(txColRef, where('amountFils', '==', payment.amountFils))
    const snap = await getDocs(q)
    if (!snap || !snap.docs || snap.docs.length === 0) return null

    const pDate = payment.date instanceof Date ? payment.date : new Date(payment.date)
    const pTime = pDate.getTime()

    for (const d of snap.docs) {
      const tx = d.data()
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date)
      const dayDiff = Math.abs(txDate.getTime() - pTime)
      const isSameDay = dayDiff < 24 * 60 * 60 * 1000

      const titleMatches =
        typeof tx.title === 'string' &&
        (tx.title.includes(debt.personName) ||
          tx.title.includes('دين') ||
          tx.title.includes('سداد') ||
          tx.title.includes('استرداد'))

      const noteMatches =
        payment.note && typeof tx.note === 'string' && tx.note.includes(payment.note)

      if (isSameDay && (titleMatches || noteMatches)) {
        return d.id
      }
    }
  } catch (err) {
    console.error('Error querying legacy payment transaction:', err)
  }
  return null
}

export interface DeletePaymentOptions {
  deleteTransaction?: boolean
}

export async function deleteDebtPayment(
  uid: string,
  debt: Debt,
  paymentId: string,
  options?: DeletePaymentOptions
): Promise<void> {
  const targetPayment = (debt.payments || []).find((p) => p.id === paymentId)
  const updatedPayments = (debt.payments || []).filter((p) => p.id !== paymentId)
  const newPaidFils = updatedPayments.reduce((sum, p) => sum + p.amountFils, 0)
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
    const txId = targetPayment?.transactionId || `debt_pay_${paymentId}`
    const payTxRef = doc(db, 'users', uid, 'transactions', txId)
    batch.delete(payTxRef)

    // Legacy fallback: if targetPayment had no transactionId and deterministic doc might not match,
    // search by note/title/amount/date
    if (!targetPayment?.transactionId && targetPayment) {
      try {
        const legacyTxId = await findLegacyPaymentTransactionId(uid, targetPayment, debt)
        if (legacyTxId && legacyTxId !== txId) {
          batch.delete(doc(db, 'users', uid, 'transactions', legacyTxId))
        }
      } catch (err) {
        console.error('Error finding legacy payment transaction to delete:', err)
      }
    }
  }

  await batch.commit()
}

export async function updateDebtPayment(
  uid: string,
  debt: Debt,
  paymentId: string,
  updatedData: { amountFils: number; date: Date; note?: string }
): Promise<void> {
  const payments = debt.payments || []
  const existingPayment = payments.find((p) => p.id === paymentId)
  if (!existingPayment) {
    throw new Error('الدفعة غير موجودة')
  }

  const amount = Math.round(Number(updatedData.amountFils))
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }

  const otherPaymentsTotal = payments
    .filter((p) => p.id !== paymentId)
    .reduce((sum, p) => sum + p.amountFils, 0)

  const remainingAllowed = Math.max(0, debt.amountFils - otherPaymentsTotal)
  if (amount > remainingAllowed) {
    throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
  }

  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const paymentDate = updatedData.date instanceof Date ? updatedData.date : new Date(updatedData.date)
  const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
  const paymentDay = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate(), 0, 0, 0, 0)
  if (paymentDay < debtStartDay) {
    throw new Error('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
  }

  const defaultPaymentNote = debt.type === 'lent' ? 'دفعة استرداد دين' : 'دفعة سداد دين'
  const finalPaymentNote = (updatedData.note?.trim() || defaultPaymentNote).slice(0, 500)

  const updatedPayments = payments.map((p) => {
    if (p.id !== paymentId) return p
    return {
      ...p,
      amountFils: amount,
      date: updatedData.date,
      note: finalPaymentNote,
    }
  })

  const newPaidFils = updatedPayments.reduce((sum, p) => sum + p.amountFils, 0)
  const newSettled = newPaidFils === debt.amountFils

  const batch = writeBatch(db)
  const debtRef = doc(db, 'users', uid, 'debts', debt.id)

  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  // Synchronize payment transaction if it exists in transactions
  const txId = existingPayment.transactionId || `debt_pay_${paymentId}`
  const payTxRef = doc(db, 'users', uid, 'transactions', txId)
  const payTxSnap = await getDoc(payTxRef)
  if (payTxSnap && typeof payTxSnap.exists === 'function' && payTxSnap.exists()) {
    batch.update(payTxRef, {
      amountFils: amount,
      date: updatedData.date instanceof Date ? Timestamp.fromDate(updatedData.date) : updatedData.date,
      note: finalPaymentNote,
    })
  }

  await batch.commit()
}

export async function getAllDebts(uid: string): Promise<Debt[]> {
  const colRef = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const q = query(colRef, orderBy('startDate', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}
