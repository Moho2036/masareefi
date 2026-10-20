import React, { useState, useMemo, useEffect, useDeferredValue } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeftRight,
  Search,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  HandCoins,
  Copy,
  X,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Users,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactionModal } from '../hooks/useTransactionModal'
import { useToast } from '../hooks/useToast'
import { useCurrency } from '../hooks/useCurrency'
import { deleteTransaction } from '../services/transactions'
import { formatDayHeader } from '../lib/dates'
import {
  getCategoryUsageMap,
  sortCategoriesByUsage,
  buildUsageFromTransactions,
  mergeUsageMaps,
  saveCategoryUsageMap,
} from '../lib/categoryUsage'
import { filterTransactions, sumByType, groupByDay } from '../lib/aggregate'
import { cn } from '../lib/cn'
import type { Transaction, TxType } from '../types'

export const TransactionsPage: React.FC = () => {
  const { user } = useAuth()
  const { range } = useSelectedMonth()
  const { data: rawTransactions, loading: txLoading } = useTransactions(range)
  const { data: categories } = useCategories()
  const { openAdd, openEdit, openDuplicate } = useTransactionModal()
  const { showToast } = useToast()
  const { format, formatWithSign } = useCurrency()

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filterType, setFilterType] = useState<TxType | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isFilterActive = Boolean(
    query.trim() || filterType !== 'all' || selectedCategory !== 'all'
  )

  const handleResetFilters = () => {
    setQuery('')
    setFilterType('all')
    setSelectedCategory('all')
  }

  // Map categoryId to Category for O(1) lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  // Track category usage from transactions in memory (read-only calculation during render)
  const usageMap = useMemo(() => {
    const txMap = buildUsageFromTransactions(rawTransactions)
    return mergeUsageMaps(txMap, getCategoryUsageMap())
  }, [rawTransactions])

  // Save merged category usage in localStorage outside render in an effect
  useEffect(() => {
    if (rawTransactions.length > 0) {
      saveCategoryUsageMap(usageMap)
    }
  }, [rawTransactions.length, usageMap])

  // Relevant categories for horizontal chips (sorted by usage frequency)
  // Shows unarchived categories PLUS any archived category that has transactions in the current month
  const relevantCategories = useMemo(() => {
    const usedCategoryIds = new Set(rawTransactions.map((tx) => tx.categoryId))
    const filtered = categories.filter((c) => {
      const matchesType = filterType === 'all' ? true : c.type === filterType
      if (!matchesType) return false
      return !c.archived || usedCategoryIds.has(c.id)
    })
    return sortCategoriesByUsage(filtered, usageMap)
  }, [categories, filterType, usageMap, rawTransactions])

  // Filtered transactions (using deferredQuery to prevent keyboard lag on mobile)
  const filteredTransactions = useMemo(() => {
    return filterTransactions(
      rawTransactions,
      {
        query: deferredQuery,
        type: filterType,
        categoryId: selectedCategory,
      },
      categoryMap
    )
  }, [rawTransactions, deferredQuery, filterType, selectedCategory, categoryMap])

  // Summary totals for filtered set
  const totals = useMemo(() => {
    return sumByType(filteredTransactions)
  }, [filteredTransactions])

  // Grouped by day
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
  const dayGroups = useMemo(() => {
    return groupByDay(filteredTransactions)
  }, [filteredTransactions])

  const handleDeleteConfirm = async () => {
    if (!user || !txToDelete) return
    if (txToDelete.id.startsWith('debt_init_') || txToDelete.id.startsWith('debt_pay_')) {
      showToast('لا يمكن حذف معاملات الديون من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.', 'error')
      setTxToDelete(null)
      return
    }
    if (txToDelete.id.startsWith('circle_payout_')) {
      showToast('لا يمكن حذف معاملات إيداع الجمعيات من هنا، يرجى إدارتها من صفحة الجمعيات.', 'error')
      setTxToDelete(null)
      return
    }
    setDeleting(true)
    try {
      await deleteTransaction(user.uid, txToDelete.id)
      showToast('تم حذف المعاملة بنجاح', 'info')
      setTxToDelete(null)
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      showToast('تعذر حذف المعاملة', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="المعاملات"
          subtitle="سجل كامل بجميع المصاريف والمداخيل وتفاصيلها"
        />
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={() => openAdd('expense')}
          className="hidden lg:inline-flex self-start sm:self-auto font-semibold"
        >
          إضافة معاملة
        </Button>
      </div>

      {/* 2-Column Responsive Layout on Desktop (Filters/Totals in Sticky Sidebar, Transactions in Main) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Sidebar Column: Filter Bar & Monthly Totals */}
        <aside className="lg:col-span-4 space-y-3.5 lg:sticky lg:top-20">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-2.5">
            {/* Top Row: Search Input & Type Toggle */}
            <div className="flex flex-col items-stretch gap-2">
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث في العنوان، الملاحظات، الفئة، أو المبلغ..."
                  className="w-full ps-10 pe-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              {/* Type Toggle: الكل / مصاريف / مداخيل */}
              <SegmentedControl<TxType | 'all'>
                value={filterType}
                onChange={(val) => {
                  setFilterType(val)
                  setSelectedCategory('all')
                }}
                options={[
                  { value: 'all', label: 'الكل' },
                  { value: 'expense', label: 'مصاريف' },
                  { value: 'income', label: 'مداخيل' },
                ]}
              />
            </div>

            {/* Bottom Row: Horizontal Scrollable Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 select-none text-xs">
              {/* All Categories Chip */}
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer',
                  selectedCategory === 'all'
                    ? 'bg-emerald-500 text-white shadow-xs font-bold'
                    : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                )}
              >
                كل التصنيفات
              </button>

              {/* Individual Category Chips */}
              {relevantCategories.map((cat) => {
                const isSelected = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all shrink-0 cursor-pointer',
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-xs font-bold'
                        : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                    )}
                  >
                    <span className="text-sm shrink-0">{cat.icon}</span>
                    <span className="font-semibold">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active Filter & Search Summary Strip */}
          {isFilterActive && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl text-xs shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                  <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>النتائج:</span>
                  <span className="px-1.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-black">
                    {filteredTransactions.length}
                  </span>
                </span>

                <span className="text-emerald-300 dark:text-emerald-700">•</span>

                <div className="flex items-center gap-1.5 flex-wrap font-medium text-slate-700 dark:text-slate-300">
                  <span>المجموع:</span>
                  {filterType === 'expense' ? (
                    <span className="font-black text-red-600 dark:text-red-400">
                      {format(totals.expense)}
                    </span>
                  ) : filterType === 'income' ? (
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      {format(totals.income)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-red-600 dark:text-red-400 font-bold">
                        -{format(totals.expense)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">/</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        +{format(totals.income)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetFilters}
                className="self-end sm:self-auto text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-100 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>مسح</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Monthly Totals Strip Card */}
          <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-400 truncate">إجمالي المداخيل</div>
                <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 truncate">
                  {format(totals.income)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-s border-slate-100 dark:border-slate-700 ps-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-400 truncate">إجمالي المصاريف</div>
                <div className="text-sm sm:text-base font-black text-red-500 dark:text-red-400 truncate">
                  {format(totals.expense)}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Column: Transactions List */}
        <main className="lg:col-span-8 space-y-4">
          {txLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 animate-pulse"
                />
              ))}
            </div>
          ) : dayGroups.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="w-8 h-8" />}
              title={
                query || filterType !== 'all' || selectedCategory !== 'all'
                  ? 'لا توجد معاملات مطابقة للفلترة'
                  : 'لا توجد معاملات لهذا الشهر'
              }
              description="ابدأ بتسجيل مصاريفك أو مداخيلك لمتابعة ميزانيتك أولاً بأول."
              action={
                <Button
                  variant="primary"
                  size="md"
                  icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                  onClick={() => openAdd('expense')}
                >
                  إضافة أول معاملة
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {dayGroups.map((group) => {
                const dayNetFils = group.transactions.reduce((acc, tx) => {
                  return tx.type === 'income' ? acc + tx.amountFils : acc - tx.amountFils
                }, 0)

                return (
                  <div key={group.dateKey} className="space-y-2">
                    {/* Day Header with clearly displayed net spend */}
                    <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDayHeader(group.date, today)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-medium">صافي اليوم:</span>
                        <span
                          className={cn(
                            'font-extrabold text-xs select-none',
                            dayNetFils > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : dayNetFils < 0
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-slate-400'
                          )}
                        >
                          {dayNetFils > 0
                            ? `+ ${format(dayNetFils)}`
                            : dayNetFils < 0
                              ? `- ${format(Math.abs(dayNetFils))}`
                              : format(0)}
                        </span>
                      </div>
                    </div>

                    {/* Transactions in this day */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs divide-y divide-slate-100 dark:divide-slate-700/50 overflow-hidden">
                      {group.transactions.map((tx) => {
                        const cat = categoryMap.get(tx.categoryId)
                        const icon = cat?.icon ?? '➕'
                        const color = cat?.color ?? '#94A3B8'
                        const name = cat?.name ?? 'غير مصنف'
                        const isExpense = tx.type === 'expense'

                        return (
                          <div
                            key={tx.id}
                            onClick={() => openEdit(tx)}
                            className="group flex items-center justify-between p-3 sm:p-3.5 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                          >
                            {/* Right side: Emoji circle + Category Name + Note */}
                            <div className="flex items-center gap-3 min-w-0 flex-1 pe-3">
                              <div
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg shrink-0"
                                style={{ backgroundColor: `${color}20` }}
                              >
                                {icon}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                                    {tx.title || name}
                                  </span>
                                  {tx.id.startsWith('debt_') && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 font-bold shrink-0">
                                      <HandCoins className="w-2.5 h-2.5" />
                                      <span>دين</span>
                                    </span>
                                  )}
                                  {tx.id.startsWith('circle_payout_') && (
                                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 font-bold shrink-0">
                                      <Users className="w-2.5 h-2.5" />
                                      <span>جمعية</span>
                                    </span>
                                  )}
                                  {tx.recurringId && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold shrink-0">
                                      متكررة
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                                  {tx.title ? (
                                    <>
                                      <span className="font-medium text-slate-500 dark:text-slate-400">{name}</span>
                                      {tx.note ? <span>•</span> : null}
                                    </>
                                  ) : null}
                                  {tx.note ? <span>{tx.note}</span> : null}
                                </div>
                              </div>
                            </div>

                            {/* Left side: Amount Pill & Actions */}
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                              {/* Amount Pill */}
                              <div
                                className={cn(
                                  'font-bold text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-xl select-none',
                                  isExpense
                                    ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                )}
                              >
                                {formatWithSign(tx.amountFils, tx.type)}
                              </div>

                              {/* Action Buttons: visible on mobile, smooth group hover on desktop */}
                              <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/40 transition-colors"
                                    aria-label="تكرار المعاملة"
                                    title="تكرار المعاملة"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEdit(tx)
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                                  aria-label="تعديل المعاملة"
                                  title="تعديل المعاملة"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {tx.id.startsWith('debt_init_') || tx.id.startsWith('debt_pay_') ? (
                                  <Link
                                    to="/debts"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors"
                                    aria-label="الانتقال إلى صفحة الديون"
                                    title="مرتبط بسجل الديون - افتح صفحة الديون للإدارة"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>
                                ) : tx.id.startsWith('circle_payout_') ? (
                                  <Link
                                    to="/tools?tool=circles"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition-colors"
                                    aria-label="الانتقال إلى صفحة الجمعيات"
                                    title="مرتبط بنظام الجمعيات - افتح صفحة الجمعيات للإدارة"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setTxToDelete(tx)
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                                    aria-label="حذف المعاملة"
                                    title="حذف المعاملة"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        title="تأكيد حذف المعاملة"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            هل أنت متأكد من رغبتك في حذف هذه المعاملة؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setTxToDelete(null)}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'جاري الحذف...' : 'حذف المعاملة'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
