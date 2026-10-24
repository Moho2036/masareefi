import { describe, it, expect } from 'vitest'
import {
  getFinancialMonthRange,
  formatMonthLabel,
  formatFinancialMonthLabel,
  formatFinancialRangeLabel,
  formatDayHeader,
  parseLocalDateInput,
  formatDateInput,
  getMonthRange,
  getFiscalMonthInfo,
  getFiscalMonthKey,
  getPreviousFinancialMonth,
  getNextFinancialMonth,
} from './dates'

describe('dates lib', () => {
  describe('formatFinancialRangeLabel', () => {
    it('formats custom financial month range into readable Arabic range', () => {
      // e.g. start Sep 25, end Oct 25 -> "25 سبتمبر - 24 أكتوبر"
      const range = {
        start: new Date(2026, 8, 25),
        end: new Date(2026, 9, 25),
      }
      expect(formatFinancialRangeLabel(range)).toBe('25 سبتمبر - 24 أكتوبر')
    })
  })
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

  describe('formatFinancialMonthLabel', () => {
    it('returns single month when monthStartDay is 1', () => {
      const range = {
        start: new Date(2026, 9, 1),
        end: new Date(2026, 10, 1),
      }
      expect(formatFinancialMonthLabel(range, 1)).toBe('أكتوبر 2026')
    })

    it('returns both months when monthStartDay > 1 within the same year', () => {
      const range = {
        start: new Date(2026, 2, 25), // 25 March 2026
        end: new Date(2026, 3, 25), // 25 April 2026
      }
      expect(formatFinancialMonthLabel(range, 25)).toBe('مارس / أبريل 2026')
    })

    it('returns both months with years when spanning across years', () => {
      const range = {
        start: new Date(2025, 11, 25), // 25 Dec 2025
        end: new Date(2026, 0, 25), // 25 Jan 2026
      }
      expect(formatFinancialMonthLabel(range, 25)).toBe('ديسمبر 2025 / يناير 2026')
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

  describe('parseLocalDateInput', () => {
    it('parses YYYY-MM-DD into a Date at midday local time', () => {
      const d = parseLocalDateInput('2026-10-05')
      expect(d.getFullYear()).toBe(2026)
      expect(d.getMonth()).toBe(9) // 0-indexed October
      expect(d.getDate()).toBe(5)
      expect(d.getHours()).toBe(12)
    })

    it('correctly handles month boundaries', () => {
      const firstDay = parseLocalDateInput('2026-10-01')
      expect(firstDay.getFullYear()).toBe(2026)
      expect(firstDay.getMonth()).toBe(9)
      expect(firstDay.getDate()).toBe(1)
      expect(firstDay.getHours()).toBe(12)

      const lastDay = parseLocalDateInput('2026-10-31')
      expect(lastDay.getFullYear()).toBe(2026)
      expect(lastDay.getMonth()).toBe(9)
      expect(lastDay.getDate()).toBe(31)
      expect(lastDay.getHours()).toBe(12)
    })
  })

  describe('getMonthRange', () => {
    it('returns exact [start, end) for calendar month when monthStartDay is 1', () => {
      const jan = getMonthRange(2026, 0, 1)
      expect(jan.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
      expect(jan.end).toEqual(new Date(2026, 1, 1, 0, 0, 0, 0))

      const dec = getMonthRange(2026, 11, 1)
      expect(dec.start).toEqual(new Date(2026, 11, 1, 0, 0, 0, 0))
      expect(dec.end).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0))
    })

    it('returns exact [start, end) for custom monthStartDay (e.g. 25)', () => {
      const janCycle = getMonthRange(2026, 0, 25)
      expect(janCycle.start).toEqual(new Date(2026, 0, 25, 0, 0, 0, 0))
      expect(janCycle.end).toEqual(new Date(2026, 1, 25, 0, 0, 0, 0))

      const decCycle = getMonthRange(2026, 11, 25)
      expect(decCycle.start).toEqual(new Date(2026, 11, 25, 0, 0, 0, 0))
      expect(decCycle.end).toEqual(new Date(2027, 0, 25, 0, 0, 0, 0))
    })
  })

  describe('getFiscalMonthInfo and getFiscalMonthKey', () => {
    it('identifies fiscal month for monthStartDay = 1', () => {
      const info = getFiscalMonthInfo(new Date(2026, 9, 15), 1)
      expect(info.year).toBe(2026)
      expect(info.monthIndex).toBe(9)
      expect(info.key).toBe('2026-10')
      expect(getFiscalMonthKey(new Date(2026, 9, 15), 1)).toBe('2026-10')
    })

    it('identifies fiscal month when date is before custom monthStartDay (e.g. Oct 10 with startDay 25)', () => {
      // Oct 10 with startDay 25 belongs to previous month's cycle (September, monthIndex 8)
      const info = getFiscalMonthInfo(new Date(2026, 9, 10), 25)
      expect(info.year).toBe(2026)
      expect(info.monthIndex).toBe(8)
      expect(info.key).toBe('2026-09')
    })

    it('identifies fiscal month when date is on/after custom monthStartDay (e.g. Oct 25 with startDay 25)', () => {
      // Oct 25 belongs to October cycle (monthIndex 9)
      const info = getFiscalMonthInfo(new Date(2026, 9, 25), 25)
      expect(info.year).toBe(2026)
      expect(info.monthIndex).toBe(9)
      expect(info.key).toBe('2026-10')
    })

    it('handles year boundary rollover (Jan 5 with startDay 25 -> previous year Dec cycle)', () => {
      const info = getFiscalMonthInfo(new Date(2026, 0, 5), 25)
      expect(info.year).toBe(2025)
      expect(info.monthIndex).toBe(11)
      expect(info.key).toBe('2025-12')
    })
  })

  describe('formatDateInput', () => {
    it('formats a date into local YYYY-MM-DD string', () => {
      const d = new Date(2026, 9, 19, 15, 30) // Oct 19, 2026
      expect(formatDateInput(d)).toBe('2026-10-19')
    })
  })

  describe('getPreviousFinancialMonth and getNextFinancialMonth (Navigation Symmetry & Drift Prevention)', () => {
    it('is 100% reversible across all 12 months with various monthStartDay values', () => {
      const testStartDays = [1, 5, 15, 25, 28]

      for (const startDay of testStartDays) {
        for (let month = 0; month < 12; month++) {
          const originalDate = new Date(2026, month, startDay)
          const originalRange = getFinancialMonthRange(originalDate, startDay)

          // Step back, then step forward -> must equal originalRange
          const prev = getPreviousFinancialMonth(originalDate, startDay)
          const backToOriginal = getNextFinancialMonth(prev, startDay)
          const restoredRange = getFinancialMonthRange(backToOriginal, startDay)

          expect(restoredRange.start.getTime()).toBe(originalRange.start.getTime())
          expect(restoredRange.end.getTime()).toBe(originalRange.end.getTime())

          // Step forward, then step back -> must equal originalRange
          const next = getNextFinancialMonth(originalDate, startDay)
          const forwardBack = getPreviousFinancialMonth(next, startDay)
          const forwardBackRange = getFinancialMonthRange(forwardBack, startDay)

          expect(forwardBackRange.start.getTime()).toBe(originalRange.start.getTime())
          expect(forwardBackRange.end.getTime()).toBe(originalRange.end.getTime())
        }
      }
    })

    it('prevents date drift across February (28 days) with monthStartDay = 28', () => {
      // Starting in March with startDay 28
      const mar28 = new Date(2026, 2, 28) // March 28
      const feb = getPreviousFinancialMonth(mar28, 28)
      expect(feb.getMonth()).toBe(1) // February
      expect(feb.getDate()).toBe(28)

      // Stepping back into January
      const jan = getPreviousFinancialMonth(feb, 28)
      expect(jan.getMonth()).toBe(0) // January
      expect(jan.getDate()).toBe(28)

      // Stepping forward from January to February to March
      const backToFeb = getNextFinancialMonth(jan, 28)
      expect(backToFeb.getMonth()).toBe(1)
      expect(backToFeb.getDate()).toBe(28)

      const backToMar = getNextFinancialMonth(backToFeb, 28)
      expect(backToMar.getMonth()).toBe(2)
      expect(backToMar.getDate()).toBe(28)
    })

    it('handles refDate on day 31 safely without jumping or shifting periods', () => {
      // E.g. User is on March 31 with monthStartDay = 28
      const mar31 = new Date(2026, 2, 31)
      const currentRange = getFinancialMonthRange(mar31, 28)

      const prev = getPreviousFinancialMonth(mar31, 28)
      const next = getNextFinancialMonth(prev, 28)
      const newRange = getFinancialMonthRange(next, 28)

      expect(newRange.start.getTime()).toBe(currentRange.start.getTime())
      expect(newRange.end.getTime()).toBe(currentRange.end.getTime())
    })

    it('navigates across year boundaries seamlessly (Dec <-> Jan)', () => {
      const dec = new Date(2025, 11, 15) // Dec 15, 2025
      const jan = getNextFinancialMonth(dec, 1)
      expect(jan.getFullYear()).toBe(2026)
      expect(jan.getMonth()).toBe(0)

      const backToDec = getPreviousFinancialMonth(jan, 1)
      expect(backToDec.getFullYear()).toBe(2025)
      expect(backToDec.getMonth()).toBe(11)
    })
  })
})
