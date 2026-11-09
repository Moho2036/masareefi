import {
  collection,
  doc,
  setDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Debt, DebtPayment, DebtEntry, TxType } from '../../types'
import { categoryConverter } from '../converters'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../../lib/firestoreOffline'

/**
 * Resolves or creates a suitable category for debt transactions.
 * Expense: looks for 'الديون والسلف' or 'سداد الديون والأقساط', then 'أخرى', otherwise creates 'الديون والسلف'.
 * Income: looks for 'الديون والسلف' or 'سداد الديون والأقساط', then 'أخرى', otherwise creates 'الديون والسلف'.
 */
export async function getOrCreateDebtCategory(
  uid: string,
  type: TxType
): Promise<string> {
  const colRef = collection(db, 'users', uid, 'categories').withConverter(categoryConverter)
  const snap = await safeGetDocs(colRef)
  const categories = snap.docs.map((d) => d.data())

  if (type === 'expense') {
    const debtCat = categories.find(
      (c) => c.type === 'expense' && !c.archived && (c.name === 'الديون والسلف' || c.name === 'سداد الديون والأقساط')
    )
    if (debtCat) return debtCat.id

    const otherCat = categories.find(
      (c) => c.type === 'expense' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    try {
      const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
      await commitFirestoreWrite(setDoc(newDocRef, {
        id: '',
        name: 'الديون والسلف',
        type: 'expense',
        icon: '💳',
        color: '#D97706',
        archived: false,
        order: 0,
      }))
      return newDocRef.id
    } catch (err) {
      console.error('Failed to create expense debt category:', err)
      const anyCat = categories.find((c) => c.type === 'expense' && !c.archived)
      if (anyCat) return anyCat.id
      throw err
    }
  } else {
    const debtCat = categories.find(
      (c) => c.type === 'income' && !c.archived && (c.name === 'الديون والسلف' || c.name === 'سداد الديون والأقساط')
    )
    if (debtCat) return debtCat.id

    const otherCat = categories.find(
      (c) => c.type === 'income' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    try {
      const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
      await commitFirestoreWrite(setDoc(newDocRef, {
        id: '',
        name: 'الديون والسلف',
        type: 'income',
        icon: '💳',
        color: '#10B981',
        archived: false,
        order: 0,
      }))
      return newDocRef.id
    } catch (err) {
      console.error('Failed to create income debt category:', err)
      const anyCat = categories.find((c) => c.type === 'income' && !c.archived)
      if (anyCat) return anyCat.id
      throw err
    }
  }
}

export interface AddDebtOptions {
  syncTransaction?: boolean
  initialPaidFils?: number
  initialPaymentNote?: string
}

export function toTimestamp(d: unknown): Timestamp {
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

export function serializePayment(p: DebtPayment): Record<string, unknown> {
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
  if (p.isMerged) {
    item.isMerged = true
  }
  if (Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.length > 0) {
    item.mergedTransactionIds = p.mergedTransactionIds.filter(Boolean)
  }
  return item
}

export function serializeDebtEntry(e: DebtEntry): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: e.id,
    amountFils: Math.round(Number(e.amountFils)),
    date: toTimestamp(e.date),
    note: typeof e.note === 'string' ? e.note.slice(0, 500) : '',
    createdAt: toTimestamp(e.createdAt),
  }
  if (e.title && typeof e.title === 'string' && e.title.trim()) {
    item.title = e.title.trim().slice(0, 100)
  }
  if (e.transactionId && typeof e.transactionId === 'string' && e.transactionId.trim()) {
    item.transactionId = e.transactionId.trim().slice(0, 128)
  }
  if (e.isMerged) {
    item.isMerged = true
  }
  if (Array.isArray(e.mergedTransactionIds) && e.mergedTransactionIds.length > 0) {
    item.mergedTransactionIds = e.mergedTransactionIds.filter(Boolean)
  }
  return item
}

export async function findLegacyInitTransactionId(
  uid: string,
  _debtId: string,
  debt: Debt
): Promise<string | null> {
  try {
    const txColRef = collection(db, 'users', uid, 'transactions')
    const q = query(txColRef, where('amountFils', '==', debt.amountFils))
    const snap = await safeGetDocs(q)
    if (!snap || !snap.docs || snap.docs.length === 0) return null

    const dDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
    const dTime = dDate.getTime()

    for (const d of snap.docs) {
      if (
        typeof d?.id === 'string' &&
        (d.id.startsWith('debt_pay_') ||
          d.id.startsWith('debt_entry_') ||
          (d.id.startsWith('debt_init_') && d.id !== 'debt_init_' + _debtId))
      ) {
        continue
      }
      const tx = typeof d?.data === 'function' ? d.data() : (d as unknown as Record<string, unknown>)
      if (!tx || Boolean(tx.recurringId)) continue
      const expectedType = debt.type === 'lent' ? 'expense' : 'income'
      if (tx.type !== expectedType) continue
      const txDate =
        tx.date && typeof (tx.date as { toDate?: unknown }).toDate === 'function'
          ? (tx.date as { toDate: () => Date }).toDate()
          : new Date(tx.date as string | number | Date)
      const dayDiff = Math.abs(txDate.getTime() - dTime)
      const isSameDay = dayDiff < 24 * 60 * 60 * 1000

      const titleMatches =
        typeof tx.title === 'string' &&
        (tx.title.includes(debt.personName) ||
          tx.title.includes('إقراض') ||
          tx.title.includes('اقتراض') ||
          tx.title.includes('دين'))

      if (isSameDay && titleMatches) {
        return d.id
      }
    }
  } catch (err) {
    console.error('Error querying legacy init transaction:', err)
  }
  return null
}

export async function checkDebtInitialTransactionExists(
  uid: string,
  debtId: string,
  debt?: Debt
): Promise<boolean> {
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${debtId}`)
  const snap = await safeGetDoc(initTxRef)
  if (snap && typeof snap.exists === 'function' && snap.exists()) return true
  if (debt) {
    const legacyId = await findLegacyInitTransactionId(uid, debtId, debt)
    return Boolean(legacyId)
  }
  return false
}

export async function checkDebtPaymentTransactionExists(
  uid: string,
  debt: Debt,
  payment: DebtPayment
): Promise<boolean> {
  if (payment.transactionId) {
    const txRef = doc(db, 'users', uid, 'transactions', payment.transactionId)
    const snap = await safeGetDoc(txRef)
    if (snap && typeof snap.exists === 'function' && snap.exists()) return true
  }
  const defaultPayTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${payment.id}`)
  const defaultSnap = await safeGetDoc(defaultPayTxRef)
  if (defaultSnap && typeof defaultSnap.exists === 'function' && defaultSnap.exists()) return true

  const legacyId = await findLegacyPaymentTransactionId(uid, payment, debt)
  return Boolean(legacyId)
}

export function generatePaymentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface AddPaymentOptions {
  syncTransaction?: boolean
}

export async function findLegacyPaymentTransactionId(
  uid: string,
  debtIdOrPayment: string | DebtPayment,
  debtOrCurrentDebt: Debt,
  paymentParam?: DebtPayment
): Promise<string | null> {
  try {
    const debt = debtOrCurrentDebt
    const payment = typeof debtIdOrPayment === 'string' ? paymentParam! : debtIdOrPayment
    if (!payment) return null

    const otherPaymentTxIds = new Set<string>()
    for (const otherP of debt.payments || []) {
      if (otherP.id !== payment.id) {
        if (otherP.transactionId) otherPaymentTxIds.add(otherP.transactionId)
        otherPaymentTxIds.add(`debt_pay_${otherP.id}`)
        if (Array.isArray(otherP.mergedTransactionIds)) {
          for (const mId of otherP.mergedTransactionIds) {
            if (mId) otherPaymentTxIds.add(mId)
          }
        }
      }
    }

    const txColRef = collection(db, 'users', uid, 'transactions')
    const q = query(txColRef, where('amountFils', '==', payment.amountFils))
    const snap = await safeGetDocs(q)
    if (!snap || !snap.docs || snap.docs.length === 0) return null

    const pDate = payment.date instanceof Date ? payment.date : new Date(payment.date)
    const pTime = pDate.getTime()

    for (const d of snap.docs) {
      if (
        typeof d?.id === 'string' &&
        (d.id.startsWith('debt_init_') ||
          d.id.startsWith('debt_entry_') ||
          otherPaymentTxIds.has(d.id) ||
          (d.id.startsWith('debt_pay_') && d.id !== `debt_pay_${payment.id}`))
      ) {
        continue
      }
      const tx = typeof d?.data === 'function' ? d.data() : (d as unknown as Record<string, unknown>)
      if (!tx || Boolean(tx.recurringId)) continue
      const expectedType = debt.type === 'lent' ? 'income' : 'expense'
      if (tx.type !== expectedType) continue

      const txDate =
        tx.date && typeof (tx.date as { toDate?: unknown }).toDate === 'function'
          ? (tx.date as { toDate: () => Date }).toDate()
          : new Date(tx.date as string | number | Date)
      const dayDiff = Math.abs(txDate.getTime() - pTime)
      const isSameDay = dayDiff < 24 * 60 * 60 * 1000

      const titleMatches =
        typeof tx.title === 'string' &&
        (tx.title.includes(debt.personName) ||
          tx.title.includes('دين') ||
          tx.title.includes('سداد') ||
          tx.title.includes('تحصيل') ||
          tx.title.includes('استرداد'))

      if (isSameDay && titleMatches) {
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

export interface UpdatePaymentOptions {
  syncTransaction?: boolean
  categoryId?: string
}

export interface CompactDebtPaymentsResult {
  mergedCount: number
  mergedAmountFils: number
}

export interface CompactDebtEntriesResult {
  mergedCount: number
  mergedAmountFils: number
}
