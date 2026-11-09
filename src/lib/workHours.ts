import { toWesternDigits } from './dates'

/**
 * Pure calculation and clamping logic for work hours and days.
 */

export function parseNumeric(val: string): number {
  if (!val) return 0
  let clean = toWesternDigits(val)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/٫/g, '.') // Arabic decimal separator (U+066B)
    .replace(/\u060C/g, ',') // Arabic comma (U+060C)
    .trim()

  // Handle both comma and dot present e.g. 1,000.50 or 1.000,50
  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',')
    const lastDot = clean.lastIndexOf('.')
    if (lastComma < lastDot) {
      // 1,250.50 -> comma is thousands separator
      clean = clean.replace(/,/g, '')
    } else {
      // 1.250,50 -> dot is thousands separator, comma is decimal
      clean = clean.replace(/\./g, '').replace(/,/g, '.')
    }
  } else if (clean.includes(',')) {
    // Only comma present
    const commaCount = (clean.match(/,/g) || []).length
    if (commaCount > 1) {
      // Multiple commas e.g. 1,000,000 -> thousands separator
      clean = clean.replace(/,/g, '')
    } else {
      // Single comma
      const singleCommaMatch = clean.match(/^(\d+),(\d+)$/)
      if (singleCommaMatch) {
        const [, before, after] = singleCommaMatch
        if (before === '0') {
          // e.g. 0,5 -> 0.5
          clean = clean.replace(',', '.')
        } else if (after.length === 3) {
          // Exactly 3 digits after comma e.g. 1,000 or 1,500 or 12,500 -> thousands separator
          clean = clean.replace(',', '')
        } else {
          // Not 3 digits e.g. 12,5 or 12,50 -> decimal comma
          clean = clean.replace(',', '.')
        }
      } else {
        clean = clean.replace(/,/g, '')
      }
    }
  }

  const parsed = parseFloat(clean)
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed
}

export function clampWorkHoursPerDay(val: number): number {
  return Math.min(24, Math.max(1, val))
}

export function clampWorkDaysPerWeek(val: number): number {
  return Math.min(7, Math.max(1, val))
}

export function clampWorkDaysPerMonth(val: number): number {
  return Math.min(31, Math.max(1, val))
}
