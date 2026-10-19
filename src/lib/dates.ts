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
 * Formats a date into an Arabic month label with Western digits.
 * Example: "أكتوبر 2026"
 */
export function formatMonthLabel(date: Date): string {
  const formatted = format(date, 'LLLL yyyy', { locale: ar })
  return toWesternDigits(formatted)
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

