import { describe, it, expect } from 'vitest'
import {
  normalizeArabic,
  getDebtRemainingFils,
  getDebtProgress,
  isDebtOverdue,
  calculateDebtSummary,
  filterDebts,
  findLinkedDebtPayment,
  groupDebtsByPerson,
  formatDebtAccountStatement,
  formatDebtEntriesCount,
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

    it('counts debt due in 7 days at midday (12:00) when referenceDate is in the morning (08:00)', () => {
      const refDate = new Date(2026, 9, 10, 8, 0, 0, 0) // Oct 10, 08:00 AM
      const dueDateIn7Days = new Date(2026, 9, 17, 12, 0, 0, 0) // Oct 17, 12:00 PM (noon)

      const debts: Debt[] = [
        {
          ...baseDebt,
          id: 'd-upcoming-7d',
          amountFils: 50000,
          paidFils: 0,
          settled: false,
          dueDate: dueDateIn7Days,
        },
      ]

      const summary = calculateDebtSummary(debts, refDate)
      expect(summary.upcomingCount).toBe(1)
      expect(summary.upcomingFils).toBe(50000)
    })

    it('treats debt as settled if remaining fils is <= 0 even if settled flag is false', () => {
      const debts: Debt[] = [
        {
          ...baseDebt,
          id: 'd-fully-paid-unsettled-flag',
          amountFils: 50000,
          paidFils: 50000,
          settled: false,
        },
      ]
      const summary = calculateDebtSummary(debts)
      expect(summary.settledCount).toBe(1)
      expect(summary.lentActiveCount).toBe(0)
      expect(summary.lentFils).toBe(0)
    })

    it('guards against NaN dueDate without throwing or counting in upcoming', () => {
      const debts: Debt[] = [
        {
          ...baseDebt,
          id: 'd-nan-due',
          amountFils: 50000,
          paidFils: 0,
          settled: false,
          dueDate: new Date('invalid-date'),
        },
      ]
      const summary = calculateDebtSummary(debts)
      expect(summary.upcomingCount).toBe(0)
      expect(summary.overdueCount).toBe(0)
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
        amountFils: 50000,
        paidFils: 10000,
        note: 'مشتريات سيارة',
        settled: false,
        dueDate: null,
      },
      {
        ...baseDebt,
        id: 'd3',
        personName: 'محمد علي',
        type: 'lent',
        amountFils: 20000,
        paidFils: 20000,
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

    it('searches debts by amount using Western or Eastern Arabic digits matching amount, paid, or remaining', () => {
      // d1: amount 100000, paid 30000, remaining 70000
      // d2: amount 50000, paid 0, remaining 50000
      // d3: amount 20000, paid 20000, remaining 0
      const matchRemaining = filterDebts(list, { search: '70' })
      expect(matchRemaining).toHaveLength(1)
      expect(matchRemaining[0].id).toBe('d1')

      const matchEastern = filterDebts(list, { search: '٥٠' }) // 50
      expect(matchEastern).toHaveLength(1)
      expect(matchEastern[0].id).toBe('d2')

      const matchPaid = filterDebts(list, { search: '30' })
      expect(matchPaid).toHaveLength(1)
      expect(matchPaid[0].id).toBe('d1')
    })
  })

  describe('findLinkedDebtPayment', () => {
    const payment = {
      id: 'pay-1',
      amountFils: 20000,
      date: new Date('2026-09-10'),
      transactionId: 'tx-payment-1',
      createdAt: new Date('2026-09-10'),
    }
    const mergedPayment = {
      id: 'compacted_123',
      amountFils: 50000,
      date: new Date('2026-09-05'),
      note: 'رصيد دفعات سابقة مدمجة',
      createdAt: new Date('2026-09-05'),
      isMerged: true,
      mergedTransactionIds: ['tx-old-1', 'debt_pay_old-p2'],
    }
    const debtWithPayment: Debt = {
      ...baseDebt,
      payments: [payment, mergedPayment],
    }

    it('returns null for empty or undefined txId', () => {
      expect(findLinkedDebtPayment(undefined, [debtWithPayment])).toBeNull()
      expect(findLinkedDebtPayment('', [debtWithPayment])).toBeNull()
    })

    it('matches by explicit payment.transactionId', () => {
      const match = findLinkedDebtPayment('tx-payment-1', [debtWithPayment])
      expect(match).not.toBeNull()
      expect(match?.debt.id).toBe(debtWithPayment.id)
      expect(match?.payment.id).toBe(payment.id)
    })

    it('matches by deterministic debt_pay_${payment.id}', () => {
      const match = findLinkedDebtPayment('debt_pay_pay-1', [debtWithPayment])
      expect(match).not.toBeNull()
      expect(match?.debt.id).toBe(debtWithPayment.id)
      expect(match?.payment.id).toBe(payment.id)
    })

    it('matches by mergedTransactionIds array in compacted payment', () => {
      const match1 = findLinkedDebtPayment('tx-old-1', [debtWithPayment])
      expect(match1).not.toBeNull()
      expect(match1?.payment.id).toBe('compacted_123')

      const match2 = findLinkedDebtPayment('debt_pay_old-p2', [debtWithPayment])
      expect(match2).not.toBeNull()
      expect(match2?.payment.id).toBe('compacted_123')
    })

    it('returns null when no debt has a matching payment', () => {
      expect(findLinkedDebtPayment('tx-other', [debtWithPayment])).toBeNull()
    })
  })

  describe('groupDebtsByPerson & formatDebtAccountStatement', () => {
    it('groups debts by normalized person name and detects mergeability', () => {
      const debts: Debt[] = [
        {
          ...baseDebt,
          id: 'd1',
          personName: 'أبوي',
          type: 'lent',
          amountFils: 50000,
          paidFils: 0,
        },
        {
          ...baseDebt,
          id: 'd2',
          personName: 'ابوي',
          type: 'lent',
          amountFils: 30000,
          paidFils: 10000,
        },
        {
          ...baseDebt,
          id: 'd3',
          personName: 'محمد',
          type: 'borrowed',
          amountFils: 40000,
          paidFils: 0,
        },
      ]

      const groups = groupDebtsByPerson(debts)
      expect(groups).toHaveLength(2)

      const fatherGroup = groups.find((g) => g.personKey === 'ابوي')
      expect(fatherGroup).toBeDefined()
      expect(fatherGroup?.debts).toHaveLength(2)
      expect(fatherGroup?.totalLentRemainingFils).toBe(70000)
      expect(fatherGroup?.canMergeLent).toBe(true)
      expect(fatherGroup?.canMerge).toBe(true)

      const mohamedGroup = groups.find((g) => g.personKey === 'محمد')
      expect(mohamedGroup).toBeDefined()
      expect(mohamedGroup?.totalBorrowedRemainingFils).toBe(40000)
      expect(mohamedGroup?.canMerge).toBe(false)
    })

    it('generates a detailed account statement string', () => {
      const debtWithEntries: Debt = {
        ...baseDebt,
        personName: 'عمر',
        entries: [
          {
            id: 'e1',
            amountFils: 60000,
            date: new Date('2026-09-01'),
            title: 'قرض أول',
            note: 'صيانة سيارة',
            createdAt: new Date('2026-09-01'),
          },
          {
            id: 'e2',
            amountFils: 40000,
            date: new Date('2026-09-15'),
            title: 'سلفة ثانية',
            note: 'قطع غيار',
            createdAt: new Date('2026-09-15'),
          },
        ],
        payments: [
          {
            id: 'p1',
            amountFils: 30000,
            date: new Date('2026-10-01'),
            note: 'دفعة أولى كاش',
            createdAt: new Date('2026-10-01'),
          },
        ],
      }

      const statement = formatDebtAccountStatement(debtWithEntries, 'د.أ')
      expect(statement).toContain('كشف حساب مالي')
      expect(statement).toContain('عمر')
      expect(statement).toContain('قرض أول')
      expect(statement).toContain('سلفة ثانية')
      expect(statement).toContain('دفعة أولى كاش')
      expect(statement).toContain('100 د.أ')
      expect(statement).toContain('30 د.أ')
      expect(statement).toContain('70 د.أ')
    })

    it('formats statement with custom decimals (e.g. 2 for SAR)', () => {
      const debtWithFraction: Debt = {
        ...baseDebt,
        amountFils: 50125, // 50.125
        paidFils: 0,
        entries: [],
        payments: [],
      }
      const statement = formatDebtAccountStatement(debtWithFraction, 'ر.س', 2)
      expect(statement).toContain('50.13 ر.س')
    })

    it('resolves string currency code to appropriate decimals via getCurrencyConfig', () => {
      const debtWithFraction: Debt = {
        ...baseDebt,
        amountFils: 50125, // 50.125
        paidFils: 0,
        entries: [],
        payments: [],
      }
      const statement = formatDebtAccountStatement(debtWithFraction, 'ر.س', 'SAR')
      expect(statement).toContain('50.13 ر.س')
    })

    it('handles debt with empty or missing personName in groupDebtsByPerson and only allows merging unsettled debts', () => {
      const unnamedDebts: Debt[] = [
        {
          ...baseDebt,
          id: 'u1',
          personName: '',
          amountFils: 50000,
          paidFils: 0,
          settled: false,
          type: 'lent',
        },
        {
          ...baseDebt,
          id: 'u2',
          personName: '   ',
          amountFils: 30000,
          paidFils: 30000,
          settled: true,
          type: 'lent',
        },
      ]
      const groups = groupDebtsByPerson(unnamedDebts)
      expect(groups).toHaveLength(1)
      expect(groups[0].canonicalName).toBe('غير مسمى')
      // Only 1 is unsettled, so canMergeLent should be false
      expect(groups[0].canMergeLent).toBe(false)
      expect(groups[0].canMerge).toBe(false)
    })
  })

  describe('formatDebtEntriesCount', () => {
    it('formats Arabic singular, dual, and plural correctly', () => {
      expect(formatDebtEntriesCount(0)).toBe('')
      expect(formatDebtEntriesCount(1)).toBe('سلفة واحدة')
      expect(formatDebtEntriesCount(2)).toBe('سلفتان مجمعتان')
      expect(formatDebtEntriesCount(3)).toBe('3 سلف مجمعة')
      expect(formatDebtEntriesCount(10)).toBe('10 سلف مجمعة')
      expect(formatDebtEntriesCount(11)).toBe('11 سلفة مجمعة')
    })
  })

  describe('filterDebts with payment notes', () => {
    it('matches search query from payment note', () => {
      const debtWithPaymentNote: Debt = {
        ...baseDebt,
        payments: [
          {
            id: 'p1',
            amountFils: 10000,
            date: new Date('2026-09-02'),
            note: 'شيك بنكي رقم 4488',
            createdAt: new Date('2026-09-02'),
          },
        ],
      }
      const results = filterDebts([debtWithPaymentNote], {
        type: 'all',
        status: 'all',
        search: '4488',
      })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('d1')
    })
  })
})
