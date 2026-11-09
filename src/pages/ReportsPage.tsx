/* eslint-disable react-hooks/refs */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { subDays, format as formatDate, differenceInDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Calendar,
  ChevronDown,
  ChevronUp,
  Printer,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { CategoryPieChart } from '../components/charts/CategoryPieChart'
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart'
import { DailyExpenseChart } from '../components/charts/DailyExpenseChart'
import { FormattedMoney } from '../components/ui/FormattedMoney'
import { useAuth } from '../hooks/useAuth'
import { useAppData } from '../context/AppDataContext'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useUserSettings } from '../hooks/useUserSettings'
import { useDebts } from '../hooks/useDebts'
import { useRecurring } from '../hooks/useRecurring'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { subscribePriorBalance } from '../services/transactions'
import { sumByType } from '../lib/aggregate'
import {
  calculateCategoryDistribution,
  calculateYearlyBreakdown,
  calculateSavingsRate,
  calculateAnnualSummary,
  generateDailyExpenses,
  getDailyExpenseStats,
  type CategoryDistributionItem,
} from '../lib/reports'
import {
  getFinancialMonthRange,
  getMonthRange,
  getFiscalMonthKey,
  getFiscalMonthInfo,
  toWesternDigits,
  getPreviousFinancialMonth,
} from '../lib/dates'
import { calculateForecast } from '../lib/forecast'
import { SafeDailySpendCard } from '../components/reports/SafeDailySpendCard'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { cn } from '../lib/cn'
import type { TxType } from '../types'

export const ReportsPage: React.FC = () => {
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [showAllMonthCategories, setShowAllMonthCategories] = useState(false)
  const [showAllYearCategories, setShowAllYearCategories] = useState(false)
  const [monthCategoryType, setMonthCategoryType] = useState<TxType>('expense')
  const [yearCategoryType, setYearCategoryType] = useState<TxType>('expense')
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<CategoryDistributionItem | null>(null)

  // Monthly data hooks
  const { user } = useAuth()
  const appData = useAppData()
  const { range } = useSelectedMonth()
  const { data: settings } = useUserSettings()
  const { data: debts } = useDebts()
  const { data: recurring } = useRecurring()
  const { data: circles } = useMoneyCircles()
  const monthStartDay = settings?.monthStartDay ?? 1

  const [localRollover, setLocalRollover] = useState<{ key: string; amount: number }>({ key: '', amount: 0 })
  const isRolloverEnabled = settings?.rolloverBalance ?? true

  const isCurrentFiscalMonth =
    getFiscalMonthKey(range.start, monthStartDay) ===
    getFiscalMonthKey(new Date(), monthStartDay)

  const isEarlyMonth =
    isCurrentFiscalMonth && differenceInDays(new Date(), range.start) < 4

  const parsedRolloverStartDate = useMemo(() => {
    if (!settings?.rolloverStartDate) return null
    const raw = settings.rolloverStartDate
    return raw instanceof Date
      ? raw
      : typeof (raw as { toDate?: () => Date }).toDate === 'function'
      ? (raw as { toDate: () => Date }).toDate()
      : new Date(raw as unknown as string)
  }, [settings?.rolloverStartDate])

  useEffect(() => {
    if (!user?.uid || !isRolloverEnabled) {
      return
    }
    // If viewing the current fiscal month, AppDataContext is already subscribed to prior balance
    if (isCurrentFiscalMonth) {
      return
    }
    // If viewing month on or before rolloverStartDate, rollover was zeroed out
    if (parsedRolloverStartDate && range.start.getTime() <= parsedRolloverStartDate.getTime()) {
      return
    }
    const currentKey = range.start.toISOString()
    const unsub = subscribePriorBalance(
      user.uid,
      range.start,
      (bal) => {
        setLocalRollover({ key: currentKey, amount: bal })
      },
      (err) => {
        console.error('Failed to subscribe prior balance in ReportsPage:', err)
      },
      parsedRolloverStartDate
    )
    return () => {
      unsub()
    }
  }, [user?.uid, isRolloverEnabled, range.start, isCurrentFiscalMonth, parsedRolloverStartDate])

  const effectiveLocalRollover =
    localRollover.key === range.start.toISOString() ? localRollover.amount : 0

  const isMonthly = reportPeriod === 'monthly'
  const isYearly = reportPeriod === 'yearly'

  // Previous month range for monthly comparison
  const prevMonthRange = useMemo(() => {
    const prevDate = getPreviousFinancialMonth(range.start, monthStartDay)
    return getFinancialMonthRange(prevDate, monthStartDay)
  }, [range.start, monthStartDay])

  // Combined range to fetch both current and previous month in a single Firestore subscription
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

  // Extract current month and previous month transactions in-memory
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

  const effectiveRollover = useMemo(() => {
    if (isCurrentFiscalMonth) {
      return appData?.rolloverBalanceFils ?? 0
    }
    if (!isRolloverEnabled) {
      return 0
    }
    if (parsedRolloverStartDate && range.start.getTime() < parsedRolloverStartDate.getTime()) {
      return 0
    }
    if (settings?.createdAt) {
      const rawCreated = settings.createdAt
      const createdAtDate =
        rawCreated instanceof Date
          ? rawCreated
          : typeof (rawCreated as { toDate?: () => Date }).toDate === 'function'
          ? (rawCreated as { toDate: () => Date }).toDate()
          : new Date(rawCreated as unknown as string)
      const createdCycleStart = getFinancialMonthRange(createdAtDate, monthStartDay).start
      if (range.start.getTime() < createdCycleStart.getTime()) {
        return 0
      }
    }
    return effectiveLocalRollover + (settings?.openingBalanceFils ?? 0)
  }, [
    isCurrentFiscalMonth,
    appData?.rolloverBalanceFils,
    isRolloverEnabled,
    parsedRolloverStartDate,
    range.start,
    settings,
    monthStartDay,
    effectiveLocalRollover,
  ])

  const { data: categories } = useCategories()

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

  // Monthly calculations
  const monthSums = useMemo(() => sumByType(monthTransactions), [monthTransactions])
  const prevMonthSums = useMemo(() => sumByType(prevMonthTransactions), [prevMonthTransactions])
  const monthSavingsRate = useMemo(
    () => calculateSavingsRate(monthSums.income, monthSums.expense),
    [monthSums.income, monthSums.expense]
  )

  const monthCategoryDist = useMemo(
    () => calculateCategoryDistribution(monthTransactions, categories, monthCategoryType),
    [monthTransactions, categories, monthCategoryType]
  )

  const handleSelectMonthPieCategory = useCallback(
    (categoryId: string) => {
      const found = monthCategoryDist.find((c) => c.categoryId === categoryId)
      if (found) {
        setSelectedCategoryModal(found)
      }
    },
    [monthCategoryDist]
  )

  const modalTransactions = useMemo(() => {
    if (!selectedCategoryModal) return []
    const list = reportPeriod === 'monthly' ? monthTransactions : yearTransactions
    const targetType = reportPeriod === 'monthly' ? monthCategoryType : yearCategoryType
    return list
      .filter((tx) => tx.categoryId === selectedCategoryModal.categoryId && tx.type === targetType)
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()
        const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()
        return db - da
      })
  }, [
    selectedCategoryModal,
    reportPeriod,
    monthTransactions,
    yearTransactions,
    monthCategoryType,
    yearCategoryType,
  ])

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
    return {
      diff,
      percent,
      isIncrease: diff > 0,
    }
  }, [monthSums.expense, prevMonthSums.expense])

  const monthIncomeComparison = useMemo(() => {
    if (prevMonthSums.income === 0) return null
    const diff = monthSums.income - prevMonthSums.income
    const percent = Math.round((Math.abs(diff) / prevMonthSums.income) * 1000) / 10
    return {
      diff,
      percent,
      isIncrease: diff > 0,
    }
  }, [monthSums.income, prevMonthSums.income])

  // Yearly calculations
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
  const yearCategoryDist = useMemo(
    () => calculateCategoryDistribution(yearTransactions, categories, yearCategoryType),
    [yearTransactions, categories, yearCategoryType]
  )

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
    const calendarYear = new Date().getFullYear()

    let createdYear = calendarYear
    if (settings?.createdAt) {
      const rawCreated = settings.createdAt
      const createdDate =
        rawCreated instanceof Date
          ? rawCreated
          : typeof (rawCreated as { toDate?: () => Date }).toDate === 'function'
          ? (rawCreated as { toDate: () => Date }).toDate()
          : new Date(rawCreated as unknown as string | number)
      if (!isNaN(createdDate.getTime())) {
        createdYear = createdDate.getFullYear()
      }
    }

    const maxYear = Math.max(calendarYear + 1, currentYear, selectedYear)
    const minYear = Math.min(createdYear, selectedYear)

    const yearsSet = new Set<number>()
    yearsSet.add(selectedYear)
    for (let y = maxYear; y >= minYear; y--) {
      yearsSet.add(y)
    }
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a)
    const finalYears = sortedYears.slice(0, 15)
    if (!finalYears.includes(selectedYear)) {
      finalYears.push(selectedYear)
      finalYears.sort((a, b) => b - a)
    }

    return finalYears.map((y) => ({
      value: String(y),
      label: `سنة ${y}`,
    }))
  }, [currentYear, selectedYear, settings])

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header with Title and Period Switcher */}
      <PageHeader
        title="التقارير المالية"
        subtitle="تحليل تفصيلي وإحصائيات لأداء ميزانيتك ومصاريفك"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <SegmentedControl<'monthly' | 'yearly'>
              value={reportPeriod}
              onChange={setReportPeriod}
              options={[
                { value: 'monthly', label: 'تقرير شهري' },
                { value: 'yearly', label: 'تقرير سنوي' },
              ]}
            />
            {reportPeriod === 'yearly' && (
              <div className="w-36">
                <Select
                  value={String(selectedYear)}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  options={yearOptions}
                />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              icon={<Printer className="w-3.5 h-3.5" />}
              className="print-hide inline-flex"
            >
              طباعة / حفظ PDF
            </Button>
          </div>
        }
      />

      {/* Print-Only Header Banner */}
      <div className="hidden print:block pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between text-xs">
          <div>
            <h1 className="text-lg font-black text-zinc-900">
              {reportPeriod === 'monthly' ? 'التقرير المالي الشهري' : 'التقرير المالي السنوي'}
            </h1>
            <p className="text-zinc-600 font-semibold mt-0.5">
              {reportPeriod === 'monthly'
                ? `الدورة المالية: ${toWesternDigits(formatDate(range.start, 'd MMMM yyyy', { locale: ar }))} – ${toWesternDigits(formatDate(new Date(range.end.getTime() - 1), 'd MMMM yyyy', { locale: ar }))}`
                : `السنة المالية: ${selectedYear} ${monthStartDay > 1 ? `(يوم بداية الدورة: ${monthStartDay})` : ''}`}
            </p>
          </div>
          <div className="text-end text-zinc-500 font-medium">
            تاريخ الطباعة: {toWesternDigits(formatDate(new Date(), 'yyyy/MM/dd HH:mm'))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ==================== MONTHLY REPORT ==================== */}
      {/* ========================================================= */}
      {reportPeriod === 'monthly' && (
        <div className="space-y-6">
          {/* Safe Daily Spend & Month-End Forecast Card */}
          <SafeDailySpendCard forecast={forecast} />

          {/* 4 Monthly KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Income */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    إجمالي المداخيل
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
                  <FormattedMoney amountFils={monthSums.income} />
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] leading-relaxed">
                {monthSums.income === 0 ? (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {forecast.isFutureMonth
                      ? 'الشهر لم يبدأ بعد'
                      : isEarlyMonth
                        ? 'الشهر في بدايته — لم يُسجل دخل بعد'
                        : prevMonthSums.income > 0 ? (
                            <span className="font-bold inline-flex items-center gap-0.5 text-red-500 dark:text-red-400">
                              <ArrowDownRight className="w-3 h-3" />
                              <span>أقل بـ 100% عن الشهر السابق</span>
                            </span>
                          ) : (
                            'لا توجد مداخيل مسجلة في هذا الشهر'
                          )}
                  </span>
                ) : monthIncomeComparison ? (
                  monthIncomeComparison.diff === 0 ? (
                    <span className="font-bold text-zinc-500 dark:text-zinc-400">
                      مساوٍ للشهر السابق (0%)
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'font-bold inline-flex items-center gap-0.5',
                        monthIncomeComparison.isIncrease
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      )}
                    >
                      {monthIncomeComparison.isIncrease ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      <span>
                        {monthIncomeComparison.isIncrease ? 'أعلى' : 'أقل'} بـ{' '}
                        {monthIncomeComparison.percent === 0 ? '<0.1%' : `${monthIncomeComparison.percent}%`} عن الشهر السابق
                      </span>
                    </span>
                  )
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {prevMonthSums.income === 0
                      ? 'لم يُسجل دخل في الشهر السابق'
                      : 'الدخل المحصل في هذا الشهر'}
                  </span>
                )}
              </div>
            </Card>

            {/* Expenses */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    إجمالي المصاريف
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
                  <FormattedMoney amountFils={monthSums.expense} />
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] leading-relaxed">
                {monthSums.expense === 0 ? (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {forecast.isFutureMonth
                      ? 'الشهر لم يبدأ بعد'
                      : isEarlyMonth
                        ? 'الشهر في بدايته — لم تُسجل مصاريف بعد'
                        : prevMonthSums.expense > 0 ? (
                            <span className="font-bold inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                              <ArrowDownRight className="w-3 h-3" />
                              <span>أقل بـ 100% عن الشهر السابق</span>
                            </span>
                          ) : (
                            'لا توجد مصاريف مسجلة في هذا الشهر'
                          )}
                  </span>
                ) : monthComparison ? (
                  monthComparison.diff === 0 ? (
                    <span className="font-bold text-zinc-500 dark:text-zinc-400">
                      مساوٍ للشهر السابق (0%)
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'font-bold inline-flex items-center gap-0.5',
                        monthComparison.isIncrease
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      {monthComparison.isIncrease ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      <span>
                        {monthComparison.isIncrease ? 'أكثر' : 'أقل'} بـ{' '}
                        {monthComparison.percent === 0 ? '<0.1%' : `${monthComparison.percent}%`} عن الشهر السابق
                      </span>
                    </span>
                  )
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    {prevMonthSums.expense === 0
                      ? 'لم تُسجل مصاريف في الشهر السابق'
                      : 'إجمالي ما تم صرفه'}
                  </span>
                )}
              </div>
            </Card>

            {/* Net Savings */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    صافي الادخار
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <PiggyBank className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div
                  className={cn(
                    'text-lg sm:text-2xl font-black select-none',
                    monthSums.balance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                  )}
                >
                  <FormattedMoney amountFils={monthSums.balance} />
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                {(isRolloverEnabled || (settings?.openingBalanceFils ?? 0) > 0) &&
                (forecast.isFutureMonth ? forecast.rolloverBalance : effectiveRollover) !== 0 ? (
                  <>
                    صافي الشهر المستقل (الرصيد المتاح مع المرحّل:{' '}
                    <span dir="ltr" className="inline-block font-semibold">
                      <FormattedMoney
                        amountFils={
                          monthSums.balance +
                          (forecast.isFutureMonth ? forecast.rolloverBalance : effectiveRollover)
                        }
                      />
                    </span>
                    )
                  </>
                ) : (
                  'المبلغ المتبقي من دخل هذا الشهر بعد المصاريف'
                )}
              </div>
            </Card>

            {/* Savings Rate */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    نسبة الادخار
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div
                  className={cn(
                    'text-lg sm:text-2xl font-black select-none',
                    monthSums.income === 0
                      ? 'text-zinc-400 dark:text-zinc-500'
                      : monthSums.balance < 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {monthSums.income === 0 ? '—' : `%${monthSavingsRate}`}
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                {monthSums.income === 0 && monthSums.expense > 0
                  ? 'لا يوجد دخل مسجل لحساب النسبة'
                  : 'من إجمالي الدخل المحصل'}
              </div>
            </Card>
          </div>

          {/* Daily Expense Chart Card */}
          <Card className="p-5 print-avoid-break">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                  المصروف اليومي خلال الشهر
                </h2>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  توزيع الإنفاق اليومي لتحديد أيام الذروة والأيام الخالية من المصاريف
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {dailyStats.highestDay && dailyStats.highestDay.amountFils > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
                    <span>أعلى صرف:</span>
                    <span>
                      {toWesternDigits(formatDate(dailyStats.highestDay.date, 'd MMMM', { locale: ar }))}
                    </span>
                    <span>(<FormattedMoney amountFils={dailyStats.highestDay.amountFils} />)</span>
                  </span>
                )}
                {!forecast.isFutureMonth && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>أيام بدون مصاريف:</span>
                    <span>{toWesternDigits(String(dailyStats.zeroSpendDaysCount))} يوم</span>
                  </span>
                )}
              </div>
            </div>

            <DailyExpenseChart data={dailyExpenses} className="pt-2" />
          </Card>

          {/* Category Filter Controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <h2 className="text-base font-extrabold text-zinc-800 dark:text-zinc-100">
              {monthCategoryType === 'expense' ? 'تحليل المصروفات حسب التصنيف' : 'تحليل المداخيل حسب التصنيف'}
            </h2>
            <SegmentedControl<TxType>
              value={monthCategoryType}
              onChange={setMonthCategoryType}
              options={[
                { value: 'expense', label: 'المصروفات' },
                { value: 'income', label: 'المداخيل' },
              ]}
            />
          </div>

          {/* Monthly Charts & Top Categories Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Donut Chart */}
            <Card className="p-5 flex flex-col justify-between print-avoid-break">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                  {monthCategoryType === 'expense' ? 'توزيع المصاريف حسب التصنيف' : 'توزيع المداخيل حسب التصنيف'}
                </h2>
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  {monthCategoryDist.length} تصنيفات
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <CategoryPieChart
                  data={monthCategoryDist}
                  type={monthCategoryType}
                  className="w-full"
                  onSelectCategory={handleSelectMonthPieCategory}
                />
              </div>
            </Card>

            {/* Top Categories Progress Bars */}
            <Card className="p-5 print-avoid-break">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-700/60">
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                  {monthCategoryType === 'expense' ? 'أعلى التصنيفات إنفاقاً' : 'أعلى التصنيفات دخلاً'}
                </h2>
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  {monthCategoryType === 'expense' ? 'النسبة المئوية من الإنفاق' : 'النسبة المئوية من الدخل'}
                </span>
              </div>

              {monthLoading && !hasLoadedMonthOnceRef.current ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                          <div className="w-24 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                          <div className="w-8 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : monthCategoryDist.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  {monthCategoryType === 'expense'
                    ? 'لا توجد مصاريف مسجلة لهذا الشهر'
                    : 'لا توجد مداخيل مسجلة لهذا الشهر'}
                </div>
              ) : (
                <div className="space-y-3">
                  {(showAllMonthCategories
                    ? monthCategoryDist
                    : monthCategoryDist.slice(0, 6)
                  ).map((item) => (
                    <div
                      key={item.categoryId}
                      tabIndex={0}
                      onClick={() => setSelectedCategoryModal(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedCategoryModal(item)
                        }
                      }}
                      className="space-y-1.5 p-2 -mx-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors cursor-pointer group"
                      title="اضغط لعرض المعاملات التابعة لهذا التصنيف"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                          <span className="font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-zinc-800 dark:text-zinc-100">
                            <FormattedMoney amountFils={item.amountFils} />
                          </span>
                          <span className="font-bold text-zinc-400 dark:text-zinc-500 min-w-8 text-end">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {monthCategoryDist.length > 6 && (
                    <div className="pt-2 text-center border-t border-zinc-100 dark:border-zinc-700/40 print-hide">
                      <button
                        type="button"
                        onClick={() => setShowAllMonthCategories((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline py-1 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                      >
                        <span>
                          {showAllMonthCategories
                            ? 'عرض أقل'
                            : `عرض جميع التصنيفات (${monthCategoryDist.length})`}
                        </span>
                        {showAllMonthCategories ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ===================== YEARLY REPORT ===================== */}
      {/* ========================================================= */}
      {reportPeriod === 'yearly' && (
        <div className="space-y-6">
          {/* Financial Year Period Banner when monthStartDay > 1 */}
          {monthStartDay > 1 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-xs font-bold text-blue-800 dark:text-blue-300">
              <Calendar className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>السنة المالية: {financialYearLabel}</span>
            </div>
          )}

          {/* 4 Yearly KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Annual Income */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    إجمالي المداخيل السنوية
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
                  <FormattedMoney amountFils={yearSums.income} />
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                {annualSummary.averageMonthlyIncomeFils > 0 ? (
                  <div>متوسط الدخل: <FormattedMoney amountFils={annualSummary.averageMonthlyIncomeFils} /> / شهر</div>
                ) : (
                  <div>إجمالي الدخل المحصل خلال سنة {selectedYear}</div>
                )}
              </div>
            </Card>

            {/* Total Annual Expense */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    إجمالي المصاريف السنوية
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
                  <FormattedMoney amountFils={yearSums.expense} />
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                {annualSummary.averageMonthlyExpenseFils > 0 ? (
                  <>
                    <div>متوسط الصرف: <FormattedMoney amountFils={monthlyAverage} /> / شهر</div>
                    {annualSummary.note && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                        ({annualSummary.note})
                      </div>
                    )}
                  </>
                ) : (
                  <div>إجمالي المصاريف خلال سنة {selectedYear}</div>
                )}
              </div>
            </Card>

            {/* Annual Net Savings */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    صافي الادخار السنوي
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <PiggyBank className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div
                  className={cn(
                    'text-lg sm:text-2xl font-black select-none',
                    yearSums.balance >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-500 dark:text-red-400'
                  )}
                >
                  <FormattedMoney amountFils={yearSums.balance} />
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                {yearSums.balance < 0 ? 'العجز المالي السنوي' : 'الفائض المالي السنوي'}
              </div>
            </Card>

            {/* Annual Savings Rate */}
            <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    نسبة الادخار السنوية
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div
                  className={cn(
                    'text-lg sm:text-2xl font-black select-none',
                    yearSums.income === 0
                      ? 'text-zinc-400 dark:text-zinc-500'
                      : yearSums.balance < 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {yearSums.income === 0 ? '—' : `%${yearlySavingsRate}`}
                </div>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                {yearSums.income === 0
                  ? 'لا يوجد دخل مسجل لحساب النسبة'
                  : 'من إجمالي الدخل المحصل سنوياً'}
              </div>
            </Card>
          </div>

          {/* Large Grouped Bar Chart */}
          <Card className="p-5 print-avoid-break">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                  المداخيل والمصاريف لكل شهر
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {monthStartDay > 1 && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                    يبدأ الشهر المالي يوم {monthStartDay}
                  </span>
                )}
                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
                  سنة {selectedYear}
                </span>
              </div>
            </div>
            {monthStartDay > 1 && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
                الأشهر المعروضة تحتسب وفق يوم بداية الشهر المالي المخصص (من يوم {monthStartDay} في كل شهر).
              </p>
            )}
            <MonthlyBarChart data={yearlyBreakdown} className="pt-2" />
          </Card>

          {/* Yearly Bottom Row: Top Categories & Monthly Breakdown Table (Stacked full width for desktop clarity) */}
          <div className="space-y-6">
            {/* Top Categories Annual */}
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-700/60">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                    {yearCategoryType === 'expense'
                      ? 'أعلى التصنيفات إنفاقاً في السنة'
                      : 'أعلى التصنيفات دخلاً في السنة'}
                  </h2>
                  <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                    {yearCategoryType === 'expense' ? 'حسب إجمالي المصاريف' : 'حسب إجمالي المداخيل'}
                  </span>
                </div>
                <SegmentedControl<TxType>
                  value={yearCategoryType}
                  onChange={setYearCategoryType}
                  options={[
                    { value: 'expense', label: 'المصروفات' },
                    { value: 'income', label: 'المداخيل' },
                  ]}
                />
              </div>

              {yearLoading && !hasLoadedYearOnceRef.current ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                          <div className="w-24 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                          <div className="w-8 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : yearCategoryDist.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  {yearCategoryType === 'expense'
                    ? 'لا توجد مصاريف مسجلة في هذه السنة'
                    : 'لا توجد مداخيل مسجلة في هذه السنة'}
                </div>
              ) : (
                <div className="space-y-3">
                  {(showAllYearCategories
                    ? yearCategoryDist
                    : yearCategoryDist.slice(0, 6)
                  ).map((item) => (
                    <div
                      key={item.categoryId}
                      tabIndex={0}
                      onClick={() => setSelectedCategoryModal(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedCategoryModal(item)
                        }
                      }}
                      className="space-y-1.5 p-2 -mx-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors cursor-pointer group"
                      title="اضغط لعرض المعاملات التابعة لهذا التصنيف"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                          <span className="font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-zinc-800 dark:text-zinc-100">
                            <FormattedMoney amountFils={item.amountFils} />
                          </span>
                          <span className="font-bold text-zinc-400 dark:text-zinc-500 min-w-8 text-end">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {yearCategoryDist.length > 6 && (
                    <div className="pt-2 text-center border-t border-zinc-100 dark:border-zinc-700/40 print-hide">
                      <button
                        type="button"
                        onClick={() => setShowAllYearCategories((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline py-1 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                      >
                        <span>
                          {showAllYearCategories
                            ? 'عرض أقل'
                            : `عرض جميع التصنيفات (${yearCategoryDist.length})`}
                        </span>
                        {showAllYearCategories ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Monthly Breakdown Table */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-700/60">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                    تفاصيل الشهور
                  </h2>
                  {monthStartDay > 1 && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      الدورة المالية تبدأ يوم {monthStartDay}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  12 شهراً
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                      <th className="p-2.5 text-start font-bold">الشهر</th>
                      <th className="p-2.5 text-start font-bold">المداخيل</th>
                      <th className="p-2.5 text-start font-bold">المصاريف</th>
                      <th className="p-2.5 text-start font-bold">صافي الادخار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyBreakdown.map((row) => {
                      const isCurrentRowMonth =
                        selectedYear === currentYear &&
                        row.monthIndex === currentFiscalInfo.monthIndex
                      const isFutureMonth =
                        selectedYear > currentYear ||
                        (selectedYear === currentYear &&
                          row.monthIndex > currentFiscalInfo.monthIndex)
                      const isUnstartedFuture =
                        isFutureMonth && row.income === 0 && row.expense === 0
                      const isEmptyRecord = row.income === 0 && row.expense === 0

                      return (
                        <tr
                          key={row.monthIndex}
                          className={cn(
                            'border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50/60 dark:hover:bg-zinc-700/30 transition-colors',
                            isCurrentRowMonth &&
                              'bg-blue-50/70 dark:bg-blue-950/40 font-bold border-s-4 border-blue-600'
                          )}
                        >
                          <td className="p-2.5 font-bold text-zinc-700 dark:text-zinc-200">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                <span>{row.monthName}</span>
                                {isCurrentRowMonth && (
                                  <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-blue-600 text-white font-bold">
                                    الشهر الحالي
                                  </span>
                                )}
                              </span>
                              {row.dateRange && (
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                                  {row.dateRange}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                            {isUnstartedFuture ? (
                              <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px] font-normal">
                                لم يبدأ بعد
                              </span>
                            ) : isEmptyRecord ? (
                              <span className="text-zinc-400 dark:text-zinc-600 font-normal">—</span>
                            ) : (
                              <FormattedMoney amountFils={row.income} />
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-red-500 dark:text-red-400">
                            {isUnstartedFuture ? (
                              <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px] font-normal">
                                لم يبدأ بعد
                              </span>
                            ) : isEmptyRecord ? (
                              <span className="text-zinc-400 dark:text-zinc-600 font-normal">—</span>
                            ) : (
                              <FormattedMoney amountFils={row.expense} />
                            )}
                          </td>
                          <td
                            className={cn(
                              'p-2.5 font-extrabold',
                              row.balance >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500 dark:text-red-400'
                            )}
                          >
                            {isUnstartedFuture ? (
                              <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px] font-normal">
                                لم يبدأ بعد
                              </span>
                            ) : isEmptyRecord ? (
                              <span className="text-zinc-400 dark:text-zinc-600 font-normal">
                                —
                              </span>
                            ) : (
                              <FormattedMoney amountFils={row.balance} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-800/80 font-black">
                      <td className="p-2.5 text-zinc-800 dark:text-zinc-100 font-black">
                        الإجمالي السنوي
                      </td>
                      <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-black">
                        <FormattedMoney amountFils={yearSums.income} />
                      </td>
                      <td className="p-2.5 text-red-500 dark:text-red-400 font-black">
                        <FormattedMoney amountFils={yearSums.expense} />
                      </td>
                      <td
                        className={cn(
                          'p-2.5 font-black',
                          yearSums.balance >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500 dark:text-red-400'
                        )}
                      >
                        <FormattedMoney amountFils={yearSums.balance} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Category Transactions Modal */}
      <Modal
        isOpen={selectedCategoryModal !== null}
        onClose={() => setSelectedCategoryModal(null)}
        title={selectedCategoryModal ? `معاملات ${selectedCategoryModal.name}` : undefined}
      >
        <div className="space-y-4 pt-1">
          {selectedCategoryModal && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/50">
              <div className="flex items-center gap-2.5">
                <CategoryIcon
                  icon={selectedCategoryModal.icon}
                  color={selectedCategoryModal.color}
                  size="md"
                />
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {selectedCategoryModal.name}
                </span>
              </div>
              <div className="text-end">
                <div className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                  <FormattedMoney amountFils={selectedCategoryModal.amountFils} />
                </div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold">
                  {selectedCategoryModal.percentage}% من الإجمالي
                </div>
              </div>
            </div>
          )}

          {modalTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
              لا توجد معاملات مسجلة في هذا التصنيف خلال هذه الفترة
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[50vh] overflow-y-auto ps-1 pe-2 -me-2">
              {modalTransactions.map((tx) => {
                const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
                return (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-zinc-800 dark:text-zinc-100">
                        {tx.title?.trim() || tx.note?.trim() || selectedCategoryModal?.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {toWesternDigits(formatDate(txDate, 'd MMMM yyyy', { locale: ar }))}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'font-black text-sm',
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      )}
                    >
                      <FormattedMoney amountFils={tx.amountFils} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedCategoryModal(null)}
            >
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
