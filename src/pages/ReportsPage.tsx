import React, { useState, useMemo, useCallback } from 'react'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Printer, Calendar } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { useCategories } from '../hooks/useCategories'
import { useReportsData } from '../hooks/useReportsData'
import { calculateCategoryDistribution, type CategoryDistributionItem } from '../lib/reports'
import { toWesternDigits } from '../lib/dates'
import { SafeDailySpendCard } from '../components/reports/SafeDailySpendCard'
import { MonthlyKpiCards, YearlyKpiCards } from '../components/reports/ReportKpiCards'
import { DailyExpenseSection } from '../components/reports/DailyExpenseSection'
import {
  MonthlyCategoryBreakdown,
  YearlyCategoryBreakdown,
} from '../components/reports/CategoryBreakdownSection'
import { AnnualSummaryTable } from '../components/reports/AnnualSummaryTable'
import { CategoryTransactionsModal } from '../components/reports/CategoryTransactionsModal'
import { motion, AnimatePresence } from 'motion/react'
import { filterCrossFadeVariants, filterTransition, isTestEnv } from '../lib/motionTokens'
import type { TxType } from '../types'

export const ReportsPage: React.FC = () => {
  const reports = useReportsData()
  const { data: categories } = useCategories()

  const [monthCategoryType, setMonthCategoryType] = useState<TxType>('expense')
  const [yearCategoryType, setYearCategoryType] = useState<TxType>('expense')
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<CategoryDistributionItem | null>(null)

  const monthCategoryDist = useMemo(
    () => calculateCategoryDistribution(reports.monthTransactions, categories, monthCategoryType),
    [reports.monthTransactions, categories, monthCategoryType]
  )

  const yearCategoryDist = useMemo(
    () => calculateCategoryDistribution(reports.yearTransactions, categories, yearCategoryType),
    [reports.yearTransactions, categories, yearCategoryType]
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
    const list = reports.reportPeriod === 'monthly' ? reports.monthTransactions : reports.yearTransactions
    const targetType = reports.reportPeriod === 'monthly' ? monthCategoryType : yearCategoryType
    return list
      .filter((tx) => tx.categoryId === selectedCategoryModal.categoryId && tx.type === targetType)
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()
        const db = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()
        return db - da
      })
  }, [
    selectedCategoryModal,
    reports.reportPeriod,
    reports.monthTransactions,
    reports.yearTransactions,
    monthCategoryType,
    yearCategoryType,
  ])

  return (
    <div className="space-y-6 animate-slide-up min-w-0 max-w-full overflow-x-clip">
      <PageHeader
        title="التقارير المالية"
        subtitle="تحليل تفصيلي وإحصائيات لأداء ميزانيتك ومصاريفك"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <SegmentedControl<'monthly' | 'yearly'>
              value={reports.reportPeriod}
              onChange={reports.setReportPeriod}
              options={[
                { value: 'monthly', label: 'تقرير شهري' },
                { value: 'yearly', label: 'تقرير سنوي' },
              ]}
            />
            {reports.reportPeriod === 'yearly' && (
              <div className="w-36">
                <Select
                  value={String(reports.selectedYear)}
                  onChange={(e) => reports.setSelectedYear(Number(e.target.value))}
                  options={reports.yearOptions}
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
              {reports.reportPeriod === 'monthly' ? 'التقرير المالي الشهري' : 'التقرير المالي السنوي'}
            </h1>
            <p className="text-zinc-600 font-semibold mt-0.5">
              {reports.reportPeriod === 'monthly'
                ? `الدورة المالية: ${toWesternDigits(formatDate(reports.range.start, 'd MMMM yyyy', { locale: ar }))} – ${toWesternDigits(formatDate(new Date(reports.range.end.getTime() - 1), 'd MMMM yyyy', { locale: ar }))}`
                : `السنة المالية: ${reports.selectedYear} ${reports.monthStartDay > 1 ? `(يوم بداية الدورة: ${reports.monthStartDay})` : ''}`}
            </p>
          </div>
          <div className="text-end text-zinc-500 font-medium">
            تاريخ الطباعة: {toWesternDigits(formatDate(new Date(), 'yyyy/MM/dd HH:mm'))}
          </div>
        </div>
      </div>

      {/* Content Section with Cross-Fade */}
      {isTestEnv ? (
        reports.reportPeriod === 'monthly' ? (
          <div className="space-y-6">
            <SafeDailySpendCard forecast={reports.forecast} />
            <MonthlyKpiCards
              monthSums={reports.monthSums}
              prevMonthSums={reports.prevMonthSums}
              monthSavingsRate={reports.monthSavingsRate}
              monthComparison={reports.monthComparison}
              monthIncomeComparison={reports.monthIncomeComparison}
              forecast={reports.forecast}
              isEarlyMonth={reports.isEarlyMonth}
              effectiveRollover={reports.effectiveRollover}
              isRolloverEnabled={reports.isRolloverEnabled}
              openingBalanceFils={reports.settings?.openingBalanceFils ?? 0}
            />
            <DailyExpenseSection
              dailyExpenses={reports.dailyExpenses}
              dailyStats={reports.dailyStats}
              isFutureMonth={reports.forecast.isFutureMonth}
            />
            <MonthlyCategoryBreakdown
              categoryDist={monthCategoryDist}
              categoryType={monthCategoryType}
              onCategoryTypeChange={setMonthCategoryType}
              loading={reports.monthLoading}
              hasLoadedOnce={reports.hasLoadedMonthOnce}
              onSelectCategory={setSelectedCategoryModal}
              onSelectPieCategory={handleSelectMonthPieCategory}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {reports.monthStartDay > 1 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-xs font-bold text-blue-800 dark:text-blue-300">
                <Calendar className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>السنة المالية: {reports.financialYearLabel}</span>
              </div>
            )}
            <YearlyKpiCards
              yearSums={reports.yearSums}
              yearlySavingsRate={reports.yearlySavingsRate}
              annualSummary={reports.annualSummary}
              selectedYear={reports.selectedYear}
              monthlyAverage={reports.monthlyAverage}
            />
            <AnnualSummaryTable
              yearlyBreakdown={reports.yearlyBreakdown}
              yearSums={reports.yearSums}
              selectedYear={reports.selectedYear}
              currentYear={reports.currentYear}
              currentFiscalInfo={reports.currentFiscalInfo}
              monthStartDay={reports.monthStartDay}
            />
            <YearlyCategoryBreakdown
              categoryDist={yearCategoryDist}
              categoryType={yearCategoryType}
              onCategoryTypeChange={setYearCategoryType}
              loading={reports.yearLoading}
              hasLoadedOnce={reports.hasLoadedYearOnce}
              onSelectCategory={setSelectedCategoryModal}
            />
          </div>
        )
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={reports.reportPeriod}
            variants={filterCrossFadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={filterTransition}
            className="space-y-6"
          >
            {reports.reportPeriod === 'monthly' ? (
              <>
                <SafeDailySpendCard forecast={reports.forecast} />
                <MonthlyKpiCards
                  monthSums={reports.monthSums}
                  prevMonthSums={reports.prevMonthSums}
                  monthSavingsRate={reports.monthSavingsRate}
                  monthComparison={reports.monthComparison}
                  monthIncomeComparison={reports.monthIncomeComparison}
                  forecast={reports.forecast}
                  isEarlyMonth={reports.isEarlyMonth}
                  effectiveRollover={reports.effectiveRollover}
                  isRolloverEnabled={reports.isRolloverEnabled}
                  openingBalanceFils={reports.settings?.openingBalanceFils ?? 0}
                />
                <DailyExpenseSection
                  dailyExpenses={reports.dailyExpenses}
                  dailyStats={reports.dailyStats}
                  isFutureMonth={reports.forecast.isFutureMonth}
                />
                <MonthlyCategoryBreakdown
                  categoryDist={monthCategoryDist}
                  categoryType={monthCategoryType}
                  onCategoryTypeChange={setMonthCategoryType}
                  loading={reports.monthLoading}
                  hasLoadedOnce={reports.hasLoadedMonthOnce}
                  onSelectCategory={setSelectedCategoryModal}
                  onSelectPieCategory={handleSelectMonthPieCategory}
                />
              </>
            ) : (
              <>
                {reports.monthStartDay > 1 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-xs font-bold text-blue-800 dark:text-blue-300">
                    <Calendar className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>السنة المالية: {reports.financialYearLabel}</span>
                  </div>
                )}
                <YearlyKpiCards
                  yearSums={reports.yearSums}
                  yearlySavingsRate={reports.yearlySavingsRate}
                  annualSummary={reports.annualSummary}
                  selectedYear={reports.selectedYear}
                  monthlyAverage={reports.monthlyAverage}
                />
                <AnnualSummaryTable
                  yearlyBreakdown={reports.yearlyBreakdown}
                  yearSums={reports.yearSums}
                  selectedYear={reports.selectedYear}
                  currentYear={reports.currentYear}
                  currentFiscalInfo={reports.currentFiscalInfo}
                  monthStartDay={reports.monthStartDay}
                />
                <YearlyCategoryBreakdown
                  categoryDist={yearCategoryDist}
                  categoryType={yearCategoryType}
                  onCategoryTypeChange={setYearCategoryType}
                  loading={reports.yearLoading}
                  hasLoadedOnce={reports.hasLoadedYearOnce}
                  onSelectCategory={setSelectedCategoryModal}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Category Transactions Modal */}
      <CategoryTransactionsModal
        category={selectedCategoryModal}
        transactions={modalTransactions}
        onClose={() => setSelectedCategoryModal(null)}
      />
    </div>
  )
}
