import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react'
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
import { Select } from '../components/ui/Select'
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
import { useUserSettings } from '../hooks/useUserSettings'
import { deleteTransaction } from '../services/transactions'
import { removeDebtPayment } from '../services/debts'
import { removeCircleInstallmentPayment } from '../services/moneyCircles'
import {
  formatDayHeader,
  formatDateInput,
  parseLocalDateInput,
  formatFinancialMonthLabel,
  toWesternDigits,
} from '../lib/dates'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { exportTransactionsToCsv } from '../lib/exportCsv'
import { getOccurrenceMonthIndex } from '../lib/recurring'
import {
  getCategoryUsageMap,
  sortCategoriesUnified,
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
import type { Transaction, TxType, Debt, Category } from '../types'

interface TransactionRowItemProps {
  tx: Transaction
  showDateBadge: boolean
  cat?: Category
  isExpense: boolean
  primaryLabel: string
  timeDisplay: string
  name: string
  showCategoryInSub: boolean
  showNoteInSub: boolean
  isLockedDebt: boolean
  isLockedCircle: boolean
  isMergedDebtPayment: boolean
  isSystemLinked: boolean
  circleRecurringIdsSet: Set<string>
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
  setTxToDelete: (tx: Transaction) => void
}

const TransactionRowItem: React.FC<TransactionRowItemProps> = ({
  tx,
  showDateBadge,
  cat,
  isExpense,
  primaryLabel,
  timeDisplay,
  name,
  showCategoryInSub,
  showNoteInSub,
  isLockedDebt,
  isLockedCircle,
  isMergedDebtPayment,
  isSystemLinked,
  circleRecurringIdsSet,
  openEdit,
  openDuplicate,
  setTxToDelete,
}) => {
  const { formatWithSign } = useCurrency()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const icon = cat?.icon ?? '➕'
  const color = cat?.color ?? '#94A3B8'

  const maxSwipe = isSystemLinked || isLockedDebt || isLockedCircle ? 100 : 160

  return (
    <div className="relative overflow-hidden select-none group">
      {/* Mobile Swipe-to-Right Action Reveal Strip */}
      <div
        className={cn(
          'absolute inset-y-0 end-0 flex items-center pe-2 gap-1.5 z-0 transition-opacity sm:hidden print:hidden',
          swipeOffset > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSwipeOffset(0)
            openEdit(tx)
          }}
          className="h-8 px-2.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 flex items-center gap-1 text-xs font-bold active:scale-95 transition-all cursor-pointer"
          aria-label="سحب لتعديل المعاملة"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>تعديل</span>
        </button>

        {!(isLockedDebt || isLockedCircle || isSystemLinked) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              openDuplicate(tx)
            }}
            className="h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-2xs dark:shadow-none"
            aria-label="سحب لتكرار المعاملة"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>تكرار</span>
          </button>
        )}

        {isLockedDebt ? (
          <Link
            to="/debts"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
            }}
            className="h-8 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center gap-1 text-xs font-bold active:scale-95 transition-all"
            aria-label="سحب للانتقال إلى صفحة الديون"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>الديون</span>
          </Link>
        ) : isLockedCircle ? (
          <Link
            to="/tools?tool=circles"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
            }}
            className="h-8 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center gap-1 text-xs font-bold active:scale-95 transition-all"
            aria-label="سحب للانتقال إلى صفحة الجمعيات"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>الجمعيات</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              setTxToDelete(tx)
            }}
            className="h-8 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-2xs dark:shadow-none"
            aria-label="سحب لحذف المعاملة"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        )}
      </div>

      {/* Main Row Surface */}
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
          if (touchStartX.current === null) return
          const diff = e.touches[0].clientX - touchStartX.current
          if (diff > 8) {
            setSwipeOffset(Math.min(diff, maxSwipe + 15))
          } else if (swipeOffset > 0 && diff < -8) {
            setSwipeOffset(0)
          }
        }}
        onTouchEnd={() => {
          if (touchStartX.current === null) return
          touchStartX.current = null
          if (swipeOffset > 40) {
            setSwipeOffset(maxSwipe)
          } else {
            setSwipeOffset(0)
          }
        }}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
        }}
        className={cn(
          'group flex items-center justify-between p-3 sm:p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer bg-white dark:bg-[#121215] relative z-10',
          swipeOffset === 0 && 'transition-transform duration-200 ease-out'
        )}
      >
        {/* Right side: Icon + Title + Subline */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pe-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0">
            <CategoryIcon icon={icon} color={color} size="md" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {primaryLabel}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal shrink-0">
                {timeDisplay}
              </span>
              {showDateBadge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  {formatDateInput(tx.date)}
                </span>
              )}
              {tx.id.startsWith('debt_') && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  <HandCoins className="w-2.5 h-2.5" />
                  <span>دين</span>
                </span>
              )}
              {(tx.id.startsWith('circle_payout_') ||
                /^circle_(.+)_m(\d+)$/.test(tx.id) ||
                Boolean(tx.recurringId && circleRecurringIdsSet.has(tx.recurringId))) && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  <Users className="w-2.5 h-2.5" />
                  <span>جمعية</span>
                </span>
              )}
              {tx.recurringId && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  <span>متكررة</span>
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

        {/* Left side: Amount & Desktop Hover Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className={cn(
              'font-extrabold text-xs sm:text-sm tabular-nums select-none ps-1',
              isExpense
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {formatWithSign(tx.amountFils, tx.type)}
          </div>

          {/* Desktop Hover Quick Actions (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity print:hidden">
            {!(isLockedDebt || isLockedCircle || isSystemLinked) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openDuplicate(tx)
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
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
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              aria-label="تعديل المعاملة"
              title="تعديل المعاملة"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {isLockedDebt ? (
              <Link
                to="/debts"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
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
                className="p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
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
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                aria-label="حذف المعاملة"
                title="حذف المعاملة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

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
    if (isCustomDateRange) {
      setIsCustomDateRange(false)
      setCustomDateFrom('')
      setCustomDateTo('')
    }
  }

  const isCustomDateActive = isCustomDateRange && Boolean(customDateFrom || customDateTo)
  const fetchAll = allMonths || isCustomDateActive
  const { data: rawTransactions, loading: txLoading } = useTransactions(fetchAll ? undefined : range)

  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    if (!txLoading) {
      hasLoadedOnceRef.current = true
    }
  }, [txLoading])
  const { data: categories } = useCategories()
  const { data: debts } = useDebts()
  const { data: circles } = useMoneyCircles()
  const { openAdd, openEdit, openDuplicate } = useTransactionModal()
  const { showToast } = useToast()
  const { config: currencyConfig } = useCurrency()
  const { data: userSettings } = useUserSettings()

  const circleIdsSet = useMemo(() => {
    return new Set(circles.map((c) => c.id))
  }, [circles])

  const circleRecurringIdsSet = useMemo(() => {
    const set = new Set<string>()
    for (const c of circles) {
      if (c.recurringId) {
        set.add(c.recurringId)
      }
    }
    return set
  }, [circles])

  const debtLookup = useMemo(() => {
    const debtIdsSet = new Set<string>()
    const entryTxIdsSet = new Set<string>()
    const paymentByTxIdMap = new Map<string, { debt: Debt; payment: Debt['payments'][number] }>()

    for (const d of debts) {
      debtIdsSet.add(d.id)
      if (d.entries) {
        for (const e of d.entries) {
          if (e.transactionId) entryTxIdsSet.add(e.transactionId)
          entryTxIdsSet.add(`debt_entry_${e.id}`)
        }
      }
      if (d.payments) {
        for (const p of d.payments) {
          const item = { debt: d, payment: p }
          if (p.transactionId) paymentByTxIdMap.set(p.transactionId, item)
          paymentByTxIdMap.set(`debt_pay_${p.id}`, item)
          if (Array.isArray(p.mergedTransactionIds)) {
            for (const mid of p.mergedTransactionIds) {
              if (mid) paymentByTxIdMap.set(mid, item)
            }
          }
        }
      }
    }

    return {
      debtIdsSet,
      entryTxIdsSet,
      paymentByTxIdMap,
    }
  }, [debts])

  const debtTransactionIdsSet = useMemo(() => {
    const set = new Set<string>()
    for (const key of debtLookup.entryTxIdsSet) set.add(key)
    for (const key of debtLookup.paymentByTxIdMap.keys()) set.add(key)
    return set
  }, [debtLookup])

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
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
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
  const linkedDebtPayment = txToDelete?.id ? debtLookup.paymentByTxIdMap.get(txToDelete.id) ?? null : null

  // Automatically reset to page 1 during render whenever filters change
  const currentFilterKey = `${fetchAll ? 'all' : range.start.getTime()}_${deferredQuery}_${filterType}_${selectedCategories.join(',')}_${selectedSource}_${isCustomDateRange}_${customDateFrom}_${customDateTo}_${sortBy}`
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey)
    setCurrentPage(1)
  }

  const activeAdvancedFiltersCount =
    (allMonths ? 1 : 0) +
    (isCustomDateRange ? 1 : 0) +
    (selectedSource !== 'all' ? 1 : 0) +
    (selectedCategories.length > 0 && !selectedCategories.includes('all') ? selectedCategories.length : 0)

  const isFilterActive = Boolean(
    query.trim() ||
    filterType !== 'all' ||
    (selectedCategories.length > 0 && !selectedCategories.includes('all')) ||
    selectedSource !== 'all' ||
    isCustomDateRange ||
    allMonths
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
    setIsMobileSearchOpen(false)
    setIsMobileFiltersOpen(false)
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
      return !c.archived || usedCategoryIds.has(c.id) || selectedCategories.includes(c.id)
    })
    return sortCategoriesUnified(filtered, usageMap, userSettings?.categorySortMode || 'usage')
  }, [categories, filterType, usageMap, rawTransactions, userSettings?.categorySortMode, selectedCategories])

  // Filtered transactions (using deferredQuery to prevent keyboard lag on mobile)
  const filteredTransactions = useMemo(() => {
    return filterTransactions(
      rawTransactions,
      {
        query: deferredQuery,
        type: filterType,
        categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
        sourceType: selectedSource,
        circleRecurringIdsSet,
        debtTransactionIdsSet,
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
    circleRecurringIdsSet,
    debtTransactionIdsSet,
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

  const allDaysNetMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of filteredTransactions) {
      const d = tx.date instanceof Date ? tx.date : new Date(tx.date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`
      const diff = tx.type === 'income' ? tx.amountFils : -tx.amountFils
      map.set(dateKey, (map.get(dateKey) || 0) + diff)
    }
    return map
  }, [filteredTransactions])

  const [isPrinting, setIsPrinting] = useState(false)

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true)
    const handleAfterPrint = () => setIsPrinting(false)
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedTransactions = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return sortedTransactions.slice(start, start + PAGE_SIZE)
  }, [sortedTransactions, safeCurrentPage])

  const displayedTransactions = isPrinting ? sortedTransactions : paginatedTransactions

  const dayGroups = useMemo(() => {
    if (sortBy === 'highest' || sortBy === 'lowest') {
      return []
    }
    const sortDirection = sortBy === 'oldest' ? 'asc' : 'desc'
    const sourceTxs = isPrinting ? sortedTransactions : paginatedTransactions
    const rawGroups = groupByDay(sourceTxs, sortDirection)
    return rawGroups.map((group) => {
      return {
        ...group,
        dayNetFils: allDaysNetMap.get(group.dateKey) ?? 0,
      }
    })
  }, [isPrinting, sortedTransactions, paginatedTransactions, sortBy, allDaysNetMap])

  const transactionListRef = useRef<HTMLDivElement>(null)

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    if (typeof window !== 'undefined') {
      transactionListRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleExportCsv = () => {
    if (sortedTransactions.length === 0) {
      showToast('لا توجد معاملات لتصديرها', 'info')
      return
    }
    exportTransactionsToCsv(sortedTransactions, categories, {
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

  const circleInstallmentToDelete = useMemo(() => {
    if (!txToDelete) return null
    const match = txToDelete.id.match(/^circle_(.+)_m(\d+)$/)
    if (match) {
      const c = circles.find((circle) => circle.id === match[1])
      return { name: c?.name || 'الجمعية' }
    }
    if (txToDelete.recurringId) {
      const c = circles.find((circle) => circle.recurringId === txToDelete.recurringId)
      if (c) return { name: c.name || 'الجمعية' }
    }
    return null
  }, [txToDelete, circles])

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
      const debtExists = Boolean(
        (debtId && debtLookup.debtIdsSet.has(debtId)) ||
          debtLookup.entryTxIdsSet.has(txToDelete.id)
      )
      if (debtExists) {
        showToast('لا يمكن حذف معاملة أصل الدين من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.', 'error')
        setTxToDelete(null)
        return
      }
    }
    if (txToDelete.id.startsWith('debt_entry_')) {
      const isDebtEntryExists = debtLookup.entryTxIdsSet.has(txToDelete.id)
      if (isDebtEntryExists) {
        showToast('لا يمكن حذف معاملة السلفة الإضافية من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.', 'error')
        setTxToDelete(null)
        return
      }
    }
    if (txToDelete.id.startsWith('circle_payout_')) {
      const circleId = txToDelete.id.replace('circle_payout_', '')
      const circleExists = Boolean(circleId && circleIdsSet.has(circleId))
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
    const isDebtInitOrEntry = tx.id.startsWith('debt_init_') || tx.id.startsWith('debt_entry_')
    const rawName = cat?.name ?? 'غير مصنف'
    const name = isDebtInitOrEntry && rawName === 'سداد الديون والأقساط' ? 'الديون والسلف' : rawName
    const isExpense = tx.type === 'expense'
    const hasTitle = Boolean(tx.title?.trim())
    const hasNote = Boolean(tx.note?.trim())
    const primaryLabel = tx.title?.trim() || tx.note?.trim() || name
    const showCategoryInSub = hasTitle || hasNote
    const showNoteInSub = hasTitle && hasNote && tx.note.trim() !== tx.title!.trim()

    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const txTime = tx.createdAt ? (tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt)) : txDate
    const timeDisplay = toWesternDigits(formatDate(txTime, 'hh:mm a', { locale: ar }))

    const linkedPaymentItem = debtLookup.paymentByTxIdMap.get(tx.id)
    const isMergedDebtPayment = Boolean(linkedPaymentItem?.payment?.isMerged)

    const isDebtInit = tx.id.startsWith('debt_init_')
    const debtId = isDebtInit ? tx.id.replace('debt_init_', '') : null
    const isDebtExists = Boolean(
      (debtId && debtLookup.debtIdsSet.has(debtId)) ||
        debtLookup.entryTxIdsSet.has(tx.id)
    )

    const isDebtEntry = tx.id.startsWith('debt_entry_')
    const isDebtEntryExists = Boolean(
      isDebtEntry && debtLookup.entryTxIdsSet.has(tx.id)
    )

    const isCirclePayout = tx.id.startsWith('circle_payout_')
    const circleId = isCirclePayout ? tx.id.replace('circle_payout_', '') : null
    const isCircleExists = Boolean(
      isCirclePayout && circleId && circleIdsSet.has(circleId)
    )

    const isLockedDebt =
      (isDebtInit && isDebtExists) || isDebtEntryExists || isMergedDebtPayment
    const isLockedCircle = isCirclePayout && isCircleExists
    const isSystemLinked =
      tx.id.startsWith('debt_') ||
      tx.id.startsWith('circle_') ||
      Boolean(tx.note?.includes('تسوية رصيد'))

    return (
      <TransactionRowItem
        key={tx.id}
        tx={tx}
        showDateBadge={showDateBadge}
        cat={cat}
        isExpense={isExpense}
        primaryLabel={primaryLabel}
        timeDisplay={timeDisplay}
        name={name}
        showCategoryInSub={showCategoryInSub}
        showNoteInSub={showNoteInSub}
        isLockedDebt={isLockedDebt}
        isLockedCircle={isLockedCircle}
        isMergedDebtPayment={isMergedDebtPayment}
        isSystemLinked={isSystemLinked}
        circleRecurringIdsSet={circleRecurringIdsSet}
        openEdit={openEdit}
        openDuplicate={openDuplicate}
        setTxToDelete={setTxToDelete}
      />
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start print:block">
        {/* Sidebar Column: Filter Bar & Monthly Totals */}
        <aside className="lg:col-span-4 space-y-3.5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar print-hide">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-[#121215] p-3 sm:p-3.5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none space-y-3 print-hide">
            {/* Top Permanent Row: Type Segmented Control + Mobile Search & Filter Action Buttons */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
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
                  className="w-full"
                  size="sm"
                />
              </div>

              {/* Mobile Only: Search & Filter Buttons */}
              <div className="lg:hidden flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSearchOpen((prev) => {
                      const next = !prev
                      if (next) setTimeout(() => searchInputRef.current?.focus(), 50)
                      return next
                    })
                  }}
                  aria-label="فتح البحث"
                  className={cn(
                    'w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer',
                    isMobileSearchOpen || query.trim()
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A]'
                  )}
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
                  aria-label="الفلاتر المتقدمة"
                  className={cn(
                    'relative w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer',
                    isMobileFiltersOpen || activeAdvancedFiltersCount > 0
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A]'
                  )}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {activeAdvancedFiltersCount > 0 && (
                    <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                      {activeAdvancedFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Search Input (Hidden on mobile unless opened or has query, always visible on desktop) */}
            <div className={cn('relative', !isMobileSearchOpen && !query.trim() && 'hidden lg:block')}>
              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-zinc-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في العنوان، الملاحظات، التصنيف، أو المبلغ..."
                className="w-full ps-9 pe-8 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-zinc-50 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-base sm:text-sm focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
              />
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="مسح نص البحث"
                  className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort Selector — Stays outside the collapsed advanced filters, always visible */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
              <span className="font-bold text-zinc-500 dark:text-zinc-400 text-[11px]">ترتيب حسب:</span>
              <div className="w-40">
                <Select
                  aria-label="ترتيب حسب"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as TransactionSortOption)
                    setCurrentPage(1)
                  }}
                  options={[
                    { value: 'newest', label: 'الأحدث أولاً' },
                    { value: 'oldest', label: 'الأقدم أولاً' },
                    { value: 'highest', label: 'الأعلى قيمة' },
                    { value: 'lowest', label: 'الأقل قيمة' },
                  ]}
                  className="text-xs font-bold"
                />
              </div>
            </div>

            {/* Advanced Filters Panel (Collapsible on mobile, always visible on desktop) */}
            <div className={cn('space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800', !isMobileFiltersOpen && 'hidden lg:block')}>
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
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs dark:shadow-none'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
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
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs dark:shadow-none'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                    )}
                    title="فلترة المعاملات ضمن نطاق زمني مخصص"
                    aria-pressed={isCustomDateRange}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>فترة مخصصة</span>
                  </button>
                </div>

                {isCustomDateRange && (
                  <div className="space-y-2 pt-2.5 border-t border-[#E4E4E7] dark:border-[#27272A]">
                    <div className="grid grid-cols-2 gap-2">
                      <DatePickerInput
                        id="tx-custom-from"
                        label="من تاريخ"
                        value={customDateFrom}
                        max={customDateTo || undefined}
                        onChange={(val) => {
                          setCustomDateFrom(val)
                          setCurrentPage(1)
                        }}
                      />
                      <DatePickerInput
                        id="tx-custom-to"
                        label="إلى تاريخ"
                        value={customDateTo}
                        min={customDateFrom || undefined}
                        popoverAlign="end"
                        onChange={(val) => {
                          setCustomDateTo(val)
                          setCurrentPage(1)
                        }}
                      />
                    </div>
                    {customDateFrom && customDateTo && customDateFrom > customDateTo ? (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                        تاريخ البداية يجب أن يسبق أو يطابق تاريخ النهاية.
                      </p>
                    ) : !customDateFrom && !customDateTo ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                        حدد تاريخ البداية والنهاية لتطبيق الفلترة المخصصة.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Source Filter Chips */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  المصدر
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 select-none text-xs no-scrollbar">
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
                            ? 'bg-blue-600 text-white shadow-2xs dark:shadow-none font-bold'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
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
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    التصنيفات
                  </label>
                  {selectedCategories.length > 0 && !selectedCategories.includes('all') && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                      ({selectedCategories.length} محدد)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="flex items-center gap-1.5 overflow-x-auto lg:overflow-visible flex-nowrap lg:flex-wrap pb-1 pt-0.5 select-none text-xs no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategories([])
                        setCurrentPage(1)
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer',
                        selectedCategories.length === 0 || selectedCategories.includes('all')
                          ? 'bg-blue-600 text-white shadow-2xs dark:shadow-none font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
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
                              ? 'bg-blue-600 text-white shadow-2xs dark:shadow-none font-bold'
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
            </div>
          </div>

          {/* All Months Indicator Banner */}
          {allMonths && (
            <div className="flex items-center justify-between gap-2.5 px-3.5 py-2 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-xs text-blue-800 dark:text-blue-300 shadow-2xs dark:shadow-none print-hide">
              <div className="flex items-center gap-2 min-w-0 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="truncate">وضع البحث في كامل السجل (كل الأشهر) مفعّل حالياً</span>
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
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-xs shadow-2xs dark:shadow-none print-hide">
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
          <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] bg-white dark:bg-[#121215] p-3.5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none">
            <div className="px-2">
              <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate mb-1">
                {allMonths ? 'إجمالي المداخيل (كافة الأشهر)' : 'إجمالي المداخيل'}
              </div>
              <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 truncate">
                <FormattedMoney amountFils={totals.income} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            <div className="px-2 ps-3.5">
              <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate mb-1">
                {allMonths ? 'إجمالي المصاريف (كافة الأشهر)' : 'إجمالي المصاريف'}
              </div>
              <div className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 truncate">
                <FormattedMoney amountFils={totals.expense} className="text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Column: Transactions List */}
        <main className="lg:col-span-8 print:w-full space-y-4">
          {/* Print-only Header */}
          <div className="hidden print:block mb-4 p-4 border border-zinc-300 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-extrabold text-zinc-900">تقرير المعاملات المالية</h1>
              <span className="text-xs text-zinc-600 font-medium">
                {allMonths ? 'كافة الأشهر' : formatFinancialMonthLabel(range, userSettings?.monthStartDay || 1)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs border-t border-zinc-200 pt-2 font-medium">
              <div>إجمالي المداخيل: <strong className="text-emerald-600"><FormattedMoney amountFils={totals.income} /></strong></div>
              <div>إجمالي المصاريف: <strong className="text-red-600"><FormattedMoney amountFils={totals.expense} /></strong></div>
              <div>صافي الرصيد: <strong className={totals.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}><FormattedMoney amountFils={totals.balance} withSign="auto" /></strong></div>
            </div>
          </div>

          {txLoading && rawTransactions.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] animate-pulse"
                />
              ))}
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="w-6 h-6" />}
              title={
                isFilterActive
                  ? 'لا توجد معاملات مطابقة للبحث أو الفلترة'
                  : 'لا توجد معاملات لهذا الشهر'
              }
              description={
                isFilterActive
                  ? 'لم نجد أي معاملات تطابق معايير الفلترة أو البحث المحددة. جرب تغيير كلمات البحث أو مسح الفلاتر.'
                  : allMonths
                    ? 'لم يتم تسجيل أي معاملات في كامل السجل حتى الآن.'
                    : 'ابدأ بتسجيل مصاريفك أو مداخيلك لهذا الشهر لمتابعة ميزانيتك أولاً بأول.'
              }
              action={
                isFilterActive ? (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleResetFilters}
                  >
                    مسح كافة الفلاتر
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                    onClick={() => openAdd('expense')}
                  >
                    إضافة معاملة
                  </Button>
                )
              }
            />
          ) : (
            <div ref={transactionListRef} className="space-y-5 scroll-mt-20">
              {/* Flat list for amount-based sorting */}
              {sortBy === 'highest' || sortBy === 'lowest' ? (
                <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none divide-y divide-[#E4E4E7] dark:divide-[#27272A] overflow-hidden">
                  {displayedTransactions.map((tx) => renderTransactionRow(tx, true))}
                </div>
              ) : (
                /* Grouped by day for date-based sorting */
                dayGroups.map((group) => {
                  const dayNetFils = group.dayNetFils

                  return (
                    <div key={group.dateKey} className="space-y-2">
                      {/* Day Header with clearly displayed net spend */}
                      <div className="flex items-center justify-between px-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDayHeader(group.date, today)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">صافي اليوم:</span>
                          <span
                            className={cn(
                              'font-extrabold text-xs select-none',
                              dayNetFils > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : dayNetFils < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-zinc-400'
                            )}
                          >
                            <FormattedMoney amountFils={dayNetFils} withSign="auto" />
                          </span>
                        </div>
                      </div>

                      {/* Transactions in this day */}
                      <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none divide-y divide-[#E4E4E7] dark:divide-[#27272A] overflow-hidden">
                        {group.transactions.map((tx) => renderTransactionRow(tx, false))}
                      </div>
                    </div>
                  )
                })
              )}

              {/* Pagination Controls */}
              {!isPrinting && totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none text-xs font-semibold print-hide">
                  <div className="text-zinc-500 dark:text-zinc-400">
                    صفحة <span className="font-bold text-zinc-800 dark:text-zinc-200">{safeCurrentPage}</span> من{' '}
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{totalPages}</span>
                    <span className="ms-1.5 text-[11px] text-zinc-400">
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
          {circleInstallmentToDelete && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>تنبيه: هذه المعاملة مرتبطة بقسط جمعية</span>
              </div>
              <p className="leading-relaxed text-[11px] text-amber-700/90 dark:text-amber-300/80">
                هذه المعاملة مرتبطة بقسط في <strong>{circleInstallmentToDelete.name}</strong>. عند تأكيد الحذف، سيتم تحويل حالة القسط تلقائياً إلى "غير مسدد" في جدول الجمعية للحفاظ على دقة الحسابات.
              </p>
            </div>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
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
