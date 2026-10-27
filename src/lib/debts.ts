import { format } from 'date-fns'
import type { Debt, DebtType } from '../types'
export { normalizeArabic } from './aggregate'
import { normalizeArabic } from './aggregate'
import { toWesternDigits } from './dates'
import { fromFils } from './money'

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

  const now = referenceDate.getTime()
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000

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

    if (isDebtOverdue(debt, referenceDate)) {
      overdueCount++
      overdueFils += remaining
    } else if (debt.dueDate) {
      const dueTime = new Date(debt.dueDate).getTime()
      if (dueTime <= sevenDaysFromNow) {
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
        const entriesNorm = (debt.entries || [])
          .map((e) => normalizeArabic(`${e.title || ''} ${e.note || ''}`))
          .join(' ')

        const rawSearch = search.trim()
        const westernQuery = toWesternDigits(rawSearch).replace(/,/g, '')
        const remainingFils = getDebtRemainingFils(debt)

        const isPureDigits = /^\d+$/.test(westernQuery)
        const matchesAmount = Boolean(
          westernQuery &&
            (isPureDigits
              ? String(fromFils(debt.amountFils)).includes(westernQuery) ||
                String(fromFils(debt.paidFils)).includes(westernQuery) ||
                String(fromFils(remainingFils)).includes(westernQuery)
              : fromFils(debt.amountFils).toString().includes(westernQuery) ||
                fromFils(debt.paidFils).toString().includes(westernQuery) ||
                fromFils(remainingFils).toString().includes(westernQuery) ||
                fromFils(debt.amountFils).toFixed(2).includes(westernQuery) ||
                fromFils(debt.paidFils).toFixed(2).includes(westernQuery) ||
                fromFils(remainingFils).toFixed(2).includes(westernQuery) ||
                fromFils(debt.amountFils).toFixed(3).includes(westernQuery) ||
                fromFils(debt.paidFils).toFixed(3).includes(westernQuery) ||
                fromFils(remainingFils).toFixed(3).includes(westernQuery))
        )

        if (
          !nameNorm.includes(normalizedQuery) &&
          !noteNorm.includes(normalizedQuery) &&
          !entriesNorm.includes(normalizedQuery) &&
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
      const aOverdue = isDebtOverdue(a, now)
      const bOverdue = isDebtOverdue(b, now)
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1
      }

      // Latest startDate first
      return b.startDate.getTime() - a.startDate.getTime()
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
      map.set(key, { canonicalName: debt.personName.trim() || 'غير مسمى', debts: [debt] })
    }
  }

  const groups: PersonDebtsGroup[] = []
  for (const [personKey, { canonicalName, debts: pDebts }] of map.entries()) {
    let totalLent = 0
    let totalBorrowed = 0

    for (const d of pDebts) {
      if (!d.settled) {
        const rem = getDebtRemainingFils(d)
        if (d.type === 'lent') {
          totalLent += rem
        } else {
          totalBorrowed += rem
        }
      }
    }

    const canMergeLent = pDebts.filter((d) => d.type === 'lent').length >= 2
    const canMergeBorrowed = pDebts.filter((d) => d.type === 'borrowed').length >= 2

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

export function formatDebtAccountStatement(debt: Debt, currencySymbol = 'د.أ'): string {
  const isLent = debt.type === 'lent'
  const typeText = isLent ? 'مستحقات لك (سلف / إقراض)' : 'التزامات عليك (اقتراض)'
  const statusText = debt.settled ? 'مسدد بالكامل ✅' : 'قيد السداد ⏳'
  const remaining = getDebtRemainingFils(debt)

  let entriesText = ''
  if (debt.entries && debt.entries.length > 0) {
    entriesText = debt.entries
      .map(
        (e, idx) =>
          `${idx + 1}. ${format(new Date(e.date), 'yyyy/MM/dd')}: ${fromFils(e.amountFils)} ${currencySymbol}${e.title ? ` (${e.title})` : ''}${e.note ? ` - ${e.note}` : ''}`
      )
      .join('\n')
  } else {
    entriesText = `1. ${format(new Date(debt.startDate), 'yyyy/MM/dd')}: ${fromFils(debt.amountFils)} ${currencySymbol}${debt.note ? ` - ${debt.note}` : ''}`
  }

  let paymentsText = 'لا توجد دفعات مسجلة بعد.'
  if (debt.payments && debt.payments.length > 0) {
    paymentsText = debt.payments
      .map(
        (p, idx) =>
          `${idx + 1}. ${format(new Date(p.date), 'yyyy/MM/dd')}: ${fromFils(p.amountFils)} ${currencySymbol}${p.note ? ` (${p.note})` : ''}`
      )
      .join('\n')
  }

  return `📋 *كشف حساب مالي - تطبيق بَصير*
────────────────
👤 *الطرف:* ${debt.personName}
🔖 *نوع المعاملة:* ${typeText}
📌 *الحالة:* ${statusText}

💰 *تفاصيل السلف وأصل الدين:*
${entriesText}

💳 *سجل الدفعات المسددة:*
${paymentsText}

────────────────
💵 *إجمالي المبلغ:* ${fromFils(debt.amountFils)} ${currencySymbol}
✅ *المسدد:* ${fromFils(debt.paidFils || 0)} ${currencySymbol}
⏳ *المتبقي:* ${fromFils(remaining)} ${currencySymbol}
────────────────
تم إنشاء كشف الحساب في ${format(new Date(), 'yyyy/MM/dd')}`
}
