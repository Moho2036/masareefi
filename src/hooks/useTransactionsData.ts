import { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from './useAuth'
import { useCategories } from './useCategories'
import { useTransactions } from './useTransactions'
import { useDebts } from './useDebts'
import { useMoneyCircles } from './useMoneyCircles'
import { useSelectedMonth } from './useSelectedMonth'
import { useTransactionModal } from './useTransactionModal'
import { useToast } from './useToast'
import { useCurrency } from './useCurrency'
import { useUserSettings } from './useUserSettings'
import { useTransactionDeletion } from './useTransactionDeletion'
import { useWindowFocusAndPrint } from './useWindowFocusAndPrint'
import { buildDebtLookup, buildDebtTxIdsSet } from '../lib/transactionLocks'
import { parseLocalDateInput } from '../lib/dates'
import { exportTransactionsToCsv } from '../lib/exportCsv'
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
import type { TxType } from '../types'

const PAGE_SIZE = 30

export function useTransactionsData() {
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
    if (allMonths) setAllMonths(false)
    if (isCustomDateRange) {
      setIsCustomDateRange(false)
      setCustomDateFrom('')
      setCustomDateTo('')
    }
  }

  const isCustomDateActive = isCustomDateRange && Boolean(customDateFrom || customDateTo)
  const fetchAll = allMonths || isCustomDateActive
  const { data: rawTransactions, loading: txLoading } = useTransactions(fetchAll ? undefined : range)

  const { data: categories } = useCategories()
  const { data: debts } = useDebts()
  const { data: circles } = useMoneyCircles()
  const { openAdd, openEdit, openDuplicate } = useTransactionModal()
  const { showToast } = useToast()
  const { config: currencyConfig } = useCurrency()
  const { data: userSettings } = useUserSettings()

  const circleIdsSet = useMemo(() => new Set(circles.map((c) => c.id)), [circles])

  const circleRecurringIdsSet = useMemo(() => {
    const set = new Set<string>()
    for (const c of circles) {
      if (c.recurringId) set.add(c.recurringId)
    }
    return set
  }, [circles])

  const debtLookup = useMemo(() => buildDebtLookup(debts), [debts])
  const debtTransactionIdsSet = useMemo(() => buildDebtTxIdsSet(debtLookup), [debtLookup])

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [filterType, setFilterType] = useState<TxType | 'all'>(() => {
    const typeParam = searchParams.get('type')
    return typeParam === 'income' || typeParam === 'expense' ? typeParam : 'all'
  })
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get('categoryId')
    return cat ? [cat] : []
  })
  const [selectedSource, setSelectedSource] = useState<'all' | 'manual' | 'recurring' | 'debt' | 'circle'>('all')
  const [sortBy, setSortBy] = useState<TransactionSortOption>('newest')
  const [currentPage, setCurrentPage] = useState(1)
  const [prevFilterKey, setPrevFilterKey] = useState('')

  // URL search params sync
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams.toString())
  if (prevSearchParams !== searchParams.toString()) {
    setPrevSearchParams(searchParams.toString())
    const typeParam = searchParams.get('type')
    if (typeParam === 'income' || typeParam === 'expense') setFilterType(typeParam)
    const cat = searchParams.get('categoryId')
    if (cat) setSelectedCategories([cat])
    if (searchParams.get('allMonths') === 'true') setAllMonths(true)
  }

  // Deletion hook
  const {
    txToDelete,
    setTxToDelete,
    deleting,
    linkedDebtPayment,
    linkedDebtInit,
    linkedDebtEntry,
    circleInstallmentToDelete,
    handleDeleteConfirm,
  } = useTransactionDeletion({
    userId: user?.uid,
    circles,
    debtLookup,
    circleIdsSet,
    showToast,
  })

  // Window focus & print state
  const { focusTick, isPrinting } = useWindowFocusAndPrint()

  // Auto-reset page on filter change
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
  }

  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev.filter((id) => id !== 'all'), catId]
    )
  }

  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const usageMap = useMemo(() => {
    if (allMonths) return buildUsageFromTransactions(rawTransactions)
    return getCategoryUsageMap()
  }, [allMonths, rawTransactions])

  useEffect(() => {
    if (allMonths && !txLoading) {
      syncCategoryUsageCache(rawTransactions)
    }
  }, [allMonths, rawTransactions, txLoading])

  const relevantCategories = useMemo(() => {
    const usedCategoryIds = new Set(rawTransactions.map((tx) => tx.categoryId))
    const filtered = categories.filter((c) => {
      const matchesType = filterType === 'all' ? true : c.type === filterType
      if (!matchesType) return false
      return !c.archived || usedCategoryIds.has(c.id) || selectedCategories.includes(c.id)
    })
    return sortCategoriesUnified(filtered, usageMap, userSettings?.categorySortMode || 'usage')
  }, [categories, filterType, usageMap, rawTransactions, userSettings?.categorySortMode, selectedCategories])

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

  const totals = useMemo(() => sumByType(filteredTransactions), [filteredTransactions])
  const sortedTransactions = useMemo(() => sortTransactions(filteredTransactions, sortBy), [filteredTransactions, sortBy])

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

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedTransactions = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return sortedTransactions.slice(start, start + PAGE_SIZE)
  }, [sortedTransactions, safeCurrentPage])

  const displayedTransactions = isPrinting ? sortedTransactions : paginatedTransactions

  const dayGroups = useMemo(() => {
    if (sortBy === 'highest' || sortBy === 'lowest') return []
    const sortDirection = sortBy === 'oldest' ? 'asc' : 'desc'
    const sourceTxs = isPrinting ? sortedTransactions : paginatedTransactions
    const rawGroups = groupByDay(sourceTxs, sortDirection)
    return rawGroups.map((group) => ({
      ...group,
      dayNetFils: allDaysNetMap.get(group.dateKey) ?? 0,
    }))
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
      allMonths ? 'تم تصدير المعاملات المحددة لكافة الأشهر بنجاح' : 'تم تصدير المعاملات المحددة بنجاح',
      'success'
    )
  }

  return {
    // Range & Settings
    range,
    userSettings,
    allMonths,
    setAllMonths,
    isCustomDateRange,
    setIsCustomDateRange,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    // Filters & Sorting
    filterType,
    setFilterType,
    query,
    setQuery,
    sortBy,
    setSortBy,
    selectedSource,
    setSelectedSource,
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
    relevantCategories,
    isFilterActive,
    handleResetFilters,
    // Data & Totals
    rawTransactions,
    txLoading,
    filteredTransactions,
    totals,
    categoryMap,
    debtLookup,
    circleIdsSet,
    circleRecurringIdsSet,
    // Pagination & List
    dayGroups,
    displayedTransactions,
    paginatedTransactions,
    totalPages,
    safeCurrentPage,
    handlePageChange,
    transactionListRef,
    today,
    isPrinting,
    // Deletion
    txToDelete,
    setTxToDelete,
    deleting,
    linkedDebtPayment,
    linkedDebtInit,
    linkedDebtEntry,
    circleInstallmentToDelete,
    handleDeleteConfirm,
    // Actions
    handleExportCsv,
    openAdd,
    openEdit,
    openDuplicate,
    setCurrentPage,
  }
}
