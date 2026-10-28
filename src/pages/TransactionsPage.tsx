import React, { useState, useMemo, useEffect, useDeferredValue } from 'react'
import { Link, useSearchParams } from 'react-router'
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
  Download,
  AlertCircle,
  SlidersHorizontal,
  Printer,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { DatePickerInput } from '../components/ui/DatePickerInput'
import { FormattedMoney } from '../components/ui/FormattedMoney'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useDebts } from '../hooks/useDebts'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactionModal } from '../hooks/useTransactionModal'
import { useToast } from '../hooks/useToast'
import { useCurrency } from '../hooks/useCurrency'
import { deleteTransaction } from '../services/transactions'
import { removeDebtPayment } from '../services/debts'
import { removeCircleInstallmentPayment } from '../services/moneyCircles'
import { formatDayHeader, formatDateInput, parseLocalDateInput } from '../lib/dates'
import { findLinkedDebtPayment } from '../lib/debts'
import { exportTransactionsToCsv } from '../lib/exportCsv'
import { getOccurrenceMonthIndex } from '../lib/recurring'
import {
  getCategoryUsageMap,
  sortCategoriesByUsage,
  buildUsageFromTransactions,
  syncCategoryUsageCache,
} from '../lib/categoryUsage'
import {
  filterTransactions,
  sumByType,
  groupByDay,
  sortTransactions,
  type TransactionSortOption,
} from '../lib/aggregate'
import { cn } from '../lib/cn'
import type { Transaction, TxType } from '../types'

export const TransactionsPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const { range, manualNavKey = 0 } = useSelectedMonth()
  const [allMonths, setAllMonths] = useState(false)
  const [isCustomDateRange, setIsCustomDateRange] = useState(false)
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [prevManualNavKey, setPrevManualNavKey] = useState(manualNavKey)

  if (prevManualNavKey !== manualNavKey) {
    setPrevManualNavKey(manualNavKey)
    if (allMonths) {
      setAllMonths(false)
    }
  }

  const fetchAll = allMonths || isCustomDateRange
  const { data: rawTransactions, loading: txLoading } = useTransactions(fetchAll ? undefined : range)
  const { data: categories } = useCategories()
  const { data: debts } = useDebts()
  const { data: circles } = useMoneyCircles()
  const { openAdd, openEdit, openDuplicate } = useTransactionModal()
  const { showToast } = useToast()
  const { format, formatWithSign, config: currencyConfig } = useCurrency()

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filterType, setFilterType] = useState<TxType | 'all'>(() => {
    const typeParam = searchParams.get('type')
    if (typeParam === 'income' || typeParam === 'expense') {
      return typeParam
    }
    return 'all'
  })
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get('categoryId')
    return cat ? [cat] : []
  })
  const [selectedSource, setSelectedSource] = useState<'all' | 'manual' | 'recurring' | 'debt' | 'circle'>('all')
  const [sortBy, setSortBy] = useState<TransactionSortOption>('newest')
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAllFilterCats, setShowAllFilterCats] = useState(false)
  const [prevFilterKey, setPrevFilterKey] = useState('')
  const PAGE_SIZE = 30

  // Check URL search params for categoryId, allMonths, and type during render
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams.toString())
  if (prevSearchParams !== searchParams.toString()) {
    setPrevSearchParams(searchParams.toString())
    const typeParam = searchParams.get('type')
    if (typeParam === 'income' || typeParam === 'expense') {
      setFilterType(typeParam)
    }
    const cat = searchParams.get('categoryId')
    if (cat) {
      setSelectedCategories([cat])
    }
    if (searchParams.get('allMonths') === 'true') {
      setAllMonths(true)
    }
  }

  // Check if txToDelete is linked to a debt payment
  const linkedDebtPayment = findLinkedDebtPayment(txToDelete?.id, debts)

  // Automatically reset to page 1 during render whenever filters change
  const currentFilterKey = `${fetchAll ? 'all' : range.start.getTime()}_${deferredQuery}_${filterType}_${selectedCategories.join(',')}_${selectedSource}_${isCustomDateRange}_${customDateFrom}_${customDateTo}_${sortBy}`
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey)
    setCurrentPage(1)
  }

  const isFilterActive = Boolean(
    query.trim() ||
    filterType !== 'all' ||
    (selectedCategories.length > 0 && !selectedCategories.includes('all')) ||
    selectedSource !== 'all' ||
    isCustomDateRange ||
    allMonths ||
    sortBy !== 'newest'
  )

  const handleResetFilters = () => {
    setQuery('')
    setFilterType('all')
    setSelectedCategories([])
    setSelectedSource('all')
    setIsCustomDateRange(false)
    setCustomDateFrom('')
    setCustomDateTo('')
    setAllMonths(false)
    setSortBy('newest')
  }

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(catId)) {
        return prev.filter((id) => id !== catId)
      } else {
        return [...prev.filter((id) => id !== 'all'), catId]
      }
    })
  }

  // Map categoryId to Category for O(1) lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  // Track category usage:
  // When allMonths is true, build from all user transactions (single source of truth) and sync cache in effect
  // When allMonths is false, read existing cache for sorting without overwriting with partial data
  const usageMap = useMemo(() => {
    if (allMonths) {
      return buildUsageFromTransactions(rawTransactions)
    }
    return getCategoryUsageMap()
  }, [allMonths, rawTransactions])

  useEffect(() => {
    if (allMonths && !txLoading) {
      syncCategoryUsageCache(rawTransactions)
    }
  }, [allMonths, rawTransactions, txLoading])

  // Relevant categories for horizontal chips (sorted by usage frequency)
  // Shows unarchived categories PLUS any category that has transactions in current view
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
        categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
        sourceType: selectedSource,
        dateRange:
          isCustomDateRange && (customDateFrom || customDateTo)
            ? {
                from: customDateFrom ? parseLocalDateInput(customDateFrom) : undefined,
                to: customDateTo ? parseLocalDateInput(customDateTo) : undefined,
              }
            : undefined,
      },
      categoryMap
    )
  }, [
    rawTransactions,
    deferredQuery,
    filterType,
    selectedCategories,
    selectedSource,
    isCustomDateRange,
    customDateFrom,
    customDateTo,
    categoryMap,
  ])

  // Summary totals for filtered set
  const totals = useMemo(() => {
    return sumByType(filteredTransactions)
  }, [filteredTransactions])

  // Sorted transactions
  const sortedTransactions = useMemo(() => {
    return sortTransactions(filteredTransactions, sortBy)
  }, [filteredTransactions, sortBy])

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
    if (focusTick < 0 || !rawTransactions) return new Date()
    return new Date()
  }, [rawTransactions, focusTick])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedTransactions = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return sortedTransactions.slice(start, start + PAGE_SIZE)
  }, [sortedTransactions, safeCurrentPage])

  const dayGroups = useMemo(() => {
    if (sortBy === 'highest' || sortBy === 'lowest') {
      return []
    }
    return groupByDay(paginatedTransactions)
  }, [paginatedTransactions, sortBy])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      showToast('لا توجد معاملات لتصديرها', 'info')
      return
    }
    exportTransactionsToCsv(filteredTransactions, categories, {
      symbol: currencyConfig.symbol,
      decimals: currencyConfig.decimals,
    })
    showToast(
      allMonths
        ? 'تم تصدير المعاملات المحددة لكافة الأشهر بنجاح'
        : 'تم تصدير المعاملات المحددة بنجاح',
      'success'
    )
  }

  const handleDeleteConfirm = async () => {
    if (!user || !txToDelete) return

    if (linkedDebtPayment) {
      if (linkedDebtPayment.payment.isMerged) {
        showToast('لا يمكن حذف دفعة مدمجة من هنا، يرجى إدارتها من سجل الديون.', 'error')
        setTxToDelete(null)
        return
      }
      setDeleting(true)
      try {
        await removeDebtPayment(user.uid, linkedDebtPayment.debt, linkedDebtPayment.payment.id)
        showToast(
          `تم حذف دفعة السداد لـ (${linkedDebtPayment.debt.personName}) وإعادة فتح المبلغ المستحق في سجل الدين بنجاح`,
          'info'
        )
        setTxToDelete(null)
      } catch (err) {
        console.error('Failed to remove linked debt payment:', err)
        showToast('تعذر حذف دفعة الدين المرتبطة', 'error')
      } finally {
        setDeleting(false)
      }
      return
    }

    if (txToDelete.id.startsWith('debt_init_')) {
      const debtId = txToDelete.id.replace('debt_init_', '')
      const debtExists = debts.some((d) => d.id === debtId)
      if (debtExists) {
        showToast('لا يمكن حذف معاملة أصل الدين من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.', 'error')
        setTxToDelete(null)
        return
      }
    }
    if (txToDelete.id.startsWith('circle_payout_')) {
      const circleId = txToDelete.id.replace('circle_payout_', '')
      const circleExists = circles.some((c) => c.id === circleId || txToDelete.id.startsWith(`circle_payout_${c.id}`))
      if (circleExists) {
        showToast('لا يمكن حذف معاملات إيداع الجمعيات من هنا، يرجى إدارتها من صفحة الجمعيات.', 'error')
        setTxToDelete(null)
        return
      }
    }
    const circleInstallmentMatch = txToDelete.id.match(/^circle_(.+)_m(\d+)$/)
    if (circleInstallmentMatch) {
      const circleId = circleInstallmentMatch[1]
      const monthNum = parseInt(circleInstallmentMatch[2], 10)
      setDeleting(true)
      try {
        await removeCircleInstallmentPayment(user.uid, circleId, monthNum)
        showToast('تم حذف قسط الجمعية وتحديث السجل بنجاح', 'info')
        setTxToDelete(null)
      } catch (err) {
        console.error('Failed to remove circle installment:', err)
        showToast('تعذر حذف قسط الجمعية', 'error')
      } finally {
        setDeleting(false)
      }
      return
    }
    if (!circleInstallmentMatch && txToDelete.recurringId) {
      const linkedCircle = circles.find((c) => c.recurringId === txToDelete.recurringId)
      if (linkedCircle) {
        const monthNum = getOccurrenceMonthIndex(linkedCircle.startDate, txToDelete.date)
        if (monthNum >= 1 && monthNum <= linkedCircle.membersCount) {
          setDeleting(true)
          try {
            await removeCircleInstallmentPayment(user.uid, linkedCircle.id, monthNum)
            showToast('تم حذف قسط الجمعية وتحديث السجل بنجاح', 'info')
            setTxToDelete(null)
          } catch (err) {
            console.error('Failed to remove circle installment:', err)
            showToast('تعذر حذف قسط الجمعية', 'error')
          } finally {
            setDeleting(false)
          }
          return
        }
      }
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

  const renderTransactionRow = (tx: Transaction, showDateBadge = false) => {
    const cat = categoryMap.get(tx.categoryId)
    const icon = cat?.icon ?? '➕'
    const color = cat?.color ?? '#94A3B8'
    const name = cat?.name ?? 'غير مصنف'
    const isExpense = tx.type === 'expense'
    const hasTitle = Boolean(tx.title?.trim())
    const hasNote = Boolean(tx.note?.trim())
    const primaryLabel = tx.title?.trim() || tx.note?.trim() || name
    const showCategoryInSub = hasTitle || hasNote
    const showNoteInSub = hasTitle && hasNote && tx.note.trim() !== tx.title!.trim()

    return (
      <div
        key={tx.id}
        onClick={() => openEdit(tx)}
        className="group flex items-center justify-between p-3 sm:p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
      >
        {/* Right side: Icon + Title + Subline */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pe-3">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            <CategoryIcon icon={icon} color={color} size="md" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {primaryLabel}
              </span>
              {showDateBadge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  {formatDateInput(tx.date)}
                </span>
              )}
              {tx.id.startsWith('debt_') && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 font-bold shrink-0">
                  <HandCoins className="w-2.5 h-2.5" />
                  <span>دين</span>
                </span>
              )}
              {(tx.id.startsWith('circle_payout_') ||
                /^circle_(.+)_m(\d+)$/.test(tx.id) ||
                Boolean(tx.recurringId && circles.some((c) => c.recurringId === tx.recurringId))) && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 font-bold shrink-0">
                  <Users className="w-2.5 h-2.5" />
                  <span>جمعية</span>
                </span>
              )}
              {tx.recurringId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold shrink-0">
                  متكررة
                </span>
              )}
            </div>

            {(showCategoryInSub || showNoteInSub) && (
              <div className="flex items-start gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                {showCategoryInSub && (
                  <>
                    <span className="font-medium text-zinc-500 dark:text-zinc-400 shrink-0">{name}</span>
                    {showNoteInSub ? <span>•</span> : null}
                  </>
                )}
                {showNoteInSub && (
                  <span className="line-clamp-2 whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
                    {tx.note}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Left side: Amount Pill & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

          <div className="hidden sm:flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {(() => {
              const linkedPaymentItem = findLinkedDebtPayment(tx.id, debts)
              const isMergedDebtPayment = Boolean(linkedPaymentItem?.payment?.isMerged)

              const isDebtInit = tx.id.startsWith('debt_init_')
              const debtId = isDebtInit ? tx.id.replace('debt_init_', '') : null
              const isDebtExists = Boolean(debtId && debts.some((d) => d.id === debtId))

              const isCirclePayout = tx.id.startsWith('circle_payout_')
              const circleId = isCirclePayout ? tx.id.replace('circle_payout_', '') : null
              const isCircleExists = Boolean(
                isCirclePayout &&
                  circles.some((c) => c.id === circleId || tx.id.startsWith(`circle_payout_${c.id}`))
              )

              const isLockedDebt = (isDebtInit && isDebtExists) || isMergedDebtPayment
              const isLockedCircle = isCirclePayout && isCircleExists

              return (
                <>
                  {!(isLockedDebt || isLockedCircle || tx.id.startsWith('debt_pay_')) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDuplicate(tx)
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
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
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    aria-label="تعديل المعاملة"
                    title="تعديل المعاملة"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {isLockedDebt ? (
                    <Link
                      to="/debts"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition-colors"
                      aria-label="الانتقال إلى صفحة الديون"
                      title={
                        isMergedDebtPayment
                          ? 'مرتبط بدفعة دين مدمجة - افتح صفحة الديون للإدارة'
                          : 'مرتبط بسجل الديون - افتح صفحة الديون للإدارة'
                      }
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  ) : isLockedCircle ? (
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
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      aria-label="حذف المعاملة"
                      title="حذف المعاملة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="المعاملات"
          subtitle="سجل كامل بجميع المصاريف والمداخيل وتفاصيلها"
        />
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap print-hide">
          <Button
            type="button"
            variant="outline"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
            disabled={filteredTransactions.length === 0}
            className="font-semibold text-xs sm:text-sm"
          >
            طباعة / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            className="font-semibold text-xs sm:text-sm"
          >
            تصدير CSV
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => openAdd('expense')}
            className="hidden lg:inline-flex font-semibold"
          >
            إضافة معاملة
          </Button>
        </div>
      </div>

      {/* 2-Column Responsive Layout on Desktop (Filters/Totals in Sticky Sidebar, Transactions in Main) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Sidebar Column: Filter Bar & Monthly Totals */}
        <aside className="lg:col-span-4 space-y-3.5 lg:sticky lg:top-20 print-hide">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs space-y-3 print-hide">
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
            <div>
              <SegmentedControl<TxType | 'all'>
                value={filterType}
                onChange={(val) => {
                  setFilterType(val)
                  setSelectedCategories([])
                }}
                options={[
                  { value: 'all', label: 'الكل' },
                  { value: 'expense', label: 'مصاريف' },
                  { value: 'income', label: 'مداخيل' },
                ]}
              />
            </div>

            {/* Date Range Options: All Months or Custom Range */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setAllMonths((prev) => {
                      const next = !prev
                      if (next) setIsCustomDateRange(false)
                      return next
                    })
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'press-scale inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0',
                    allMonths
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  )}
                  title={allMonths ? 'التبديل إلى معاملات الشهر المالي المحدد فقط' : 'البحث في كامل سجل المعاملات (كافة الأشهر)'}
                  aria-pressed={allMonths}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>كل الأشهر</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDateRange((prev) => {
                      const next = !prev
                      if (next) setAllMonths(false)
                      return next
                    })
                    setCurrentPage(1)
                  }}
                  className={cn(
                    'press-scale inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0',
                    isCustomDateRange
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  )}
                  title="فلترة المعاملات ضمن نطاق زمني مخصص"
                  aria-pressed={isCustomDateRange}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>فترة مخصصة</span>
                </button>
              </div>

              {isCustomDateRange && (
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <DatePickerInput
                    id="tx-custom-from"
                    label="من تاريخ"
                    value={customDateFrom}
                    onChange={(val) => {
                      setCustomDateFrom(val)
                      setCurrentPage(1)
                    }}
                  />
                  <DatePickerInput
                    id="tx-custom-to"
                    label="إلى تاريخ"
                    value={customDateTo}
                    onChange={(val) => {
                      setCustomDateTo(val)
                      setCurrentPage(1)
                    }}
                  />
                </div>
              )}
            </div>

            {/* Source Filter Chips */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-400">
                المصدر
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 select-none text-xs scrollbar-none">
                {[
                  { value: 'all', label: 'كافة المصادر' },
                  { value: 'manual', label: 'يدوية' },
                  { value: 'recurring', label: 'متكررة' },
                  { value: 'debt', label: 'ديون' },
                  { value: 'circle', label: 'جمعيات' },
                ].map((s) => {
                  const isSelected = selectedSource === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        setSelectedSource(s.value as typeof selectedSource)
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer',
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs font-bold'
                          : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                      )}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category Chips with Multi-Select */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-400">
                  التصنيفات
                </label>
                {selectedCategories.length > 0 && !selectedCategories.includes('all') && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ({selectedCategories.length} محدد)
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="flex items-center gap-1.5 overflow-x-auto lg:overflow-visible flex-nowrap lg:flex-wrap pb-1 pt-0.5 select-none text-xs scrollbar-none">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategories([])
                      setCurrentPage(1)
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer',
                      selectedCategories.length === 0 || selectedCategories.includes('all')
                        ? 'bg-emerald-500 text-white shadow-xs font-bold'
                        : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                    )}
                  >
                    كل التصنيفات
                  </button>

                  {(showAllFilterCats ? relevantCategories : relevantCategories.slice(0, 8)).map((cat) => {
                    const isSelected = selectedCategories.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          toggleCategory(cat.id)
                          setCurrentPage(1)
                        }}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all shrink-0 cursor-pointer',
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs font-bold'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                        )}
                      >
                        <CategoryIcon icon={cat.icon} size="sm" />
                        <span className="font-semibold">{cat.name}</span>
                      </button>
                    )
                  })}
                  {relevantCategories.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllFilterCats((prev) => !prev)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors shrink-0 cursor-pointer"
                    >
                      {showAllFilterCats ? 'عرض أقل' : `+${relevantCategories.length - 8} أخرى`}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
              <span className="font-bold text-slate-400 text-[11px]">ترتيب حسب:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as TransactionSortOption)
                  setCurrentPage(1)
                }}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
                <option value="highest">الأعلى قيمة</option>
                <option value="lowest">الأقل قيمة</option>
              </select>
            </div>
          </div>

          {/* All Months Indicator Banner */}
          {allMonths && (
            <div className="flex items-start sm:items-center gap-2.5 px-3.5 py-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-xs text-blue-800 dark:text-blue-300 shadow-xs print-hide">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5 sm:mt-0" />
              <div className="flex-1">
                وضع <strong>البحث في كامل السجل (كل الأشهر)</strong> مفعّل حالياً. النتائج المعروضة وتصدير CSV يشملان كافة الأشهر. (التنقل بين الأشهر من الشريط العلوي سيعيدك تلقائياً لتصفح ذلك الشهر).
              </div>
              <button
                type="button"
                onClick={() => setAllMonths(false)}
                className="text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline shrink-0 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          )}

          {/* Active Filter & Search Summary Strip */}
          {isFilterActive && (
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-xs shadow-xs print-hide">
              <span className="inline-flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>النتائج المطابقة:</span>
                <span className="px-1.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-black">
                  {filteredTransactions.length}
                </span>
              </span>

              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>مسح الفلتر</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Totals Strip Card */}
          <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-400 truncate">
                  {allMonths ? 'إجمالي المداخيل (كافة الأشهر)' : 'إجمالي المداخيل'}
                </div>
                <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 truncate">
                  <FormattedMoney amountFils={totals.income} className="text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-s border-slate-100 dark:border-slate-700 ps-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-400 truncate">
                  {allMonths ? 'إجمالي المصاريف (كافة الأشهر)' : 'إجمالي المصاريف'}
                </div>
                <div className="text-sm sm:text-base font-black text-red-500 dark:text-red-400 truncate">
                  <FormattedMoney amountFils={totals.expense} className="text-red-500 dark:text-red-400" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Column: Transactions List */}
        <main className="lg:col-span-8 space-y-4">
          {txLoading && rawTransactions.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 animate-pulse"
                />
              ))}
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="w-8 h-8" />}
              title={
                isFilterActive
                  ? 'لا توجد معاملات مطابقة للفلترة'
                  : 'لا توجد معاملات لهذا الشهر'
              }
              description={
                allMonths
                  ? 'لم يتم العثور على أي معاملات مطابقة في كامل سجل المعاملات.'
                  : 'ابدأ بتسجيل مصاريفك أو مداخيلك لمتابعة ميزانيتك أولاً بأول.'
              }
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
              {/* Flat list for amount-based sorting */}
              {sortBy === 'highest' || sortBy === 'lowest' ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs divide-y divide-slate-100 dark:divide-slate-700/50 overflow-hidden">
                  {paginatedTransactions.map((tx) => renderTransactionRow(tx, true))}
                </div>
              ) : (
                /* Grouped by day for date-based sorting */
                dayGroups.map((group) => {
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
                        {group.transactions.map((tx) => renderTransactionRow(tx, false))}
                      </div>
                    </div>
                  )
                })
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs text-xs font-semibold print-hide">
                  <div className="text-slate-500 dark:text-slate-400">
                    صفحة <span className="font-bold text-slate-800 dark:text-slate-200">{safeCurrentPage}</span> من{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">{totalPages}</span>
                    <span className="ms-1.5 text-[11px] text-slate-400">
                      ({filteredTransactions.length} معاملة)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => handlePageChange(Math.max(1, safeCurrentPage - 1))}
                      className="text-xs"
                    >
                      السابق
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => handlePageChange(Math.min(totalPages, safeCurrentPage + 1))}
                      className="text-xs"
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              )}
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
          {linkedDebtPayment && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>تنبيه: هذه المعاملة مرتبطة بدفعة سداد دين</span>
              </div>
              <p className="leading-relaxed text-[11px] text-amber-700/90 dark:text-amber-300/80">
                هذه المعاملة مرتبطة بسجل دين لـ <strong>{linkedDebtPayment.debt.personName}</strong>. عند تأكيد الحذف، سيتم أيضاً حذف دفعة السداد وإعادة فتح المبلغ المستحق في سجل الديون للحفاظ على تطابق الرصيد المحاسبي.
              </p>
            </div>
          )}
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
