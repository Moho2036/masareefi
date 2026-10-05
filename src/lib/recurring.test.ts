import { describe, it, expect } from 'vitest'
import {
  advanceDate,
  getDeterministicTxId,
  calculateDueOccurrences,
  calculateMonthlyEquivalent,
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
  })
})
