import { toWesternDigits } from './dates'
import { toFils } from './money'

/**
 * Pure calculation and clamping logic for work hours, days, and purchase trade-offs.
 */

export function parseNumeric(val: string): number {
  if (!val) return 0
  let clean = toWesternDigits(val)
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, '')
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
  const safe = typeof val === 'number' && Number.isFinite(val) ? val : 8
  return Math.min(24, Math.max(1, safe))
}

export function clampWorkDaysPerWeek(val: number): number {
  const safe = typeof val === 'number' && Number.isFinite(val) ? val : 5
  return Math.min(7, Math.max(1, safe))
}

export function clampWorkDaysPerMonth(val: number): number {
  const safe = typeof val === 'number' && Number.isFinite(val) ? val : 22
  return Math.min(31, Math.max(1, safe))
}

export function normalizeMonthlyWorkingDays(
  rawWorkDays: number,
  mode: 'month' | 'week'
): number {
  if (mode === 'week') {
    const clamped = rawWorkDays > 0 ? clampWorkDaysPerWeek(rawWorkDays) : 5
    return clamped * (52 / 12)
  }
  return rawWorkDays > 0 ? clampWorkDaysPerMonth(rawWorkDays) : 22
}

export function calculateTotalMonthlyHours(
  dailyHours: number,
  monthlyWorkingDays: number
): number {
  const clampedDaily = dailyHours > 0 ? clampWorkHoursPerDay(dailyHours) : 8
  return Math.max(1, clampedDaily * monthlyWorkingDays)
}

export function calculateHourlyWageFils(
  salary: number,
  totalMonthlyHours: number,
  decimals?: number
): number {
  if (salary <= 0 || totalMonthlyHours <= 0) return 0
  const salaryFils = toFils(salary, decimals)
  return Math.round(salaryFils / totalMonthlyHours)
}

export function calculateHoursRequired(
  itemPrice: number,
  hourlyWageFils: number,
  decimals?: number
): number {
  if (itemPrice <= 0 || hourlyWageFils <= 0) return 0
  const itemPriceFils = toFils(itemPrice, decimals)
  return itemPriceFils / hourlyWageFils
}

export interface WorkTimeBreakdown {
  totalMinutes: number
  fullHours: number
  remainingMinutes: number
  equivalentWorkDays: string
}

export function calculateWorkTimeBreakdown(
  requiredHours: number,
  dailyHours: number = 8
): WorkTimeBreakdown {
  if (!Number.isFinite(requiredHours) || requiredHours <= 0) {
    return {
      totalMinutes: 0,
      fullHours: 0,
      remainingMinutes: 0,
      equivalentWorkDays: '0.0',
    }
  }
  const clampedDaily = clampWorkHoursPerDay(dailyHours)
  const totalMinutes = Math.round(requiredHours * 60)
  const fullHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const equivalentWorkDays = (requiredHours / Math.max(1, clampedDaily)).toFixed(1)

  return {
    totalMinutes,
    fullHours,
    remainingMinutes,
    equivalentWorkDays,
  }
}

export function calculateSalaryPercentage(itemPrice: number, salary: number): string {
  if (salary <= 0 || itemPrice <= 0) return '0'
  return ((itemPrice / salary) * 100).toFixed(1)
}

export type WorkImpactTier = 'none' | 'light' | 'medium' | 'heavy'

export function calculateWorkImpactTier(
  salary: number,
  itemPrice: number,
  requiredHours: number
): WorkImpactTier {
  if (salary <= 0 || itemPrice <= 0) return 'none'
  if (requiredHours <= 4) return 'light'
  if (requiredHours <= 24) return 'medium'
  return 'heavy'
}
