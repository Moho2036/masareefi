/* eslint-disable react-hooks/refs */
import { useMemo, useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { useSelectedMonth } from './useSelectedMonth'
import { useTransactions } from './useTransactions'
import { useCategories } from './useCategories'
import { useRecurring } from './useRecurring'
import { useDebts } from './useDebts'
import { useMoneyCircles } from './useMoneyCircles'
import { useUserSettings } from './useUserSettings'
import { useTransactionModal } from './useTransactionModal'
import { usePeriodRollover } from './usePeriodRollover'
import { sumByType } from '../lib/aggregate'
import { calculateCategoryDistribution } from '../lib/reports'
import { calculateDebtSummary, getDebtRemainingFils } from '../lib/debts'
import { calculateForecast } from '../lib/forecast'
import { isOccurrenceSkipped, advanceDateWithTargetDay } from '../lib/recurring'
import { getDashboardHeroVisualStatus } from '../lib/dashboard'
import type { Recurring } from '../types'

export function useDashboardData() {
  const { user } = useAuth()
  const { range, goToCurrentMonth } = useSelectedMonth()
  const { data: rawTransactions, loading: txLoading } = useTransactions(range)
  const { data: categories } = useCategories()
  const { data: recurringList, loading: recurringLoading } = useRecurring()
  const { data: debts, loading: debtsLoading } = useDebts()
  const { data: circles } = useMoneyCircles()
  const { data: settings, loading: settingsLoading } = useUserSettings()
  const { openAdd, openEdit, openDuplicate } = useTransactionModal()

  const hasLoadedOnceRef = useRef(false)

  const monthStartDay = settings?.monthStartDay ?? 1
  const {
    effectiveRollover,
    isRolloverResolving,
    isCurrentFiscalMonth,
    isRolloverEnabled,
  } = usePeriodRollover(range, settings)

  useEffect(() => {
    if (!txLoading && !settingsLoading && !isRolloverResolving) {
      hasLoadedOnceRef.current = true
    }
  }, [txLoading, settingsLoading, isRolloverResolving])

  const isInitialOrLoading =
    !hasLoadedOnceRef.current && (txLoading || settingsLoading || isRolloverResolving)

  // Calculate monthly totals
  const sums = useMemo(() => sumByType(rawTransactions), [rawTransactions])

  // Calculate forecast & daily safe budget
  const forecast = useMemo(() => {
    return calculateForecast({
      transactions: rawTransactions,
      recurring: recurringList,
      debts,
      circles,
      monthStartDay,
      periodRange: range,
      rolloverBalanceFils:
        isRolloverEnabled || (settings?.openingBalanceFils ?? 0) > 0
          ? effectiveRollover
          : undefined,
    })
  }, [
    rawTransactions,
    recurringList,
    debts,
    circles,
    monthStartDay,
    range,
    effectiveRollover,
    isRolloverEnabled,
    settings?.openingBalanceFils,
  ])

  const displayedRollover = forecast.isFutureMonth ? forecast.rolloverBalance : effectiveRollover
  const displayBalance = sums.balance + displayedRollover

  const lastStableBalanceRef = useRef<number>(displayBalance)
  useEffect(() => {
    if (!isRolloverResolving) {
      lastStableBalanceRef.current = displayBalance
    }
  }, [displayBalance, isRolloverResolving])

  const safeDisplayBalance = isRolloverResolving ? lastStableBalanceRef.current : displayBalance

  // Calculate active debts summary
  const debtSummary = useMemo(() => calculateDebtSummary(debts), [debts])

  const nearestUpcomingDebt = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const activeWithDue = debts
      .filter(
        (d) =>
          !d.settled &&
          getDebtRemainingFils(d) > 0 &&
          d.dueDate &&
          new Date(d.dueDate).getTime() >= today.getTime()
      )
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    return activeWithDue[0] || null
  }, [debts])

  // Map categoryId to Category object
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  const topExpenseCategories = useMemo(
    () => calculateCategoryDistribution(rawTransactions, categories, 'expense').slice(0, 3),
    [rawTransactions, categories]
  )

  // Up to 5 most recent transactions sorted by date descending, then createdAt descending
  const recentTransactions = useMemo(() => {
    return [...rawTransactions]
      .sort((a, b) => {
        const timeA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
        const timeB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
        if (timeB !== timeA) {
          return timeB - timeA
        }
        const createdA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
        const createdB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
        return createdB - createdA
      })
      .slice(0, 5)
  }, [rawTransactions])

  // Up to 3 upcoming active recurring items
  const upcomingRecurring = useMemo(() => {
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    const list: (Recurring & { nextDate: Date })[] = []

    for (const r of recurringList) {
      if (!r.active) continue

      let nextD = r.nextDate instanceof Date ? r.nextDate : new Date(r.nextDate)
      const startD = r.startDate instanceof Date ? r.startDate : new Date(r.startDate)

      let guard = 24
      while (isOccurrenceSkipped(r, nextD, monthStartDay) && guard-- > 0) {
        nextD = advanceDateWithTargetDay(nextD, r.frequency, startD.getDate())
      }

      if (r.endDate) {
        const endD = r.endDate instanceof Date ? r.endDate : new Date(r.endDate)
        const endMidnight = new Date(endD)
        endMidnight.setHours(23, 59, 59, 999)
        if (nextD.getTime() > endMidnight.getTime() || endMidnight.getTime() < todayMidnight.getTime()) {
          continue
        }
      }

      list.push({ ...r, nextDate: nextD })
    }

    return list
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
      .slice(0, 3)
  }, [recurringList, monthStartDay])

  const [focusTick, setFocusTick] = useState(0)

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        setFocusTick((t) => t + 1)
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [])

  const today = useMemo(() => {
    if (focusTick < 0 || !rawTransactions) return new Date()
    return new Date()
  }, [rawTransactions, focusTick])

  const hasRolloverEffect = isRolloverEnabled || (settings?.openingBalanceFils ?? 0) > 0
  const effectiveAvailableIncome = sums.income + (hasRolloverEffect ? displayedRollover : 0)
  const isTemporaryLiquidityDeficit =
    displayBalance < 0 && forecast.freeBalance > 0 && forecast.upcomingRecurringIncome > 0
  const isSpendingWithoutIncome =
    effectiveAvailableIncome <= 0 && sums.expense > 0 && !isTemporaryLiquidityDeficit
  const consumptionRatio =
    effectiveAvailableIncome > 0 ? sums.expense / effectiveAvailableIncome : 0
  const isHighConsumption = effectiveAvailableIncome > 0 && consumptionRatio >= 0.8

  const heroVisual = useMemo(() => {
    return getDashboardHeroVisualStatus({
      isInitialOrLoading,
      isRolloverResolving,
      isTemporaryLiquidityDeficit,
      isFutureMonth: Boolean(forecast.isFutureMonth),
      displayBalance,
      freeBalance: forecast.freeBalance,
      healthStatus: forecast.healthStatus,
      isSpendingWithoutIncome,
      isHighConsumption,
    })
  }, [
    isInitialOrLoading,
    isRolloverResolving,
    isTemporaryLiquidityDeficit,
    forecast.isFutureMonth,
    displayBalance,
    forecast.freeBalance,
    forecast.healthStatus,
    isSpendingWithoutIncome,
    isHighConsumption,
  ])

  const displayName = settings?.displayName?.trim() || user?.displayName?.trim() || ''
  const greetingSubtitle = displayName ? `أهلاً بك، ${displayName}` : undefined

  return {
    range,
    monthStartDay,
    isCurrentFiscalMonth,
    isRolloverResolving,
    isInitialOrLoading,
    sums,
    forecast,
    safeDisplayBalance,
    heroTopBar: heroVisual.topBarClass,
    heroShieldColor: heroVisual.shieldColorClass,
    greetingSubtitle,
    debtSummary,
    nearestUpcomingDebt,
    debtsLoading,
    categoryMap,
    topExpenseCategories,
    recentTransactions,
    upcomingRecurring,
    recurringLoading,
    today,
    openAdd,
    openEdit,
    openDuplicate,
    goToCurrentMonth,
  }
}
