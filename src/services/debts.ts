import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
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
  return item
}

export async function updateDebt(
  uid: string,
  id: string,
  data: Partial<Omit<Debt, 'id' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'debts', id)
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
  if (data.paidFils !== undefined) {
    updates.paidFils = Math.round(Number(data.paidFils))
  }
  if (data.payments !== undefined) {
    updates.payments = data.payments.map(serializePayment)
  }

  if (data.amountFils !== undefined || data.paidFils !== undefined) {
    const snap = await getDoc(docRef)
    const existing = snap.data()
    const origAmount = existing?.amountFils ? Math.round(Number(existing.amountFils)) : 0
    const origPaid = existing?.paidFils ? Math.round(Number(existing.paidFils)) : 0

    const finalAmountFils = data.amountFils !== undefined ? Math.round(Number(data.amountFils)) : origAmount
    const rawPaid = data.paidFils !== undefined ? Math.round(Number(data.paidFils)) : origPaid
    const finalPaidFils = Math.max(0, Math.min(finalAmountFils, rawPaid))

    updates.amountFils = finalAmountFils
    updates.paidFils = finalPaidFils
    updates.settled = finalPaidFils >= finalAmountFils
  } else if (data.settled !== undefined) {
    updates.settled = Boolean(data.settled)
  }

  await updateDoc(docRef, updates)

  // Synchronize with transactions/debt_init_${id} if it exists
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
  const initTxSnap = await getDoc(initTxRef)
  if (initTxSnap.exists()) {
    const txUpdates: Record<string, unknown> = {}
    if (data.amountFils !== undefined) {
      txUpdates.amountFils = Math.round(Number(data.amountFils))
    }
    if (data.startDate !== undefined) {
      txUpdates.date = data.startDate instanceof Date ? Timestamp.fromDate(data.startDate) : data.startDate
    }
    if (data.personName !== undefined || data.type !== undefined) {
      const debtSnap = await getDoc(docRef)
      const currentDebt = debtSnap.data()
      const name = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''
      const debtType = data.type || currentDebt?.type || 'lent'
      txUpdates.title = (debtType === 'lent' ? `إقراض: ${name}` : `اقتراض من: ${name}`).slice(0, 100)
      if (data.type !== undefined) {
        txUpdates.type = data.type === 'lent' ? 'expense' : 'income'
      }
    }
    if (Object.keys(txUpdates).length > 0) {
      await updateDoc(initTxRef, txUpdates)
    }
  }

  // Synchronize all associated payment transactions debt_pay_${payment.id} if personName or type changed
  if (data.personName !== undefined || data.type !== undefined) {
    const debtSnap = await getDoc(docRef)
    const currentDebt = debtSnap.data()
    const name = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''
    const debtType = data.type || currentDebt?.type || 'lent'
    const payments: DebtPayment[] = currentDebt?.payments || []

    for (const p of payments) {
      if (p.id) {
        const payTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${p.id}`)
        const payTxSnap = await getDoc(payTxRef)
        if (payTxSnap.exists()) {
          const payTxUpdates: Record<string, unknown> = {
            title: (debtType === 'lent' ? `استرداد دفعة دين: ${name}` : `سداد دفعة دين: ${name}`).slice(0, 100),
          }
          if (data.type !== undefined) {
            payTxUpdates.type = debtType === 'lent' ? 'income' : 'expense'
          }
          await updateDoc(payTxRef, payTxUpdates)
        }
      }
    }
  }
}

export async function deleteDebt(uid: string, id: string): Promise<void> {
  const debtRef = doc(db, 'users', uid, 'debts', id)
  const snap = await getDoc(debtRef)
  const debt = snap.data()
  const payments: DebtPayment[] = debt?.payments || []

  const batch = writeBatch(db)
  batch.delete(debtRef)

  // Synchronize: Delete initial transaction
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
  batch.delete(initTxRef)

  // Synchronize: Delete all payment transactions
  for (const p of payments) {
    if (p.id) {
      const payTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${p.id}`)
      batch.delete(payTxRef)
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
  const amount = Math.round(Number(payment.amountFils))
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }

  const remaining = Math.max(0, debt.amountFils - (debt.paidFils || 0))
  if (amount > remaining) {
    throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
  }

  const paymentId = generatePaymentId()
  const defaultPaymentNote = debt.type === 'lent' ? 'دفعة استرداد دين' : 'دفعة سداد دين'
  const finalPaymentNote = (payment.note?.trim() || defaultPaymentNote).slice(0, 500)

  const newPayment: DebtPayment = {
    id: paymentId,
    amountFils: amount,
    date: payment.date,
    note: finalPaymentNote,
    createdAt: new Date(),
  }

  const updatedPayments = [...(debt.payments || []), newPayment]
  const newPaidFils = (debt.paidFils || 0) + amount
  const newSettled = newPaidFils >= debt.amountFils

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

    const txRef = doc(db, 'users', uid, 'transactions', `debt_pay_${paymentId}`)
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

export async function deleteDebtPayment(
  uid: string,
  debt: Debt,
  paymentId: string
): Promise<void> {
  const updatedPayments = (debt.payments || []).filter((p) => p.id !== paymentId)
  const newPaidFils = updatedPayments.reduce((sum, p) => sum + p.amountFils, 0)
  const newSettled = newPaidFils >= debt.amountFils

  const batch = writeBatch(db)
  const debtRef = doc(db, 'users', uid, 'debts', debt.id)

  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  // Synchronize: Delete payment transaction if it exists
  const payTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${paymentId}`)
  batch.delete(payTxRef)

  await batch.commit()
}

export async function getAllDebts(uid: string): Promise<Debt[]> {
  const colRef = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const q = query(colRef, orderBy('startDate', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}
