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
    case 'daily':
      return addDays(d, 1)
    case 'weekly':
      return addDays(d, 7)
    case 'biweekly':
      return addDays(d, 14)
    case 'monthly':
      return addMonths(d, 1)
    case 'quarterly':
      return addMonths(d, 3)
    case 'semiannual':
      return addMonths(d, 6)
    case 'yearly':
      return addYears(d, 1)
  }
}

/**
 * Advances a date while preserving the original target day of month (e.g. 31st).
 * If the target month has fewer days, clamps to the last day of that month,
 * but restores to targetDay in subsequent months that have enough days.
 */
export function advanceDateWithTargetDay(
  date: Date,
  freq: Frequency,
  targetDay: number
): Date {
  const d = new Date(date.getTime())
  if (freq === 'daily') {
    return addDays(d, 1)
  }
  if (freq === 'weekly') {
    return addDays(d, 7)
  }
  if (freq === 'biweekly') {
    return addDays(d, 14)
  }
  if (freq === 'monthly') {
    const nextYear = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()
    const nextMonth = (d.getMonth() + 1) % 12
    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
    const safeDay = Math.min(targetDay, daysInNextMonth)
    d.setFullYear(nextYear, nextMonth, safeDay)
    return d
  }
  if (freq === 'quarterly' || freq === 'semiannual') {
    const monthsToAdd = freq === 'quarterly' ? 3 : 6
    const totalMonths = d.getMonth() + monthsToAdd
    const nextYear = d.getFullYear() + Math.floor(totalMonths / 12)
    const nextMonth = totalMonths % 12
    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
    const safeDay = Math.min(targetDay, daysInNextMonth)
    d.setFullYear(nextYear, nextMonth, safeDay)
    return d
  }
  if (freq === 'yearly') {
    const nextYear = d.getFullYear() + 1
    const currentMonth = d.getMonth()
    const daysInMonth = new Date(nextYear, currentMonth + 1, 0).getDate()
    const safeDay = Math.min(targetDay, daysInMonth)
    d.setFullYear(nextYear, currentMonth, safeDay)
    return d
  }
  return advanceDate(d, freq)
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
 * Calculates the 1-based month index of an occurrence relative to the start date.
 * Example: start 2026-01-15, occurrence 2026-01-15 -> 1
 * occurrence 2026-02-15 -> 2
 * occurrence 2026-04-15 -> 4
 */
export function getOccurrenceMonthIndex(startDate: Date, occurrenceDate: Date): number {
  const start = startDate instanceof Date ? startDate : new Date(startDate)
  const occ = occurrenceDate instanceof Date ? occurrenceDate : new Date(occurrenceDate)

  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0)
  const t = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate(), 12, 0, 0)

  if (t < s) {
    const diffMonths =
      (occ.getFullYear() - start.getFullYear()) * 12 +
      (occ.getMonth() - start.getMonth())
    return diffMonths + 1
  }

  let approxMonths = (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth())
  while (addMonths(s, approxMonths) > t) {
    approxMonths--
  }
  while (addMonths(s, approxMonths + 1) <= t) {
    approxMonths++
  }
  return approxMonths + 1
}

/**
 * Determines whether a recurring occurrence should be skipped.
 * For money circles, the user's turn month is exempt from paying an installment.
 */
export function isOccurrenceSkipped(recurring: Recurring, occurrenceDate: Date): boolean {
  const monthIdx = getOccurrenceMonthIndex(recurring.startDate, occurrenceDate)
  if (Array.isArray(recurring.skipMonths) && recurring.skipMonths.length > 0) {
    if (recurring.skipMonths.includes(monthIdx)) {
      return true
    }
  }
  if (recurring.skipMonth !== undefined && recurring.skipMonth !== null) {
    return monthIdx === recurring.skipMonth
  }
  return false
}

/**
 * Calculates due occurrences for a recurring transaction up to `today`.
 * Compares against end-of-day so occurrences due today are not skipped if opened in the morning.
 * Collects each due date and advances `nextDate` until nextDate > today or nextDate > endDate.
 * If an occurrence matches skipMonth (e.g. money circle turn month), it is NOT added to dates
 * (no transaction is created), but nextDate still advances past it.
 */
export function calculateDueOccurrences(
  recurring: Recurring,
  today: Date = new Date()
): DueOccurrencesResult {
  const dates: Date[] = []
  let curNextDate = new Date(recurring.nextDate.getTime())

  // Normalize today and endDate to end-of-day so occurrences due today (even if at noon)
  // are processed even when the user opens the app in the morning.
  const endOfToday = new Date(today.getTime())
  endOfToday.setHours(23, 59, 59, 999)

  const endOfEndDate = recurring.endDate ? new Date(recurring.endDate.getTime()) : null
  if (endOfEndDate) {
    endOfEndDate.setHours(23, 59, 59, 999)
  }

  const startDate = recurring.startDate instanceof Date ? recurring.startDate : new Date(recurring.startDate)
  const targetDay = startDate.getDate()

  // Safety safeguard against unbounded iterations
  let loopLimit = 500

  while (curNextDate <= endOfToday && loopLimit-- > 0) {
    if (endOfEndDate && curNextDate > endOfEndDate) {
      break
    }
    // Only push to dates if this occurrence is NOT skipped
    if (!isOccurrenceSkipped(recurring, curNextDate)) {
      dates.push(new Date(curNextDate.getTime()))
    }
    curNextDate = advanceDateWithTargetDay(curNextDate, recurring.frequency, targetDay)
  }

  const shouldDeactivate = Boolean(
    endOfEndDate && curNextDate > endOfEndDate
  )

  return {
    dates,
    newNextDate: curNextDate,
    shouldDeactivate,
  }
}

/**
 * Calculates the updated nextDate when editing an existing recurring transaction whose
 * startDate or frequency was modified.
 * - If newStartDate is in the future (after today's date), nextDate is set to newStartDate.
 * - Otherwise, advances from newStartDate by frequency until reaching the first upcoming occurrence (>= today).
 */
export function calculateNextDateOnEdit(
  newStartDate: Date,
  frequency: Frequency,
  today: Date = new Date()
): Date {
  const startOfToday = new Date(today.getTime())
  startOfToday.setHours(0, 0, 0, 0)

  const startOfNewStart = new Date(newStartDate.getTime())
  startOfNewStart.setHours(0, 0, 0, 0)

  if (startOfNewStart > startOfToday) {
    return new Date(newStartDate.getTime())
  }

  let candidate = new Date(newStartDate.getTime())
  const targetDay = startOfNewStart.getDate()
  let loopLimit = 1000

  while (candidate < startOfToday && loopLimit-- > 0) {
    candidate = advanceDateWithTargetDay(candidate, frequency, targetDay)
  }

  return candidate
}

/**
 * Calculates the 1-based index of the first unpaid, non-exempt month of a money circle.
 * - Month indices range from 1 to membersCount.
 * - The user's turn month (`myTurnMonth`) is exempt and skipped.
 * - Returns null if all non-exempt months have been paid.
 */
export function getNextCircleDueMonth(
  membersCount: number,
  myTurnMonth: number,
  paidMonths: number[] = [],
  paymentsByMonth?: Record<string | number, boolean>,
  startDate?: Date,
  today: Date = new Date(),
  exemptMonths?: number[]
): number | null {
  const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null

  const allExempt = new Set<number>()
  if (myTurnMonth) allExempt.add(myTurnMonth)
  if (Array.isArray(exemptMonths)) {
    exemptMonths.forEach((m) => allExempt.add(m))
  }

  for (let m = 1; m <= membersCount; m++) {
    if (allExempt.has(m)) continue

    // If this month was explicitly cancelled/unpaid by the user and its date is <= today, skip it so recurring doesn't immediately re-deduct it
    if (start && (paymentsByMonth?.[m] === false || paymentsByMonth?.[String(m)] === false)) {
      const monthDate = addMonths(start, m - 1)
      if (monthDate <= today) {
        continue
      }
    }

    const isPaid =
      paidMonths.includes(m) ||
      paymentsByMonth?.[m] === true ||
      paymentsByMonth?.[String(m)] === true

    if (!isPaid) {
      return m
    }
  }
  return null
}

/**
 * Calculates the next due date for a money circle recurring installment.
 * Points directly to the first unpaid non-exempt month (e.g. month 1 if unpaid, even if startDate < today).
 * If all non-exempt months are paid, returns the date of the last month of the circle.
 */
export function getNextCircleDueDate(
  startDate: Date,
  membersCount: number,
  myTurnMonth: number,
  paidMonths: number[] = [],
  paymentsByMonth?: Record<string | number, boolean>,
  todayOrExempt?: Date | number[],
  exemptMonths?: number[]
): Date {
  const today = todayOrExempt instanceof Date ? todayOrExempt : new Date()
  const effectiveExempt = Array.isArray(todayOrExempt) ? todayOrExempt : exemptMonths
  const start = startDate instanceof Date ? startDate : new Date(startDate)
  const dueMonth = getNextCircleDueMonth(
    membersCount,
    myTurnMonth,
    paidMonths,
    paymentsByMonth,
    start,
    today,
    effectiveExempt
  )

  if (dueMonth !== null) {
    return addMonths(start, dueMonth - 1)
  }

  return addMonths(start, Math.max(0, membersCount - 1))
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
 * If an item is a money circle whose turn month matches refDate, its expense is 0 this month.
 */
export function calculateMonthlyEquivalent(
  items: Recurring[],
  refDate: Date = new Date()
): MonthlyEquivalentResult {
  let monthlyIncome = 0
  let monthlyExpense = 0

  for (const item of items) {
    if (!item.active) continue

    // Skip expired recurring items where endDate has passed before refDate
    if (item.endDate) {
      const endOfEndDate = new Date(
        item.endDate instanceof Date ? item.endDate.getTime() : new Date(item.endDate).getTime()
      )
      endOfEndDate.setHours(23, 59, 59, 999)
      const startOfRef = new Date(refDate.getTime())
      startOfRef.setHours(0, 0, 0, 0)
      if (endOfEndDate < startOfRef) {
        continue
      }
    }

    // For money circles, check if this month's occurrence is exempt from installment payment.
    // If referenceDate is the start of a custom financial cycle (e.g. Sep 25 for Oct),
    // nextDate might fall in [refDate, addMonths(refDate, 1)) in the upcoming calendar month (e.g. Oct 1..Oct 25).
    let isSkipped = isOccurrenceSkipped(item, refDate)
    if (!isSkipped && item.nextDate) {
      const nextDate = item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate)
      const cycleEnd = addMonths(refDate, 1)
      if (nextDate >= refDate && nextDate < cycleEnd) {
        const isSameCalendarMonth =
          nextDate.getFullYear() === refDate.getFullYear() &&
          nextDate.getMonth() === refDate.getMonth()
        const isCustomCycleStartAnchor =
          refDate.getDate() >= 20 &&
          nextDate.getDate() <= 10 &&
          refDate.getHours() === 0 &&
          refDate.getMinutes() === 0
        if (isSameCalendarMonth || isCustomCycleStartAnchor) {
          isSkipped = isOccurrenceSkipped(item, nextDate)
        }
      }
    }

    if (item.type === 'expense' && isSkipped) {
      continue
    }

    let equivalentFils = 0
    switch (item.frequency) {
      case 'daily':
        equivalentFils = Math.round(item.amountFils * (365 / 12))
        break
      case 'weekly':
        equivalentFils = Math.round(item.amountFils * (52 / 12))
        break
      case 'biweekly':
        equivalentFils = Math.round(item.amountFils * (26 / 12))
        break
      case 'monthly':
        equivalentFils = item.amountFils
        break
      case 'quarterly':
        equivalentFils = Math.round(item.amountFils / 3)
        break
      case 'semiannual':
        equivalentFils = Math.round(item.amountFils / 6)
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
