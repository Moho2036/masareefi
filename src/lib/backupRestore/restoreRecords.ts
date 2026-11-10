import { doc } from 'firebase/firestore'
import { db } from '../firebase'
import type {
  Transaction,
  Debt,
  Recurring,
  MoneyCircle,
} from '../../types'
import {
  transactionConverter,
  debtConverter,
  recurringConverter,
  circleConverter,
} from '../../services/converters'
import { MAX_AMOUNT_FILS } from '../money'
import {
  parseDate,
  sanitizeDebt,
  sanitizeRecurring,
} from './typesAndValidation'
import type { BatchOp } from './restoreSettingsAndCategories'

export function enqueueTransactionsRestore(
  uid: string,
  transactions: Transaction[],
  categoryIdRemap: Map<string, string>,
  ops: BatchOp[]
): void {
  for (const tx of transactions) {
    if (!tx.id) continue
    const amountFils = Math.min(MAX_AMOUNT_FILS, Math.round(Number(tx.amountFils || 0)))
    if (amountFils <= 0) continue

    const txRef = doc(db, 'users', uid, 'transactions', tx.id).withConverter(transactionConverter)
    const title = typeof tx.title === 'string' && tx.title.trim() ? tx.title.trim().slice(0, 100) : undefined
    const recurringId = typeof tx.recurringId === 'string' && tx.recurringId.trim() ? tx.recurringId.trim().slice(0, 128) : undefined

    const rawCatId = tx.categoryId || ''
    const finalCatId = categoryIdRemap.get(rawCatId) || rawCatId

    const txData: Transaction = {
      id: tx.id,
      type: tx.type === 'income' ? 'income' : 'expense',
      amountFils,
      categoryId: finalCatId,
      date: parseDate(tx.date),
      note: typeof tx.note === 'string' ? tx.note.slice(0, 500) : '',
      createdAt: tx.createdAt ? parseDate(tx.createdAt) : new Date(),
      ...(title !== undefined ? { title } : {}),
      ...(recurringId !== undefined ? { recurringId } : {}),
    }
    ops.push((b) => b.set(txRef, txData))
  }
}

export function enqueueDebtsRestore(
  uid: string,
  debts: Debt[],
  ops: BatchOp[]
): void {
  for (const raw of debts) {
    const debtData = sanitizeDebt(raw)
    if (!debtData) continue
    const debtRef = doc(db, 'users', uid, 'debts', debtData.id).withConverter(debtConverter)
    ops.push((b) => b.set(debtRef, debtData))
  }
}

export function enqueueRecurringRestore(
  uid: string,
  recurring: Recurring[],
  categoryIdRemap: Map<string, string>,
  ops: BatchOp[]
): void {
  for (const raw of recurring) {
    const recData = sanitizeRecurring(raw, categoryIdRemap)
    if (!recData) continue
    const recRef = doc(db, 'users', uid, 'recurring', recData.id).withConverter(recurringConverter)
    ops.push((b) => b.set(recRef, recData))
  }
}

export function enqueueCirclesRestore(
  uid: string,
  circles: MoneyCircle[],
  categoryIdRemap: Map<string, string>,
  ops: BatchOp[]
): void {
  for (const c of circles) {
    if (!c.id) continue
    const monthlyAmountFils = Math.min(MAX_AMOUNT_FILS, Math.round(Number(c.monthlyAmountFils || 0)))
    if (monthlyAmountFils <= 0) continue

    const membersCount = Math.max(2, Math.min(50, Math.round(Number(c.membersCount || 2))))
    const totalAmountFils = Math.min(MAX_AMOUNT_FILS, monthlyAmountFils * membersCount)
    if (totalAmountFils <= 0) continue

    const circleRef = doc(db, 'users', uid, 'circles', c.id).withConverter(circleConverter)
    const recurringId = typeof c.recurringId === 'string' && c.recurringId.trim() ? c.recurringId.trim().slice(0, 128) : undefined
    const myTurnMonth = Math.max(1, Math.min(membersCount, Math.round(Number(c.myTurnMonth || 1))))

    const members = (c.members || []).slice(0, 50).map((m) => {
      let cleanedPaymentsByMonth: Record<string, boolean> | undefined = undefined
      if (m.paymentsByMonth && typeof m.paymentsByMonth === 'object' && !Array.isArray(m.paymentsByMonth)) {
        cleanedPaymentsByMonth = {}
        for (const [key, val] of Object.entries(m.paymentsByMonth)) {
          if (typeof val === 'boolean') {
            cleanedPaymentsByMonth[key] = val
          }
        }
      }
      return {
        id: m.id,
        name: (m.name || '').trim().slice(0, 50),
        turnMonth: Math.round(m.turnMonth),
        paidMonths: (m.paidMonths || []).map(Number),
        ...(cleanedPaymentsByMonth && Object.keys(cleanedPaymentsByMonth).length > 0
          ? { paymentsByMonth: cleanedPaymentsByMonth }
          : {}),
      }
    })

    const expenseCategoryId = typeof c.expenseCategoryId === 'string' && c.expenseCategoryId.trim()
      ? (categoryIdRemap.get(c.expenseCategoryId.trim()) || c.expenseCategoryId.trim())
      : undefined
    const incomeCategoryId = typeof c.incomeCategoryId === 'string' && c.incomeCategoryId.trim()
      ? (categoryIdRemap.get(c.incomeCategoryId.trim()) || c.incomeCategoryId.trim())
      : undefined
    const categoryId = typeof c.categoryId === 'string' && c.categoryId.trim()
      ? (categoryIdRemap.get(c.categoryId.trim()) || c.categoryId.trim())
      : undefined

    const shareType =
      c.shareType && ['full', 'half', 'double'].includes(c.shareType) ? c.shareType : undefined
    const secondTurnMonth =
      c.secondTurnMonth !== undefined &&
      c.secondTurnMonth !== null &&
      Number.isFinite(Number(c.secondTurnMonth)) &&
      Math.round(Number(c.secondTurnMonth)) >= 1 &&
      Math.round(Number(c.secondTurnMonth)) <= membersCount
        ? Math.round(Number(c.secondTurnMonth))
        : undefined

    const circleData: MoneyCircle = {
      id: c.id,
      name: (c.name || '').trim().slice(0, 100) || 'جمعية',
      monthlyAmountFils,
      membersCount,
      totalAmountFils,
      myTurnMonth,
      startDate: parseDate(c.startDate),
      members,
      status: c.status === 'completed' ? 'completed' : 'active',
      createdAt: c.createdAt ? parseDate(c.createdAt) : new Date(),
      ...(recurringId !== undefined ? { recurringId } : {}),
      ...(c.isManager !== undefined ? { isManager: Boolean(c.isManager) } : {}),
      ...(expenseCategoryId !== undefined ? { expenseCategoryId } : {}),
      ...(incomeCategoryId !== undefined ? { incomeCategoryId } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(shareType !== undefined ? { shareType } : {}),
      ...(secondTurnMonth !== undefined ? { secondTurnMonth } : {}),
    }
    ops.push((b) => b.set(circleRef, circleData))
  }
}
