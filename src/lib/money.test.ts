import { describe, it, expect } from 'vitest'
import {
  toFils,
  fromFils,
  formatJOD,
  formatSigned,
  formatMoney,
  formatCompactNumber,
  getCurrencyConfig,
  PRESET_CURRENCIES,
} from './money'

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

    it('handles single comma as decimal separator (including 3 decimals for JOD)', () => {
      expect(toFils('12,500')).toBe(12500)
      expect(toFils('0,500')).toBe(500)
      expect(toFils('12,5')).toBe(12500)
      expect(toFils('12,50')).toBe(12500)
    })

    it('handles thousands comma properly when ending with 000 or for 2-decimal currencies', () => {
      expect(toFils('1,000')).toBe(1000000) // 1000 units
      expect(toFils('2,000')).toBe(2000000) // 2000 units
      expect(toFils('1,500', 'SAR')).toBe(1500000) // 1500 SAR
      expect(toFils('12,500', 'USD')).toBe(12500000) // 12500 USD
      expect(toFils('1,500', 2)).toBe(1500000) // 1500 units with 2 decimals
    })

    it('handles multiple commas as thousands separators', () => {
      expect(toFils('1,000,000')).toBe(1000000000)
      expect(toFils('2,500,000')).toBe(2500000000)
    })

    it('handles both comma and dot together', () => {
      expect(toFils('1,250.500')).toBe(1250500)
      expect(toFils('1.250,500')).toBe(1250500)
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

  describe('multi-currency support (formatMoney)', () => {
    it('formats SAR with 2 decimal places and ر.س symbol', () => {
      expect(formatMoney(12500, 'SAR')).toBe('12.50 ر.س')
      expect(formatMoney(350000, 'SAR')).toBe('350.00 ر.س')
    })

    it('formats USD with 2 decimal places and $ symbol', () => {
      expect(formatMoney(12500, 'USD')).toBe('12.50 $')
    })

    it('formats EUR with 2 decimal places and € symbol', () => {
      expect(formatMoney(12500, 'EUR')).toBe('12.50 €')
    })

    it('formats AED with 2 decimal places and د.إ symbol', () => {
      expect(formatMoney(12500, 'AED')).toBe('12.50 د.إ')
    })

    it('formats custom currency or presets like EGP with 2 decimals and KWD/BHD/OMR with 3 decimals', () => {
      expect(formatMoney(12500, 'EGP')).toBe('12.50 ج.م')
      expect(formatMoney(12500, 'ج.م')).toBe('12.50 ج.م')
      expect(formatMoney(12500, 'KWD')).toBe('12.500 د.ك')
      expect(formatMoney(12500, 'د.ك')).toBe('12.500 د.ك')
      expect(formatMoney(12500, 'BHD')).toBe('12.500 د.ب')
      expect(formatMoney(12500, 'د.ب')).toBe('12.500 د.ب')
      expect(formatMoney(12500, 'OMR')).toBe('12.500 ر.ع')
      expect(formatMoney(12500, 'ر.ع')).toBe('12.500 ر.ع')
      expect(formatMoney(12500, 'ليرة')).toBe('12.50 ليرة')
    })

    it('falls back to JOD when no currency specified', () => {
      expect(formatMoney(12500)).toBe('12.500 د.أ')
    })
  })

  describe('getCurrencyConfig & PRESET_CURRENCIES', () => {
    it('contains all required preset currencies with correct decimals', () => {
      expect(PRESET_CURRENCIES.KWD.decimals).toBe(3)
      expect(PRESET_CURRENCIES.BHD.decimals).toBe(3)
      expect(PRESET_CURRENCIES.OMR.decimals).toBe(3)
      expect(PRESET_CURRENCIES.EGP.decimals).toBe(2)
      expect(PRESET_CURRENCIES.SAR.decimals).toBe(2)
      expect(PRESET_CURRENCIES.AED.decimals).toBe(2)
      expect(PRESET_CURRENCIES.JOD.decimals).toBe(3)
    })

    it('assigns 3 decimals to custom currencies representing 3-decimal currencies', () => {
      expect(getCurrencyConfig('د.ك').decimals).toBe(3)
      expect(getCurrencyConfig('kwd').decimals).toBe(3)
      expect(getCurrencyConfig('د.ب').decimals).toBe(3)
      expect(getCurrencyConfig('bhd').decimals).toBe(3)
      expect(getCurrencyConfig('ر.ع').decimals).toBe(3)
      expect(getCurrencyConfig('omr').decimals).toBe(3)
      expect(getCurrencyConfig('د.ع').decimals).toBe(3)
      expect(getCurrencyConfig('ريال قطري').decimals).toBe(2)
    })
  })

  describe('formatCompactNumber', () => {
    it('formats small numbers normally', () => {
      expect(formatCompactNumber(0)).toBe('0')
      expect(formatCompactNumber(45)).toBe('45')
      expect(formatCompactNumber(999)).toBe('999')
    })

    it('formats thousands with k suffix', () => {
      expect(formatCompactNumber(1000)).toBe('1k')
      expect(formatCompactNumber(1500)).toBe('1.5k')
      expect(formatCompactNumber(10000)).toBe('10k')
      expect(formatCompactNumber(25400)).toBe('25.4k')
      expect(formatCompactNumber(100000)).toBe('100k')
    })

    it('formats millions with M suffix', () => {
      expect(formatCompactNumber(1000000)).toBe('1M')
      expect(formatCompactNumber(2500000)).toBe('2.5M')
    })

    it('handles negative values and invalid inputs correctly', () => {
      expect(formatCompactNumber(-5000)).toBe('-5k')
      expect(formatCompactNumber(NaN)).toBe('0')
    })
  })
})
