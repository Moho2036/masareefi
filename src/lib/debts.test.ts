import { describe, it, expect } from 'vitest'
import {
  normalizeArabic,
  getDebtRemainingFils,
  getDebtProgress,
  isDebtOverdue,
  calculateDebtSummary,
  filterDebts,
  isDebtSettled,
} from './debts'
import type { Debt } from '../types'

describe('debts domain logic', () => {
  const baseDebt: Debt = {
    id: 'd1',
    personName: 'أحمد العبدلله',
    type: 'lent',
    amountFils: 100000,
    paidFils: 30000,
    startDate: new Date('2026-09-01T00:00:00Z'),
    dueDate: new Date('2026-10-01T00:00:00Z'),
    note: 'سلفة صيانة',
    settled: false,
    payments: [],
    createdAt: new Date('2026-09-01T00:00:00Z'),
  }

  describe('normalizeArabic', () => {
    it('normalizes alef variants and teh marbuta', () => {
      expect(normalizeArabic('إبراهيم')).toBe('ابراهيم')
      expect(normalizeArabic('أحمد')).toBe('احمد')
      expect(normalizeArabic('سلفة عائلية')).toBe('سلفه عائليه')
    })
  })

  describe('getDebtRemainingFils and getDebtProgress', () => {
    it('calculates remaining amount correctly', () => {
      expect(getDebtRemainingFils(baseDebt)).toBe(70000)
      expect(getDebtRemainingFils({ ...baseDebt, paidFils: 100000 })).toBe(0)
      expect(getDebtRemainingFils({ ...baseDebt, paidFils: 120000 })).toBe(0)
    })

    it('calculates progress percentage correctly', () => {
      expect(getDebtProgress(baseDebt)).toBe(30)
      expect(getDebtProgress({ ...baseDebt, paidFils: 100000 })).toBe(100)
      expect(getDebtProgress({ ...baseDebt, paidFils: 0 })).toBe(0)
    })
  })

  describe('isDebtSettled', () => {
    it('returns true when paid equals or exceeds total amount', () => {
      expect(isDebtSettled(50000, 50000)).toBe(true)
      expect(isDebtSettled(50000, 60000)).toBe(true)
    })

    it('returns false when total amount exceeds paid amount', () => {
      expect(isDebtSettled(50000, 30000)).toBe(false)
      expect(isDebtSettled(100000, 0)).toBe(false)
    })
  })

  describe('isDebtOverdue', () => {
    it('returns true if active and past due date', () => {
      const refDate = new Date('2026-10-15T00:00:00Z')
      expect(isDebtOverdue(baseDebt, refDate)).toBe(true)
    })

    it('returns false if not yet past due date', () => {
      const refDate = new Date('2026-09-15T00:00:00Z')
      expect(isDebtOverdue(baseDebt, refDate)).toBe(false)
    })

    it('returns false if debt is settled even if past due date', () => {
      const refDate = new Date('2026-10-15T00:00:00Z')
      expect(isDebtOverdue({ ...baseDebt, settled: true }, refDate)).toBe(false)
    })

    it('returns false if dueDate is null', () => {
      const refDate = new Date('2026-10-15T00:00:00Z')
      expect(isDebtOverdue({ ...baseDebt, dueDate: null }, refDate)).toBe(false)
    })
  })

  describe('calculateDebtSummary', () => {
    it('calculates totals and net properly', () => {
      const debts: Debt[] = [
        // Lent: 100 JOD, paid 30 JOD => remaining 70 JOD
        baseDebt,
        // Lent: 50 JOD, paid 0 => remaining 50 JOD
        {
          ...baseDebt,
          id: 'd2',
          amountFils: 50000,
          paidFils: 0,
        },
        // Borrowed: 80 JOD, paid 20 JOD => remaining 60 JOD
        {
          ...baseDebt,
          id: 'd3',
          type: 'borrowed',
          amountFils: 80000,
          paidFils: 20000,
        },
        // Settled: should not add to remaining balances
        {
          ...baseDebt,
          id: 'd4',
          type: 'lent',
          amountFils: 40000,
          paidFils: 40000,
          settled: true,
        },
      ]

      const summary = calculateDebtSummary(debts)
      expect(summary.lentFils).toBe(120000) // 70k + 50k
      expect(summary.borrowedFils).toBe(60000) // 60k
      expect(summary.netFils).toBe(60000) // 120k - 60k
      expect(summary.lentActiveCount).toBe(2)
      expect(summary.borrowedActiveCount).toBe(1)
      expect(summary.settledCount).toBe(1)
    })
  })

  describe('filterDebts', () => {
    const list: Debt[] = [
      baseDebt, // lent, active, overdue as of Oct 15
      {
        ...baseDebt,
        id: 'd2',
        personName: 'خالد عمر',
        type: 'borrowed',
        note: 'مشتريات سيارة',
        settled: false,
        dueDate: null,
      },
      {
        ...baseDebt,
        id: 'd3',
        personName: 'محمد علي',
        type: 'lent',
        settled: true,
      },
    ]

    it('filters by type', () => {
      const lent = filterDebts(list, { type: 'lent' })
      expect(lent).toHaveLength(2)
      const borrowed = filterDebts(list, { type: 'borrowed' })
      expect(borrowed).toHaveLength(1)
      expect(borrowed[0].personName).toBe('خالد عمر')
    })

    it('filters by status', () => {
      const active = filterDebts(list, { status: 'active' })
      expect(active).toHaveLength(2)
      const settled = filterDebts(list, { status: 'settled' })
      expect(settled).toHaveLength(1)
      expect(settled[0].id).toBe('d3')
    })

    it('searches with Arabic normalization', () => {
      const result = filterDebts(list, { search: 'احمد' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('d1')

      const resultNote = filterDebts(list, { search: 'سياره' })
      expect(resultNote).toHaveLength(1)
      expect(resultNote[0].id).toBe('d2')
    })
  })
})
