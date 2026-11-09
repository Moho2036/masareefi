import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  escapeCsvCell,
  buildCsv,
  exportTransactionsToCsv,
} from './exportCsv'
import type { Transaction, Category } from '../types'

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
})
