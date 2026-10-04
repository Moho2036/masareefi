import { describe, it, expect } from 'vitest'
import { toFils, fromFils, formatJOD, formatSigned } from './money'

describe('money lib', () => {
  describe('toFils', () => {
    it('converts basic numbers to integer fils', () => {
      expect(toFils(12.5)).toBe(12500)
      expect(toFils(0)).toBe(0)
      expect(toFils(1)).toBe(1000)
      expect(toFils(0.001)).toBe(1)
      expect(toFils(-5.25)).toBe(-5250)
    })

    it('rounds sub-fils values to nearest integer', () => {
      expect(toFils(12.3456)).toBe(12346)
      expect(toFils(12.3454)).toBe(12345)
    })

    it('handles string representations', () => {
      expect(toFils('12.5')).toBe(12500)
      expect(toFils('12.500')).toBe(12500)
      expect(toFils(' 12.500 ')).toBe(12500)
      expect(toFils('0')).toBe(0)
      expect(toFils('0.75')).toBe(750)
    })

    it('handles thousands commas', () => {
      expect(toFils('12,500')).toBe(12500000)
      expect(toFils('1,250.500')).toBe(1250500)
      expect(toFils('1,000,000')).toBe(1000000000)
    })

    it('handles decimal comma when not thousands separator', () => {
      expect(toFils('12,5')).toBe(12500)
      expect(toFils('12,50')).toBe(12500)
    })

    it('handles Arabic-Indic numerals', () => {
      expect(toFils('١٢.٥')).toBe(12500)
      expect(toFils('٢٥')).toBe(25000)
      expect(toFils('١,٢٥٠.٥')).toBe(1250500)
    })

    it('returns 0 for empty or invalid input', () => {
      expect(toFils('')).toBe(0)
      expect(toFils('   ')).toBe(0)
      expect(toFils('invalid')).toBe(0)
      expect(toFils(NaN)).toBe(0)
      expect(toFils(Infinity)).toBe(0)
    })
  })

  describe('fromFils', () => {
    it('converts fils to decimal dinars', () => {
      expect(fromFils(12500)).toBe(12.5)
      expect(fromFils(0)).toBe(0)
      expect(fromFils(1000)).toBe(1)
      expect(fromFils(1)).toBe(0.001)
      expect(fromFils(-5000)).toBe(-5)
    })

    it('handles invalid numbers', () => {
      expect(fromFils(NaN)).toBe(0)
      expect(fromFils(Infinity)).toBe(0)
    })
  })

  describe('formatJOD', () => {
    it('formats fils with Arabic currency symbol and 3 decimals', () => {
      expect(formatJOD(12500)).toBe('12.500 د.أ')
      expect(formatJOD(0)).toBe('0.000 د.أ')
      expect(formatJOD(337250)).toBe('337.250 د.أ')
    })

    it('formats thousands with grouping separators', () => {
      expect(formatJOD(1000000)).toBe('1,000.000 د.أ')
    })

    it('supports omitting currency symbol when requested', () => {
      expect(formatJOD(12500, { showCurrency: false })).toBe('12.500')
      expect(formatJOD(1000000, { showCurrency: false })).toBe('1,000.000')
    })
  })

  describe('formatSigned', () => {
    it('formats positive amount for income', () => {
      expect(formatSigned(12500, 'income')).toBe('+ 12.500 د.أ')
      expect(formatSigned(350000, 'income')).toBe('+ 350.000 د.أ')
    })

    it('formats negative amount for expense', () => {
      expect(formatSigned(12500, 'expense')).toBe('- 12.500 د.أ')
      expect(formatSigned(25500, 'expense')).toBe('- 25.500 د.أ')
    })

    it('handles negative values correctly without double signs', () => {
      expect(formatSigned(-12500, 'expense')).toBe('- 12.500 د.أ')
      expect(formatSigned(-12500, 'income')).toBe('+ 12.500 د.أ')
    })
  })
})
