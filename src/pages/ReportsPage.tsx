import React, { useState, useMemo } from 'react'
import { addMonths } from 'date-fns'
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { MonthSelector } from '../components/ui/MonthSelector'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Card } from '../components/ui/Card'
import { CategoryPieChart } from '../components/charts/CategoryPieChart'
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useUserSettings } from '../hooks/useUserSettings'
import { useDebts } from '../hooks/useDebts'
import { useRecurring } from '../hooks/useRecurring'
import { useCurrency } from '../hooks/useCurrency'
import { sumByType } from '../lib/aggregate'
import {
  calculateCategoryDistribution,
  calculateYearlyBreakdown,
  calculateSavingsRate,
} from '../lib/reports'
import { getFinancialMonthRange } from '../lib/dates'
import { calculateForecast } from '../lib/forecast'
import { SafeDailySpendCard } from '../components/reports/SafeDailySpendCard'
import { cn } from '../lib/cn'

export const ReportsPage: React.FC = () => {
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'yearly'>('monthly')

  // Monthly data hooks
  const { selectedDate, range } = useSelectedMonth()
  const { data: settings } = useUserSettings()
  const { data: debts } = useDebts()
  const { data: recurring } = useRecurring()
  const { format } = useCurrency()
  const monthStartDay = settings?.monthStartDay ?? 1

  const isMonthly = reportPeriod === 'monthly'
  const isYearly = reportPeriod === 'yearly'

  const { data: monthTransactions, loading: monthLoading } = useTransactions(range, {
    enabled: isMonthly,
  })
  const { data: categories } = useCategories()

  const forecast = useMemo(() => {
    return calculateForecast({
      transactions: monthTransactions,
      recurring,
      debts,
      monthStartDay,
      periodRange: range,
    })
  }, [monthTransactions, recurring, debts, monthStartDay, range])

  // Previous month range for monthly comparison
  const prevMonthRange = useMemo(() => {
    const prevDate = addMonths(selectedDate, -1)
    return getFinancialMonthRange(prevDate, monthStartDay)
  }, [selectedDate, monthStartDay])

  const { data: prevMonthTransactions } = useTransactions(prevMonthRange, {
    enabled: isMonthly,
  })

  // Yearly data hooks
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  const yearRange = useMemo(
    () => ({
      start: new Date(selectedYear, 0, 1, 0, 0, 0, 0),
      end: new Date(selectedYear + 1, 0, 1, 0, 0, 0, 0),
    }),
    [selectedYear]
  )

  const { data: yearTransactions, loading: yearLoading } = useTransactions(yearRange, {
    enabled: isYearly,
  })

  // Monthly calculations
  const monthSums = useMemo(() => sumByType(monthTransactions), [monthTransactions])
  const prevMonthSums = useMemo(() => sumByType(prevMonthTransactions), [prevMonthTransactions])
  const monthSavingsRate = useMemo(
    () => calculateSavingsRate(monthSums.income, monthSums.expense),
    [monthSums.income, monthSums.expense]
  )

  const monthCategoryDist = useMemo(
    () => calculateCategoryDistribution(monthTransactions, categories, 'expense'),
    [monthTransactions, categories]
  )

  const monthComparison = useMemo(() => {
    if (prevMonthSums.expense === 0) return null
    const diff = monthSums.expense - prevMonthSums.expense
    const percent = Math.round((Math.abs(diff) / prevMonthSums.expense) * 100)
    return {
      diff,
      percent,
      isIncrease: diff > 0,
    }
  }, [monthSums.expense, prevMonthSums.expense])

  // Yearly calculations
  const yearSums = useMemo(() => sumByType(yearTransactions), [yearTransactions])
  const yearlyBreakdown = useMemo(
    () => calculateYearlyBreakdown(yearTransactions, selectedYear),
    [yearTransactions, selectedYear]
  )
  const yearCategoryDist = useMemo(
    () => calculateCategoryDistribution(yearTransactions, categories, 'expense'),
    [yearTransactions, categories]
  )
  const monthlyAverage = useMemo(
    () => Math.round(yearSums.expense / 12),
    [yearSums.expense]
  )

  const yearOptions = useMemo(
    () => [
      { value: String(currentYear), label: `سنة ${currentYear}` },
      { value: String(currentYear - 1), label: `سنة ${currentYear - 1}` },
      { value: String(currentYear - 2), label: `سنة ${currentYear - 2}` },
      { value: String(currentYear - 3), label: `سنة ${currentYear - 3}` },
      { value: String(currentYear - 4), label: `سنة ${currentYear - 4}` },
    ],
    [currentYear]
  )

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
            {reportPeriod === 'monthly' ? (
              <MonthSelector />
            ) : (
              <div className="w-36">
                <Select
                  value={String(selectedYear)}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  options={yearOptions}
                />
              </div>
            )}
          </div>
        }
      />

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
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  إجمالي المداخيل
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
                {format(monthSums.income)}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                الدخل المحصل في هذا الشهر
              </div>
            </Card>

            {/* Expenses */}
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  إجمالي المصاريف
                </span>
                <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
                {format(monthSums.expense)}
              </div>
              <div className="mt-1">
                {monthComparison ? (
                  <span
                    className={cn(
                      'text-[11px] font-bold inline-flex items-center gap-0.5',
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
                      {monthComparison.percent}% عن الشهر السابق
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    إجمالي ما تم صرفه
                  </span>
                )}
              </div>
            </Card>

            {/* Net Savings */}
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  صافي الادخار
                </span>
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
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
                {format(monthSums.balance)}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                المبلغ المتبقي بعد كل المصاريف
              </div>
            </Card>

            {/* Savings Rate */}
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  نسبة الادخار
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Percent className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className={cn(
                  'text-lg sm:text-2xl font-black select-none',
                  monthSavingsRate >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
                )}
              >
                %{monthSavingsRate}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                من إجمالي الدخل المحصل
              </div>
            </Card>
          </div>

          {/* Monthly Charts & Top Categories Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Donut Chart */}
            <Card className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  توزيع المصاريف حسب التصنيف
                </h2>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {monthCategoryDist.length} تصنيفات
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <CategoryPieChart data={monthCategoryDist} className="w-full" />
              </div>
            </Card>

            {/* Top Categories Progress Bars */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  أعلى التصنيفات إنفاقاً
                </h2>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  النسبة المئوية من الإنفاق
                </span>
              </div>

              {monthLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  جاري تحميل التصنيفات...
                </div>
              ) : monthCategoryDist.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  لا توجد مصاريف مسجلة لهذا الشهر
                </div>
              ) : (
                <div className="space-y-4">
                  {monthCategoryDist.map((item) => (
                    <div key={item.categoryId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{item.icon}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 dark:text-slate-100">
                            {format(item.amountFils)}
                          </span>
                          <span className="font-bold text-slate-400 dark:text-slate-500 min-w-8 text-end">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
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
          {/* 4 Yearly KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Annual Income */}
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  إجمالي المداخيل السنوية
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
                {format(yearSums.income)}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                إجمالي الدخل خلال سنة {selectedYear}
              </div>
            </Card>

            {/* Total Annual Expense */}
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  إجمالي المصاريف السنوية
                </span>
                <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
                {format(yearSums.expense)}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                إجمالي المصاريف خلال سنة {selectedYear}
              </div>
            </Card>

            {/* Annual Net Savings */}
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  صافي الادخار السنوي
                </span>
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
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
                {format(yearSums.balance)}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                الفائض المالي السنوي
              </div>
            </Card>

            {/* Monthly Expense Average */}
            <Card className="p-3.5 sm:p-5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  متوسط المصاريف الشهري
                </span>
                <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 select-none">
                {format(monthlyAverage)}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                معدل الصرف لكل شهر
              </div>
            </Card>
          </div>

          {/* Large Grouped Bar Chart */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  المداخيل والمصاريف لكل شهر
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                سنة {selectedYear}
              </span>
            </div>
            <MonthlyBarChart data={yearlyBreakdown} className="pt-2" />
          </Card>

          {/* Yearly Bottom Row: Top Categories & Monthly Breakdown Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Categories Annual */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  أعلى التصنيفات إنفاقاً في السنة
                </h2>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  حسب إجمالي المصاريف
                </span>
              </div>

              {yearLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  جاري تحميل التصنيفات...
                </div>
              ) : yearCategoryDist.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  لا توجد مصاريف مسجلة في هذه السنة
                </div>
              ) : (
                <div className="space-y-4">
                  {yearCategoryDist.map((item) => (
                    <div key={item.categoryId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{item.icon}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 dark:text-slate-100">
                            {format(item.amountFils)}
                          </span>
                          <span className="font-bold text-slate-400 dark:text-slate-500 min-w-8 text-end">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
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
                </div>
              )}
            </Card>

            {/* Monthly Breakdown Table */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  تفاصيل الشهور
                </h2>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  12 شهراً
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="p-2.5 text-start font-bold">الشهر</th>
                      <th className="p-2.5 text-start font-bold">المداخيل</th>
                      <th className="p-2.5 text-start font-bold">المصاريف</th>
                      <th className="p-2.5 text-start font-bold">صافي الادخار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyBreakdown.map((row) => (
                      <tr
                        key={row.monthIndex}
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="p-2.5 font-bold text-slate-700 dark:text-slate-200">
                          {row.monthName}
                        </td>
                        <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                          {format(row.income)}
                        </td>
                        <td className="p-2.5 font-bold text-red-500 dark:text-red-400">
                          {format(row.expense)}
                        </td>
                        <td
                          className={cn(
                            'p-2.5 font-extrabold',
                            row.balance >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-500 dark:text-red-400'
                          )}
                        >
                          {format(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
