import type { Debt, DebtType } from '../types'
export { normalizeArabic } from './aggregate'
import { normalizeArabic } from './aggregate'

/**
 * Calculates remaining fils to be paid for a debt.
 */
export function getDebtRemainingFils(debt: Debt): number {
  return Math.max(0, Math.round(debt.amountFils - (debt.paidFils || 0)))
}

/**
 * Determines if a debt is settled based on whether new total amount is covered by paid amount.
 */
export function isDebtSettled(amountFils: number, paidFils: number): boolean {
  return amountFils <= paidFils
}

/**
 * Calculates payment progress percentage (0 - 100).
 */
export function getDebtProgress(debt: Debt): number {
  if (debt.amountFils <= 0) return 0
  const paid = debt.paidFils || 0
  return Math.min(100, Math.max(0, Math.round((paid / debt.amountFils) * 100)))
}

/**
 * Checks if a debt is overdue past its due date.
 */
export function isDebtOverdue(debt: Debt, referenceDate = new Date()): boolean {
  if (debt.settled) return false
  if (!debt.dueDate) return false
  // Overdue if due date end-of-day is before reference date
  const due = new Date(debt.dueDate)
  due.setHours(23, 59, 59, 999)
  return due.getTime() < referenceDate.getTime()
}

export interface DebtSummary {
  lentFils: number
  borrowedFils: number
  netFils: number
  lentActiveCount: number
  borrowedActiveCount: number
  settledCount: number
}

/**
 * Computes high-level KPI summary cards:
 * - lentFils: total outstanding balance owed to the user (أطلب الناس)
 * - borrowedFils: total outstanding balance the user owes (عليّ للناس)
 * - netFils: lentFils - borrowedFils
 */
export function calculateDebtSummary(debts: Debt[]): DebtSummary {
  let lentFils = 0
  let borrowedFils = 0
  let lentActiveCount = 0
  let borrowedActiveCount = 0
  let settledCount = 0

  for (const debt of debts) {
    if (debt.settled) {
      settledCount++
      continue
    }

    const remaining = getDebtRemainingFils(debt)

    if (debt.type === 'lent') {
      lentFils += remaining
      lentActiveCount++
    } else if (debt.type === 'borrowed') {
      borrowedFils += remaining
      borrowedActiveCount++
    }
  }

  return {
    lentFils,
    borrowedFils,
    netFils: lentFils - borrowedFils,
    lentActiveCount,
    borrowedActiveCount,
    settledCount,
  }
}

export interface DebtFilterOptions {
  type?: 'all' | DebtType
  status?: 'all' | 'active' | 'settled' | 'overdue'
  search?: string
}

/**
 * Filters and sorts debts for display.
 * Sort priority:
 * 1. Active overdue debts first
 * 2. Active debts sorted by startDate descending
 * 3. Settled debts at the bottom
 */
export function filterDebts(debts: Debt[], options: DebtFilterOptions = {}): Debt[] {
  const { type = 'all', status = 'all', search = '' } = options
  const normalizedQuery = normalizeArabic(search)
  const now = new Date()

  return debts
    .filter((debt) => {
      // 1. Filter by type
      if (type !== 'all' && debt.type !== type) {
        return false
      }

      // 2. Filter by status
      if (status === 'active' && debt.settled) {
        return false
      }
      if (status === 'settled' && !debt.settled) {
        return false
      }
      if (status === 'overdue' && !isDebtOverdue(debt, now)) {
        return false
      }

      // 3. Search query
      if (normalizedQuery) {
        const nameNorm = normalizeArabic(debt.personName)
        const noteNorm = normalizeArabic(debt.note || '')
        if (!nameNorm.includes(normalizedQuery) && !noteNorm.includes(normalizedQuery)) {
          return false
        }
      }

      return true
    })
    .sort((a, b) => {
      // Settled debts always after active
      if (a.settled !== b.settled) {
        return a.settled ? 1 : -1
      }

      // Overdue debts top of active list
      const aOverdue = isDebtOverdue(a, now)
      const bOverdue = isDebtOverdue(b, now)
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1
      }

      // Latest startDate first
      return b.startDate.getTime() - a.startDate.getTime()
    })
}
