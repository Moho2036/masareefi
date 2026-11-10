import { useState, useEffect, useRef, useMemo, useContext } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { AppDataContext } from '../../context/AppDataContext'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useCategories } from '../../hooks/useCategories'
import { useDebts } from '../../hooks/useDebts'
import { useMoneyCircles } from '../../hooks/useMoneyCircles'
import { useRecurring } from '../../hooks/useRecurring'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { useTransactions } from '../../hooks/useTransactions'
import { useToast } from '../../hooks/useToast'
import { useCurrency } from '../../hooks/useCurrency'
import { fromFils } from '../../lib/money'
import { formatDateInput, toWesternDigits } from '../../lib/dates'
import { normalizeArabic } from '../../lib/aggregate'
import {
  getCategoryUsageMap,
  sortCategoriesUnified,
  buildUsageFromTransactions,
  mergeUsageMaps,
} from '../../lib/categoryUsage'
import { calculateForecast } from '../../lib/forecast'
import { resolveTransactionLockStatus } from '../../lib/transactionLocks'
import { useTransactionSubmitHandlers } from './useTransactionSubmitHandlers'
import type { Transaction, TxType, Frequency } from '../../types'

export interface UseTransactionFormStateProps {
  initialTransaction?: Transaction | null
  duplicateFrom?: Transaction | null
  initialType?: TxType
  isSourceDeleted?: boolean
  onClose: () => void
  onSuccess?: () => void
  onDuplicate?: (tx: Transaction) => void
  onDirtyChange?: (isDirty: boolean) => void
}

export function useTransactionFormState({
  initialTransaction,
  duplicateFrom,
  initialType = 'expense',
  isSourceDeleted,
  onClose,
  onSuccess,
  onDuplicate,
  onDirtyChange,
}: UseTransactionFormStateProps) {
  const { user } = useAuth()
  const appData = useContext(AppDataContext)
  const { data: userSettings } = useUserSettings()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const { data: debts } = useDebts()
  const { data: circles } = useMoneyCircles()
  const { data: recurringList } = useRecurring()
  const { setSelectedDate, range } = useSelectedMonth()
  const { data: monthTransactions } = useTransactions(range)
  const { showToast } = useToast()
  const { config: currencyConfig } = useCurrency()

  const isEditing = Boolean(initialTransaction)

  const lockStatus = useMemo(() => {
    return resolveTransactionLockStatus(initialTransaction, debts, circles, isSourceDeleted)
  }, [initialTransaction, debts, circles, isSourceDeleted])

  const {
    isLocked: isLockedTransaction,
    isLinkedToDebtPayment,
    circleInstallmentMonth,
    linkedCircleInstallment,
  } = lockStatus

  const [duplicateCleared, setDuplicateCleared] = useState(false)
  const activeDuplicateFrom = duplicateCleared ? null : duplicateFrom
  const isActualDuplicate = Boolean(
    activeDuplicateFrom &&
    typeof activeDuplicateFrom.id === 'string' &&
    activeDuplicateFrom.id.trim().length > 0
  )
  const amountInputRef = useRef<HTMLInputElement>(null)

  const [type, setType] = useState<TxType>(() => {
    if (initialTransaction) return initialTransaction.type
    if (duplicateFrom) return duplicateFrom.type
    return initialType
  })

  const [amountStr, setAmountStr] = useState<string>(() => {
    if (initialTransaction) return String(fromFils(initialTransaction.amountFils))
    if (duplicateFrom) return String(fromFils(duplicateFrom.amountFils))
    return ''
  })

  const [categoryId, setCategoryId] = useState<string>(() => {
    if (initialTransaction) return initialTransaction.categoryId
    if (duplicateFrom) return duplicateFrom.categoryId
    return ''
  })

  const isBrowsingDifferentMonth = useMemo(() => {
    if (initialTransaction) return false
    const now = new Date()
    return now < range.start || now >= range.end
  }, [initialTransaction, range])

  const [dateStr, setDateStr] = useState<string>(() => {
    if (initialTransaction?.date) {
      const d =
        initialTransaction.date instanceof Date
          ? initialTransaction.date
          : new Date(initialTransaction.date)
      return formatDateInput(d)
    }
    const now = new Date()
    const isWithinRange = now >= range.start && now < range.end
    return formatDateInput(isWithinRange ? now : range.start)
  })

  const [title, setTitle] = useState<string>(
    initialTransaction?.title ?? duplicateFrom?.title ?? ''
  )
  const [note, setNote] = useState<string>(
    initialTransaction?.note ?? duplicateFrom?.note ?? ''
  )
  const [showNoteField, setShowNoteField] = useState<boolean>(() =>
    Boolean(initialTransaction?.note || duplicateFrom?.note)
  )
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<Frequency>('monthly')
  const [showExtraFrequencyDropdown, setShowExtraFrequencyDropdown] = useState(false)
  const [hasEndDate, setHasEndDate] = useState(false)
  const [endDateStr, setEndDateStr] = useState('')
  const [scheduleNextIfPast, setScheduleNextIfPast] = useState(false)
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false)
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const lastDirtyRef = useRef<boolean | null>(null)

  useEffect(() => {
    const isDirty = Boolean(
      initialTransaction ||
        duplicateFrom ||
        amountStr.trim() ||
        title.trim() ||
        note.trim()
    )
    if (lastDirtyRef.current !== isDirty) {
      lastDirtyRef.current = isDirty
      onDirtyChange?.(isDirty)
    }
  }, [onDirtyChange, initialTransaction, duplicateFrom, amountStr, title, note])

  const usageMap = useMemo(() => {
    if (monthTransactions && monthTransactions.length > 0) {
      return mergeUsageMaps(buildUsageFromTransactions(monthTransactions))
    }
    return getCategoryUsageMap()
  }, [monthTransactions])

  const originalCatId = initialTransaction?.categoryId || duplicateFrom?.categoryId
  const availableCategories = useMemo(() => {
    const filtered = categories.filter(
      (c) => (c.type === type && !c.archived) || c.id === originalCatId
    )
    return sortCategoriesUnified(
      filtered,
      usageMap,
      userSettings?.categorySortMode || 'usage'
    )
  }, [categories, type, usageMap, originalCatId, userSettings?.categorySortMode])

  const activeCategoryId = categoryId || (availableCategories[0]?.id ?? '')
  const isSelectedCategoryMissing =
    Boolean(activeCategoryId) &&
    !categories.some((c) => c.id === activeCategoryId)

  const displayedCategories = useMemo(() => {
    if (isCategoriesExpanded || availableCategories.length <= 6) {
      return availableCategories
    }
    const top6 = availableCategories.slice(0, 6)
    if (activeCategoryId && !top6.some((c) => c.id === activeCategoryId)) {
      const selected = availableCategories.find((c) => c.id === activeCategoryId)
      if (selected) {
        return [...availableCategories.slice(0, 5), selected]
      }
    }
    return top6
  }, [availableCategories, isCategoriesExpanded, activeCategoryId])

  const forecast = useMemo(() => {
    if (type !== 'expense') return null
    const isRolloverEnabled = userSettings?.rolloverBalance ?? true
    const openingFils = userSettings?.openingBalanceFils ?? 0
    const effectiveRollover =
      isRolloverEnabled || openingFils > 0
        ? (appData?.rolloverBalanceFils ?? openingFils)
        : undefined

    return calculateForecast({
      transactions: monthTransactions || [],
      recurring: recurringList || [],
      debts: debts || [],
      monthStartDay: userSettings?.monthStartDay ?? 1,
      periodRange: range,
      rolloverBalanceFils: effectiveRollover,
    })
  }, [
    type,
    monthTransactions,
    recurringList,
    debts,
    userSettings?.monthStartDay,
    userSettings?.rolloverBalance,
    userSettings?.openingBalanceFils,
    range,
    appData?.rolloverBalanceFils,
  ])

  const titleSuggestions = useMemo(() => {
    if (!monthTransactions || monthTransactions.length === 0) return []
    const sample = monthTransactions.slice(0, 50)
    const matching = sample.filter(
      (t) =>
        t.type === type &&
        t.title &&
        t.title.trim() &&
        !t.id.startsWith('debt_') &&
        !t.id.startsWith('circle_')
    )
    const uniqueMap = new Map<string, { title: string; categoryId: string }>()
    const cleanCurrentTitle = normalizeArabic(toWesternDigits(title.trim()))

    for (const t of matching) {
      const tTitle = t.title!.trim()
      const cleanTTitle = normalizeArabic(toWesternDigits(tTitle))
      if (cleanCurrentTitle) {
        if (cleanTTitle.includes(cleanCurrentTitle) && cleanTTitle !== cleanCurrentTitle) {
          if (!uniqueMap.has(tTitle)) {
            uniqueMap.set(tTitle, { title: tTitle, categoryId: t.categoryId })
          }
        }
      } else {
        if (!uniqueMap.has(tTitle)) {
          uniqueMap.set(tTitle, { title: tTitle, categoryId: t.categoryId })
        }
      }
      if (uniqueMap.size >= 4) break
    }
    return Array.from(uniqueMap.values())
  }, [monthTransactions, type, title])

  const {
    handleSubmit,
    handleSaveAndAddAnother,
    handleDelete,
    handleDuplicateCurrent,
  } = useTransactionSubmitHandlers({
    user,
    initialTransaction,
    isEditing,
    isActualDuplicate,
    lockStatus,
    isSourceDeleted,
    type,
    amountStr,
    setAmountStr,
    activeCategoryId,
    dateStr,
    title,
    setTitle,
    note,
    setNote,
    isRecurring,
    setIsRecurring,
    recurringFrequency,
    hasEndDate,
    endDateStr,
    scheduleNextIfPast,
    range,
    setSelectedDate,
    currencyConfig,
    setError,
    setSubmitting,
    setDeleting,
    setDuplicateCleared,
    amountInputRef,
    showToast,
    onSuccess,
    onClose,
    onDuplicate,
  })

  return {
    isEditing,
    lockStatus,
    isLockedTransaction,
    isLinkedToDebtPayment,
    circleInstallmentMonth,
    linkedCircleInstallment,
    isActualDuplicate,
    amountInputRef,
    type,
    setType,
    amountStr,
    setAmountStr,
    categoryId,
    setCategoryId,
    isBrowsingDifferentMonth,
    range,
    dateStr,
    setDateStr,
    title,
    setTitle,
    note,
    setNote,
    showNoteField,
    setShowNoteField,
    isRecurring,
    setIsRecurring,
    recurringFrequency,
    setRecurringFrequency,
    showExtraFrequencyDropdown,
    setShowExtraFrequencyDropdown,
    hasEndDate,
    setHasEndDate,
    endDateStr,
    setEndDateStr,
    scheduleNextIfPast,
    setScheduleNextIfPast,
    isCategoriesExpanded,
    setIsCategoriesExpanded,
    isCreateCatOpen,
    setIsCreateCatOpen,
    error,
    setError,
    submitting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleting,
    categoriesLoading,
    availableCategories,
    displayedCategories,
    activeCategoryId,
    isSelectedCategoryMissing,
    forecast,
    titleSuggestions,
    currencyConfig,
    handleSubmit,
    handleSaveAndAddAnother,
    handleDelete,
    handleDuplicateCurrent,
  }
}
