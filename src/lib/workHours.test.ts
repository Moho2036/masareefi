import { describe, it, expect } from 'vitest'
import {
  parseNumeric,
  clampWorkHoursPerDay,
  clampWorkDaysPerWeek,
  clampWorkDaysPerMonth,
  normalizeMonthlyWorkingDays,
  calculateTotalMonthlyHours,
  calculateHourlyWageFils,
  calculateHoursRequired,
  calculateWorkTimeBreakdown,
  calculateSalaryPercentage,
  calculateWorkImpactTier,
} from './workHours'

describe('workHours logic', () => {
  describe('clampWorkHoursPerDay', () => {
    it('clamps upper bound to 24 hours per day', () => {
      expect(clampWorkHoursPerDay(25)).toBe(24)
      expect(clampWorkHoursPerDay(30)).toBe(24)
      expect(clampWorkHoursPerDay(100)).toBe(24)
    })

    it('clamps lower bound to 1 hour per day on calculation', () => {
      expect(clampWorkHoursPerDay(0)).toBe(1)
      expect(clampWorkHoursPerDay(-5)).toBe(1)
    })

    it('falls back to default 8 when given NaN or non-finite numbers', () => {
      expect(clampWorkHoursPerDay(NaN)).toBe(8)
      expect(clampWorkHoursPerDay(Infinity)).toBe(8)
      expect(clampWorkHoursPerDay(-Infinity)).toBe(8)
    })

    it('preserves valid values between 1 and 24', () => {
      expect(clampWorkHoursPerDay(1)).toBe(1)
      expect(clampWorkHoursPerDay(8)).toBe(8)
      expect(clampWorkHoursPerDay(12)).toBe(12)
      expect(clampWorkHoursPerDay(24)).toBe(24)
    })
  })

  describe('clampWorkDaysPerWeek', () => {
    it('clamps upper bound to 7 days per week', () => {
      expect(clampWorkDaysPerWeek(8)).toBe(7)
      expect(clampWorkDaysPerWeek(10)).toBe(7)
    })

    it('clamps lower bound to 1 day per week on calculation', () => {
      expect(clampWorkDaysPerWeek(0)).toBe(1)
      expect(clampWorkDaysPerWeek(-1)).toBe(1)
    })

    it('falls back to default 5 when given NaN or non-finite numbers', () => {
      expect(clampWorkDaysPerWeek(NaN)).toBe(5)
      expect(clampWorkDaysPerWeek(Infinity)).toBe(5)
    })

    it('preserves valid values between 1 and 7', () => {
      expect(clampWorkDaysPerWeek(1)).toBe(1)
      expect(clampWorkDaysPerWeek(5)).toBe(5)
      expect(clampWorkDaysPerWeek(7)).toBe(7)
    })
  })

  describe('clampWorkDaysPerMonth', () => {
    it('clamps upper bound to 31 days per month', () => {
      expect(clampWorkDaysPerMonth(32)).toBe(31)
      expect(clampWorkDaysPerMonth(45)).toBe(31)
    })

    it('clamps lower bound to 1 day per month on calculation', () => {
      expect(clampWorkDaysPerMonth(0)).toBe(1)
      expect(clampWorkDaysPerMonth(-2)).toBe(1)
    })

    it('falls back to default 22 when given NaN or non-finite numbers', () => {
      expect(clampWorkDaysPerMonth(NaN)).toBe(22)
      expect(clampWorkDaysPerMonth(Infinity)).toBe(22)
    })

    it('preserves valid values between 1 and 31', () => {
      expect(clampWorkDaysPerMonth(1)).toBe(1)
      expect(clampWorkDaysPerMonth(22)).toBe(22)
      expect(clampWorkDaysPerMonth(31)).toBe(31)
    })
  })

  describe('normalizeMonthlyWorkingDays', () => {
    it('normalizes days in week mode with 52/12 multiplier', () => {
      expect(normalizeMonthlyWorkingDays(5, 'week')).toBeCloseTo(5 * (52 / 12), 4)
      expect(normalizeMonthlyWorkingDays(0, 'week')).toBeCloseTo(5 * (52 / 12), 4) // defaults to 5
      expect(normalizeMonthlyWorkingDays(6, 'week')).toBeCloseTo(6 * (52 / 12), 4)
      expect(normalizeMonthlyWorkingDays(10, 'week')).toBeCloseTo(7 * (52 / 12), 4) // clamped to 7
    })

    it('normalizes days in month mode', () => {
      expect(normalizeMonthlyWorkingDays(22, 'month')).toBe(22)
      expect(normalizeMonthlyWorkingDays(0, 'month')).toBe(22) // defaults to 22
      expect(normalizeMonthlyWorkingDays(-5, 'month')).toBe(22)
      expect(normalizeMonthlyWorkingDays(30, 'month')).toBe(30)
      expect(normalizeMonthlyWorkingDays(40, 'month')).toBe(31) // clamped to 31
    })
  })

  describe('calculateTotalMonthlyHours', () => {
    it('calculates product of daily hours and monthly working days', () => {
      expect(calculateTotalMonthlyHours(8, 22)).toBe(176)
      expect(calculateTotalMonthlyHours(0, 20)).toBe(160) // daily hours defaults to 8
      expect(calculateTotalMonthlyHours(10, 0)).toBe(1) // at least 1 hour
    })
  })

  describe('calculateHourlyWageFils', () => {
    it('calculates hourly wage in fils', () => {
      // 500 JOD / 176 hours = 2.8409 JOD = 2841 fils
      expect(calculateHourlyWageFils(500, 176)).toBe(2841)
      // 0 or negative salary
      expect(calculateHourlyWageFils(0, 176)).toBe(0)
      expect(calculateHourlyWageFils(-100, 176)).toBe(0)
      // 0 hours
      expect(calculateHourlyWageFils(500, 0)).toBe(0)
    })
  })

  describe('calculateHoursRequired', () => {
    it('calculates required hours to purchase item', () => {
      // Item: 250 JOD = 250,000 fils, Hourly wage: 2841 fils -> 88.0 hours
      const wage = calculateHourlyWageFils(500, 176)
      const hours = calculateHoursRequired(250, wage)
      expect(hours).toBeCloseTo(250000 / 2841, 2)
      // Edge cases
      expect(calculateHoursRequired(0, wage)).toBe(0)
      expect(calculateHoursRequired(250, 0)).toBe(0)
    })
  })

  describe('calculateWorkTimeBreakdown', () => {
    it('safely handles non-finite or non-positive required hours', () => {
      const zeroBreakdown = {
        totalMinutes: 0,
        fullHours: 0,
        remainingMinutes: 0,
        equivalentWorkDays: '0.0',
      }
      expect(calculateWorkTimeBreakdown(0)).toEqual(zeroBreakdown)
      expect(calculateWorkTimeBreakdown(-5)).toEqual(zeroBreakdown)
      expect(calculateWorkTimeBreakdown(NaN)).toEqual(zeroBreakdown)
      expect(calculateWorkTimeBreakdown(Infinity)).toEqual(zeroBreakdown)
    })

    it('formats breakdown into minutes, hours, and equivalent work days', () => {
      // 10.5 hours with 8 daily hours
      const breakdown = calculateWorkTimeBreakdown(10.5, 8)
      expect(breakdown.totalMinutes).toBe(630)
      expect(breakdown.fullHours).toBe(10)
      expect(breakdown.remainingMinutes).toBe(30)
      expect(breakdown.equivalentWorkDays).toBe('1.3')
    })
  })

  describe('calculateSalaryPercentage', () => {
    it('computes percentage as a formatted string', () => {
      expect(calculateSalaryPercentage(250, 500)).toBe('50.0')
      expect(calculateSalaryPercentage(50, 500)).toBe('10.0')
      expect(calculateSalaryPercentage(0, 500)).toBe('0')
      expect(calculateSalaryPercentage(250, 0)).toBe('0')
    })
  })

  describe('calculateWorkImpactTier', () => {
    it('determines the psychological impact tier', () => {
      expect(calculateWorkImpactTier(0, 50, 2)).toBe('none')
      expect(calculateWorkImpactTier(500, 0, 0)).toBe('none')
      expect(calculateWorkImpactTier(500, 10, 3.5)).toBe('light') // <= 4
      expect(calculateWorkImpactTier(500, 50, 17.5)).toBe('medium') // <= 24
      expect(calculateWorkImpactTier(500, 250, 88)).toBe('heavy') // > 24
    })
  })

  describe('parseNumeric', () => {
    it('handles thousands separator comma when followed by 3 digits', () => {
      expect(parseNumeric('12,500')).toBe(12500)
      expect(parseNumeric('1,000')).toBe(1000)
      expect(parseNumeric('1,500')).toBe(1500)
      expect(parseNumeric('1,000,000')).toBe(1000000)
    })

    it('handles decimal comma when not followed by 3 digits or when starting with 0', () => {
      expect(parseNumeric('50,5')).toBe(50.5)
      expect(parseNumeric('50,25')).toBe(50.25)
      expect(parseNumeric('0,5')).toBe(0.5)
      expect(parseNumeric('0,500')).toBe(0.5)
    })

    it('handles Arabic decimal comma (٫) and Arabic comma (،)', () => {
      expect(parseNumeric('50٫5')).toBe(50.5)
      expect(parseNumeric('50،5')).toBe(50.5)
      expect(parseNumeric('12،500')).toBe(12500)
    })

    it('strips internal whitespace and invisible bidirectional characters', () => {
      expect(parseNumeric(' 1 500 ')).toBe(1500)
      expect(parseNumeric('١ ٥٠٠')).toBe(1500)
      expect(parseNumeric('\u200E1500\u200F')).toBe(1500)
      expect(parseNumeric('\u202A 12,500 \u202C')).toBe(12500)
      expect(parseNumeric('\u2066 50.5 \u2069')).toBe(50.5)
    })

    it('handles empty or invalid string gracefully', () => {
      expect(parseNumeric('')).toBe(0)
      expect(parseNumeric('abc')).toBe(0)
    })
  })
})
