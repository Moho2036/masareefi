import { describe, it, expect } from 'vitest'
import {
  calculateDailyExpenses,
  calculateCategoryDistribution,
  calculateYearlyBreakdown,
  calculateSavingsRate,
  calculateYearlyMonthlyAverage,
  calculateAnnualSummary,
  ARABIC_MONTH_NAMES,
} from './reports'
import type { Transaction, Category } from '../types'

describe('Reporting Logic (src/lib/reports.ts)', () => {
  const mockCategories: Category[] = [
    { id: 'cat-food', name: 'طعام وبقالة', type: 'expense', icon: '🛒', color: '#10B981', archived: false, order: 0 },
    { id: 'cat-rent', name: 'إيجار وسكن', type: 'expense', icon: '🏠', color: '#EF4444', archived: false, order: 1 },
    { id: 'cat-salary', name: 'راتب شهري', type: 'income', icon: '💼', color: '#3B82F6', archived: false, order: 2 },
  ]

  describe('calculateDailyExpenses', () => {
    it('returns empty array when start date >= end date', () => {
      const start = new Date(2026, 9, 10)
      const end = new Date(2026, 9, 5)
      expect(calculateDailyExpenses([], start, end)).toEqual([])
    })

    it('returns zero-filled array of days for empty transactions', () => {
      const start = new Date(2026, 9, 1) // Oct 1, 2026
      const end = new Date(2026, 9, 4) // Oct 4, 2026 (3 days: 1, 2, 3)
      const result = calculateDailyExpenses([], start, end)

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ day: 1, date: new Date(2026, 9, 1), amountFils: 0 })
      expect(result[1]).toEqual({ day: 2, date: new Date(2026, 9, 2), amountFils: 0 })
      expect(result[2]).toEqual({ day: 3, date: new Date(2026, 9, 3), amountFils: 0 })
    })

    it('correctly aggregates multiple expense transactions on specific days and ignores income', () => {
      const start = new Date(2026, 9, 1)
      const end = new Date(2026, 9, 5) // 4 days: 1, 2, 3, 4

      const txs: Transaction[] = [
        {
          id: 'tx-1',
          type: 'expense',
          amountFils: 5000,
          categoryId: 'cat-food',
          date: new Date(2026, 9, 2, 14, 30),
          note: 'غداء',
          createdAt: new Date(),
        },
        {
          id: 'tx-2',
          type: 'expense',
          amountFils: 3500,
          categoryId: 'cat-food',
          date: new Date(2026, 9, 2, 19, 0),
          note: 'عشاء',
          createdAt: new Date(),
        },
        {
          id: 'tx-3',
          type: 'income',
          amountFils: 100000,
          categoryId: 'cat-salary',
          date: new Date(2026, 9, 2, 10, 0),
          note: 'راتب',
          createdAt: new Date(),
        },
        {
          id: 'tx-4',
          type: 'expense',
          amountFils: 20000,
          categoryId: 'cat-rent',
          date: new Date(2026, 9, 4, 8, 0),
          note: 'قسط',
          createdAt: new Date(),
        },
      ]

      const result = calculateDailyExpenses(txs, start, end)

      expect(result).toHaveLength(4)
      expect(result[0]).toEqual({ day: 1, date: new Date(2026, 9, 1), amountFils: 0 })
      expect(result[1]).toEqual({ day: 2, date: new Date(2026, 9, 2), amountFils: 8500 }) // 5000 + 3500, income ignored
      expect(result[2]).toEqual({ day: 3, date: new Date(2026, 9, 3), amountFils: 0 })
      expect(result[3]).toEqual({ day: 4, date: new Date(2026, 9, 4), amountFils: 20000 })
    })

    it('generates exact number of calendar days without DST skipping or infinite loop', () => {
      // Month of October (31 days) where DST changes frequently occur
      const start = new Date(2026, 9, 1, 0, 0, 0)
      const end = new Date(2026, 10, 1, 0, 0, 0) // Exclusive end: Nov 1
      const result = calculateDailyExpenses([], start, end)

      expect(result).toHaveLength(31)
      expect(result[0].day).toBe(1)
      expect(result[30].day).toBe(31)
      // Every subsequent entry has day = previous + 1
      for (let i = 0; i < result.length; i++) {
        expect(result[i].day).toBe(i + 1)
      }
    })
  })

  describe('calculateCategoryDistribution', () => {
    it('returns empty array when transactions are empty', () => {
      const result = calculateCategoryDistribution([], mockCategories)
      expect(result).toEqual([])
    })

    it('calculates distribution with percentages summing to 100% and sorts descending', () => {
      const txs: Transaction[] = [
        {
          id: '1',
          type: 'expense',
          amountFils: 60000, // 60%
          categoryId: 'cat-rent',
          date: new Date(),
          note: 'إيجار',
          createdAt: new Date(),
        },
        {
          id: '2',
          type: 'expense',
          amountFils: 30000, // 30%
          categoryId: 'cat-food',
          date: new Date(),
          note: 'سوبرماركت',
          createdAt: new Date(),
        },
        {
          id: '3',
          type: 'expense',
          amountFils: 10000, // 10%
          categoryId: 'cat-food',
          date: new Date(),
          note: 'خضار',
          createdAt: new Date(),
        },
      ]

      const result = calculateCategoryDistribution(txs, mockCategories)

      expect(result).toHaveLength(2)
      // Rent is 60000 (60%)
      expect(result[0].categoryId).toBe('cat-rent')
      expect(result[0].amountFils).toBe(60000)
      expect(result[0].percentage).toBe(60)
      expect(result[0].name).toBe('إيجار وسكن')

      // Food is 40000 (40%)
      expect(result[1].categoryId).toBe('cat-food')
      expect(result[1].amountFils).toBe(40000)
      expect(result[1].percentage).toBe(40)
      expect(result[1].name).toBe('طعام وبقالة')

      const sumPercent = result.reduce((acc, item) => acc + item.percentage, 0)
      expect(sumPercent).toBe(100)
    })

    it('falls back to "غير مصنف" for unmapped category IDs', () => {
      const txs: Transaction[] = [
        {
          id: '1',
          type: 'expense',
          amountFils: 15000,
          categoryId: 'unknown-cat-id',
          date: new Date(),
          note: 'شيء غير مصنف',
          createdAt: new Date(),
        },
      ]

      const result = calculateCategoryDistribution(txs, mockCategories)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('غير مصنف')
      expect(result[0].icon).toBe('📁')
      expect(result[0].color).toBe('#94A3B8')
      expect(result[0].percentage).toBe(100)
    })
  })

  describe('calculateYearlyBreakdown', () => {
    it('returns exactly 12 months with zero-fill when transactions are empty', () => {
      const breakdown = calculateYearlyBreakdown([], 2026)

      expect(breakdown).toHaveLength(12)
      expect(breakdown[0].monthName).toBe(ARABIC_MONTH_NAMES[0])
      expect(breakdown[11].monthName).toBe(ARABIC_MONTH_NAMES[11])

      for (let i = 0; i < 12; i++) {
        expect(breakdown[i].income).toBe(0)
        expect(breakdown[i].expense).toBe(0)
        expect(breakdown[i].balance).toBe(0)
        expect(breakdown[i].monthIndex).toBe(i)
      }
    })

    it('aggregates transactions into respective months and ignores other years', () => {
      const txs: Transaction[] = [
        // Jan 2026 (month 0)
        {
          id: '1',
          type: 'income',
          amountFils: 800000,
          categoryId: 'cat-salary',
          date: new Date(2026, 0, 15),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '2',
          type: 'expense',
          amountFils: 300000,
          categoryId: 'cat-rent',
          date: new Date(2026, 0, 20),
          note: '',
          createdAt: new Date(),
        },
        // March 2026 (month 2)
        {
          id: '3',
          type: 'expense',
          amountFils: 150000,
          categoryId: 'cat-food',
          date: new Date(2026, 2, 5),
          note: '',
          createdAt: new Date(),
        },
        // Jan 2025 (different year - must be ignored)
        {
          id: '4',
          type: 'income',
          amountFils: 999999,
          categoryId: 'cat-salary',
          date: new Date(2025, 0, 15),
          note: '',
          createdAt: new Date(),
        },
      ]

      const breakdown = calculateYearlyBreakdown(txs, 2026)

      // January
      expect(breakdown[0].income).toBe(800000)
      expect(breakdown[0].expense).toBe(300000)
      expect(breakdown[0].balance).toBe(500000)

      // February (empty)
      expect(breakdown[1].income).toBe(0)
      expect(breakdown[1].expense).toBe(0)
      expect(breakdown[1].balance).toBe(0)

      // March
      expect(breakdown[2].income).toBe(0)
      expect(breakdown[2].expense).toBe(150000)
      expect(breakdown[2].balance).toBe(-150000)
    })

    it('groups transactions into fiscal cycles when monthStartDay > 1 (e.g. 25)', () => {
      const txs: Transaction[] = [
        // Transaction on 2026-01-10: day 10 < 25 -> belongs to Dec 2025 cycle (should be excluded from 2026)
        {
          id: '1',
          type: 'income',
          amountFils: 500000,
          categoryId: 'cat-salary',
          date: new Date(2026, 0, 10),
          note: '',
          createdAt: new Date(),
        },
        // Transaction on 2026-01-25: day 25 >= 25 -> belongs to Jan 2026 cycle (month 0)
        {
          id: '2',
          type: 'income',
          amountFils: 800000,
          categoryId: 'cat-salary',
          date: new Date(2026, 0, 25),
          note: '',
          createdAt: new Date(),
        },
        // Transaction on 2026-02-05: day 5 < 25 -> belongs to Jan 2026 cycle (month 0)
        {
          id: '3',
          type: 'expense',
          amountFils: 200000,
          categoryId: 'cat-rent',
          date: new Date(2026, 1, 5),
          note: '',
          createdAt: new Date(),
        },
        // Transaction on 2027-01-10: belongs to Dec 2026 cycle (month 11)
        {
          id: '4',
          type: 'expense',
          amountFils: 150000,
          categoryId: 'cat-food',
          date: new Date(2027, 0, 10),
          note: '',
          createdAt: new Date(),
        },
      ]

      const breakdown = calculateYearlyBreakdown(txs, 2026, 25)

      // Month 0 (Jan cycle: Jan 25 - Feb 25): income 800,000, expense 200,000
      expect(breakdown[0].income).toBe(800000)
      expect(breakdown[0].expense).toBe(200000)
      expect(breakdown[0].balance).toBe(600000)

      // Month 11 (Dec cycle: Dec 25 - Jan 25): expense 150,000
      expect(breakdown[11].income).toBe(0)
      expect(breakdown[11].expense).toBe(150000)
      expect(breakdown[11].balance).toBe(-150000)
    })
  })

  describe('calculateSavingsRate', () => {
    it('returns 0 when income is zero or negative', () => {
      expect(calculateSavingsRate(0, 50000)).toBe(0)
      expect(calculateSavingsRate(-1000, 50000)).toBe(0)
    })

    it('calculates positive savings rate correctly', () => {
      // Income: 1000 JOD, Expense: 600 JOD -> Savings: 400 JOD (40%)
      expect(calculateSavingsRate(1000000, 600000)).toBe(40)
    })

    it('returns 100% when expenses are 0', () => {
      expect(calculateSavingsRate(1000000, 0)).toBe(100)
    })

    it('calculates negative savings rate and clamps at -100', () => {
      // Income: 1000 JOD, Expense: 1500 JOD -> -50%
      expect(calculateSavingsRate(1000000, 1500000)).toBe(-50)

      // Income: 1000 JOD, Expense: 5000 JOD -> clamped at -100%
      expect(calculateSavingsRate(1000000, 5000000)).toBe(-100)
    })
  })

  describe('calculateYearlyMonthlyAverage', () => {
    it('divides by elapsed months in current year based on currentMonthIndex', () => {
      // In April (monthIndex 3), 4 months have elapsed
      const avgApril = calculateYearlyMonthlyAverage(120000, 2026, 2026, 3, 4)
      expect(avgApril).toBe(30000)

      // In January (monthIndex 0), 1 month has elapsed
      const avgJan = calculateYearlyMonthlyAverage(50000, 2026, 2026, 0, 1)
      expect(avgJan).toBe(50000)

      // In December (monthIndex 11), 12 months have elapsed
      const avgDec = calculateYearlyMonthlyAverage(120000, 2026, 2026, 11, 12)
      expect(avgDec).toBe(10000)
    })

    it('divides past years by number of active months with activity', () => {
      // User only had activity in 3 months during 2025
      const avgPastPartial = calculateYearlyMonthlyAverage(90000, 2025, 2026, 3, 3)
      expect(avgPastPartial).toBe(30000)

      // Full year activity (12 months)
      const avgPastFull = calculateYearlyMonthlyAverage(120000, 2025, 2026, 3, 12)
      expect(avgPastFull).toBe(10000)
    })

    it('falls back safely to 12 if no active months in past years', () => {
      const avgEmpty = calculateYearlyMonthlyAverage(0, 2025, 2026, 3, 0)
      expect(avgEmpty).toBe(0)
    })
  })

  describe('calculateAnnualSummary', () => {
    const createEmptyBreakdown = () =>
      Array.from({ length: 12 }, (_, i) => ({
        monthIndex: i,
        monthName: ARABIC_MONTH_NAMES[i],
        income: 0,
        expense: 0,
        balance: 0,
      }))

    it('returns zero summary for empty or null breakdown', () => {
      const res = calculateAnnualSummary([], 2026, 2026, 4)
      expect(res.averageMonthlyExpenseFils).toBe(0)
      expect(res.activeMonthsCount).toBe(0)
      expect(res.isCurrentMonthOnly).toBe(false)
    })

    it('divides past year only by months that have actual expenses (> 0) and ignores income-only months', () => {
      const breakdown = createEmptyBreakdown()
      // Month 0 (Jan): 100 JOD expense
      breakdown[0].expense = 100000
      breakdown[0].income = 500000
      // Month 1 (Feb): 200 JOD expense
      breakdown[1].expense = 200000
      breakdown[1].income = 500000
      // Month 2 (March): 0 expense, but 500 JOD salary income! (must NOT be counted in divisor!)
      breakdown[2].expense = 0
      breakdown[2].income = 500000

      // Past year 2025 (current year is 2026)
      const res = calculateAnnualSummary(breakdown, 2025, 2026, 3)

      // Total expense = 300,000. Active expense months count = 2 (NOT 3!)
      expect(res.activeMonthsCount).toBe(2)
      expect(res.averageMonthlyExpenseFils).toBe(150000) // 300,000 / 2 = 150,000
      expect(res.isCurrentMonthOnly).toBe(false)
      expect(res.note).toBeUndefined()
    })

    it('in current year, averages over completed past months with expenses and ignores future months', () => {
      const breakdown = createEmptyBreakdown()
      // Current month is April (index 3)
      // Jan (index 0): 100 JOD expense
      breakdown[0].expense = 100000
      // Feb (index 1): 200 JOD expense
      breakdown[1].expense = 200000
      // March (index 2): 0 expense, 500 JOD income (must not dilute divisor)
      breakdown[2].expense = 0
      breakdown[2].income = 500000
      // April (index 3, incomplete current month): 30 JOD expense
      breakdown[3].expense = 30000
      // May (index 4, future month): 999 JOD future projection/accident (must be strictly ignored)
      breakdown[4].expense = 999000

      const res = calculateAnnualSummary(breakdown, 2026, 2026, 3)

      // Only Jan (100k) and Feb (200k) are completed past months with expenses
      // Total completed expense = 300k / 2 = 150k
      expect(res.activeMonthsCount).toBe(2)
      expect(res.averageMonthlyExpenseFils).toBe(150000)
      expect(res.isCurrentMonthOnly).toBe(false)
      expect(res.note).toBeUndefined()
    })

    it('in current year, if only current month has expenses, displays it with explanatory note', () => {
      const breakdown = createEmptyBreakdown()
      // Current month is January (index 0) or user joined in April (index 3) with no prior expenses
      // April (index 3): 75 JOD expense
      breakdown[3].expense = 75000

      const res = calculateAnnualSummary(breakdown, 2026, 2026, 3)

      expect(res.activeMonthsCount).toBe(1)
      expect(res.averageMonthlyExpenseFils).toBe(75000)
      expect(res.isCurrentMonthOnly).toBe(true)
      expect(res.note).toBe('بيانات الشهر الجاري فقط — لم يكتمل شهر كامل بعد')
    })

    it('returns zero if no expenses occurred in the current year so far', () => {
      const breakdown = createEmptyBreakdown()
      // Income only in Jan and Feb
      breakdown[0].income = 500000
      breakdown[1].income = 500000

      const res = calculateAnnualSummary(breakdown, 2026, 2026, 2)

      expect(res.activeMonthsCount).toBe(0)
      expect(res.averageMonthlyExpenseFils).toBe(0)
      expect(res.isCurrentMonthOnly).toBe(false)
    })
  })
})
