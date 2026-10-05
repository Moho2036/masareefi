import React, { useMemo } from 'react'
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
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { MonthSelector } from '../components/ui/MonthSelector'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { CategoryPieChart } from '../components/charts/CategoryPieChart'
import { DailyExpenseChart } from '../components/charts/DailyExpenseChart'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useTransactionModal } from '../hooks/useTransactionModal'
import { sumByType } from '../lib/aggregate'
import { calculateCategoryDistribution, calculateDailyExpenses } from '../lib/reports'
import { formatJOD, formatSigned } from '../lib/money'
import { toWesternDigits, formatDayHeader } from '../lib/dates'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { cn } from '../lib/cn'

export const DashboardPage: React.FC = () => {
  const { range } = useSelectedMonth()
  const { data: rawTransactions, loading: txLoading } = useTransactions(range)
  const { data: categories } = useCategories()
  const { data: recurringList } = useRecurring()
  const { openAdd, openEdit } = useTransactionModal()

  // Calculate monthly totals
  const sums = useMemo(() => sumByType(rawTransactions), [rawTransactions])

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
    () => calculateDailyExpenses(rawTransactions, range.start, range.end),
    [rawTransactions, range.start, range.end]
  )

  // Up to 5 most recent transactions
  const recentTransactions = useMemo(
    () => rawTransactions.slice(0, 5),
    [rawTransactions]
  )

  // Up to 5 upcoming active recurring items
  const upcomingRecurring = useMemo(() => {
    return recurringList
      .filter((r) => r.active)
      .sort((a, b) => {
        const dateA = a.nextDate instanceof Date ? a.nextDate : new Date(a.nextDate)
        const dateB = b.nextDate instanceof Date ? b.nextDate : new Date(b.nextDate)
        return dateA.getTime() - dateB.getTime()
      })
      .slice(0, 5)
  }, [recurringList])

  const today = useMemo(() => new Date(), [])

  return (
    <div className="space-y-6">
      {/* Header with Title and MonthSelector / Quick Add */}
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة شاملة وسريعة على وضعك المالي لهذا الشهر"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <MonthSelector />
            <Button
              variant="primary"
              size="md"
              onClick={() => openAdd('expense')}
              className="gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة معاملة</span>
            </Button>
          </div>
        }
      />

      {/* Top Row: 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Card */}
        <Card className="border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              المداخيل
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 select-none">
            {formatJOD(sums.income)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            إجمالي الدخل المحصل هذا الشهر
          </div>
        </Card>

        {/* Expenses Card */}
        <Card className="border border-red-200/80 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/20 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              المصاريف
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-500 dark:text-red-400 select-none">
            {formatJOD(sums.expense)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            إجمالي ما تم إنفاقه هذا الشهر
          </div>
        </Card>

        {/* Balance Card */}
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              الرصيد
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={cn(
              'text-2xl sm:text-3xl font-black select-none',
              sums.balance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            )}
          >
            {formatJOD(sums.balance)}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
            {sums.balance >= 0 ? 'فائض مالي متبقي' : 'عجز مالي هذا الشهر'}
          </div>
        </Card>
      </div>

      {/* Middle Row: 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category Pie Chart Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
              المصاريف حسب التصنيف
            </h2>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              {categoryDistribution.length} تصنيفات
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <CategoryPieChart data={categoryDistribution} className="w-full" />
          </div>
        </Card>

        {/* Daily Expenses Chart Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
              المصاريف اليومية
            </h2>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              حركة الصرف اليومية
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <DailyExpenseChart data={dailyExpenses} className="w-full" />
          </div>
        </Card>
      </div>

      {/* Bottom Row: Recent Transactions & Upcoming Recurring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Transactions Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/60">
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

          {txLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              جاري تحميل المعاملات...
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
            <div className="space-y-2">
              {recentTransactions.map((tx) => {
                const cat = categoryMap.get(tx.categoryId)
                const isExpense = tx.type === 'expense'
                const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
                const dateHeader = formatDayHeader(txDate, today)

                return (
                  <div
                    key={tx.id}
                    onClick={() => openEdit(tx)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Emoji Icon in rounded circle */}
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-xs"
                        style={{
                          backgroundColor: cat ? `${cat.color}25` : '#94A3B825',
                        }}
                      >
                        {cat ? cat.icon : '📁'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {tx.note || (cat ? cat.name : 'معاملة')}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                          {tx.note && cat && (
                            <>
                              <span className="truncate">{cat.name}</span>
                              <span>•</span>
                            </>
                          )}
                          <span className="truncate">{dateHeader}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end shrink-0 ps-3">
                      <div
                        className={cn(
                          'text-sm sm:text-base font-extrabold select-none',
                          isExpense
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {formatSigned(tx.amountFils, tx.type)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Upcoming Recurring Card */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/60">
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
            <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500">
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
            <div className="space-y-2">
              {upcomingRecurring.map((item) => {
                const cat = categoryMap.get(item.categoryId)
                const isExpense = item.type === 'expense'
                const nextDate =
                  item.nextDate instanceof Date
                    ? item.nextDate
                    : new Date(item.nextDate)
                const nextDateFormatted = toWesternDigits(
                  format(nextDate, 'd MMMM yyyy', { locale: ar })
                )

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-xs"
                        style={{
                          backgroundColor: cat ? `${cat.color}25` : '#94A3B825',
                        }}
                      >
                        {cat ? cat.icon : '🔄'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                          {item.note || (cat ? cat.name : 'معاملة متكررة')}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span className="truncate">{nextDateFormatted}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end shrink-0 ps-3">
                      <div
                        className={cn(
                          'text-sm sm:text-base font-extrabold select-none',
                          isExpense
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {formatSigned(item.amountFils, item.type)}
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
  )
}
