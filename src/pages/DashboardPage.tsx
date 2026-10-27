import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router'
import {
  Plus,
  Receipt,
  Calendar,
  ChevronLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Wallet,
  HandCoins,
  Scale,
  ShieldCheck,
  Copy,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { EmptyState } from '../components/ui/EmptyState'
import { QuickFeatureHub } from '../components/dashboard/QuickFeatureHub'
import { HeroCardSkeleton } from '../components/skeletons/DashboardSkeleton'

const CategoryPieChart = React.lazy(() =>
  import('../components/charts/CategoryPieChart').then((m) => ({ default: m.CategoryPieChart }))
)
const DailyExpenseChart = React.lazy(() =>
  import('../components/charts/DailyExpenseChart').then((m) => ({ default: m.DailyExpenseChart }))
)
import { useAuth } from '../hooks/useAuth'
import { useAppData } from '../context/AppDataContext'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useDebts } from '../hooks/useDebts'
import { useUserSettings } from '../hooks/useUserSettings'
import { useCurrency } from '../hooks/useCurrency'
import { useTransactionModal } from '../hooks/useTransactionModal'
import { subscribePriorBalance } from '../services/transactions'
import { sumByType } from '../lib/aggregate'
import { calculateCategoryDistribution, calculateDailyExpenses } from '../lib/reports'
import { calculateDebtSummary } from '../lib/debts'
import { calculateForecast } from '../lib/forecast'
import { isOccurrenceSkipped, advanceDateWithTargetDay } from '../lib/recurring'
import {
  toWesternDigits,
  formatDayHeader,
  getFiscalMonthKey,
  getPreviousFinancialMonth,
  getFinancialMonthRange,
  formatFinancialMonthLabel,
} from '../lib/dates'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { cn } from '../lib/cn'
import type { Recurring } from '../types'

export const DashboardPage: React.FC = () => {
  const { user } = useAuth()
  const { range } = useSelectedMonth()
  const { data: rawTransactions, loading: txLoading } = useTransactions(range)
  const { data: categories } = useCategories()
  const { data: recurringList } = useRecurring()
  const { data: debts } = useDebts()
  const { data: settings } = useUserSettings()
  const { format, formatWithSign } = useCurrency()
  const { openAdd, openEdit, openDuplicate } = useTransactionModal()

  const [localRollover, setLocalRollover] = useState<{ key: string; amount: number }>({ key: '', amount: 0 })
  const isRolloverEnabled = settings?.rolloverBalance ?? true
  const monthStartDay = settings?.monthStartDay ?? 1

  const appData = useAppData()
  const isCurrentFiscalMonth =
    getFiscalMonthKey(range.start, monthStartDay) ===
    getFiscalMonthKey(new Date(), monthStartDay)

  useEffect(() => {
    if (!user?.uid || !isRolloverEnabled) {
      return
    }
    // If viewing the current fiscal month, AppDataContext is already subscribed to prior balance
    if (isCurrentFiscalMonth) {
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
        console.error('Failed to subscribe prior balance in DashboardPage:', err)
      }
    )
    return () => {
      unsub()
    }
  }, [user?.uid, isRolloverEnabled, range.start, isCurrentFiscalMonth])

  const effectiveLocalRollover =
    localRollover.key === range.start.toISOString() ? localRollover.amount : 0

  const effectiveRollover =
    (isRolloverEnabled
      ? isCurrentFiscalMonth
        ? (appData?.rolloverBalanceFils ?? 0)
        : effectiveLocalRollover
      : 0) + (settings?.openingBalanceFils ?? 0)

  const prevMonthLabel = useMemo(() => {
    const prevFinancialMonth = getPreviousFinancialMonth(range.start, monthStartDay)
    const prevRange = getFinancialMonthRange(prevFinancialMonth, monthStartDay)
    return formatFinancialMonthLabel(prevRange, monthStartDay)
  }, [range.start, monthStartDay])

  // Calculate monthly totals
  const sums = useMemo(() => sumByType(rawTransactions), [rawTransactions])
  const displayBalance = sums.balance + effectiveRollover

  // Calculate forecast & daily safe budget
  const forecast = useMemo(() => {
    return calculateForecast({
      transactions: rawTransactions,
      recurring: recurringList,
      debts,
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
    monthStartDay,
    range,
    effectiveRollover,
    isRolloverEnabled,
    settings?.openingBalanceFils,
  ])

  // Calculate active debts summary
  const debtSummary = useMemo(() => calculateDebtSummary(debts), [debts])

  // Map categoryId to Category object
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  // Category distribution for donut chart
  const categoryDistribution = useMemo(
    () => calculateCategoryDistribution(rawTransactions, categories, 'expense'),
    [rawTransactions, categories]
  )

  // Daily expenses for trend area chart
  const dailyExpenses = useMemo(
    () => calculateDailyExpenses(rawTransactions, range.start, range.end, new Date()),
    [rawTransactions, range.start, range.end]
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

  // Up to 5 upcoming active recurring items
  const upcomingRecurring = useMemo(() => {
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    const list: (Recurring & { nextDate: Date })[] = []

    for (const r of recurringList) {
      if (!r.active) continue

      let nextD = r.nextDate instanceof Date ? r.nextDate : new Date(r.nextDate)

      if (isOccurrenceSkipped(r, nextD)) {
        const startD = r.startDate instanceof Date ? r.startDate : new Date(r.startDate)
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
      .slice(0, 5)
  }, [recurringList])

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
    // Recompute today whenever rawTransactions update or window regains focus
    if (focusTick < 0 || !rawTransactions) return new Date()
    return new Date()
  }, [rawTransactions, focusTick])

  // Guard against initial loading state where rawTransactions is [] and txLoading is true,
  // preventing calculation of deficit (danger/red flash) for fractions of a second before data arrives
  const isInitialOrLoading = txLoading && rawTransactions.length === 0

  // Financial health and liquidity pool calculations (taking positive/negative rollover and opening balance into account)
  const hasRolloverEffect = isRolloverEnabled || (settings?.openingBalanceFils ?? 0) > 0
  const effectiveAvailableIncome = sums.income + (hasRolloverEffect ? effectiveRollover : 0)
  const isZeroState =
    sums.income === 0 &&
    sums.expense === 0 &&
    (!hasRolloverEffect || effectiveRollover === 0)
  const isTemporaryLiquidityDeficit =
    displayBalance < 0 && forecast.freeBalance > 0 && forecast.upcomingRecurringIncome > 0
  const isSpendingWithoutIncome =
    effectiveAvailableIncome <= 0 && sums.expense > 0 && !isTemporaryLiquidityDeficit
  const consumptionRatio =
    effectiveAvailableIncome > 0 ? sums.expense / effectiveAvailableIncome : 0
  const isHighConsumption = effectiveAvailableIncome > 0 && consumptionRatio >= 0.8

  // Dynamic Hero Card Palette based on financial health:
  // Clean Swiss surface with distinct top accent bar and badges
  const heroTheme = useMemo(() => {
    let status: 'safe' | 'warning' | 'danger'
    if (isInitialOrLoading) {
      status = 'safe'
    } else if (isTemporaryLiquidityDeficit) {
      status = 'warning'
    } else if (
      displayBalance < 0 ||
      forecast.freeBalance < 0 ||
      forecast.healthStatus === 'danger' ||
      isSpendingWithoutIncome
    ) {
      status = 'danger'
    } else if (isHighConsumption || forecast.healthStatus === 'warning') {
      status = 'warning'
    } else {
      status = 'safe'
    }

    if (status === 'safe') {
      return {
        status,
        topBar: 'bg-emerald-500',
        badge:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
        badgeText: isInitialOrLoading
          ? 'جاري التحديث...'
          : isZeroState
            ? 'لا توجد معاملات بعد'
            : 'فائض مالي',
        stripBg:
          'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:border-emerald-800/50 dark:text-emerald-200',
      }
    }
    if (status === 'warning') {
      return {
        status,
        topBar: 'bg-amber-500',
        badge:
          'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
        badgeText: isTemporaryLiquidityDeficit
          ? 'سيولة مؤقتة بانتظار الدخل'
          : isHighConsumption
            ? `استهلكت ${Math.round(consumptionRatio * 100)}% من الدخل`
            : 'انتبه للوتيرة',
        stripBg:
          'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200/80 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-200',
      }
    }
    return {
      status,
      topBar: 'bg-red-500',
      badge:
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60',
      badgeText:
        displayBalance < 0 || isSpendingWithoutIncome
          ? 'عجز مالي'
          : 'التزامات تفوق الرصيد',
      stripBg:
        'bg-red-50/70 hover:bg-red-100/70 border-red-200/80 text-red-900 dark:bg-red-950/30 dark:border-red-800/50 dark:text-red-200',
    }
  }, [
    isInitialOrLoading,
    isZeroState,
    isTemporaryLiquidityDeficit,
    isSpendingWithoutIncome,
    isHighConsumption,
    consumptionRatio,
    forecast.healthStatus,
    forecast.freeBalance,
    displayBalance,
  ])

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header with Title and Desktop-only Quick Add */}
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة شاملة وسريعة على وضعك المالي لهذا الشهر"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => openAdd('expense')}
            className="hidden lg:inline-flex gap-1.5 shadow-xs font-semibold press-scale"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة معاملة</span>
          </Button>
        }
      />

      {/* 1. Hero Card: Clean Swiss Surface & Financial Health Indicator */}
      {isInitialOrLoading ? (
        <HeroCardSkeleton />
      ) : (
        <div className="bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-6 space-y-4 min-h-[260px] sm:min-h-[275px] flex flex-col justify-between transition-all">
          {/* Top highlight bar */}
          <div className={cn('h-1.5 w-full absolute top-0 inset-x-0', heroTheme.topBar)} />

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
                <Wallet className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                {isRolloverEnabled ? 'الرصيد المتاح (شامل المرحّل)' : 'الرصيد المتاح (لهذا الشهر)'}
              </span>
            </div>
            <span
              className={cn(
                'text-xs font-black px-2.5 py-0.5 rounded-full select-none border',
                heroTheme.badge
              )}
            >
              {heroTheme.badgeText}
            </span>
          </div>

          <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight select-none text-zinc-950 dark:text-zinc-50">
            {format(displayBalance)}
          </div>

          {/* Rollover Breakdown Subline */}
          {(isRolloverEnabled || (settings?.openingBalanceFils ?? 0) > 0) && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs sm:text-sm font-medium -mt-1 pb-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60">
                <span className="text-zinc-500 dark:text-zinc-400 text-[11px] sm:text-xs">صافي هذا الشهر:</span>
                <span className="font-black text-zinc-900 dark:text-zinc-100">
                  {sums.balance > 0
                    ? `+ ${format(sums.balance)}`
                    : sums.balance < 0
                      ? `- ${format(Math.abs(sums.balance))}`
                      : format(0)}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60">
                <span className="text-zinc-500 dark:text-zinc-400 text-[11px] sm:text-xs">
                  {(settings?.openingBalanceFils ?? 0) > 0
                    ? 'الرصيد التراكمي / الافتتاحي:'
                    : `الرصيد المرحّل (من شهر ${prevMonthLabel}):`}
                </span>
                <span className="font-black text-zinc-900 dark:text-zinc-100">
                  {effectiveRollover > 0
                    ? `+ ${format(effectiveRollover)}`
                    : effectiveRollover < 0
                      ? `- ${format(Math.abs(effectiveRollover))}`
                      : format(0)}
                </span>
              </div>
            </div>
          )}

          {/* Total Income & Total Expenses Row */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold border border-emerald-200/60 dark:border-emerald-800/60">
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  إجمالي المداخيل
                </div>
                <div className="text-sm sm:text-base font-black truncate text-zinc-900 dark:text-zinc-100">
                  {format(sums.income)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 font-bold border border-red-200/60 dark:border-red-800/60">
                <TrendingDown className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  إجمالي المصاريف
                </div>
                <div className="text-sm sm:text-base font-black truncate text-zinc-900 dark:text-zinc-100">
                  {format(sums.expense)}
                </div>
              </div>
            </div>
          </div>

          {/* Daily Safe Budget Interactive Strip */}
          {forecast.isCurrentMonth && (
            <Link
              to="/reports"
              className={cn(
                'press-scale flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors group cursor-pointer',
                heroTheme.stripBg
              )}
              title="عرض التفاصيل في التقارير"
            >
              <div className="flex items-center gap-2 font-medium">
                <div className="w-6 h-6 rounded-lg bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span>ميزانية الأمان اليومي:</span>
              </div>
              <div className="flex items-center gap-1.5 text-end">
                <span className="font-black text-sm sm:text-base">
                  {format(forecast.dailySafeFils)}
                </span>
                <span className="text-[11px] font-medium opacity-80">
                  / اليوم
                </span>
                <ChevronLeft className="w-3.5 h-3.5 opacity-80 group-hover:-translate-x-0.5 transition-transform" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Financial Health Proactive Alert Banner */}
      {!isInitialOrLoading && !isZeroState && (isSpendingWithoutIncome || isHighConsumption) && (
        <div
          className={cn(
            'p-3.5 sm:p-4 rounded-2xl border flex items-center gap-3 text-xs sm:text-sm animate-fade-in shadow-xs',
            isSpendingWithoutIncome
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-200'
          )}
        >
          {isSpendingWithoutIncome ? (
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          )}
          <div className="flex-1">
            {isSpendingWithoutIncome ? (
              <span>
                <strong>عجز في السيولة:</strong> تم تسجيل مصاريف بقيمة{' '}
                <strong>{format(sums.expense)}</strong> دون توفر دخل محصل أو رصيد مرحّل كافٍ لتغطيتها.
              </span>
            ) : (
              <span>
                <strong>تنبيه الاستهلاك:</strong> لقد استهلكت{' '}
                <strong>{Math.round(consumptionRatio * 100)}%</strong> من إجمالي السيولة المتاحة (
                {format(effectiveAvailableIncome)}) لهذا الشهر.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Feature Access Hub (Mobile only, hidden on lg desktop) */}
      <QuickFeatureHub />

      {/* 2. Core Activity: Recent Transactions (col 7) & Debts Summary + Upcoming Recurring (col 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Recent Transactions: lg:col-span-7 */}
        <div className="lg:col-span-7">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  آخر المعاملات
                </h2>
              </div>
              <Link
                to="/transactions"
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                <span>عرض الكل</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isInitialOrLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-750/40 animate-pulse"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <div className="space-y-1.5">
                        <div className="w-28 h-3.5 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="w-16 h-2.5 rounded bg-slate-100 dark:bg-slate-750" />
                      </div>
                    </div>
                    <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
                  </div>
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <EmptyState
                icon={<Receipt className="w-6 h-6" />}
                title="لا توجد معاملات مسجلة"
                description="أضف معاملتك الأولى لهذا الشهر للبدء بتتبع مصاريفك ومداخيلك."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openAdd('expense')}
                    className="gap-1 mt-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة معاملة</span>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-1.5">
                {recentTransactions.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId)
                  const isExpense = tx.type === 'expense'
                  const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
                  const dateHeader = formatDayHeader(txDate, today)

                  return (
                    <div
                      key={tx.id}
                      onClick={() => openEdit(tx)}
                      className="press-scale flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                          style={{
                            backgroundColor: cat ? `${cat.color}25` : '#94A3B825',
                          }}
                        >
                          <CategoryIcon icon={cat?.icon || '📁'} color={cat?.color} size="md" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {tx.title || tx.note || (cat ? cat.name : 'معاملة')}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                            {cat && (
                              <>
                                <span className="truncate">{cat.name}</span>
                                <span>•</span>
                              </>
                            )}
                            <span className="truncate">{dateHeader}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ps-3">
                        {!(
                          tx.id.startsWith('debt_init_') ||
                          tx.id.startsWith('debt_pay_') ||
                          tx.id.startsWith('circle_payout_')
                        ) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDuplicate(tx)
                            }}
                            className="hidden sm:inline-flex sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/40 transition-all cursor-pointer"
                            aria-label="تكرار المعاملة"
                            title="تكرار المعاملة"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div
                          className={cn(
                            'text-xs sm:text-sm font-extrabold select-none ps-0.5',
                            isExpense
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {formatWithSign(tx.amountFils, tx.type)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Debts Summary & Upcoming Recurring: lg:col-span-5 */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Debts Summary */}
          <Card className="p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-800 rounded-2xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  ملخص الديون والالتزامات
                </h2>
              </div>
              <Link
                to="/debts"
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                <span>إدارة الديون</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5">
              {/* Lent to others (مستحقات لك) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                    لي
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      مستحقات لك
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {debtSummary.lentActiveCount} ديون نشطة
                    </div>
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 select-none">
                  {format(debtSummary.lentFils)}
                </div>
              </div>

              {/* Borrowed from others (التزامات عليك) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-xs">
                    عليّ
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      التزامات عليك
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {debtSummary.borrowedActiveCount} ديون نشطة
                    </div>
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 select-none">
                  {format(debtSummary.borrowedFils)}
                </div>
              </div>

              {/* Net difference (الصافي) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750/60 border border-slate-100 dark:border-slate-700/40">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      صافي المركز
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {debtSummary.netFils >= 0 ? 'فائض لصالحك' : 'عجز عليك'}
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    'text-xs sm:text-sm font-black select-none',
                    debtSummary.netFils >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {debtSummary.netFils >= 0 ? '+' : ''}
                  {format(debtSummary.netFils)}
                </div>
              </div>
            </div>
          </Card>

          {/* Upcoming Recurring */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                  المتكررات القادمة
                </h2>
              </div>
              <Link
                to="/recurring"
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                <span>إدارة المتكررة</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingRecurring.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                <p className="font-semibold mb-2">لا توجد معاملات متكررة نشطة</p>
                <Link
                  to="/recurring"
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                >
                  <span>ضبط معاملة متكررة جديدة</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingRecurring.map((item) => {
                  const cat = categoryMap.get(item.categoryId)
                  const isExpense = item.type === 'expense'
                  const nextDate =
                    item.nextDate instanceof Date
                      ? item.nextDate
                      : new Date(item.nextDate)
                  const nextDateFormatted = toWesternDigits(
                    formatDate(nextDate, 'd MMMM', { locale: ar })
                  )

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                          style={{
                            backgroundColor: cat ? `${cat.color}25` : '#94A3B825',
                          }}
                        >
                          <CategoryIcon icon={cat?.icon || '🔄'} color={cat?.color} size="sm" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {item.title || item.note || (cat ? cat.name : 'معاملة متكررة')}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {nextDateFormatted}
                          </div>
                        </div>
                      </div>

                      <div className="text-end shrink-0 ps-2">
                        <div
                          className={cn(
                            'text-xs font-extrabold select-none',
                            isExpense
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {formatWithSign(item.amountFils, item.type)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 3. Analytical Charts at the Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category Pie Chart Card */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
              المصاريف حسب التصنيف
            </h2>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              {categoryDistribution.length} تصنيفات
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <React.Suspense
              fallback={
                <div className="h-56 w-full flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border-8 border-slate-200/80 dark:border-slate-700/60 animate-pulse" />
                </div>
              }
            >
              <CategoryPieChart data={categoryDistribution} className="w-full" />
            </React.Suspense>
          </div>
        </Card>

        {/* Daily Expenses Chart Card */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
              المصاريف اليومية
            </h2>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              حركة الصرف اليومية
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <React.Suspense
              fallback={
                <div className="h-56 w-full flex items-end justify-between gap-2 px-4 pb-4 animate-pulse">
                  {[40, 65, 30, 80, 50, 95, 45, 70, 60, 85].map((height, idx) => (
                    <div
                      key={idx}
                      className="w-full bg-slate-200/80 dark:bg-slate-700/60 rounded-t-lg"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              }
            >
              <DailyExpenseChart data={dailyExpenses} className="w-full" />
            </React.Suspense>
          </div>
        </Card>
      </div>
    </div>
  )
}
