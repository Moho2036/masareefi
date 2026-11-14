import { describe, it, expect } from 'vitest'
import {
  evaluateMathExpression,
  hasMathOperator,
  cleanNumberToken,
} from './mathExpression'

describe('mathExpression lib', () => {
  describe('hasMathOperator', () => {
    it('detects operators in western digits', () => {
      expect(hasMathOperator('10+5')).toBe(true)
      expect(hasMathOperator('100 - 20')).toBe(true)
      expect(hasMathOperator('3*4')).toBe(true)
      expect(hasMathOperator('10/2')).toBe(true)
    })

    it('detects operators with Arabic and Persian digits', () => {
      expect(hasMathOperator('١٠+٥')).toBe(true)
      expect(hasMathOperator('۱۰*۲')).toBe(true)
    })

    it('ignores leading plus or minus without subsequent operators', () => {
      expect(hasMathOperator('-50')).toBe(false)
      expect(hasMathOperator('+100')).toBe(false)
      expect(hasMathOperator('-50 + 20')).toBe(true)
    })

    it('returns false for plain numbers', () => {
      expect(hasMathOperator('123')).toBe(false)
      expect(hasMathOperator('123.45')).toBe(false)
      expect(hasMathOperator('١٢٣.٤٥')).toBe(false)
      expect(hasMathOperator('')).toBe(false)
    })
  })

  describe('cleanNumberToken', () => {
    it('parses valid numeric strings', () => {
      expect(cleanNumberToken('123')).toBe(123)
      expect(cleanNumberToken('123.45')).toBe(123.45)
      expect(cleanNumberToken('1,234.56')).toBe(1234.56)
    })

    it('handles commas as decimals or thousand separators', () => {
      expect(cleanNumberToken('12,5')).toBe(12.5)
      expect(cleanNumberToken('1,000')).toBe(1000)
    })

    it('treats comma as decimal separator for zero-prefixed values (JOD-style)', () => {
      expect(cleanNumberToken('0,500')).toBe(0.5)
      expect(cleanNumberToken('-0,500')).toBe(-0.5)
      expect(cleanNumberToken('0,750')).toBe(0.75)
    })

    it('returns NaN for invalid number strings', () => {
      expect(cleanNumberToken('')).toBeNaN()
      expect(cleanNumberToken('1.2.3')).toBeNaN()
    })
  })

  describe('evaluateMathExpression', () => {
    it('evaluates simple expressions', () => {
      expect(evaluateMathExpression('10+5')).toBe(15)
      expect(evaluateMathExpression('20-8')).toBe(12)
      expect(evaluateMathExpression('4*6')).toBe(24)
      expect(evaluateMathExpression('15/3')).toBe(5)
    })

    it('respects operator precedence (* and / before + and -)', () => {
      expect(evaluateMathExpression('10+2*5')).toBe(20)
      expect(evaluateMathExpression('30-10/2')).toBe(25)
      expect(evaluateMathExpression('2*3+4*5')).toBe(26)
    })

    it('handles Arabic-Indic digits and Arabic decimal separator (٫)', () => {
      expect(evaluateMathExpression('١٠ + ٥')).toBe(15)
      expect(evaluateMathExpression('٢.٥ * ٤')).toBe(10)
      expect(evaluateMathExpression('١٠٫٥ + ٤٫٥')).toBe(15)
    })

    it('handles Persian digits', () => {
      expect(evaluateMathExpression('۱۰ + ۲۰')).toBe(30)
      expect(evaluateMathExpression('۶ * ۷')).toBe(42)
    })

    it('returns null on division by zero', () => {
      expect(evaluateMathExpression('10/0')).toBeNull()
      expect(evaluateMathExpression('5 + 10 / 0')).toBeNull()
    })

    it('handles leading signs', () => {
      expect(evaluateMathExpression('-10+25')).toBe(15)
      expect(evaluateMathExpression('+15+5')).toBe(20)
    })

    it('handles trailing operators gracefully', () => {
      expect(evaluateMathExpression('10+5+')).toBe(15)
      expect(evaluateMathExpression('20*2*')).toBe(40)
    })

    it('returns null for empty or invalid inputs', () => {
      expect(evaluateMathExpression('')).toBeNull()
      expect(evaluateMathExpression('abc')).toBeNull()
      expect(evaluateMathExpression('++')).toBeNull()
    })

    it('strips invisible bidirectional Unicode characters before parsing', () => {
      // LRM (U+200E) and RLM (U+200F) injected around digits and operators
      expect(evaluateMathExpression('\u200E10\u200F+\u200E5\u200F')).toBe(15)
      expect(evaluateMathExpression('\u202A100\u202B*\u202C2\u202D')).toBe(200)
    })

    it('supports unary minus/plus immediately after * or /', () => {
      expect(evaluateMathExpression('100*-2')).toBe(-200)
      expect(evaluateMathExpression('50+-10')).toBe(40)
      expect(evaluateMathExpression('20/-4')).toBe(-5)
      expect(evaluateMathExpression('10*+3')).toBe(30)
    })
  })
})
