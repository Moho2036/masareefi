import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  escapeCsvCell,
  buildCsv,
  exportTransactionsToCsv,
  exportAllFinancialDataToCsv,
  formatFilsForCsv,
  buildTransactionCsvRows,
} from './exportCsv'
import type { Transaction, Category, MoneyCircle } from '../types'

describe('exportCsv module', () => {
  describe('escapeCsvCell', () => {
    it('returns empty string for null and undefined', () => {
      expect(escapeCsvCell(null)).toBe('')
      expect(escapeCsvCell(undefined)).toBe('')
    })

    it('returns string representation for normal text or numbers', () => {
      expect(escapeCsvCell('طعام')).toBe('طعام')
      expect(escapeCsvCell(12.5)).toBe('12.5')
    })

    it('wraps with quotes and escapes internal quotes when commas or quotes are present', () => {
      expect(escapeCsvCell('طعام, شراب')).toBe('"طعام, شراب"')
      expect(escapeCsvCell('ملاحظة "مهمة"')).toBe('"ملاحظة ""مهمة"""')
      expect(escapeCsvCell('سطر أول\nسطر ثان')).toBe('"سطر أول\nسطر ثان"')
    })

    it('prepends single quote to string values starting with =, +, -, or @ to prevent formula injection', () => {
      expect(escapeCsvCell('=SUM(A1:B1)')).toBe("'=SUM(A1:B1)")
      expect(escapeCsvCell(' =SUM(A1:B1)')).toBe("' =SUM(A1:B1)")
      expect(escapeCsvCell('+12345')).toBe("'+12345")
      expect(escapeCsvCell('  +12345')).toBe("'  +12345")
      expect(escapeCsvCell('-cmd')).toBe("'-cmd")
      expect(escapeCsvCell(' -cmd')).toBe("' -cmd")
      expect(escapeCsvCell('@calc')).toBe("'@calc")
      expect(escapeCsvCell(' @calc')).toBe("' @calc")
      // Numbers starting with minus should NOT have quote prepended
      expect(escapeCsvCell(-12.5)).toBe('-12.5')
    })
  })

  describe('buildCsv', () => {
    it('prepends UTF-8 BOM character directly without sep=, directive by default and formats rows with CRLF', () => {
      const headers = ['الاسم', 'المبلغ']
      const rows = [
        ['أحمد', 15.5],
        ['سارة', 20],
      ]
      const result = buildCsv(headers, rows)

      expect(result.startsWith('\uFEFFالاسم,المبلغ\r\n')).toBe(true)
      expect(result).toBe('\uFEFFالاسم,المبلغ\r\nأحمد,15.5\r\nسارة,20')
    })

    it('includes sep=, directive if includeSepDirective is true', () => {
      const headers = ['الاسم', 'المبلغ']
      const rows = [['أحمد', 15.5]]
      const result = buildCsv(headers, rows, { includeSepDirective: true })
      expect(result).toBe('\uFEFFsep=,\r\nالاسم,المبلغ\r\nأحمد,15.5')
    })
  })

  describe('exportTransactionsToCsv', () => {
    let clickSpy = vi.fn<() => void>()
    let createdAnchor: HTMLAnchorElement | null = null

    beforeEach(() => {
      clickSpy = vi.fn()
      createdAnchor = null
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      globalThis.URL.revokeObjectURL = vi.fn()

      const origCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName)
        if (tagName === 'a') {
          createdAnchor = el as HTMLAnchorElement
          createdAnchor.click = () => {
            clickSpy()
          }
        }
        return el
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('formats and triggers download for transactions', () => {
      const sampleCategories: Category[] = [
        { id: 'c1', name: 'بقالة', type: 'expense', icon: '🛒', color: '#F59E0B', archived: false, order: 0 },
      ]
      const sampleTxs: Transaction[] = [
        {
          id: 't1',
          type: 'expense',
          amountFils: 12500,
          categoryId: 'c1',
          date: new Date('2026-05-10T10:00:00Z'),
          title: 'تسوق',
          note: 'سوبرماركت',
          createdAt: new Date(),
        },
      ]

      exportTransactionsToCsv(sampleTxs, sampleCategories)

      expect(createdAnchor).not.toBeNull()
      expect(clickSpy).toHaveBeenCalledTimes(1)
      expect(createdAnchor?.getAttribute('download')).toMatch(/^baseer_transactions_\d{4}-\d{2}-\d{2}\.csv$/)
    })

    it('supports custom currency symbol and decimals in transactions export', () => {
      const sampleCategories: Category[] = [
        { id: 'c1', name: 'راتب', type: 'income', icon: '💰', color: '#10B981', archived: false, order: 0 },
      ]
      const sampleTxs: Transaction[] = [
        {
          id: 't1',
          type: 'income',
          amountFils: 500000,
          categoryId: 'c1',
          date: new Date('2026-05-01T10:00:00Z'),
          title: 'راتب شهري',
          note: '',
          createdAt: new Date(),
        },
      ]

      exportTransactionsToCsv(sampleTxs, sampleCategories, { symbol: '$', decimals: 2 })
      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('formatFilsForCsv helper', () => {
    it('rounds integer fils without floating point drift across decimals', () => {
      expect(formatFilsForCsv(12500, 3)).toBe('12.500')
      expect(formatFilsForCsv(1005, 2)).toBe('1.01')
      expect(formatFilsForCsv(1004, 2)).toBe('1.00')
      expect(formatFilsForCsv(1500, 0)).toBe('2')
      expect(formatFilsForCsv(1400, 0)).toBe('1')
      expect(formatFilsForCsv(NaN, 2)).toBe('0.00')
    })
  })

  describe('buildTransactionCsvRows helper', () => {
    it('normalizes string dates and builds valid rows', () => {
      const catMap = new Map([['c1', 'طعام']])
      const txs = [
        {
          id: 't-str-date',
          type: 'expense' as const,
          amountFils: 5000,
          categoryId: 'c1',
          date: '2026-05-10T12:00:00Z' as unknown as Date,
          title: 'غداء',
          note: '',
          createdAt: new Date(),
        },
      ]

      const rows = buildTransactionCsvRows(txs, catMap, 'د.أ', 3)
      expect(rows).toHaveLength(1)
      expect(rows[0][0]).toBe('2026-05-10')
      expect(rows[0][1]).toBe('مصروف')
      expect(rows[0][2]).toBe('طعام')
      expect(rows[0][3]).toBe('غداء')
      expect(rows[0][5]).toBe('5.000')
    })
  })

  describe('exportAllFinancialDataToCsv', () => {
    let capturedBlobText = ''
    beforeEach(() => {
      capturedBlobText = ''
      globalThis.Blob = class MockBlob {
        content: string[]
        constructor(parts: string[]) {
          this.content = parts
          capturedBlobText = parts.join('')
        }
      } as unknown as typeof Blob
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-all')
      globalThis.URL.revokeObjectURL = vi.fn()
    })

    it('formats double share money circles with dual turns and doubled payout in unified export', () => {
      const circles: MoneyCircle[] = [
        {
          id: 'c-double',
          name: 'جمعية مزدوجة',
          monthlyAmountFils: 50000,
          membersCount: 10,
          totalAmountFils: 500000,
          myTurnMonth: 2,
          secondTurnMonth: 7,
          shareType: 'double',
          startDate: new Date('2026-01-01'),
          members: [],
          status: 'active',
          createdAt: new Date(),
        },
      ]

      exportAllFinancialDataToCsv({
        transactions: [],
        categories: [],
        debts: [],
        recurring: [],
        circles,
      })

      // Dual turn: "2 ، 7"
      expect(capturedBlobText).toContain('2 ، 7')
      // Doubled monthly contribution: 50000 * 2 = 100.000 JOD
      expect(capturedBlobText).toContain('100.000')
      // Doubled total payout: 500000 * 2 = 1000.000 JOD
      expect(capturedBlobText).toContain('1000.000')
    })
  })
})
