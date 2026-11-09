import { describe, it, expect } from 'vitest'
import {
  normalizeArabic,
  filterTransactions,
  sumByType,
  groupByDay,
  sortTransactions,
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

    it('filters by sourceType including debt_init_, debt_entry_, and debt_pay_', () => {
      const mixedTxs: Transaction[] = [
        {
          id: 'debt_init_1',
          type: 'expense',
          amountFils: 50000,
          categoryId: 'cat-debt',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'debt_entry_2',
          type: 'expense',
          amountFils: 20000,
          categoryId: 'cat-debt',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'debt_pay_3',
          type: 'income',
          amountFils: 10000,
          categoryId: 'cat-debt',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'manual_1',
          type: 'expense',
          amountFils: 15000,
          categoryId: 'cat-food',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
      ]

      const debtTxs = filterTransactions(mixedTxs, { sourceType: 'debt' })
      expect(debtTxs.map((t) => t.id)).toEqual(['debt_init_1', 'debt_entry_2', 'debt_pay_3'])

      const manualTxs = filterTransactions(mixedTxs, { sourceType: 'manual' })
      expect(manualTxs.map((t) => t.id)).toEqual(['manual_1'])
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

    it('matches transactions by category name when title is omitted or does not match', () => {
      const categoryMap = new Map([
        ['cat-fuel', { name: 'وقود ومحروقات' }],
        ['cat-food', { name: 'طعام ومشروبات' }],
      ])

      const transactions: Transaction[] = [
        {
          id: 'tx-fuel',
          type: 'expense',
          amountFils: 25000,
          categoryId: 'cat-fuel',
          date: new Date(),
          note: 'محطة المناصير',
          createdAt: new Date(),
        },
        {
          id: 'tx-food',
          type: 'expense',
          amountFils: 15000,
          categoryId: 'cat-food',
          date: new Date(),
          title: 'غداء عمل',
          note: '',
          createdAt: new Date(),
        },
      ]

      // Search for "وقود" matches tx-fuel via categoryMap
      const res = filterTransactions(transactions, { query: 'وقود' }, categoryMap)
      expect(res).toHaveLength(1)
      expect(res[0].id).toBe('tx-fuel')

      // Search with function resolver
      const resFn = filterTransactions(transactions, { query: 'طعام' }, (id) => categoryMap.get(id)?.name)
      expect(resFn).toHaveLength(1)
      expect(resFn[0].id).toBe('tx-food')
    })

    it('matches transactions by amount in Western or Arabic digits', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-25',
          type: 'expense',
          amountFils: 25000, // 25 JOD
          categoryId: 'cat-1',
          date: new Date(),
          note: 'تسوق',
          createdAt: new Date(),
        },
        {
          id: 'tx-150',
          type: 'income',
          amountFils: 150000, // 150 JOD
          categoryId: 'cat-2',
          date: new Date(),
          note: 'مكافأة',
          createdAt: new Date(),
        },
      ]

      // Search with English digits "25"
      const resEn = filterTransactions(transactions, { query: '25' })
      expect(resEn).toHaveLength(1)
      expect(resEn[0].id).toBe('tx-25')

      // Search with Arabic digits "٢٥"
      const resAr = filterTransactions(transactions, { query: '٢٥' })
      expect(resAr).toHaveLength(1)
      expect(resAr[0].id).toBe('tx-25')

      // Search with Arabic digits "١٥٠"
      const resAr150 = filterTransactions(transactions, { query: '١٥٠' })
      expect(resAr150).toHaveLength(1)
      expect(resAr150[0].id).toBe('tx-150')
    })

    it('matches exact and formatted currency amounts without confusing fils with dinars', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-1-jod',
          type: 'expense',
          amountFils: 1000, // 1 JOD
          categoryId: 'cat-1',
          date: new Date(),
          note: 'قهوة',
          createdAt: new Date(),
        },
        {
          id: 'tx-5-jod',
          type: 'expense',
          amountFils: 5000, // 5 JOD
          categoryId: 'cat-1',
          date: new Date(),
          note: 'ساندويش',
          createdAt: new Date(),
        },
        {
          id: 'tx-100-jod',
          type: 'expense',
          amountFils: 100000, // 100 JOD
          categoryId: 'cat-1',
          date: new Date(),
          note: 'مشتريات ملابس',
          createdAt: new Date(),
        },
        {
          id: 'tx-500-jod',
          type: 'income',
          amountFils: 500000, // 500 JOD
          categoryId: 'cat-2',
          date: new Date(),
          note: 'دفعة استشارة',
          createdAt: new Date(),
        },
        {
          id: 'tx-12-5-jod',
          type: 'expense',
          amountFils: 12500, // 12.500 JOD
          categoryId: 'cat-1',
          date: new Date(),
          note: 'فاتورة مطعم',
          createdAt: new Date(),
        },
        {
          id: 'tx-1000-jod',
          type: 'income',
          amountFils: 1000000, // 1000 JOD
          categoryId: 'cat-2',
          date: new Date(),
          note: 'راتب رئيسي',
          createdAt: new Date(),
        },
      ]

      // Searching for "100" must match 100 JOD (tx-100-jod), NOT 1 JOD (tx-1-jod, 1000 fils)!
      const res100 = filterTransactions(transactions, { query: '100' })
      expect(res100.map((t) => t.id)).toContain('tx-100-jod')
      expect(res100.map((t) => t.id)).not.toContain('tx-1-jod')

      // Searching for "500" must match 500 JOD (tx-500-jod), NOT 5 JOD (tx-5-jod, 5000 fils)!
      const res500 = filterTransactions(transactions, { query: '500' })
      expect(res500.map((t) => t.id)).toContain('tx-500-jod')
      expect(res500.map((t) => t.id)).not.toContain('tx-5-jod')

      // Searching for "12.500" or "12.5" matches 12.5 JOD
      expect(filterTransactions(transactions, { query: '12.500' }).map((t) => t.id)).toEqual(['tx-12-5-jod'])
      expect(filterTransactions(transactions, { query: '12.5' }).map((t) => t.id)).toEqual(['tx-12-5-jod'])

      // Searching for "1,000" matches 1000 JOD, NOT 1 JOD
      const resThousand = filterTransactions(transactions, { query: '1,000' })
      expect(resThousand.map((t) => t.id)).toEqual(['tx-1000-jod'])

      // Searching for "1.000" matches 1 JOD (1.000), NOT 1000 JOD
      const resOne = filterTransactions(transactions, { query: '1.000' })
      expect(resOne.map((t) => t.id)).toEqual(['tx-1-jod'])
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

    it('guards against corrupted or NaN amounts and normalizes negative amounts with Math.abs', () => {
      const corruptedTxs = [
        {
          id: '1',
          type: 'expense' as const,
          amountFils: 5000,
          categoryId: 'c1',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '2',
          type: 'expense' as const,
          amountFils: NaN,
          categoryId: 'c1',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '3',
          type: 'expense' as const,
          amountFils: -3000, // Negative amount normalized via Math.abs
          categoryId: 'c1',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '4',
          type: 'income' as const,
          amountFils: '10000' as unknown as number, // String corrupted
          categoryId: 'c2',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        {
          id: '5',
          type: 'income' as const,
          amountFils: 50000,
          categoryId: 'c2',
          date: new Date(),
          note: '',
          createdAt: new Date(),
        },
        null as unknown as Transaction,
      ]

      const totals = sumByType(corruptedTxs)
      expect(totals.expense).toBe(8000) // 5000 + 3000
      expect(totals.income).toBe(50000) // only valid 50000
      expect(totals.balance).toBe(42000)
      expect(Number.isNaN(totals.balance)).toBe(false)
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

    it('sorts same-day transactions with identical date timestamps descending by createdAt', () => {
      const fixedDate = new Date('2026-10-15T12:00:00Z')
      const txs: Transaction[] = [
        {
          id: 'first-added',
          type: 'expense',
          amountFils: 1000,
          categoryId: 'c1',
          date: fixedDate,
          note: 'أول إضافة',
          createdAt: new Date('2026-10-15T08:30:00Z'),
        },
        {
          id: 'second-added',
          type: 'expense',
          amountFils: 2000,
          categoryId: 'c1',
          date: fixedDate,
          note: 'ثاني إضافة',
          createdAt: new Date('2026-10-15T11:45:00Z'),
        },
        {
          id: 'third-added',
          type: 'expense',
          amountFils: 3000,
          categoryId: 'c1',
          date: fixedDate,
          note: 'ثالث إضافة',
          createdAt: new Date('2026-10-15T16:20:00Z'),
        },
      ]

      const groups = groupByDay(txs)
      expect(groups).toHaveLength(1)
      expect(groups[0].transactions.map((t) => t.id)).toEqual([
        'third-added',
        'second-added',
        'first-added',
      ])
    })
  })

  describe('filterTransactions with categoryIds, sourceType, and dateRange', () => {
    const mixedTxs: Transaction[] = [
      {
        id: 'manual-1',
        type: 'expense',
        amountFils: 5000,
        categoryId: 'cat-food',
        date: new Date('2026-10-05T10:00:00Z'),
        note: 'مطعم',
        createdAt: new Date('2026-10-05T10:00:00Z'),
      },
      {
        id: 'debt_init_123',
        type: 'expense',
        amountFils: 15000,
        categoryId: 'cat-debt',
        date: new Date('2026-10-10T10:00:00Z'),
        note: 'دين',
        createdAt: new Date('2026-10-10T10:00:00Z'),
      },
      {
        id: 'circle_payout_456',
        type: 'income',
        amountFils: 100000,
        categoryId: 'cat-circle',
        date: new Date('2026-10-15T10:00:00Z'),
        note: 'قبض جمعية',
        createdAt: new Date('2026-10-15T10:00:00Z'),
      },
      {
        id: 'rec-1',
        recurringId: 'rule-789',
        type: 'expense',
        amountFils: 20000,
        categoryId: 'cat-bills',
        date: new Date('2026-10-20T10:00:00Z'),
        note: 'إنترنت',
        createdAt: new Date('2026-10-20T10:00:00Z'),
      },
    ]

    it('filters by multiple categoryIds', () => {
      const res = filterTransactions(mixedTxs, { categoryIds: ['cat-food', 'cat-bills'] })
      expect(res.map((t) => t.id)).toEqual(['manual-1', 'rec-1'])

      const allRes = filterTransactions(mixedTxs, { categoryIds: ['all'] })
      expect(allRes).toHaveLength(4)
    })

    it('filters by sourceType (debt, circle, recurring, manual)', () => {
      const debts = filterTransactions(mixedTxs, { sourceType: 'debt' })
      expect(debts.map((t) => t.id)).toEqual(['debt_init_123'])

      const circles = filterTransactions(mixedTxs, { sourceType: 'circle' })
      expect(circles.map((t) => t.id)).toEqual(['circle_payout_456'])

      const recurring = filterTransactions(mixedTxs, { sourceType: 'recurring' })
      expect(recurring.map((t) => t.id)).toEqual(['rec-1'])

      const manual = filterTransactions(mixedTxs, { sourceType: 'manual' })
      expect(manual.map((t) => t.id)).toEqual(['manual-1'])
    })

    it('filters by custom dateRange', () => {
      const res = filterTransactions(mixedTxs, {
        dateRange: {
          from: new Date('2026-10-08T00:00:00Z'),
          to: new Date('2026-10-16T00:00:00Z'),
        },
      })
      expect(res.map((t) => t.id)).toEqual(['debt_init_123', 'circle_payout_456'])
    })
  })

  describe('sortTransactions', () => {
    const list: Transaction[] = [
      {
        id: 'tx-1',
        type: 'expense',
        amountFils: 10000,
        categoryId: 'c1',
        date: new Date('2026-10-01T10:00:00Z'),
        note: '',
        createdAt: new Date('2026-10-01T10:00:00Z'),
      },
      {
        id: 'tx-2',
        type: 'expense',
        amountFils: 50000,
        categoryId: 'c1',
        date: new Date('2026-10-03T10:00:00Z'),
        note: '',
        createdAt: new Date('2026-10-03T10:00:00Z'),
      },
      {
        id: 'tx-3',
        type: 'expense',
        amountFils: 20000,
        categoryId: 'c1',
        date: new Date('2026-10-02T10:00:00Z'),
        note: '',
        createdAt: new Date('2026-10-02T10:00:00Z'),
      },
    ]

    it('sorts newest first (default)', () => {
      const sorted = sortTransactions(list, 'newest')
      expect(sorted.map((t) => t.id)).toEqual(['tx-2', 'tx-3', 'tx-1'])
    })

    it('sorts oldest first', () => {
      const sorted = sortTransactions(list, 'oldest')
      expect(sorted.map((t) => t.id)).toEqual(['tx-1', 'tx-3', 'tx-2'])
    })

    it('sorts highest amount first', () => {
      const sorted = sortTransactions(list, 'highest')
      expect(sorted.map((t) => t.id)).toEqual(['tx-2', 'tx-3', 'tx-1'])
    })

    it('sorts lowest amount first', () => {
      const sorted = sortTransactions(list, 'lowest')
      expect(sorted.map((t) => t.id)).toEqual(['tx-1', 'tx-3', 'tx-2'])
    })
  })

  describe('groupByDay direction and filterTransactions enhancements', () => {
    it('supports direction="asc" in groupByDay', () => {
      const txs: Transaction[] = [
        {
          id: '1',
          type: 'expense',
          amountFils: 1000,
          categoryId: 'c1',
          date: new Date('2026-10-05T14:00:00Z'),
          note: '',
          createdAt: new Date('2026-10-05T14:00:00Z'),
        },
        {
          id: '2',
          type: 'expense',
          amountFils: 2000,
          categoryId: 'c1',
          date: new Date('2026-10-01T10:00:00Z'),
          note: '',
          createdAt: new Date('2026-10-01T10:00:00Z'),
        },
        {
          id: '3',
          type: 'expense',
          amountFils: 3000,
          categoryId: 'c1',
          date: new Date('2026-10-01T15:00:00Z'),
          note: '',
          createdAt: new Date('2026-10-01T15:00:00Z'),
        },
      ]

      const ascGroups = groupByDay(txs, 'asc')
      expect(ascGroups[0].dateKey).toBe('2026-10-01')
      expect(ascGroups[1].dateKey).toBe('2026-10-05')
      expect(ascGroups[0].transactions.map((t) => t.id)).toEqual(['2', '3'])

      const descGroups = groupByDay(txs, 'desc')
      expect(descGroups[0].dateKey).toBe('2026-10-05')
      expect(descGroups[1].dateKey).toBe('2026-10-01')
      expect(descGroups[1].transactions.map((t) => t.id)).toEqual(['3', '2'])
    })

    it('matches circle installments via circleRecurringIdsSet and linked debts via debtTransactionIdsSet', () => {
      const txs: Transaction[] = [
        {
          id: 'rec-tx-1',
          type: 'expense',
          amountFils: 50000,
          categoryId: 'c1',
          date: new Date('2026-10-01T10:00:00Z'),
          note: 'قسط جمعية',
          recurringId: 'rec-circle-99',
          createdAt: new Date(),
        },
        {
          id: 'custom-bank-tx-88',
          type: 'expense',
          amountFils: 10000,
          categoryId: 'c1',
          date: new Date('2026-10-02T10:00:00Z'),
          note: 'سداد دفعة دين',
          createdAt: new Date(),
        },
      ]

      const circleRes = filterTransactions(txs, {
        sourceType: 'circle',
        circleRecurringIdsSet: new Set(['rec-circle-99']),
      })
      expect(circleRes).toHaveLength(1)
      expect(circleRes[0].id).toBe('rec-tx-1')

      const debtRes = filterTransactions(txs, {
        sourceType: 'debt',
        debtTransactionIdsSet: new Set(['custom-bank-tx-88']),
      })
      expect(debtRes).toHaveLength(1)
      expect(debtRes[0].id).toBe('custom-bank-tx-88')
    })

    it('safely handles transactions with undefined note during search query', () => {
      const txs: Transaction[] = [
        {
          id: 'no-note-tx',
          type: 'expense',
          amountFils: 5000,
          categoryId: 'c1',
          date: new Date('2026-10-01T10:00:00Z'),
          title: 'شراء قهوة',
          note: undefined as unknown as string,
          createdAt: new Date(),
        },
      ]

      expect(() => {
        const res = filterTransactions(txs, { query: 'قهوة' })
        expect(res).toHaveLength(1)
      }).not.toThrow()
    })

    it('rejects transactions with invalid dates when filtering by dateRange', () => {
      const txsWithInvalidDate: Transaction[] = [
        {
          id: 'valid-tx',
          type: 'expense',
          amountFils: 5000,
          categoryId: 'c1',
          date: new Date('2026-10-10T10:00:00Z'),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'invalid-date-tx',
          type: 'expense',
          amountFils: 5000,
          categoryId: 'c1',
          date: new Date('invalid date string'),
          note: '',
          createdAt: new Date(),
        },
      ]

      const filtered = filterTransactions(txsWithInvalidDate, {
        dateRange: {
          from: new Date('2026-10-01T00:00:00Z'),
          to: new Date('2026-10-31T23:59:59Z'),
        },
      })
      expect(filtered.map((t) => t.id)).toEqual(['valid-tx'])
    })

    it('groupByDay falls back to 1970-01-01 and never produces NaN-NaN-NaN dateKey', () => {
      const txs = [
        {
          id: 'invalid-d',
          type: 'expense' as const,
          amountFils: 5000,
          categoryId: 'c1',
          date: new Date('invalid'),
          note: '',
          createdAt: new Date(),
        },
      ]

      const groups = groupByDay(txs)
      expect(groups).toHaveLength(1)
      expect(groups[0].dateKey).toBe('1970-01-01')
      expect(groups[0].dateKey).not.toContain('NaN')
    })

    it('sortTransactions handles invalid dates and corrupted amounts gracefully without breaking sorting', () => {
      const list = [
        {
          id: 'tx-valid',
          type: 'expense' as const,
          amountFils: 5000,
          categoryId: 'c1',
          date: new Date('2026-10-05T10:00:00Z'),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'tx-invalid-date',
          type: 'expense' as const,
          amountFils: 10000,
          categoryId: 'c1',
          date: new Date('invalid'),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'tx-nan-amount',
          type: 'expense' as const,
          amountFils: NaN,
          categoryId: 'c1',
          date: new Date('2026-10-01T10:00:00Z'),
          note: '',
          createdAt: new Date(),
        },
      ]

      expect(() => sortTransactions(list, 'newest')).not.toThrow()
      expect(() => sortTransactions(list, 'oldest')).not.toThrow()
      expect(() => sortTransactions(list, 'highest')).not.toThrow()
      expect(() => sortTransactions(list, 'lowest')).not.toThrow()
    })
  })
})
