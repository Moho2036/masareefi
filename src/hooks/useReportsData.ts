/* eslint-disable react-hooks/refs */
import { useState, useMemo, useEffect, useRef } from 'react'
import { subDays, format as formatDate, differenceInDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useSelectedMonth } from './useSelectedMonth'
import { useTransactions } from './useTransactions'
import { useUserSettings } from './useUserSettings'
import { useDebts } from './useDebts'
import { useRecurring } from './useRecurring'
import { useMoneyCircles } from './useMoneyCircles'
import { usePeriodRollover } from './usePeriodRollover'
import { sumByType } from '../lib/aggregate'
import {
  calculateYearlyBreakdown,
  calculateSavingsRate,
  calculateAnnualSummary,
  generateDailyExpenses,
  getDailyExpenseStats,
} from '../lib/reports'
import {
  getFinancialMonthRange,
  getMonthRange,
  getFiscalMonthInfo,
  toWesternDigits,
  getPreviousFinancialMonth,
} from '../lib/dates'
import { calculateForecast } from '../lib/forecast'
import { generateReportYearOptions } from '../lib/reportYears'

export function useReportsData() {
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'yearly'>('monthly')

  const { range } = useSelectedMonth()
  const { data: settings } = useUserSettings()
  const { data: debts } = useDebts()
  const { data: recurring } = useRecurring()
  const { data: circles } = useMoneyCircles()
  const monthStartDay = settings?.monthStartDay ?? 1

  const {
    effectiveRollover,
    isRolloverEnabled,
    isCurrentFiscalMonth,
  } = usePeriodRollover(range, settings)

  const isEarlyMonth =
    isCurrentFiscalMonth && differenceInDays(new Date(), range.start) < 4

  const isMonthly = reportPeriod === 'monthly'
  const isYearly = reportPeriod === 'yearly'

  // Previous month range for monthly comparison
  const prevMonthRange = useMemo(() => {
    const prevDate = getPreviousFinancialMonth(range.start, monthStartDay)
    return getFinancialMonthRange(prevDate, monthStartDay)
  }, [range.start, monthStartDay])

  const twoMonthsRange = useMemo(() => {
    return {
      start: prevMonthRange.start,
      end: range.end,
    }
  }, [prevMonthRange.start, range.end])

  const { data: twoMonthsTransactions, loading: monthLoading } = useTransactions(twoMonthsRange, {
    enabled: isMonthly,
  })

  const hasLoadedMonthOnceRef = useRef(false)
  const hasLoadedYearOnceRef = useRef(false)

  useEffect(() => {
    if (!monthLoading) {
      hasLoadedMonthOnceRef.current = true
    }
  }, [monthLoading])

  const monthStartMs = range.start.getTime()
  const monthEndMs = range.end.getTime()
  const prevStartMs = prevMonthRange.start.getTime()
  const prevEndMs = prevMonthRange.end.getTime()

  const monthTransactions = useMemo(() => {
    return twoMonthsTransactions.filter((tx) => {
      const t = tx.date instanceof Date ? tx.date.getTime() : new Date(tx.date).getTime()
      return t >= monthStartMs && t < monthEndMs
    })
  }, [twoMonthsTransactions, monthStartMs, monthEndMs])

  const prevMonthTransactions = useMemo(() => {
    return twoMonthsTransactions.filter((tx) => {
      const t = tx.date instanceof Date ? tx.date.getTime() : new Date(tx.date).getTime()
      return t >= prevStartMs && t < prevEndMs
    })
  }, [twoMonthsTransactions, prevStartMs, prevEndMs])

  const forecast = useMemo(() => {
    return calculateForecast({
      transactions: monthTransactions,
      recurring,
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
    monthTransactions,
    recurring,
    debts,
    circles,
    monthStartDay,
    range,
    effectiveRollover,
    isRolloverEnabled,
    settings?.openingBalanceFils,
  ])

  // Yearly data hooks
  const defaultYear = useMemo(() => range.start.getFullYear(), [range.start])
  const [userSelectedYear, setUserSelectedYear] = useState<number | null>(null)
  const [prevDefaultYear, setPrevDefaultYear] = useState(defaultYear)
  if (defaultYear !== prevDefaultYear) {
    setPrevDefaultYear(defaultYear)
    setUserSelectedYear(null)
  }
  const currentFiscalInfo = useMemo(
    () => getFiscalMonthInfo(new Date(), monthStartDay),
    [monthStartDay]
  )
  const currentYear = currentFiscalInfo.year
  const selectedYear = userSelectedYear ?? defaultYear
  const setSelectedYear = (year: number) => setUserSelectedYear(year)

  const yearRange = useMemo(() => {
    const start = getMonthRange(selectedYear, 0, monthStartDay).start
    const end = getMonthRange(selectedYear, 11, monthStartDay).end
    return { start, end }
  }, [selectedYear, monthStartDay])

  const financialYearLabel = useMemo(() => {
    const inclusiveEnd = subDays(yearRange.end, 1)
    const startStr = toWesternDigits(formatDate(yearRange.start, 'd MMMM yyyy', { locale: ar }))
    const endStr = toWesternDigits(formatDate(inclusiveEnd, 'd MMMM yyyy', { locale: ar }))
    return `${startStr} – ${endStr}`
  }, [yearRange])

  const { data: yearTransactions, loading: yearLoading } = useTransactions(yearRange, {
    enabled: isYearly,
  })

  useEffect(() => {
    if (!yearLoading) {
      hasLoadedYearOnceRef.current = true
    }
  }, [yearLoading])

  const monthSums = useMemo(() => sumByType(monthTransactions), [monthTransactions])
  const prevMonthSums = useMemo(() => sumByType(prevMonthTransactions), [prevMonthTransactions])
  const monthSavingsRate = useMemo(
    () => calculateSavingsRate(monthSums.income, monthSums.expense),
    [monthSums.income, monthSums.expense]
  )

  const dailyExpenses = useMemo(() => {
    return generateDailyExpenses(monthTransactions, range, new Date())
  }, [monthTransactions, range])

  const dailyStats = useMemo(() => {
    return getDailyExpenseStats(dailyExpenses)
  }, [dailyExpenses])

  const monthComparison = useMemo(() => {
    if (prevMonthSums.expense === 0) return null
    const diff = monthSums.expense - prevMonthSums.expense
    const percent = Math.round((Math.abs(diff) / prevMonthSums.expense) * 1000) / 10
    return { diff, percent, isIncrease: diff > 0 }
  }, [monthSums.expense, prevMonthSums.expense])

  const monthIncomeComparison = useMemo(() => {
    if (prevMonthSums.income === 0) return null
    const diff = monthSums.income - prevMonthSums.income
    const percent = Math.round((Math.abs(diff) / prevMonthSums.income) * 1000) / 10
    return { diff, percent, isIncrease: diff > 0 }
  }, [monthSums.income, prevMonthSums.income])

  const yearSums = useMemo(() => sumByType(yearTransactions), [yearTransactions])
  const yearlySavingsRate = useMemo(
    () => calculateSavingsRate(yearSums.income, yearSums.expense),
    [yearSums.income, yearSums.expense]
  )
  const yearlyBreakdown = useMemo(() => {
    const rawBreakdown = calculateYearlyBreakdown(yearTransactions, selectedYear, monthStartDay)
    return rawBreakdown.map((row) => ({
      ...row,
      isFutureMonth:
        selectedYear > currentYear ||
        (selectedYear === currentYear && row.monthIndex > currentFiscalInfo.monthIndex),
    }))
  }, [yearTransactions, selectedYear, monthStartDay, currentYear, currentFiscalInfo.monthIndex])

  const annualSummary = useMemo(() => {
    return calculateAnnualSummary(
      yearlyBreakdown,
      selectedYear,
      currentYear,
      currentFiscalInfo.monthIndex
    )
  }, [yearlyBreakdown, selectedYear, currentYear, currentFiscalInfo.monthIndex])

  const monthlyAverage = annualSummary.averageMonthlyExpenseFils

  const yearOptions = useMemo(() => {
    return generateReportYearOptions(currentYear, selectedYear, settings?.createdAt)
  }, [currentYear, selectedYear, settings?.createdAt])

  return {
    reportPeriod,
    setReportPeriod,
    range,
    monthStartDay,
    settings,
    monthLoading,
    hasLoadedMonthOnce: hasLoadedMonthOnceRef.current,
    monthTransactions,
    prevMonthSums,
    monthSums,
    monthSavingsRate,
    monthComparison,
    monthIncomeComparison,
    isEarlyMonth,
    effectiveRollover,
    isRolloverEnabled,
    forecast,
    dailyExpenses,
    dailyStats,
    selectedYear,
    setSelectedYear,
    currentYear,
    currentFiscalInfo,
    financialYearLabel,
    yearLoading,
    hasLoadedYearOnce: hasLoadedYearOnceRef.current,
    yearTransactions,
    yearSums,
    yearlySavingsRate,
    yearlyBreakdown,
    annualSummary,
    monthlyAverage,
    yearOptions,
  }
}
