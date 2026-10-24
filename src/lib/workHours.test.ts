import { describe, it, expect } from 'vitest'
import {
  clampWorkHoursPerDay,
  clampWorkDaysPerWeek,
  clampWorkDaysPerMonth,
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

    it('preserves valid values between 1 and 31', () => {
      expect(clampWorkDaysPerMonth(1)).toBe(1)
      expect(clampWorkDaysPerMonth(22)).toBe(22)
      expect(clampWorkDaysPerMonth(31)).toBe(31)
    })
  })
})
