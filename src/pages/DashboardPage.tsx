/* eslint-disable react-hooks/refs */
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import {
  Plus,
  Receipt,
  Calendar,
  ChevronLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  HandCoins,
  ShieldCheck,
  Copy,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { FormattedMoney } from '../components/ui/FormattedMoney'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { EmptyState } from '../components/ui/EmptyState'
import { QuickFeatureHub } from '../components/dashboard/QuickFeatureHub'
import { HeroCardSkeleton } from '../components/skeletons/DashboardSkeleton'
import { useAuth } from '../hooks/useAuth'
import { useAppData } from '../context/AppDataContext'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useDebts } from '../hooks/useDebts'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useUserSettings } from '../hooks/useUserSettings'
import { useTransactionModal } from '../hooks/useTransactionModal'
import { subscribePriorBalance } from '../services/transactions'
import { sumByType } from '../lib/aggregate'
import { calculateCategoryDistribution } from '../lib/reports'
import { calculateDebtSummary } from '../lib/debts'
import { calculateForecast } from '../lib/forecast'
import { isOccurrenceSkipped, advanceDateWithTargetDay } from '../lib/recurring'
import {
  toWesternDigits,
  formatDayHeader,
  getFiscalMonthKey,
  getFinancialMonthRange,
  formatFinancialMonthLabel,
} from '../lib/dates'
import { format as formatDate, differenceInDays, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import { cn } from '../lib/cn'
import type { Recurring, Transaction, Category } from '../types'

interface RecentTransactionRowProps {
  tx: Transaction
  cat?: Category
  today: Date
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
}

const RecentTransactionRow: React.FC<RecentTransactionRowProps> = ({
  tx,
  cat,
  today,
  openEdit,
  openDuplicate,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const isExpense = tx.type === 'expense'
  const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
  const dateHeader = formatDayHeader(txDate, today)
  const isFuture = startOfDay(txDate).getTime() > startOfDay(today).getTime()
  const isSystemLinked =
    tx.id.startsWith('debt_') ||
    tx.id.startsWith('circle_') ||
    Boolean(tx.note?.includes('تسوية رصيد'))
  const hasCustomLabel = Boolean(tx.title?.trim() || tx.note?.trim())
  const isDebtInitOrEntry = tx.id.startsWith('debt_init_') || tx.id.startsWith('debt_entry_')
  const rawCatName = cat ? cat.name : 'معاملة'
  const catName = isDebtInitOrEntry && rawCatName === 'سداد الديون والأقساط' ? 'الديون والسلف' : rawCatName
  const primaryLabel = tx.title?.trim() || tx.note?.trim() || catName

  return (
    <div className="relative overflow-hidden rounded-xl select-none group">
      {/* Swipe Action Reveal Button (Mobile Swipe Right) */}
      {!isSystemLinked && (
        <div
          className={cn(
            'absolute inset-y-0 end-0 flex items-center pe-2 z-0 transition-opacity',
            swipeOffset > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              openDuplicate(tx)
            }}
            className="h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            aria-label="تكرار المعاملة"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>تكرار</span>
          </button>
        </div>
      )}

      {/* Main Row Content */}
      <div
        onClick={() => {
          if (swipeOffset > 0) {
            setSwipeOffset(0)
            return
          }
          openEdit(tx)
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
        }}
        onTouchMove={(e) => {
          if (touchStartX.current === null || isSystemLinked) return
          const diff = e.touches[0].clientX - touchStartX.current
          if (diff > 8) {
            setSwipeOffset(Math.min(diff, 80))
          } else if (swipeOffset > 0 && diff < -8) {
            setSwipeOffset(0)
          }
        }}
        onTouchEnd={() => {
          if (touchStartX.current === null) return
          touchStartX.current = null
          if (swipeOffset > 35) {
            setSwipeOffset(72)
          } else {
            setSwipeOffset(0)
          }
        }}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
        }}
        className={cn(
          'press-scale flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-xl transition-colors cursor-pointer bg-white dark:bg-[#121215] relative z-10',
          swipeOffset === 0 && 'transition-transform duration-200 ease-out'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <CategoryIcon icon={cat?.icon || '📁'} color={cat?.color} size="md" />
          </span>
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {primaryLabel}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              {cat && hasCustomLabel && (
                <>
                  <span className="truncate">{catName}</span>
                  <span>•</span>
                </>
              )}
              <span className="truncate">{dateHeader}</span>
              {isFuture && (
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md shrink-0">
                  مستقبلية
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ps-3">
          {!isSystemLinked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openDuplicate(tx)
              }}
              className="hidden sm:inline-flex sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
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
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            <FormattedMoney amountFils={tx.amountFils} withSign={tx.type} />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatObligationsCount(count: number): string {
  if (count === 1) return 'التزام واحد يستحق'
  if (count === 2) return 'التزامان يستحقان'
  if (count >= 3 && count <= 10) return `${count} التزامات تستحق`
  return `${count} التزاماً يستحق`
}

function formatDebtCount(count: number): string {
  if (count === 0) return 'لا توجد ديون نشطة'
  if (count === 1) return 'دين نشط واحد'
  if (count === 2) return 'دينان نشطان'
  if (count >= 3 && count <= 10) return `${count} ديون نشطة`
  return `${count} ديناً نشطاً`
}

export const DashboardPage: React.FC = () => {
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

  const [localRollover, setLocalRollover] = useState<{ key: string; amount: number }>({ key: '', amount: 0 })
  const isRolloverEnabled = settings?.rolloverBalance ?? true
  const monthStartDay = settings?.monthStartDay ?? 1

  const appData = useAppData()
  const isCurrentFiscalMonth =
    getFiscalMonthKey(range.start, monthStartDay) ===
    getFiscalMonthKey(new Date(), monthStartDay)

  const parsedRolloverStartDate = useMemo(() => {
    if (!settings?.rolloverStartDate) return null
    const raw = settings.rolloverStartDate
    return raw instanceof Date
      ? raw
      : typeof (raw as { toDate?: () => Date }).toDate === 'function'
      ? (raw as { toDate: () => Date }).toDate()
      : new Date(raw as unknown as string)
  }, [settings?.rolloverStartDate])

  const isRolloverResolving = useMemo(() => {
    if (isCurrentFiscalMonth) {
      return Boolean(appData?.rolloverLoading)
    }
    if (!isRolloverEnabled) return false
    if (parsedRolloverStartDate && range.start.getTime() <= parsedRolloverStartDate.getTime()) return false
    return localRollover.key !== range.start.toISOString()
  }, [isCurrentFiscalMonth, appData?.rolloverLoading, isRolloverEnabled, parsedRolloverStartDate, range.start, localRollover.key])

  useEffect(() => {
    if (!txLoading && !settingsLoading && !isRolloverResolving) {
      hasLoadedOnceRef.current = true
    }
  }, [txLoading, settingsLoading, isRolloverResolving])

  const isInitialOrLoading =
    !hasLoadedOnceRef.current && (txLoading || settingsLoading || isRolloverResolving)

  useEffect(() => {
    if (!user?.uid || !isRolloverEnabled || isCurrentFiscalMonth) {
      return
    }
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
        console.error('Failed to subscribe prior balance in DashboardPage:', err)
      },
      parsedRolloverStartDate
    )
    return () => {
      unsub()
    }
  }, [user?.uid, isRolloverEnabled, range.start, isCurrentFiscalMonth, parsedRolloverStartDate])

  const effectiveLocalRollover =
    localRollover.key === range.start.toISOString() ? localRollover.amount : 0

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
      .filter((d) => !d.settled && d.dueDate && new Date(d.dueDate).getTime() >= today.getTime())
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
      .slice(0, 3)
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

  const heroTopBar = useMemo(() => {
    if (isInitialOrLoading || isRolloverResolving) return 'bg-emerald-500'
    if (isTemporaryLiquidityDeficit) return 'bg-amber-500'
    if (forecast.isFutureMonth) {
      if (displayBalance < 0 || forecast.healthStatus === 'danger') return 'bg-red-500'
      if (forecast.healthStatus === 'warning' || forecast.freeBalance < 0) return 'bg-amber-500'
      return 'bg-emerald-500'
    }
    if (
      displayBalance < 0 ||
      forecast.freeBalance < 0 ||
      forecast.healthStatus === 'danger' ||
      isSpendingWithoutIncome
    ) {
      return 'bg-red-500'
    }
    if (isHighConsumption || forecast.healthStatus === 'warning') {
      return 'bg-amber-500'
    }
    return 'bg-emerald-500'
  }, [
    isInitialOrLoading,
    isRolloverResolving,
    isTemporaryLiquidityDeficit,
    forecast.isFutureMonth,
    isSpendingWithoutIncome,
    isHighConsumption,
    forecast.healthStatus,
    forecast.freeBalance,
    displayBalance,
  ])

  const heroShieldColor = useMemo(() => {
    if (isInitialOrLoading || isRolloverResolving) return 'text-emerald-600 dark:text-emerald-400'
    if (isTemporaryLiquidityDeficit) return 'text-amber-500 dark:text-amber-400'
    if (forecast.isFutureMonth) {
      if (displayBalance < 0 || forecast.healthStatus === 'danger') return 'text-red-600 dark:text-red-400'
      if (forecast.healthStatus === 'warning' || forecast.freeBalance < 0) return 'text-amber-500 dark:text-amber-400'
      return 'text-emerald-600 dark:text-emerald-400'
    }
    if (
      displayBalance < 0 ||
      forecast.freeBalance < 0 ||
      forecast.healthStatus === 'danger' ||
      isSpendingWithoutIncome
    ) {
      return 'text-red-600 dark:text-red-400'
    }
    if (isHighConsumption || forecast.healthStatus === 'warning') {
      return 'text-amber-500 dark:text-amber-400'
    }
    return 'text-emerald-600 dark:text-emerald-400'
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
  const greetingSubtitle = displayName
    ? `أهلاً بك، ${displayName} — نظرة شاملة على وضعك المالي لهذا الشهر`
    : 'نظرة شاملة وسريعة على وضعك المالي لهذا الشهر'

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header with Title and Desktop-only Quick Add */}
      <PageHeader
        title="لوحة التحكم"
        subtitle={greetingSubtitle}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => openAdd('expense')}
            data-tour="add-transaction-btn"
            className="hidden lg:inline-flex gap-1.5 shadow-xs font-semibold press-scale"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة معاملة</span>
          </Button>
        }
      />

      {/* 1. Hero Card: Clean Swiss Surface */}
      {isInitialOrLoading ? (
        <HeroCardSkeleton />
      ) : (
        <div
          data-tour="hero-balance"
          className="bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] shadow-xs dark:shadow-none relative overflow-hidden rounded-2xl p-5 sm:p-6 space-y-5 flex flex-col justify-between transition-all"
        >
          {/* Top highlight bar */}
          <div className={cn('h-1 w-full absolute top-0 inset-x-0 transition-colors duration-300', heroTopBar)} />

          {/* Warning banner when browsing a different month (integrated Swiss flat divider style) */}
          {!isCurrentFiscalMonth && (
            <div className="pb-3 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                  أنت تستعرض حالياً بيانات شهر {formatFinancialMonthLabel(range, monthStartDay)}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentMonth}
                className="shrink-0 text-xs font-bold"
              >
                العودة إلى الشهر الحالي
              </Button>
            </div>
          )}

          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400">
              الرصيد المتاح
            </span>
          </div>

          {/* Main Balance & Clean Typographic Subline (Persistent min-h to prevent layout shifts) */}
          <div className="space-y-1.5">
            <div className={cn('text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight select-none text-zinc-950 dark:text-zinc-50 transition-opacity', isRolloverResolving ? 'opacity-70 animate-pulse' : 'opacity-100')}>
              <FormattedMoney amountFils={safeDisplayBalance} />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium pt-1">
              <span>
                صافي الدورة المالية:{' '}
                <strong className="font-bold text-zinc-800 dark:text-zinc-200">
                  <FormattedMoney amountFils={sums.balance} withSign="auto" />
                </strong>
              </span>
            </div>
          </div>

          {/* Income & Expenses Swiss Split Row (Zero nested boxes) */}
          <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] pt-3.5 border-t border-[#E4E4E7] dark:border-[#27272A]">
            <Link
              to="/transactions?type=income"
              className="flex flex-col gap-1 pe-3 hover:opacity-80 transition-opacity cursor-pointer"
              title="عرض كافة معاملات الدخل"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>إجمالي المداخيل</span>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
                <FormattedMoney amountFils={sums.income} />
              </div>
            </Link>

            <Link
              to="/transactions?type=expense"
              className="flex flex-col gap-1 ps-4 hover:opacity-80 transition-opacity cursor-pointer"
              title="عرض كافة معاملات المصاريف"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span>إجمالي المصاريف</span>
              </div>
              <div className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 truncate">
                <FormattedMoney amountFils={sums.expense} />
              </div>
            </Link>
          </div>

          {/* Daily Safe Budget Clean Footer Row */}
          <Link
            to="/reports"
            className="flex items-center justify-between pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] text-xs hover:opacity-80 transition-opacity group cursor-pointer"
            title="عرض التفاصيل في التقارير"
          >
            <div className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-300">
              <ShieldCheck className={cn('w-4 h-4 shrink-0 transition-colors', heroShieldColor)} />
              <span>
                {forecast.isCurrentMonth
                  ? 'ميزانية الأمان اليومي:'
                  : forecast.isPastMonth
                    ? 'صافي أداء الدورة:'
                    : 'حد الصرف اليومي المقترح:'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-end font-bold text-zinc-900 dark:text-zinc-100">
              <span className="text-sm sm:text-base font-black">
                <FormattedMoney
                  amountFils={forecast.isPastMonth ? sums.balance : forecast.dailySafeFils}
                  withSign={forecast.isPastMonth ? 'auto' : undefined}
                />
              </span>
              {!forecast.isPastMonth && (
                <span className="text-[11px] font-normal text-zinc-400">/ اليوم</span>
              )}
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-400 group-hover:-translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Proactive alert for next cycle soon obligations (within 3 days of new cycle) */}
          {forecast.isCurrentMonth && (forecast.nextCycleSoonObligationsFils ?? 0) > 0 && (
            <Link
              to={
                (forecast.nextCycleSoonRecurringCount ?? 0) > 0 && (forecast.nextCycleSoonDebtCount ?? 0) === 0
                  ? '/recurring'
                  : (forecast.nextCycleSoonDebtCount ?? 0) > 0 && (forecast.nextCycleSoonRecurringCount ?? 0) === 0
                    ? '/debts'
                    : '/recurring'
              }
              className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-semibold">
                  تنبيه مطلع الدورة القادمة: لديك{' '}
                  {formatObligationsCount(forecast.nextCycleSoonCount ?? 1)}{' '}
                  خلال أقل من 3 أيام بقيمة{' '}
                  <FormattedMoney amountFils={forecast.nextCycleSoonObligationsFils!} />.
                </span>
              </div>
              <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Quick Feature Access Hub (Mobile only, hidden on lg desktop) */}
      <QuickFeatureHub />

      {/* 2. Core Activity: Recent Transactions (col 7) & Debts Summary + Upcoming Recurring (col 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Recent Transactions & Top Expenses: lg:col-span-7 */}
        <div className="lg:col-span-7 space-y-5">
          {/* Recent Transactions Card */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  آخر المعاملات
                </h2>
              </div>
              <Link
                to="/transactions"
                className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
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
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 animate-pulse"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                      <div className="space-y-1.5">
                        <div className="w-28 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="w-16 h-2.5 rounded bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    </div>
                    <div className="w-16 h-4 rounded bg-zinc-200 dark:bg-zinc-800 shrink-0" />
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
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {recentTransactions.map((tx) => (
                  <RecentTransactionRow
                    key={tx.id}
                    tx={tx}
                    cat={categoryMap.get(tx.categoryId)}
                    today={today}
                    openEdit={openEdit}
                    openDuplicate={openDuplicate}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Top 3 Monthly Expenses Card */}
          {topExpenseCategories.length > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  أعلى مصاريف الشهر
                </h2>
                <Link
                  to="/reports"
                  className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
                >
                  <span>التقارير الكاملة</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="space-y-3">
                {topExpenseCategories.map((item) => (
                  <Link
                    key={item.categoryId}
                    to={`/transactions?categoryId=${item.categoryId}&type=expense`}
                    className="block space-y-1.5 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                          <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                        </span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                          <FormattedMoney amountFils={item.amountFils} />
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-400 min-w-8 text-end tabular-nums select-none ps-2">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Debts Summary & Upcoming Recurring: lg:col-span-5 */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Debts Summary */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  ملخص الديون والالتزامات
                </h2>
              </div>
              <Link
                to="/debts"
                className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
              >
                <span>إدارة الديون</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isInitialOrLoading || debtsLoading ? (
              <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] pt-1 animate-pulse">
                <div className="pe-3 space-y-2">
                  <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="w-20 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
                  <div className="w-12 h-2.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="ps-4 space-y-2">
                  <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="w-20 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
                  <div className="w-12 h-2.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A]">
                  <Link
                    to="/debts"
                    className="flex flex-col gap-1 pe-3 hover:opacity-80 transition-opacity cursor-pointer"
                    title="عرض المستحقات في صفحة الديون"
                  >
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      مستحقات لك
                    </span>
                    <span
                      className={cn(
                        'text-base sm:text-lg font-black truncate',
                        debtSummary.lentActiveCount > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-500 dark:text-zinc-400 font-bold'
                      )}
                    >
                      <FormattedMoney amountFils={debtSummary.lentFils} />
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {formatDebtCount(debtSummary.lentActiveCount)}
                    </span>
                  </Link>

                  <Link
                    to="/debts"
                    className="flex flex-col gap-1 ps-4 hover:opacity-80 transition-opacity cursor-pointer"
                    title="عرض الالتزامات في صفحة الديون"
                  >
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      التزامات عليك
                    </span>
                    <span
                      className={cn(
                        'text-base sm:text-lg font-black truncate',
                        debtSummary.borrowedActiveCount > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-zinc-500 dark:text-zinc-400 font-bold'
                      )}
                    >
                      <FormattedMoney amountFils={debtSummary.borrowedFils} />
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {formatDebtCount(debtSummary.borrowedActiveCount)}
                    </span>
                  </Link>
                </div>

                {nearestUpcomingDebt && nearestUpcomingDebt.dueDate && (
                  <Link
                    to="/debts"
                    className="mt-3 pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs hover:opacity-80 transition-opacity cursor-pointer"
                    title="عرض الديون المستحقة"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        أقرب استحقاق ({nearestUpcomingDebt.type === 'lent' ? 'مستحق لك' : 'التزام عليك'}): {nearestUpcomingDebt.personName}
                      </span>
                      <span className="text-[10px] text-zinc-400 shrink-0">
                        ({toWesternDigits(formatDate(new Date(nearestUpcomingDebt.dueDate), new Date(nearestUpcomingDebt.dueDate).getFullYear() === today.getFullYear() ? 'd MMMM' : 'd MMMM yyyy', { locale: ar }))})
                      </span>
                    </div>
                    <div className={cn(
                      'text-xs sm:text-sm font-black select-none shrink-0 ps-2',
                      nearestUpcomingDebt.type === 'lent'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    )}>
                      <FormattedMoney
                        amountFils={Math.max(
                          0,
                          nearestUpcomingDebt.amountFils - (nearestUpcomingDebt.paidFils || 0)
                        )}
                      />
                    </div>
                  </Link>
                )}
              </>
            )}
          </Card>

          {/* Upcoming Recurring */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  المتكررات القادمة
                </h2>
              </div>
              <Link
                to="/recurring"
                className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
              >
                <span>إدارة المتكررة</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            {isInitialOrLoading || recurringLoading ? (
              <div className="space-y-2 pt-1 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                      <div className="space-y-1">
                        <div className="w-24 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                        <div className="w-14 h-2 rounded bg-zinc-100 dark:bg-zinc-800" />
                      </div>
                    </div>
                    <div className="w-14 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : upcomingRecurring.length === 0 ? (
              <div className="py-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-500 dark:text-zinc-400">
                  لا توجد معاملات متكررة نشطة
                </span>
                <Link
                  to="/recurring"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-bold shrink-0"
                >
                  <span>ضبط معاملة متكررة جديدة</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
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
                  const diffDays = differenceInDays(startOfDay(nextDate), startOfDay(today))
                  let relativeText: string
                  if (diffDays < 0) {
                    relativeText = 'مستحقة'
                  } else if (diffDays === 0) {
                    relativeText = 'اليوم'
                  } else if (diffDays === 1) {
                    relativeText = 'غداً'
                  } else if (diffDays === 2) {
                    relativeText = 'بعد يومين'
                  } else if (diffDays >= 3 && diffDays <= 10) {
                    relativeText = `بعد ${diffDays} أيام`
                  } else {
                    relativeText = `بعد ${diffDays} يوماً`
                  }

                  return (
                    <Link
                      to="/recurring"
                      key={item.id}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                          <CategoryIcon icon={cat?.icon || '🔄'} color={cat?.color} size="sm" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-zinc-800 dark:text-zinc-100 truncate">
                            {item.title || item.note || (cat ? cat.name : 'معاملة متكررة')}
                          </div>
                          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {nextDateFormatted} • {relativeText}
                          </div>
                        </div>
                      </div>

                      <div className="text-end shrink-0 ps-2">
                        <div
                          className={cn(
                            'text-xs font-extrabold select-none',
                            isExpense
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          <FormattedMoney amountFils={item.amountFils} withSign={item.type} />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
