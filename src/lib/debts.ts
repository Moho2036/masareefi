import type { Debt, DebtType } from '../types'
export { normalizeArabic } from './aggregate'
import { normalizeArabic } from './aggregate'
import { toWesternDigits } from './dates'
import { fromFils } from './money'

/**
 * Snaps payment amount in fils to remainingFils if input exceeds remainingFils
 * within the acceptable currency rounding tolerance (e.g. 5 fils for 2-decimals, 500 fils for 0-decimals),
 * or if the formatted string values match, so paidFils === amountFils.
 */
export function resolvePaymentAmountWithTolerance(
  inputFils: number,
  remainingFils: number,
  decimals: number
): number {
  if (inputFils <= remainingFils) return inputFils
  const maxTolerance = decimals === 0 ? 500 : decimals === 2 ? 5 : 0
  if (maxTolerance > 0) {
    const diff = inputFils - remainingFils
    const roundedRemainingStr = fromFils(remainingFils).toFixed(decimals)
    const inputStr = fromFils(inputFils).toFixed(decimals)
    if (diff <= maxTolerance || inputStr === roundedRemainingStr) {
      return remainingFils
    }
  }
  return inputFils
}

/**
 * Calculates remaining fils to be paid for a debt.
 */
export function getDebtRemainingFils(debt: Debt): number {
  return Math.max(0, Math.round(debt.amountFils - (debt.paidFils || 0)))
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
  overdueCount: number
  overdueFils: number
  upcomingCount: number
  upcomingFils: number
}

/**
 * Computes high-level KPI summary cards:
 * - lentFils: total outstanding balance owed to the user (أطلب الناس)
 * - borrowedFils: total outstanding balance the user owes (عليّ للناس)
 * - netFils: lentFils - borrowedFils
 * - overdueCount & overdueFils: debts past due date
 * - upcomingCount & upcomingFils: debts due within next 7 days
 */
export function calculateDebtSummary(debts: Debt[], referenceDate = new Date()): DebtSummary {
  let lentFils = 0
  let borrowedFils = 0
  let lentActiveCount = 0
  let borrowedActiveCount = 0
  let settledCount = 0
  let overdueCount = 0
  let overdueFils = 0
  let upcomingCount = 0
  let upcomingFils = 0

  const sevenDaysEnd = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() + 7,
    23, 59, 59, 999
  ).getTime()

  for (const debt of debts) {
    if (debt.settled || getDebtRemainingFils(debt) <= 0) {
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

    if (isDebtOverdue(debt, referenceDate)) {
      overdueCount++
      overdueFils += remaining
    } else if (debt.dueDate) {
      const dueTime = new Date(debt.dueDate).getTime()
      if (!Number.isNaN(dueTime) && dueTime <= sevenDaysEnd) {
        upcomingCount++
        upcomingFils += remaining
      }
    }
  }

  return {
    lentFils,
    borrowedFils,
    netFils: lentFils - borrowedFils,
    lentActiveCount,
    borrowedActiveCount,
    settledCount,
    overdueCount,
    overdueFils,
    upcomingCount,
    upcomingFils,
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
  const normalizedQuery = normalizeArabic(toWesternDigits(search))
  const now = new Date()
  const overdueDebtIds = new Set<string>()

  return debts
    .filter((debt) => {
      const isOverdue = isDebtOverdue(debt, now)
      if (isOverdue) {
        overdueDebtIds.add(debt.id)
      }

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
      if (status === 'overdue' && !isOverdue) {
        return false
      }

      // 3. Search query
      if (normalizedQuery) {
        const nameNorm = normalizeArabic(toWesternDigits(debt.personName))
        const noteNorm = normalizeArabic(toWesternDigits(debt.note || ''))
        const entriesNorm = (debt.entries || [])
          .map((e) => normalizeArabic(toWesternDigits(`${e.title || ''} ${e.note || ''}`)))
          .join(' ')
        const paymentsNorm = (debt.payments || [])
          .map((p) => normalizeArabic(toWesternDigits(p.note || '')))
          .join(' ')

        const rawSearch = search.trim()
        const westernQuery = toWesternDigits(rawSearch).replace(/,/g, '')
        const remFils = getDebtRemainingFils(debt)
        const amtStrs = [debt.amountFils, debt.paidFils, remFils].flatMap((f) => [
          fromFils(f).toString(),
          fromFils(f).toFixed(2),
          fromFils(f).toFixed(3),
        ])
        const matchesAmount = Boolean(westernQuery && amtStrs.some((s) => s.includes(westernQuery)))

        if (
          !nameNorm.includes(normalizedQuery) &&
          !noteNorm.includes(normalizedQuery) &&
          !entriesNorm.includes(normalizedQuery) &&
          !paymentsNorm.includes(normalizedQuery) &&
          !matchesAmount
        ) {
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
      const aOverdue = overdueDebtIds.has(a.id)
      const bOverdue = overdueDebtIds.has(b.id)
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1
      }

      // Latest startDate first
      const timeA = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime()
      const timeB = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime()
      return timeB - timeA
    })
}

/**
 * Finds a linked debt and payment item for a given transaction id (if any).
 */
export function findLinkedDebtPayment(
  txId: string | undefined,
  debts: Debt[]
): { debt: Debt; payment: Debt['payments'][number] } | null {
  if (!txId) return null
  for (const debt of debts) {
    if (!debt.payments || debt.payments.length === 0) continue
    for (const p of debt.payments) {
      if (
        p.transactionId === txId ||
        txId === `debt_pay_${p.id}` ||
        (Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.includes(txId))
      ) {
        return { debt, payment: p }
      }
    }
  }
  return null
}

export interface PersonDebtsGroup {
  personKey: string
  canonicalName: string
  debts: Debt[]
  totalLentRemainingFils: number
  totalBorrowedRemainingFils: number
  netRemainingFils: number
  canMerge: boolean
  canMergeLent: boolean
  canMergeBorrowed: boolean
}

export function groupDebtsByPerson(debts: Debt[]): PersonDebtsGroup[] {
  const map = new Map<string, { canonicalName: string; debts: Debt[] }>()
  for (const debt of debts) {
    const key = normalizeArabic(debt.personName || '').trim() || 'unnamed'
    const existing = map.get(key)
    if (existing) {
      existing.debts.push(debt)
    } else {
      map.set(key, { canonicalName: (debt.personName || '').trim() || 'غير مسمى', debts: [debt] })
    }
  }

  const groups: PersonDebtsGroup[] = []
  for (const [personKey, { canonicalName, debts: pDebts }] of map.entries()) {
    let totalLent = 0
    let totalBorrowed = 0

    for (const d of pDebts) {
      if (!d.settled && getDebtRemainingFils(d) > 0) {
        const rem = getDebtRemainingFils(d)
        if (d.type === 'lent') {
          totalLent += rem
        } else {
          totalBorrowed += rem
        }
      }
    }

    const canMergeLent =
      pDebts.filter((d) => d.type === 'lent' && !d.settled && getDebtRemainingFils(d) > 0).length >= 2
    const canMergeBorrowed =
      pDebts.filter((d) => d.type === 'borrowed' && !d.settled && getDebtRemainingFils(d) > 0).length >= 2

    groups.push({
      personKey,
      canonicalName,
      debts: pDebts,
      totalLentRemainingFils: totalLent,
      totalBorrowedRemainingFils: totalBorrowed,
      netRemainingFils: totalLent - totalBorrowed,
      canMerge: canMergeLent || canMergeBorrowed,
      canMergeLent,
      canMergeBorrowed,
    })
  }

  return groups.sort((a, b) => {
    const aTotal = a.totalLentRemainingFils + a.totalBorrowedRemainingFils
    const bTotal = b.totalLentRemainingFils + b.totalBorrowedRemainingFils
    if (aTotal !== bTotal) return bTotal - aTotal
    return a.canonicalName.localeCompare(b.canonicalName, 'ar')
  })
}

export function formatDebtEntriesCount(count: number): string {
  if (count <= 0) return ''
  if (count === 1) return 'سلفة واحدة'
  if (count === 2) return 'سلفتان مجمعتان'
  if (count <= 10) return `${count} سلف مجمعة`
  return `${count} سلفة مجمعة`
}

export { formatDebtAccountStatement } from './debtStatement'
