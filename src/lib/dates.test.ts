import { describe, it, expect } from 'vitest'
import { getFinancialMonthRange, formatMonthLabel, formatDayHeader } from './dates'

describe('dates lib', () => {
  describe('getFinancialMonthRange', () => {
    it('handles default monthStartDay = 1 (calendar month)', () => {
      const refDate = new Date(2026, 9, 10) // Oct 10, 2026
      const { start, end } = getFinancialMonthRange(refDate, 1)

      expect(start).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0))
      expect(end).toEqual(new Date(2026, 10, 1, 0, 0, 0, 0))
    })

    it('handles refDate before monthStartDay (e.g. Oct 10 with startDay 25)', () => {
      // Prompt spec: if startDay=25 and ref is Oct 10 -> Sep 25..Oct 25
      const refDate = new Date(2026, 9, 10) // Oct 10, 2026
      const { start, end } = getFinancialMonthRange(refDate, 25)

      expect(start).toEqual(new Date(2026, 8, 25, 0, 0, 0, 0)) // Sep 25
      expect(end).toEqual(new Date(2026, 9, 25, 0, 0, 0, 0)) // Oct 25
    })

    it('handles refDate on monthStartDay (e.g. Oct 25 with startDay 25)', () => {
      const refDate = new Date(2026, 9, 25) // Oct 25, 2026
      const { start, end } = getFinancialMonthRange(refDate, 25)

      expect(start).toEqual(new Date(2026, 9, 25, 0, 0, 0, 0)) // Oct 25
      expect(end).toEqual(new Date(2026, 10, 25, 0, 0, 0, 0)) // Nov 25
    })

    it('handles refDate after monthStartDay (e.g. Oct 26 with startDay 25)', () => {
      // Prompt spec: ref Oct 26 -> Oct 25..Nov 25
      const refDate = new Date(2026, 9, 26) // Oct 26, 2026
      const { start, end } = getFinancialMonthRange(refDate, 25)

      expect(start).toEqual(new Date(2026, 9, 25, 0, 0, 0, 0)) // Oct 25
      expect(end).toEqual(new Date(2026, 10, 25, 0, 0, 0, 0)) // Nov 25
    })

    it('handles year boundary when rolling back to December (Jan 5 with startDay 25)', () => {
      const refDate = new Date(2026, 0, 5) // Jan 5, 2026
      const { start, end } = getFinancialMonthRange(refDate, 25)

      expect(start).toEqual(new Date(2025, 11, 25, 0, 0, 0, 0)) // Dec 25, 2025
      expect(end).toEqual(new Date(2026, 0, 25, 0, 0, 0, 0)) // Jan 25, 2026
    })

    it('handles year boundary when rolling forward into January (Dec 28 with startDay 25)', () => {
      const refDate = new Date(2025, 11, 28) // Dec 28, 2025
      const { start, end } = getFinancialMonthRange(refDate, 25)

      expect(start).toEqual(new Date(2025, 11, 25, 0, 0, 0, 0)) // Dec 25, 2025
      expect(end).toEqual(new Date(2026, 0, 25, 0, 0, 0, 0)) // Jan 25, 2026
    })

    it('clamps monthStartDay safely between 1 and 28', () => {
      const refDate = new Date(2026, 9, 15)
      const rangeUnder = getFinancialMonthRange(refDate, 0)
      expect(rangeUnder.start.getDate()).toBe(1)

      const rangeOver = getFinancialMonthRange(refDate, 31)
      expect(rangeOver.start.getDate()).toBe(28)
    })
  })

  describe('formatMonthLabel', () => {
    it('formats month and year in Arabic with Western digits', () => {
      expect(formatMonthLabel(new Date(2026, 9, 4))).toBe('أكتوبر 2026')
      expect(formatMonthLabel(new Date(2025, 0, 1))).toBe('يناير 2025')
    })
  })

  describe('formatDayHeader', () => {
    // In October 2026:
    // Oct 4 is Sunday (الأحد)
    // Oct 3 is Saturday (السبت)
    // Oct 2 is Friday (الجمعة)
    // Oct 1 is Thursday (الخميس)
    const sundayOct4 = new Date(2026, 9, 4)
    const saturdayOct3 = new Date(2026, 9, 3)
    const thursdayOct1 = new Date(2026, 9, 1)

    it('formats today with "اليوم - "', () => {
      expect(formatDayHeader(sundayOct4, sundayOct4)).toBe('اليوم - الأحد 4 أكتوبر')
      expect(formatDayHeader(saturdayOct3, saturdayOct3)).toBe('اليوم - السبت 3 أكتوبر')
    })

    it('formats yesterday with "أمس - "', () => {
      expect(formatDayHeader(saturdayOct3, sundayOct4)).toBe('أمس - السبت 3 أكتوبر')
    })

    it('formats older days without today/yesterday prefix', () => {
      expect(formatDayHeader(thursdayOct1, sundayOct4)).toBe('الخميس 1 أكتوبر')
    })
  })
})
