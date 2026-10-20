import { describe, it, expect } from 'vitest'
import {
  advanceDate,
  getDeterministicTxId,
  calculateDueOccurrences,
  calculateMonthlyEquivalent,
  calculateNextDateOnEdit,
  getOccurrenceMonthIndex,
  isOccurrenceSkipped,
} from './recurring'
import type { Recurring } from '../types'

describe('recurring pure logic', () => {
  describe('advanceDate', () => {
    it('advances weekly by 7 days', () => {
      const d = new Date('2026-10-01T00:00:00Z')
      const next = advanceDate(d, 'weekly')
      expect(next.toISOString().slice(0, 10)).toBe('2026-10-08')
    })

    it('advances monthly by 1 month', () => {
      const d = new Date('2026-05-15T00:00:00Z')
      const next = advanceDate(d, 'monthly')
      expect(next.toISOString().slice(0, 10)).toBe('2026-06-15')
    })

    it('safely clamps month-end dates (Jan 31 -> Feb 28 in non-leap year)', () => {
      const d = new Date('2026-01-31T00:00:00Z')
      const next = advanceDate(d, 'monthly')
      expect(next.toISOString().slice(0, 10)).toBe('2026-02-28')
    })

    it('safely clamps month-end dates (Aug 31 -> Sep 30)', () => {
      const d = new Date('2026-08-31T00:00:00Z')
      const next = advanceDate(d, 'monthly')
      expect(next.toISOString().slice(0, 10)).toBe('2026-09-30')
    })

    it('advances yearly by 1 year', () => {
      const d = new Date('2026-10-04T00:00:00Z')
      const next = advanceDate(d, 'yearly')
      expect(next.toISOString().slice(0, 10)).toBe('2027-10-04')
    })
  })

  describe('getDeterministicTxId', () => {
    it('returns id in format recurringId_YYYY-MM-DD', () => {
      const d = new Date('2026-11-01T12:00:00Z')
      const id = getDeterministicTxId('rec-rent-123', d)
      expect(id).toBe('rec-rent-123_2026-11-01')
    })
  })

  describe('calculateDueOccurrences', () => {
    it('returns 0 dates when nextDate is in the future', () => {
      const rec: Recurring = {
        id: 'r1',
        type: 'expense',
        amountFils: 50000,
        categoryId: 'c1',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-10-01'),
        nextDate: new Date('2026-11-01'),
        active: true,
      }
      const today = new Date('2026-10-15')
      const result = calculateDueOccurrences(rec, today)

      expect(result.dates).toHaveLength(0)
      expect(result.newNextDate.getTime()).toBe(rec.nextDate.getTime())
      expect(result.shouldDeactivate).toBe(false)
    })

    it('returns 1 date when nextDate equals today', () => {
      const rec: Recurring = {
        id: 'r1',
        type: 'expense',
        amountFils: 50000,
        categoryId: 'c1',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-10-01'),
        nextDate: new Date('2026-10-01'),
        active: true,
      }
      const today = new Date('2026-10-01')
      const result = calculateDueOccurrences(rec, today)

      expect(result.dates).toHaveLength(1)
      expect(result.dates[0].toISOString().slice(0, 10)).toBe('2026-10-01')
      expect(result.newNextDate.toISOString().slice(0, 10)).toBe('2026-11-01')
      expect(result.shouldDeactivate).toBe(false)
    })

    it('catches up on multi-month backlog when user was away for 3 months', () => {
      const rec: Recurring = {
        id: 'r1',
        type: 'income',
        amountFils: 850000,
        categoryId: 'c1',
        note: 'راتب شهري',
        frequency: 'monthly',
        startDate: new Date('2026-07-01'),
        nextDate: new Date('2026-07-01'),
        active: true,
      }
      // Today is September 15 (3 occurrences: Jul 1, Aug 1, Sep 1)
      const today = new Date('2026-09-15')
      const result = calculateDueOccurrences(rec, today)

      expect(result.dates).toHaveLength(3)
      expect(result.dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
        '2026-07-01',
        '2026-08-01',
        '2026-09-01',
      ])
      // New nextDate should be Oct 1
      expect(result.newNextDate.toISOString().slice(0, 10)).toBe('2026-10-01')
      expect(result.shouldDeactivate).toBe(false)
    })

    it('sets shouldDeactivate to true when advancing past endDate', () => {
      const rec: Recurring = {
        id: 'r1',
        type: 'expense',
        amountFils: 20000,
        categoryId: 'c1',
        note: 'اشتراك محدود',
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        nextDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-01'), // expires on March 1st
        active: true,
      }
      const today = new Date('2026-04-01')
      const result = calculateDueOccurrences(rec, today)

      expect(result.dates).toHaveLength(1)
      expect(result.dates[0].toISOString().slice(0, 10)).toBe('2026-03-01')
      expect(result.shouldDeactivate).toBe(true)
    })

    it('preserves target day across short months (Jan 31 -> Feb 28 -> Mar 31)', () => {
      const rec: Recurring = {
        id: 'r31',
        type: 'expense',
        amountFils: 15000,
        categoryId: 'c1',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-01-31'),
        nextDate: new Date('2026-01-31'),
        active: true,
      }
      const today = new Date('2026-04-15')
      const result = calculateDueOccurrences(rec, today)

      expect(result.dates).toHaveLength(3)
      expect(result.dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
      ])
      // Next date after March 31 should be April 30 (Apr has 30 days)
      expect(result.newNextDate.toISOString().slice(0, 10)).toBe('2026-04-30')
    })

    it('processes due occurrence when user opens app in the morning (before 12:00 noon)', () => {
      // parseLocalDateInput sets nextDate to 12:00:00 local time
      const nextDateNoon = new Date(2026, 9, 15, 12, 0, 0)
      const rec: Recurring = {
        id: 'r-morning',
        type: 'expense',
        amountFils: 15000,
        categoryId: 'c1',
        note: '',
        frequency: 'monthly',
        startDate: new Date(2026, 8, 15, 12, 0, 0),
        nextDate: nextDateNoon,
        active: true,
      }

      // User opens app at 8:30 AM on the due date
      const todayMorning = new Date(2026, 9, 15, 8, 30, 0)
      const result = calculateDueOccurrences(rec, todayMorning)

      expect(result.dates).toHaveLength(1)
      expect(result.dates[0].getFullYear()).toBe(2026)
      expect(result.dates[0].getMonth()).toBe(9)
      expect(result.dates[0].getDate()).toBe(15)
    })
  })

  describe('calculateMonthlyEquivalent', () => {
    it('computes monthly equivalent in fils for active items only', () => {
      const items: Recurring[] = [
        {
          id: '1',
          type: 'income',
          amountFils: 850000, // 850 JOD monthly
          categoryId: 'c1',
          note: '',
          frequency: 'monthly',
          startDate: new Date(),
          nextDate: new Date(),
          active: true,
        },
        {
          id: '2',
          type: 'expense',
          amountFils: 100000, // 100 JOD monthly
          categoryId: 'c2',
          note: '',
          frequency: 'monthly',
          startDate: new Date(),
          nextDate: new Date(),
          active: true,
        },
        {
          id: '3',
          type: 'expense',
          amountFils: 120000, // 120 JOD yearly -> 10 JOD monthly
          categoryId: 'c3',
          note: '',
          frequency: 'yearly',
          startDate: new Date(),
          nextDate: new Date(),
          active: true,
        },
        {
          id: '4',
          type: 'expense',
          amountFils: 50000,
          categoryId: 'c4',
          note: '',
          frequency: 'monthly',
          startDate: new Date(),
          nextDate: new Date(),
          active: false, // PAUSED - should not count
        },
      ]

      const result = calculateMonthlyEquivalent(items)
      expect(result.monthlyIncome).toBe(850000)
      expect(result.monthlyExpense).toBe(110000) // 100000 + 10000
    })

    it('excludes expired recurring transactions whose endDate has passed before refDate', () => {
      const refDate = new Date(2026, 9, 20) // Oct 20, 2026
      const items: Recurring[] = [
        {
          id: '1',
          type: 'expense',
          amountFils: 50000,
          categoryId: 'c1',
          note: 'Active gym',
          frequency: 'monthly',
          startDate: new Date(2026, 0, 1),
          nextDate: new Date(2026, 9, 1),
          active: true,
          endDate: new Date(2026, 11, 31), // Dec 31, 2026 (future)
        },
        {
          id: '2',
          type: 'expense',
          amountFils: 30000,
          categoryId: 'c2',
          note: 'Expired subscription',
          frequency: 'monthly',
          startDate: new Date(2026, 0, 1),
          nextDate: new Date(2026, 7, 1),
          active: true, // still flagged active in DB, but endDate has passed!
          endDate: new Date(2026, 8, 30), // Sep 30, 2026 (past relative to Oct 20)
        },
        {
          id: '3',
          type: 'income',
          amountFils: 200000,
          categoryId: 'c3',
          note: 'Expired contract',
          frequency: 'monthly',
          startDate: new Date(2026, 0, 1),
          nextDate: new Date(2026, 5, 1),
          active: true,
          endDate: new Date(2026, 5, 30), // June 30, 2026 (past)
        },
      ]

      const result = calculateMonthlyEquivalent(items, refDate)
      expect(result.monthlyExpense).toBe(50000) // Only the active gym (50,000)
      expect(result.monthlyIncome).toBe(0) // Expired contract excluded
    })
  })

  describe('calculateNextDateOnEdit', () => {
    it('returns newStartDate when newStartDate is in the future', () => {
      const today = new Date(2026, 9, 15) // Oct 15, 2026
      const futureStart = new Date(2026, 10, 1) // Nov 1, 2026
      const nextDate = calculateNextDateOnEdit(futureStart, 'monthly', today)

      expect(nextDate.getFullYear()).toBe(2026)
      expect(nextDate.getMonth()).toBe(10)
      expect(nextDate.getDate()).toBe(1)
    })

    it('returns newStartDate when newStartDate is today', () => {
      const today = new Date(2026, 9, 15, 9, 0, 0)
      const startTodayNoon = new Date(2026, 9, 15, 12, 0, 0)
      const nextDate = calculateNextDateOnEdit(startTodayNoon, 'monthly', today)

      expect(nextDate.getDate()).toBe(15)
      expect(nextDate.getMonth()).toBe(9)
    })

    it('advances past start date to next upcoming date when newStartDate is in the past', () => {
      const today = new Date(2026, 9, 17) // Oct 17, 2026
      const pastStart = new Date(2026, 7, 20) // Aug 20, 2026

      // monthly: Aug 20 -> Sep 20 -> Oct 20 (upcoming)
      const nextDate = calculateNextDateOnEdit(pastStart, 'monthly', today)
      expect(nextDate.getFullYear()).toBe(2026)
      expect(nextDate.getMonth()).toBe(9) // October
      expect(nextDate.getDate()).toBe(20)
    })

    it('advances weekly past start date until reaching today or next cycle', () => {
      const today = new Date(2026, 9, 17) // Oct 17, 2026
      const pastStart = new Date(2026, 9, 3) // Oct 3 (+7 = Oct 10, +7 = Oct 17)

      const nextDate = calculateNextDateOnEdit(pastStart, 'weekly', today)
      expect(nextDate.getDate()).toBe(17)
      expect(nextDate.getMonth()).toBe(9)
    })
  })

  describe('Money Circle turn-month skipping logic', () => {
    it('calculates 1-based month index accurately', () => {
      const start = new Date(2026, 0, 1) // Jan 1, 2026
      expect(getOccurrenceMonthIndex(start, new Date(2026, 0, 1))).toBe(1)
      expect(getOccurrenceMonthIndex(start, new Date(2026, 1, 1))).toBe(2)
      expect(getOccurrenceMonthIndex(start, new Date(2026, 3, 1))).toBe(4)
      expect(getOccurrenceMonthIndex(start, new Date(2026, 9, 1))).toBe(10)
      // Dates before start date return actual diffMonths without clamping
      expect(getOccurrenceMonthIndex(start, new Date(2025, 11, 1))).toBe(0)
      expect(getOccurrenceMonthIndex(start, new Date(2025, 10, 1))).toBe(-1)
    })

    it('identifies when an occurrence is the skipped turn month', () => {
      const rec: Recurring = {
        id: 'r_circle',
        type: 'expense',
        amountFils: 100000,
        categoryId: 'c1',
        note: 'جمعية الأهل',
        frequency: 'monthly',
        startDate: new Date(2026, 0, 1), // Jan 1
        nextDate: new Date(2026, 0, 1),
        active: true,
        circleId: 'circle_123',
        skipMonth: 4, // Turn is Month 4 (April)
      }

      // Jan (Month 1): not skipped
      expect(isOccurrenceSkipped(rec, new Date(2026, 0, 1))).toBe(false)
      // Mar (Month 3): not skipped
      expect(isOccurrenceSkipped(rec, new Date(2026, 2, 1))).toBe(false)
      // Apr (Month 4): SKIPPED! (User's turn to receive payout)
      expect(isOccurrenceSkipped(rec, new Date(2026, 3, 1))).toBe(true)
      // May (Month 5): not skipped
      expect(isOccurrenceSkipped(rec, new Date(2026, 4, 1))).toBe(false)
    })

    it('skips generating transaction for the turn month in calculateDueOccurrences', () => {
      // Circle started in Jan, today is May 15. User turn is Month 4 (April).
      const rec: Recurring = {
        id: 'r_circle',
        type: 'expense',
        amountFils: 100000,
        categoryId: 'c1',
        note: 'جمعية الأهل',
        frequency: 'monthly',
        startDate: new Date(2026, 0, 1), // Jan 1, 2026
        nextDate: new Date(2026, 0, 1),
        active: true,
        circleId: 'circle_123',
        skipMonth: 4, // April should NOT be deducted
      }

      const today = new Date(2026, 4, 15) // May 15, 2026
      const result = calculateDueOccurrences(rec, today)

      // Expected occurrences up to May 15:
      // Month 1 (Jan 1) -> included
      // Month 2 (Feb 1) -> included
      // Month 3 (Mar 1) -> included
      // Month 4 (Apr 1) -> SKIPPED (user's turn to receive payout!)
      // Month 5 (May 1) -> included
      expect(result.dates.length).toBe(4) // 4 dates instead of 5
      const dateStrings = result.dates.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
      expect(dateStrings).toContain('2026-1-1')
      expect(dateStrings).toContain('2026-2-1')
      expect(dateStrings).toContain('2026-3-1')
      expect(dateStrings).not.toContain('2026-4-1') // April must NOT be in the created transactions!
      expect(dateStrings).toContain('2026-5-1')

      // nextDate should still correctly advance to June 1
      expect(result.newNextDate.getMonth()).toBe(5) // June
    })

    it('waives monthly expense in calculateMonthlyEquivalent during the turn month', () => {
      const circleRec: Recurring = {
        id: 'r_circle',
        type: 'expense',
        amountFils: 100000,
        categoryId: 'c1',
        note: 'جمعية',
        frequency: 'monthly',
        startDate: new Date(2026, 0, 1),
        nextDate: new Date(2026, 3, 1),
        active: true,
        circleId: 'c1',
        skipMonth: 4,
      }

      // In March (Month 3): expense is counted
      const marchResult = calculateMonthlyEquivalent([circleRec], new Date(2026, 2, 15))
      expect(marchResult.monthlyExpense).toBe(100000)

      // In April (Month 4 - User's turn): expense is 0! (waived)
      const aprilResult = calculateMonthlyEquivalent([circleRec], new Date(2026, 3, 15))
      expect(aprilResult.monthlyExpense).toBe(0)
    })

    it('waives monthly expense in calculateMonthlyEquivalent when referenceDate is start of custom cycle (e.g. Sep 25)', () => {
      // Circle started Jan 1, 2026. Month 10 is October.
      const circleRec: Recurring = {
        id: 'r_circle_custom',
        type: 'expense',
        amountFils: 150000,
        categoryId: 'c1',
        note: 'جمعية قسط',
        frequency: 'monthly',
        startDate: new Date(2026, 0, 1),
        nextDate: new Date(2026, 9, 1), // Oct 1, 2026 (Month 10)
        active: true,
        circleId: 'c1',
        skipMonth: 10, // Month 10 is the user's turn
      }

      // Financial cycle for October with monthStartDay = 25 starts on Sep 25, 2026
      const sep25RangeStart = new Date(2026, 8, 25, 0, 0, 0, 0)
      const res = calculateMonthlyEquivalent([circleRec], sep25RangeStart)
      expect(res.monthlyExpense).toBe(0)
    })
  })
})

