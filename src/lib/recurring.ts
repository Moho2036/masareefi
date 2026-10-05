import { addDays, addMonths, addYears, format } from 'date-fns'
import type { Frequency, Recurring } from '../types'

/**
 * Advances a date by one interval according to frequency.
 * - weekly: +7 days
 * - monthly: +1 month (safely clamped to end-of-month e.g. Jan 31 -> Feb 28)
 * - yearly: +1 year (clamped for leap year Feb 29 -> Feb 28)
 */
export function advanceDate(date: Date, freq: Frequency): Date {
  const d = new Date(date.getTime())
  switch (freq) {
    case 'weekly':
      return addDays(d, 7)
    case 'monthly':
      return addMonths(d, 1)
    case 'yearly':
      return addYears(d, 1)
  }
}

/**
 * Generates an idempotent, deterministic transaction ID based on recurringId and date.
 * Format: `${recurringId}_${YYYY-MM-DD}`
 */
export function getDeterministicTxId(recurringId: string, date: Date): string {
  const dateKey = format(date, 'yyyy-MM-dd')
  return `${recurringId}_${dateKey}`
}

export interface DueOccurrencesResult {
  dates: Date[]
  newNextDate: Date
  shouldDeactivate: boolean
}

/**
 * Calculates due occurrences for a recurring transaction up to `today`.
 * Collects each due date and advances `nextDate` until nextDate > today or nextDate > endDate.
 */
export function calculateDueOccurrences(
  recurring: Recurring,
  today: Date = new Date()
): DueOccurrencesResult {
  const dates: Date[] = []
  let curNextDate = new Date(recurring.nextDate.getTime())

  // Safety safeguard against unbounded iterations
  let loopLimit = 500

  while (curNextDate <= today && loopLimit-- > 0) {
    if (recurring.endDate && curNextDate > recurring.endDate) {
      break
    }
    dates.push(new Date(curNextDate.getTime()))
    curNextDate = advanceDate(curNextDate, recurring.frequency)
  }

  const shouldDeactivate = Boolean(
    recurring.endDate && curNextDate > recurring.endDate
  )

  return {
    dates,
    newNextDate: curNextDate,
    shouldDeactivate,
  }
}

export interface MonthlyEquivalentResult {
  monthlyIncome: number
  monthlyExpense: number
}

/**
 * Calculates normalized monthly income and expense for active recurring items.
 * - weekly: amount * (52 / 12)
 * - monthly: amount * 1
 * - yearly: amount / 12
 */
export function calculateMonthlyEquivalent(
  items: Recurring[]
): MonthlyEquivalentResult {
  let monthlyIncome = 0
  let monthlyExpense = 0

  for (const item of items) {
    if (!item.active) continue

    let equivalentFils = 0
    switch (item.frequency) {
      case 'weekly':
        equivalentFils = Math.round(item.amountFils * (52 / 12))
        break
      case 'monthly':
        equivalentFils = item.amountFils
        break
      case 'yearly':
        equivalentFils = Math.round(item.amountFils / 12)
        break
    }

    if (item.type === 'income') {
      monthlyIncome += equivalentFils
    } else {
      monthlyExpense += equivalentFils
    }
  }

  return {
    monthlyIncome,
    monthlyExpense,
  }
}
