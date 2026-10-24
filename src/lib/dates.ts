import { format, isSameDay, subDays } from 'date-fns'
import { ar } from 'date-fns/locale'

/**
 * Normalizes any Arabic-Indic digits [٠-٩] to Western ASCII digits [0-9].
 */
export function toWesternDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
}

/**
 * Calculates the financial month date range based on the user's month start day (1-28).
 * The end date is exclusive.
 *
 * Examples with monthStartDay = 25:
 * - refDate = Oct 10, 2026 -> { start: Sep 25, 2026, end: Oct 25, 2026 }
 * - refDate = Oct 26, 2026 -> { start: Oct 25, 2026, end: Nov 25, 2026 }
 * - refDate = Oct 25, 2026 -> { start: Oct 25, 2026, end: Nov 25, 2026 }
 */
export function getFinancialMonthRange(
  refDate: Date,
  monthStartDay: number = 1,
): { start: Date; end: Date } {
  const safeStartDay = Math.max(1, Math.min(28, Math.floor(monthStartDay) || 1))
  const year = refDate.getFullYear()
  const month = refDate.getMonth() // 0-11
  const day = refDate.getDate()

  let startYear = year
  let startMonth = month

  if (day < safeStartDay) {
    // Current date is before the start day of this calendar month,
    // so this period started in the previous calendar month.
    startMonth = month - 1
    if (startMonth < 0) {
      startMonth = 11
      startYear = year - 1
    }
  }

  const start = new Date(startYear, startMonth, safeStartDay, 0, 0, 0, 0)

  // End date is one month later on the same day (exclusive)
  let endYear = startYear
  let endMonth = startMonth + 1
  if (endMonth > 11) {
    endMonth = 0
    endYear = startYear + 1
  }
  const end = new Date(endYear, endMonth, safeStartDay, 0, 0, 0, 0)

  return { start, end }
}

/**
 * Returns a stable reference date within the previous financial month.
 * Navigates by the financial month start anchor (safeStartDay in [1..28]),
 * guaranteeing 100% reversible navigation without date drift across February
 * (28/29 days) and 31-day months.
 */
export function getPreviousFinancialMonth(
  refDate: Date,
  monthStartDay: number = 1
): Date {
  const safeStartDay = Math.max(1, Math.min(28, Math.floor(monthStartDay) || 1))
  const currentRange = getFinancialMonthRange(refDate, safeStartDay)
  const startYear = currentRange.start.getFullYear()
  const startMonth = currentRange.start.getMonth()

  let prevYear = startYear
  let prevMonth = startMonth - 1
  if (prevMonth < 0) {
    prevMonth = 11
    prevYear = startYear - 1
  }

  return new Date(prevYear, prevMonth, safeStartDay, 12, 0, 0, 0)
}

/**
 * Returns a stable reference date within the next financial month.
 * Navigates by the financial month start anchor (safeStartDay in [1..28]),
 * guaranteeing 100% reversible navigation without date drift across February
 * (28/29 days) and 31-day months.
 */
export function getNextFinancialMonth(
  refDate: Date,
  monthStartDay: number = 1
): Date {
  const safeStartDay = Math.max(1, Math.min(28, Math.floor(monthStartDay) || 1))
  const currentRange = getFinancialMonthRange(refDate, safeStartDay)
  const startYear = currentRange.start.getFullYear()
  const startMonth = currentRange.start.getMonth()

  let nextYear = startYear
  let nextMonth = startMonth + 1
  if (nextMonth > 11) {
    nextMonth = 0
    nextYear = startYear + 1
  }

  return new Date(nextYear, nextMonth, safeStartDay, 12, 0, 0, 0)
}

/**
 * Formats a date into an Arabic month label with Western digits.
 * Example: "أكتوبر 2026"
 */
export function formatMonthLabel(date: Date): string {
  const formatted = format(date, 'LLLL yyyy', { locale: ar })
  return toWesternDigits(formatted)
}

/**
 * Formats a financial month label clearly.
 * When monthStartDay === 1, returns standard formatMonthLabel(range.start) e.g. "أكتوبر 2026".
 * When monthStartDay > 1, displays both months clearly e.g. "مارس / أبريل 2026",
 * or if spanning year boundaries "ديسمبر 2025 / يناير 2026", avoiding user ambiguity.
 */
export function formatFinancialMonthLabel(
  range: { start: Date; end: Date },
  monthStartDay: number = 1
): string {
  if (monthStartDay === 1) {
    return formatMonthLabel(range.start)
  }
  const inclusiveEnd = subDays(range.end, 1)
  const startMonth = toWesternDigits(format(range.start, 'LLLL', { locale: ar }))
  const endMonth = toWesternDigits(format(inclusiveEnd, 'LLLL', { locale: ar }))
  const startYear = range.start.getFullYear()
  const endYear = inclusiveEnd.getFullYear()

  if (startYear === endYear) {
    return `${startMonth} / ${endMonth} ${startYear}`
  }
  return `${startMonth} ${startYear} / ${endMonth} ${endYear}`
}

/**
 * Formats a financial date range into an Arabic descriptive string with Western digits.
 * Example: "25 سبتمبر - 24 أكتوبر"
 */
export function formatFinancialRangeLabel(range: { start: Date; end: Date }): string {
  const inclusiveEnd = subDays(range.end, 1)
  const startStr = toWesternDigits(format(range.start, 'd MMMM', { locale: ar }))
  const endStr = toWesternDigits(format(inclusiveEnd, 'd MMMM', { locale: ar }))
  return `${startStr} - ${endStr}`
}

/**
 * Formats a transaction day header.
 * - Today: "اليوم - السبت 4 أكتوبر"
 * - Yesterday: "أمس - الجمعة 3 أكتوبر"
 * - Older dates: "الخميس 2 أكتوبر"
 *
 * All digits in Western format (0-9).
 */
export function formatDayHeader(date: Date, today: Date): string {
  const formattedDate = toWesternDigits(
    format(date, 'EEEE d LLLL', { locale: ar }),
  )

  if (isSameDay(date, today)) {
    return `اليوم - ${formattedDate}`
  }

  const yesterday = subDays(today, 1)
  if (isSameDay(date, yesterday)) {
    return `أمس - ${formattedDate}`
  }

  return formattedDate
}

/**
 * Safely parses a 'YYYY-MM-DD' HTML date input string into a Date object
 * set to local midday (12:00:00). This guarantees that timezone offsets
 * and daylight savings shifts never push the date across calendar or month boundaries.
 */
export function parseLocalDateInput(dateStr: string): Date {
  if (!dateStr) return new Date()
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
    return new Date(year, month - 1, day, 12, 0, 0, 0)
  }
  return new Date(dateStr)
}

/**
 * Formats a Date object into a local 'YYYY-MM-DD' string for HTML date inputs or local filenames.
 */
export function formatDateInput(date: Date = new Date()): string {
  const d = date instanceof Date ? date : new Date(date)
  return format(d, 'yyyy-MM-dd')
}

/**
 * Resolves the fiscal month information (year, 0-indexed monthIndex, and YYYY-MM key)
 * for a specific date based on monthStartDay (1-28).
 * If day < monthStartDay, the date belongs to the fiscal cycle that started in the previous month.
 */
export function getFiscalMonthInfo(
  date: Date,
  monthStartDay: number = 1
): { year: number; monthIndex: number; key: string } {
  const safeStartDay = Math.max(1, Math.min(28, Math.floor(monthStartDay) || 1))
  const d = date instanceof Date ? date : new Date(date)
  const day = d.getDate()
  let year = d.getFullYear()
  let month = d.getMonth()

  if (day < safeStartDay) {
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
  }

  const key = `${year}-${String(month + 1).padStart(2, '0')}`
  return { year, monthIndex: month, key }
}

/**
 * Returns the fiscal month key (e.g. "2026-10") for a date and monthStartDay.
 */
export function getFiscalMonthKey(date: Date, monthStartDay: number = 1): string {
  return getFiscalMonthInfo(date, monthStartDay).key
}

/**
 * Calculates the exact [start, end) date range for a specific fiscal month cycle (0..11)
 * in a given calendar year based on monthStartDay (1-28).
 *
 * Example with year = 2026, monthIndex = 0 (January), monthStartDay = 25:
 * -> start: Jan 25, 2026, end: Feb 25, 2026
 *
 * Example with year = 2026, monthIndex = 11 (December), monthStartDay = 25:
 * -> start: Dec 25, 2026, end: Jan 25, 2027
 */
export function getMonthRange(
  year: number,
  monthIndex: number,
  monthStartDay: number = 1
): { start: Date; end: Date } {
  const safeStartDay = Math.max(1, Math.min(28, Math.floor(monthStartDay) || 1))
  const start = new Date(year, monthIndex, safeStartDay, 0, 0, 0, 0)

  let endYear = year
  let endMonth = monthIndex + 1
  if (endMonth > 11) {
    endMonth = 0
    endYear = year + 1
  }
  const end = new Date(endYear, endMonth, safeStartDay, 0, 0, 0, 0)
  return { start, end }
}

