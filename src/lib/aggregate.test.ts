import { describe, it, expect } from 'vitest'
import {
  normalizeArabic,
  filterTransactions,
  sumByType,
  groupByDay,
  countByCategory,
} from './aggregate'
import type { Transaction } from '../types'

describe('aggregate helpers', () => {
  describe('normalizeArabic', () => {
    it('removes diacritics / tashkeel', () => {
      expect(normalizeArabic('مَصَارِيفِي')).toBe('مصاريفي')
      expect(normalizeArabic('غَدَاءٌ')).toBe('غداء')
    })

    it('normalizes hamzahs on Alef', () => {
      expect(normalizeArabic('إيجار')).toBe('ايجار')
      expect(normalizeArabic('أحمد')).toBe('احمد')
      expect(normalizeArabic('آلة')).toBe('اله')
    })

    it('normalizes Taa Marbutah and Alef Maksura', () => {
      expect(normalizeArabic('بقالة')).toBe('بقاله')
      expect(normalizeArabic('مستشفى')).toBe('مستشفي')
    })
  })

  describe('filterTransactions', () => {
    const txs: Transaction[] = [
      {
        id: '1',
        type: 'expense',
        amountFils: 5000,
        categoryId: 'cat-food',
        date: new Date('2026-10-01T12:00:00Z'),
        note: 'غداء مع العائلة',
        createdAt: new Date('2026-10-01T12:00:00Z'),
      },
      {
        id: '2',
        type: 'expense',
        amountFils: 20000,
        categoryId: 'cat-rent',
        date: new Date('2026-10-02T10:00:00Z'),
        title: 'فاتورة الكهرباء',
        note: 'إيجار شقة',
        createdAt: new Date('2026-10-02T10:00:00Z'),
      },
      {
        id: '3',
        type: 'income',
        amountFils: 750000,
        categoryId: 'cat-salary',
        date: new Date('2026-10-03T09:00:00Z'),
        note: 'راتب شهري',
        createdAt: new Date('2026-10-03T09:00:00Z'),
      },
    ]

    it('filters by type', () => {
      const expenses = filterTransactions(txs, { type: 'expense' })
      expect(expenses).toHaveLength(2)
      expect(expenses.map((t) => t.id)).toEqual(['1', '2'])

      const incomes = filterTransactions(txs, { type: 'income' })
      expect(incomes).toHaveLength(1)
      expect(incomes[0].id).toBe('3')

      const all = filterTransactions(txs, { type: 'all' })
      expect(all).toHaveLength(3)
    })

    it('filters by categoryId', () => {
      const filtered = filterTransactions(txs, { categoryId: 'cat-food' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('1')
    })

    it('filters by Arabic query tolerant of hamza and taa marbuta in note and title', () => {
      // Searching without hamza matches note with hamza "إيجار"
      const result = filterTransactions(txs, { query: 'ايجار' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')

      // Searching with haa matches "العائلة"
      const result2 = filterTransactions(txs, { query: 'العائله' })
      expect(result2).toHaveLength(1)
      expect(result2[0].id).toBe('1')

      // Searching matches title "فاتورة الكهرباء"
      const result3 = filterTransactions(txs, { query: 'الكهرباء' })
      expect(result3).toHaveLength(1)
      expect(result3[0].id).toBe('2')
    })
  })

  describe('sumByType', () => {
    it('calculates expense, income, and balance totals in fils', () => {
      const txs: Transaction[] = [
        {
          id: '1',
          type: 'expense',
          amountFils: 5000,
          categoryId: 'c1',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '2',
          type: 'expense',
          amountFils: 15000,
          categoryId: 'c1',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '3',
          type: 'income',
          amountFils: 100000,
          categoryId: 'c2',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
      ]

      const totals = sumByType(txs)
      expect(totals.expense).toBe(20000)
      expect(totals.income).toBe(100000)
      expect(totals.balance).toBe(80000)
    })

    it('handles empty transaction list', () => {
      const totals = sumByType([])
      expect(totals).toEqual({ expense: 0, income: 0, balance: 0 })
    })
  })

  describe('groupByDay', () => {
    it('groups transactions by day descending', () => {
      const txs: Transaction[] = [
        {
          id: '1',
          type: 'expense',
          amountFils: 1000,
          categoryId: 'c1',
          date: new Date('2026-10-01T08:00:00Z'),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '2',
          type: 'expense',
          amountFils: 2000,
          categoryId: 'c1',
          date: new Date('2026-10-05T14:00:00Z'),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '3',
          type: 'expense',
          amountFils: 3000,
          categoryId: 'c1',
          date: new Date('2026-10-05T09:00:00Z'),
          note: '',
          createdAt: new Date(),
        },
      ]

      const groups = groupByDay(txs)
      expect(groups).toHaveLength(2)

      // First group should be Oct 5 (most recent)
      expect(groups[0].dateKey).toBe('2026-10-05')
      expect(groups[0].transactions).toHaveLength(2)
      // Oct 5 14:00 before 09:00
      expect(groups[0].transactions[0].id).toBe('2')
      expect(groups[0].transactions[1].id).toBe('3')

      // Second group should be Oct 1
      expect(groups[1].dateKey).toBe('2026-10-01')
      expect(groups[1].transactions).toHaveLength(1)
      expect(groups[1].transactions[0].id).toBe('1')
    })
  })

  describe('countByCategory', () => {
    it('counts occurrences per categoryId', () => {
      const txs: Transaction[] = [
        { id: '1', type: 'expense', amountFils: 1, categoryId: 'cat-a', date: new Date(), note: '', createdAt: new Date() },
        { id: '2', type: 'expense', amountFils: 2, categoryId: 'cat-b', date: new Date(), note: '', createdAt: new Date() },
        { id: '3', type: 'expense', amountFils: 3, categoryId: 'cat-a', date: new Date(), note: '', createdAt: new Date() },
      ]

      const counts = countByCategory(txs)
      expect(counts).toEqual({
        'cat-a': 2,
        'cat-b': 1,
      })
    })
  })
})
