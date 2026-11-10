import { describe, it, expect } from 'vitest'
import {
  formatObligationsCount,
  formatDebtCount,
  getDashboardHeroVisualStatus,
} from './dashboard'

describe('dashboard helpers', () => {
  describe('formatObligationsCount', () => {
    it('formats single obligation', () => {
      expect(formatObligationsCount(1)).toBe('التزام واحد يستحق')
    })
    it('formats dual obligations', () => {
      expect(formatObligationsCount(2)).toBe('التزامان يستحقان')
    })
    it('formats 3 to 10 obligations', () => {
      expect(formatObligationsCount(5)).toBe('5 التزامات تستحق')
    })
    it('formats 11+ obligations', () => {
      expect(formatObligationsCount(12)).toBe('12 التزاماً يستحق')
    })
  })

  describe('formatDebtCount', () => {
    it('formats zero active debts', () => {
      expect(formatDebtCount(0)).toBe('لا توجد ديون نشطة')
    })
    it('formats 1 active debt', () => {
      expect(formatDebtCount(1)).toBe('دين نشط واحد')
    })
    it('formats 2 active debts', () => {
      expect(formatDebtCount(2)).toBe('دينان نشطان')
    })
    it('formats 3 to 10 debts', () => {
      expect(formatDebtCount(4)).toBe('4 ديون نشطة')
    })
    it('formats 11+ debts', () => {
      expect(formatDebtCount(15)).toBe('15 ديناً نشطاً')
    })
  })

  describe('getDashboardHeroVisualStatus', () => {
    const baseParams = {
      isInitialOrLoading: false,
      isRolloverResolving: false,
      isTemporaryLiquidityDeficit: false,
      isFutureMonth: false,
      displayBalance: 100000,
      freeBalance: 50000,
      healthStatus: 'safe' as const,
      isSpendingWithoutIncome: false,
      isHighConsumption: false,
    }

    it('returns emerald when loading/resolving to guard against flashes', () => {
      const res = getDashboardHeroVisualStatus({ ...baseParams, isInitialOrLoading: true })
      expect(res.topBarClass).toBe('bg-emerald-500')
      expect(res.shieldColorClass).toBe('text-emerald-600 dark:text-emerald-400')
    })

    it('returns amber on temporary liquidity deficit', () => {
      const res = getDashboardHeroVisualStatus({ ...baseParams, isTemporaryLiquidityDeficit: true })
      expect(res.topBarClass).toBe('bg-amber-500')
      expect(res.shieldColorClass).toBe('text-amber-500 dark:text-amber-400')
    })

    it('returns red on danger/deficit in future month', () => {
      const res = getDashboardHeroVisualStatus({
        ...baseParams,
        isFutureMonth: true,
        displayBalance: -100,
      })
      expect(res.topBarClass).toBe('bg-red-500')
    })

    it('returns red on current month negative display balance', () => {
      const res = getDashboardHeroVisualStatus({
        ...baseParams,
        displayBalance: -500,
      })
      expect(res.topBarClass).toBe('bg-red-500')
      expect(res.shieldColorClass).toBe('text-red-600 dark:text-red-400')
    })

    it('returns amber on high consumption or warning', () => {
      const res = getDashboardHeroVisualStatus({
        ...baseParams,
        isHighConsumption: true,
      })
      expect(res.topBarClass).toBe('bg-amber-500')
    })

    it('returns emerald on healthy state', () => {
      const res = getDashboardHeroVisualStatus(baseParams)
      expect(res.topBarClass).toBe('bg-emerald-500')
      expect(res.shieldColorClass).toBe('text-emerald-600 dark:text-emerald-400')
    })
  })
})
