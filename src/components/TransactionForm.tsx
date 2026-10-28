import React, { useState, useRef, useMemo, useContext } from 'react'
import {
  Check,
  Trash2,
  AlertCircle,
  ArrowLeft,
  Copy,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router'
import { SegmentedControl } from './ui/SegmentedControl'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { DatePickerInput } from './ui/DatePickerInput'
import { Toggle } from './ui/Toggle'
import { CategoryIcon } from './ui/CategoryIcon'
import { CategoryForm } from './CategoryForm'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useDebts } from '../hooks/useDebts'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useToast } from '../hooks/useToast'
import { useCurrency } from '../hooks/useCurrency'
import { useUserSettings } from '../hooks/useUserSettings'
import { useRecurring } from '../hooks/useRecurring'
import { useTransactions } from '../hooks/useTransactions'
import { AppDataContext } from '../context/AppDataContext'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '../services/transactions'
import { addRecurring, processDueRecurring } from '../services/recurring'
import { updateDebtPayment, removeDebtPayment } from '../services/debts'
import { removeCircleInstallmentPayment } from '../services/moneyCircles'
import { toFils, fromFils, formatMoney } from '../lib/money'
import { parseLocalDateInput, formatDateInput, toWesternDigits } from '../lib/dates'
import { normalizeArabic } from '../lib/aggregate'
import { findLinkedDebtPayment } from '../lib/debts'
import {
  getCategoryUsageMap,
  recordCategoryUsage,
  sortCategoriesUnified,
} from '../lib/categoryUsage'
import { calculateForecast } from '../lib/forecast'
import { advanceDate } from '../lib/recurring'
import { cn } from '../lib/cn'
import type { Transaction, TxType, Frequency } from '../types'

function evaluateMathExpression(expr: string): number | null {
  if (!expr) return null
  const cleaned = expr.replace(/[^\d.+\-*/]/g, '').replace(/[+\-*/.]+$/, '')
  if (!cleaned) return null
  if (!/[+\-*/]/.test(cleaned)) {
    const num = Number(cleaned)
    return isNaN(num) ? null : num
  }
  try {
    const tokens = cleaned.match(/(\d+(?:\.\d+)?|[+\-*/])/g)
    if (!tokens || tokens.length === 0) return null

    const firstPass: (number | string)[] = []
    let i = 0
    while (i < tokens.length) {
      const tok = tokens[i]
      if (tok === '*' || tok === '/') {
        const prev = Number(firstPass.pop())
        const next = Number(tokens[++i])
        if (isNaN(prev) || isNaN(next)) return null
        if (tok === '/' && next === 0) return null
        firstPass.push(tok === '*' ? prev * next : prev / next)
      } else if (!isNaN(Number(tok))) {
        firstPass.push(Number(tok))
      } else {
        firstPass.push(tok)
      }
      i++
    }

    let result = typeof firstPass[0] === 'number' ? firstPass[0] : 0
    let j = 1
    while (j < firstPass.length) {
      const op = firstPass[j]
      const next = Number(firstPass[j + 1])
      if (isNaN(next)) break
      if (op === '+') result += next
      else if (op === '-') result -= next
      j += 2
    }
    return isFinite(result) ? result : null
  } catch {
    return null
  }
}

export interface TransactionFormProps {
  initialTransaction?: Transaction | null
  duplicateFrom?: Transaction | null
  initialType?: TxType
  onClose: () => void
  onSuccess?: () => void
  onDuplicate?: (tx: Transaction) => void
  isSourceDeleted?: boolean
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialTransaction,
  duplicateFrom,
  initialType = 'expense',
  onClose,
  onSuccess,
  onDuplicate,
  isSourceDeleted,
}) => {
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

  // Find linked debt payment if editing a debt payment transaction
  const linkedDebtPayment = findLinkedDebtPayment(initialTransaction?.id, debts)

  const isLinkedToDebtInit = Boolean(
    initialTransaction?.id && initialTransaction.id.startsWith('debt_init_')
  )
  const debtId = isLinkedToDebtInit && initialTransaction ? initialTransaction.id.replace('debt_init_', '') : null
  const isDebtExists = Boolean(debtId && debts.some((d) => d.id === debtId))

  const isLinkedToDebtPayment = Boolean(
    linkedDebtPayment ||
      (initialTransaction?.id &&
        initialTransaction.id.startsWith('debt_pay_') &&
        debts.some((d) =>
          (d.payments || []).some(
            (p) => p.id === initialTransaction.id.replace('debt_pay_', '') || p.transactionId === initialTransaction.id
          )
        ))
  )

  const isLinkedToCircle = Boolean(
    initialTransaction?.id && initialTransaction.id.startsWith('circle_payout_')
  )
  const circleId = isLinkedToCircle && initialTransaction ? initialTransaction.id.replace('circle_payout_', '') : null
  const isCircleExists = Boolean(
    isLinkedToCircle &&
      initialTransaction &&
      circles.some((c) => c.id === circleId || initialTransaction.id.startsWith(`circle_payout_${c.id}`))
  )

  const circleInstallmentMatch = initialTransaction?.id.match(/^circle_(.+)_m(\d+)$/)
  const isLinkedToCircleInstallment = Boolean(circleInstallmentMatch)
  const circleInstallmentId = circleInstallmentMatch ? circleInstallmentMatch[1] : null
  const circleInstallmentMonth = circleInstallmentMatch ? parseInt(circleInstallmentMatch[2], 10) : null
  const linkedCircleInstallment = circleInstallmentId ? circles.find((c) => c.id === circleInstallmentId) : null
  const isCircleInstallmentExists = Boolean(linkedCircleInstallment)

  const isMergedPaymentTx = Boolean(linkedDebtPayment?.payment?.isMerged)

  const isSourceMissing =
    isSourceDeleted ??
    ((isLinkedToDebtInit && !isDebtExists) || (isLinkedToCircle && !isCircleExists))

  // Only completely lock amount & date for debt_init_ and circle_payout_ if their source still exists!
  // Also completely lock merged debt payment transactions.
  // If the source debt/circle was deleted, the orphaned transaction is unlocked.
  const isLockedTransaction =
    !isSourceMissing && (isLinkedToDebtInit || isLinkedToCircle || isMergedPaymentTx)
  const [duplicateCleared, setDuplicateCleared] = useState(false)
  const activeDuplicateFrom = duplicateCleared ? null : duplicateFrom
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
  const [scheduleNextIfPast, setScheduleNextIfPast] = useState(true)
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false)
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Track category usage frequencies to prioritize top categories (read once on open)
  const usageMap = useMemo(() => getCategoryUsageMap(), [])

  // Filter & sort available categories for current transaction type
  // Preserve current transaction's category even if archived
  const originalCatId = initialTransaction?.categoryId || duplicateFrom?.categoryId
  const availableCategories = useMemo(() => {
    const filtered = categories.filter(
      (c) => c.type === type && (!c.archived || c.id === originalCatId)
    )
    return sortCategoriesUnified(
      filtered,
      usageMap,
      userSettings?.categorySortMode || 'usage'
    )
  }, [categories, type, usageMap, originalCatId, userSettings?.categorySortMode])

  // Compute the effectively selected category ID:
  // If user selected one that belongs to available categories, use it.
  // Otherwise, fallback to the top (most frequent) available category.
  const activeCategoryId =
    categoryId && availableCategories.some((c) => c.id === categoryId)
      ? categoryId
      : availableCategories[0]?.id ?? ''

  // Foldable categories grid: first 6 (ensuring selected category is visible if chosen) or all
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

  // Guidance metrics for expense in current month
  const forecast = useMemo(() => {
    if (type !== 'expense') return null
    return calculateForecast({
      transactions: monthTransactions || [],
      recurring: recurringList || [],
      debts: debts || [],
      monthStartDay: userSettings?.monthStartDay ?? 1,
      periodRange: range,
      rolloverBalanceFils: userSettings?.rolloverBalance
        ? appData?.rolloverBalanceFils || 0
        : 0,
    })
  }, [
    type,
    monthTransactions,
    recurringList,
    debts,
    userSettings?.monthStartDay,
    userSettings?.rolloverBalance,
    range,
    appData?.rolloverBalanceFils,
  ])

  // Auto-suggest for description/title matching current month's transactions
  const titleSuggestions = useMemo(() => {
    if (!monthTransactions || monthTransactions.length === 0) return []
    const matching = monthTransactions.filter(
      (t) => t.type === type && t.title && t.title.trim()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('يجب تسجيل الدخول أولاً')
      return
    }

    let parsedAmountStr = amountStr
    const evaluated = evaluateMathExpression(amountStr)
    if (evaluated !== null && evaluated > 0) {
      parsedAmountStr = String(Number(evaluated.toFixed(currencyConfig.decimals)))
      setAmountStr(parsedAmountStr)
    }

    const amountFils = isLockedTransaction && initialTransaction
      ? initialTransaction.amountFils
      : toFils(parsedAmountStr, currencyConfig.decimals)

    if (amountFils <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    if (!activeCategoryId) {
      setError('يرجى اختيار التصنيف')
      return
    }

    const parsedDate = parseLocalDateInput(dateStr)
    if (isNaN(parsedDate.getTime())) {
      setError('يرجى اختيار تاريخ صالح')
      return
    }

    setSubmitting(true)
    try {
      const trimmedTitle = title.trim().slice(0, 100)
      const isOutsideMonth = parsedDate < range.start || parsedDate >= range.end

      if (isEditing && initialTransaction) {
        if (isLinkedToDebtPayment && linkedDebtPayment) {
          if (linkedDebtPayment.payment.isMerged) {
            const catOrNoteChanged =
              activeCategoryId !== initialTransaction.categoryId ||
              note.trim() !== (initialTransaction.note || '').trim()
            if (!catOrNoteChanged) {
              setError('لا يمكن تعديل دفعة مدمجة من هنا، يرجى إدارتها من سجل الديون.')
              setSubmitting(false)
              return
            }
          } else {
            const debtStartDate =
              linkedDebtPayment.debt.startDate instanceof Date
                ? linkedDebtPayment.debt.startDate
                : new Date(linkedDebtPayment.debt.startDate)
            const debtStartDay = new Date(
              debtStartDate.getFullYear(),
              debtStartDate.getMonth(),
              debtStartDate.getDate(),
              0, 0, 0, 0
            )
            const paymentDay = new Date(
              parsedDate.getFullYear(),
              parsedDate.getMonth(),
              parsedDate.getDate(),
              0, 0, 0, 0
            )
            if (paymentDay < debtStartDay) {
              setError('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
              setSubmitting(false)
              return
            }
            const previousPaymentsSum = (linkedDebtPayment.debt.payments || []).reduce(
              (acc, p) => acc + p.amountFils,
              0
            )
            const untrackedPaidFils = Math.max(
              0,
              (linkedDebtPayment.debt.paidFils || 0) - previousPaymentsSum
            )
            const otherPaymentsTotal = (linkedDebtPayment.debt.payments || [])
              .filter((p) => p.id !== linkedDebtPayment.payment.id)
              .reduce((sum, p) => sum + p.amountFils, 0)
            const remainingAllowed = Math.max(
              0,
              linkedDebtPayment.debt.amountFils - (otherPaymentsTotal + untrackedPaidFils)
            )
            if (amountFils > remainingAllowed) {
              setError('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
              setSubmitting(false)
              return
            }

            await updateDebtPayment(
              user.uid,
              linkedDebtPayment.debt,
              linkedDebtPayment.payment.id,
              {
                amountFils,
                date: parsedDate,
                note: note.trim().slice(0, 500),
                categoryId: activeCategoryId,
                title: trimmedTitle,
              }
            )
            recordCategoryUsage(activeCategoryId)
            showToast('تم تعديل دفعة الدين وتحديث سجل الدين بنجاح', 'success')
            if (isOutsideMonth) {
              setSelectedDate(parsedDate)
            }
            onSuccess?.()
            onClose()
            return
          }
        }

        const finalType = isLockedTransaction ? initialTransaction.type : type
        const finalAmountFils = isLockedTransaction ? initialTransaction.amountFils : amountFils
        const finalDate = isLockedTransaction
          ? (initialTransaction.date instanceof Date ? initialTransaction.date : new Date(initialTransaction.date))
          : parsedDate
        const finalTitle = isLockedTransaction ? initialTransaction.title : trimmedTitle

        await updateTransaction(user.uid, initialTransaction.id, {
          type: finalType,
          amountFils: finalAmountFils,
          categoryId: activeCategoryId,
          date: finalDate,
          title: finalTitle ?? '',
          note: note.trim().slice(0, 500),
        })
        recordCategoryUsage(activeCategoryId)
        showToast(
          isOutsideMonth && !isLockedTransaction
            ? 'تم تعديل المعاملة والانتقال إلى شهر المعاملة'
            : 'تم تعديل المعاملة بنجاح',
          'success'
        )
      } else if (isRecurring) {
        const endOfToday = new Date()
        endOfToday.setHours(23, 59, 59, 999)
        const isFuture = parsedDate > endOfToday

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        let nextDate = parsedDate
        if (scheduleNextIfPast && parsedDate < startOfToday) {
          while (nextDate <= startOfToday) {
            nextDate = advanceDate(nextDate, recurringFrequency)
          }
        }

        await addRecurring(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
          frequency: recurringFrequency,
          startDate: parsedDate,
          nextDate,
          endDate: hasEndDate && endDateStr ? parseLocalDateInput(endDateStr) : null,
          active: true,
        })

        let processedCount = 0
        if (!isFuture) {
          processedCount = await processDueRecurring(user.uid)
        }

        recordCategoryUsage(activeCategoryId)

        let recurringToastMessage: string
        if (isFuture) {
          recurringToastMessage = isOutsideMonth
            ? 'تمت جدولة المعاملة المتكررة والانتقال إلى شهر المعاملة'
            : 'تمت جدولة المعاملة المتكررة بنجاح'
        } else if (processedCount > 1) {
          recurringToastMessage = isOutsideMonth
            ? `تمت إضافة ${processedCount} معاملات متكررة مستحقة وتفعيل التكرار والانتقال إلى شهر المعاملة`
            : `تمت إضافة ${processedCount} معاملات متكررة مستحقة وتفعيل التكرار بنجاح`
        } else {
          recurringToastMessage = isOutsideMonth
            ? 'تمت إضافة المعاملة وتفعيل التكرار والانتقال إلى شهر المعاملة'
            : 'تمت إضافة المعاملة وتفعيل التكرار بنجاح'
        }

        showToast(recurringToastMessage, 'success')
      } else {
        await addTransaction(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          date: parsedDate,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
        })

        recordCategoryUsage(activeCategoryId)

        showToast(
          activeDuplicateFrom
            ? (isOutsideMonth
                ? 'تم حفظ المعاملة المكررة والانتقال إلى شهر المعاملة'
                : 'تم حفظ المعاملة المكررة بنجاح')
            : (isOutsideMonth
                ? 'تم حفظ المعاملة والانتقال إلى شهر المعاملة'
                : 'تمت إضافة المعاملة بنجاح'),
          'success'
        )
      }

      if (isOutsideMonth) {
        setSelectedDate(parsedDate)
      }

      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      console.error('Failed to save transaction:', err)
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'تعذر حفظ المعاملة. يرجى التحقق من البيانات والمحاولة مجدداً.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveAndAddAnother = async () => {
    setError(null)

    if (!user) {
      setError('يجب تسجيل الدخول أولاً')
      return
    }

    let parsedAmountStr = amountStr
    const evaluated = evaluateMathExpression(amountStr)
    if (evaluated !== null && evaluated > 0) {
      parsedAmountStr = String(Number(evaluated.toFixed(currencyConfig.decimals)))
      setAmountStr(parsedAmountStr)
    }

    const amountFils = toFils(parsedAmountStr, currencyConfig.decimals)
    if (amountFils <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    if (!activeCategoryId) {
      setError('يرجى اختيار التصنيف')
      return
    }

    const parsedDate = parseLocalDateInput(dateStr)
    if (isNaN(parsedDate.getTime())) {
      setError('يرجى اختيار تاريخ صالح')
      return
    }

    setSubmitting(true)
    try {
      const trimmedTitle = title.trim().slice(0, 100)
      if (isRecurring) {
        const endOfToday = new Date()
        endOfToday.setHours(23, 59, 59, 999)
        const isFuture = parsedDate > endOfToday

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        let nextDate = parsedDate
        if (scheduleNextIfPast && parsedDate < startOfToday) {
          while (nextDate <= startOfToday) {
            nextDate = advanceDate(nextDate, recurringFrequency)
          }
        }

        await addRecurring(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
          frequency: recurringFrequency,
          startDate: parsedDate,
          nextDate,
          endDate: hasEndDate && endDateStr ? parseLocalDateInput(endDateStr) : null,
          active: true,
        })

        if (!isFuture) {
          await processDueRecurring(user.uid)
        }
      } else {
        await addTransaction(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          date: parsedDate,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
        })
      }

      const isOutsideMonth = parsedDate < range.start || parsedDate >= range.end
      recordCategoryUsage(activeCategoryId)

      showToast(
        isOutsideMonth
          ? 'تم حفظ المعاملة والانتقال إلى شهر المعاملة، وجاهز للمعاملة التالية'
          : 'تم حفظ المعاملة بنجاح، وجاهز للمعاملة التالية',
        'success'
      )

      if (isOutsideMonth) {
        setSelectedDate(parsedDate)
      }

      onSuccess?.()

      // Reset fields for consecutive rapid entries
      setAmountStr('')
      setTitle('')
      setNote('')
      setIsRecurring(false)
      setDuplicateCleared(true)

      setTimeout(() => {
        amountInputRef.current?.focus()
      }, 50)
    } catch (err: unknown) {
      console.error('Failed to save transaction:', err)
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'تعذر حفظ المعاملة. يرجى التحقق من البيانات والمحاولة مجدداً.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !initialTransaction) return
    if (isLinkedToDebtPayment && linkedDebtPayment) {
      if (linkedDebtPayment.payment.isMerged) {
        setError('لا يمكن حذف دفعة مدمجة من هنا، يرجى إدارتها من سجل الديون.')
        return
      }
      setDeleting(true)
      try {
        await removeDebtPayment(user.uid, linkedDebtPayment.debt, linkedDebtPayment.payment.id)
        showToast(
          `تم حذف دفعة السداد لـ (${linkedDebtPayment.debt.personName}) وإعادة فتح المبلغ المستحق في سجل الدين بنجاح`,
          'info'
        )
        onSuccess?.()
        onClose()
      } catch (err) {
        console.error('Failed to remove linked debt payment:', err)
        setError('تعذر حذف دفعة الدين المرتبطة')
      } finally {
        setDeleting(false)
      }
      return
    }
    if (isLinkedToDebtInit && isDebtExists && !isSourceDeleted) {
      setError('لا يمكن حذف معاملة أصل الدين من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.')
      return
    }
    if (isLinkedToCircle && isCircleExists && !isSourceDeleted) {
      setError('لا يمكن حذف معاملات إيداع الجمعيات من هنا، يرجى إدارتها من صفحة الجمعيات.')
      return
    }
    if (circleInstallmentMatch && user) {
      const circleId = circleInstallmentMatch[1]
      const monthNum = parseInt(circleInstallmentMatch[2], 10)
      setDeleting(true)
      try {
        await removeCircleInstallmentPayment(user.uid, circleId, monthNum)
        showToast('تم حذف قسط الجمعية وتحديث السجل بنجاح', 'info')
        onSuccess?.()
        onClose()
      } catch (err) {
        console.error('Failed to remove circle installment:', err)
        setError('تعذر حذف قسط الجمعية')
      } finally {
        setDeleting(false)
      }
      return
    }
    setDeleting(true)
    try {
      await deleteTransaction(user.uid, initialTransaction.id)
      showToast('تم حذف المعاملة', 'info')
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      setError('تعذر حذف المعاملة')
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicateCurrent = async () => {
    if (!initialTransaction) return
    const parsedFils = toFils(amountStr, currencyConfig.decimals)
    const finalFils = parsedFils > 0 ? parsedFils : initialTransaction.amountFils

    const currentData: Transaction = {
      ...initialTransaction,
      type,
      amountFils: finalFils,
      categoryId: activeCategoryId,
      title: title.trim() || undefined,
      note: note.trim().slice(0, 500),
      date: new Date(),
    }

    if (onDuplicate) {
      onDuplicate(currentData)
      return
    }
    if (!user) return
    setSubmitting(true)
    try {
      await addTransaction(user.uid, {
        type: currentData.type,
        amountFils: currentData.amountFils,
        categoryId: currentData.categoryId,
        date: currentData.date,
        title: currentData.title,
        note: currentData.note,
      })
      showToast('تم تكرار المعاملة بنجاح', 'success')
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to duplicate transaction:', err)
      showToast('تعذر تكرار المعاملة', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: TxType; label: string }[] = [
    { value: 'expense', label: 'مصروف' },
    { value: 'income', label: 'دخل' },
  ]

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Linked Debt Init Warning Banner */}
      {isLinkedToDebtInit && isDebtExists && !isSourceDeleted && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>معاملة أصل الدين متزامنة مع سجل الديون</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/80 pe-1">
            هذه المعاملة تمثل نشوء الدين الأصلي. لتعديل المبلغ أو حذف الدين، يرجى إدارته من صفحة الديون. يمكنك تغيير التصنيف والملاحظة هنا.
          </p>
          <Link
            to="/debts"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            <span>الانتقال إلى سجل الديون</span>
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
        </div>
      )}

      {/* Linked Debt Payment Warning Banner */}
      {isLinkedToDebtPayment && (
        linkedDebtPayment?.payment?.isMerged ? (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>معاملة مرتبطة بدفعة دين مدمجة لـ ({linkedDebtPayment.debt.personName})</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/80 pe-1">
              هذه المعاملة تمثل رصيد دفعات سابقة تم دمجها في سجل الدين. لا يمكن تعديل مبلغها أو حذفها من هنا، يرجى إدارتها من صفحة الديون.
            </p>
            <Link
              to="/debts"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
            >
              <span>الانتقال إلى سجل الديون</span>
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-300">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                {linkedDebtPayment
                  ? `معاملة مرتبطة بدفعة سداد دين لـ (${linkedDebtPayment.debt.personName})`
                  : 'معاملة مرتبطة بدفعة سداد دين'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-blue-700/90 dark:text-blue-300/80 pe-1">
              عند تعديل المبلغ أو حذف هذه المعاملة، سيتم تلقائياً تحديث دفعة السداد في سجل الدين وإعادة احتساب رصيد الدين وحالة الإغلاق.
            </p>
          </div>
        )
      )}

      {/* Linked Circle Payout Warning Banner */}
      {isLinkedToCircle && isCircleExists && !isSourceDeleted && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
            <AlertCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>معاملة مرتبطة بإيداع جمعية مالية</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-700/90 dark:text-emerald-300/80 pe-1">
            هذه المعاملة تم إنشاؤها تلقائياً عند إيداع صافي استلام الجمعية. لتعديل المبلغ أو حذفها يرجى الانتقال إلى صفحة الجمعيات، أو يمكنك تغيير التصنيف والملاحظة وحفظ التعديل هنا.
          </p>
          <Link
            to="/tools?tool=circles"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            <span>الانتقال إلى صفحة الجمعيات</span>
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
        </div>
      )}

      {/* Linked Circle Installment Warning Banner */}
      {isLinkedToCircleInstallment && isCircleInstallmentExists && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>معاملة مرتبطة بقسط جمعية ({linkedCircleInstallment?.name || 'جمعية'}) - شهر {circleInstallmentMonth}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-700/90 dark:text-emerald-300/80 pe-1">
            عند حذف هذه المعاملة، سيتم تلقائياً تحديث حالة القسط في جدول الجمعية وإلغاء تسجيل الدفع.
          </p>
        </div>
      )}

      {/* Orphaned Unlocked Banner */}
      {isSourceMissing && (isLinkedToDebtInit || isLinkedToCircle) && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>تم فك قفل هذه المعاملة نظراً لحذف السجل الأصلي المرتبط بها. يمكنك تعديلها أو حذفها بحرية.</span>
        </div>
      )}

      {/* Type Toggle: مصروف / دخل */}
      <div>
        <SegmentedControl<TxType>
          value={type}
          disabled={isLockedTransaction || isLinkedToDebtPayment}
          onChange={(newType) => {
            setType(newType)
            setCategoryId('')
            setError(null)
          }}
          options={typeOptions}
          className="w-full"
        />
      </div>

      {/* Big Amount Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="tx-amount"
            className="block text-xs font-bold text-slate-500 dark:text-slate-400"
          >
            المبلغ
          </label>
          {!isLockedTransaction && (
            <div className="flex items-center gap-1">
              {['+', '-', '*', '/'].map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => {
                    setAmountStr((prev) => {
                      const trimmed = prev.trim()
                      if (!trimmed) return ''
                      if (/[+\-*/]$/.test(trimmed)) {
                        return trimmed.slice(0, -1) + op
                      }
                      return trimmed + op
                    })
                  }}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer select-none"
                  title={`إضافة عملية ${op}`}
                >
                  {op === '*' ? '×' : op === '/' ? '÷' : op}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const evaluated = evaluateMathExpression(amountStr)
                  if (evaluated !== null && evaluated >= 0) {
                    setAmountStr(String(Number(evaluated.toFixed(currencyConfig.decimals))))
                  }
                }}
                className="w-6 h-6 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/80 dark:hover:bg-blue-900 text-xs font-bold text-blue-600 dark:text-blue-400 transition-colors cursor-pointer select-none"
                title="حساب النتيجة"
              >
                =
              </button>
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border transition-all',
            error && amountStr && toFils(amountStr, currencyConfig.decimals) <= 0
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-slate-200 dark:border-slate-700 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20',
            isLockedTransaction && 'opacity-70 bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed'
          )}
        >
          <input
            ref={amountInputRef}
            id="tx-amount"
            type="text"
            inputMode="decimal"
            readOnly={isLockedTransaction}
            disabled={isLockedTransaction}
            value={amountStr}
            onChange={(e) => {
              if (isLockedTransaction) return
              setAmountStr(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === '=') {
                e.preventDefault()
                const evaluated = evaluateMathExpression(amountStr)
                if (evaluated !== null && evaluated >= 0) {
                  setAmountStr(String(Number(evaluated.toFixed(currencyConfig.decimals))))
                }
              }
            }}
            onBlur={() => {
              if (/[+\-*/]/.test(amountStr)) {
                const evaluated = evaluateMathExpression(amountStr)
                if (evaluated !== null && evaluated >= 0) {
                  setAmountStr(String(Number(evaluated.toFixed(currencyConfig.decimals))))
                }
              }
            }}
            placeholder={currencyConfig.decimals === 3 ? '0.000' : '0.00'}
            className={cn(
              'w-full bg-transparent text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none',
              isLockedTransaction && 'cursor-not-allowed'
            )}
            autoFocus={!isEditing && !isLockedTransaction && !isTouchDevice}
          />
          <span className="text-base lg:text-lg font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
            {currencyConfig.symbol}
          </span>
        </div>

        {/* Guidance Subline for Expense in Current Month */}
        {type === 'expense' && forecast && forecast.isCurrentMonth && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 px-1 font-medium">
            <span>
              الرصيد المتاح الحر:{' '}
              <strong
                className={cn(
                  forecast.freeBalance < 0
                    ? 'text-red-500 dark:text-red-400 font-bold'
                    : 'text-slate-700 dark:text-slate-200'
                )}
              >
                {formatMoney(forecast.freeBalance, currencyConfig.code)}
              </strong>
            </span>
            <span>
              حد الصرف اليومي الآمن:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {formatMoney(forecast.dailySafeFils, currencyConfig.code)}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Category Chips Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
            التصنيف
          </label>
          <div className="flex items-center gap-2">
            {availableCategories.length > 6 && (
              <button
                type="button"
                onClick={() => setIsCategoriesExpanded((prev) => !prev)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {isCategoriesExpanded ? (
                  <>
                    <span>طي التصنيفات</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>عرض كل التصنيفات ({availableCategories.length})</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreateCatOpen(true)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تصنيف جديد</span>
            </button>
          </div>
        </div>
        {categoriesLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-0.5 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-750 flex items-center gap-2 p-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
        ) : availableCategories.length === 0 ? (
          <div className="py-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
            لا توجد تصنيفات متاحة لهذا النوع
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-0.5">
            {displayedCategories.map((cat) => {
              const isSelected = activeCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(cat.id)
                    setError(null)
                  }}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all text-start cursor-pointer select-none min-w-0',
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 ring-2 ring-blue-600/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}25` }}
                  >
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  </span>
                  <span className="truncate flex-1 text-xs sm:text-sm font-semibold">
                    {cat.name}
                    {cat.archived ? ' (مؤرشف)' : ''}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Date Picker */}
      <div>
        <DatePickerInput
          id="tx-date"
          label="التاريخ"
          value={dateStr}
          onChange={(val) => {
            if (isLockedTransaction) return
            setDateStr(val)
          }}
          required
          disabled={isLockedTransaction}
          readOnly={isLockedTransaction}
          showQuickButtons
        />
        {isBrowsingDifferentMonth && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              تم ضبط التاريخ تلقائياً على بداية الشهر المالي المتصفح حالياً ({formatDateInput(range.start)}). يمكنك تغييره بحرية.
            </span>
          </p>
        )}
      </div>

      {/* Description / Title Input */}
      <div>
        <Input
          type="text"
          label="الوصف / العنوان (اختياري)"
          placeholder="مثال: فاتورة كهرباء، مشتريات تموينية..."
          value={title}
          onChange={(e) => {
            if (isLockedTransaction) return
            setTitle(e.target.value)
          }}
          maxLength={100}
          disabled={isLockedTransaction}
          readOnly={isLockedTransaction}
        />
        {titleSuggestions.length > 0 && !isLockedTransaction && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 px-0.5">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium select-none">
              اقتراحات سريعة:
            </span>
            {titleSuggestions.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => {
                  setTitle(s.title)
                  if (s.categoryId && availableCategories.some((c) => c.id === s.categoryId)) {
                    setCategoryId(s.categoryId)
                  }
                }}
                className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Note Input (Collapsible) */}
      {showNoteField || isLockedTransaction ? (
        <div>
          <Input
            type="text"
            label="ملاحظة تفصيلية (اختياري)"
            placeholder="مثال: غداء مع الأصدقاء"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </div>
      ) : (
        <div className="-mt-2">
          <button
            type="button"
            onClick={() => setShowNoteField(true)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>+ إضافة ملاحظة تفصيلية</span>
          </button>
        </div>
      )}

      {/* Recurring Option (only for new transactions) */}
      {!isEditing && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <Toggle
            checked={isRecurring}
            onChange={setIsRecurring}
            label="جعلها معاملة متكررة"
            description="تكرار هذه المعاملة تلقائياً وفق دورية زمنية محددة"
          />

          {isRecurring && (
            <div className="space-y-3 pe-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                  دورية التكرار
                </label>
                <div
                  role="radiogroup"
                  className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={recurringFrequency === 'weekly'}
                    onClick={() => {
                      setRecurringFrequency('weekly')
                      setShowExtraFrequencyDropdown(false)
                    }}
                    className={cn(
                      'py-1.5 text-xs font-bold rounded-lg transition-all',
                      recurringFrequency === 'weekly'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    أسبوعي
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={recurringFrequency === 'monthly'}
                    onClick={() => {
                      setRecurringFrequency('monthly')
                      setShowExtraFrequencyDropdown(false)
                    }}
                    className={cn(
                      'py-1.5 text-xs font-bold rounded-lg transition-all',
                      recurringFrequency === 'monthly'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    شهري
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={recurringFrequency === 'yearly'}
                    onClick={() => {
                      setRecurringFrequency('yearly')
                      setShowExtraFrequencyDropdown(false)
                    }}
                    className={cn(
                      'py-1.5 text-xs font-bold rounded-lg transition-all',
                      recurringFrequency === 'yearly'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    سنوي
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={['daily', 'biweekly', 'quarterly', 'semiannual'].includes(
                      recurringFrequency
                    )}
                    onClick={() => setShowExtraFrequencyDropdown((prev) => !prev)}
                    className={cn(
                      'py-1.5 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-0.5',
                      ['daily', 'biweekly', 'quarterly', 'semiannual'].includes(recurringFrequency)
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    <span className="truncate">
                      {recurringFrequency === 'daily'
                        ? 'يومي'
                        : recurringFrequency === 'biweekly'
                          ? 'أسبوعين'
                          : recurringFrequency === 'quarterly'
                            ? 'ربع سنوي'
                            : recurringFrequency === 'semiannual'
                              ? 'نصف سنوي'
                              : 'أخرى'}
                    </span>
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  </button>
                </div>

                {/* Dropdown menu for extra frequencies */}
                {showExtraFrequencyDropdown && (
                  <div className="mt-2 p-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg grid grid-cols-2 gap-1.5">
                    {[
                      { value: 'daily' as Frequency, label: 'يومي' },
                      { value: 'biweekly' as Frequency, label: 'كل أسبوعين' },
                      { value: 'quarterly' as Frequency, label: 'ربع سنوي (3 أشهر)' },
                      { value: 'semiannual' as Frequency, label: 'نصف سنوي (6 أشهر)' },
                    ].map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => {
                          setRecurringFrequency(f.value)
                          setShowExtraFrequencyDropdown(false)
                        }}
                        className={cn(
                          'px-2.5 py-2 text-xs font-bold rounded-lg text-start flex items-center justify-between transition-colors',
                          recurringFrequency === f.value
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        )}
                      >
                        <span>{f.label}</span>
                        {recurringFrequency === f.value && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* End date toggle + picker */}
              <div className="pt-1 space-y-2">
                <Toggle
                  checked={hasEndDate}
                  onChange={setHasEndDate}
                  label="تحديد تاريخ انتهاء للتكرار"
                  description="يتوقف التكرار التلقائي بعد هذا التاريخ"
                />
                {hasEndDate && (
                  <DatePickerInput
                    id="rec-end-date"
                    label="تاريخ الانتهاء"
                    value={endDateStr}
                    onChange={setEndDateStr}
                    required
                  />
                )}
              </div>

              {/* Past date schedule notice */}
              {parseLocalDateInput(dateStr) < new Date(new Date().setHours(0, 0, 0, 0)) && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2">
                  <span>تاريخ المعاملة في الماضي؛ سيتم تلقائياً جدولة الاستحقاق القادم من تاريخ اليوم.</span>
                  <input
                    type="checkbox"
                    checked={scheduleNextIfPast}
                    onChange={(e) => setScheduleNextIfPast(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 text-start rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-semibold"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Delete confirmation if editing */}
      {isEditing && !isLockedTransaction && showDeleteConfirm ? (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 space-y-2.5">
          <p className="text-xs font-bold text-red-800 dark:text-red-300">
            هل أنت متأكد من حذف هذه المعاملة نهائياً؟
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1"
            >
              {deleting ? 'جاري الحذف...' : 'نعم، احذف المعاملة'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              تراجع
            </Button>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="flex-1"
          >
            {submitting
              ? 'جاري الحفظ...'
              : isEditing
                ? 'تعديل المعاملة'
                : activeDuplicateFrom
                  ? 'حفظ النسخة'
                  : 'حفظ'}
          </Button>

          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAndAddAnother}
              disabled={submitting}
              className="text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              حفظ وإضافة أخرى
            </Button>
          )}

          {isEditing && !isLockedTransaction && !isLinkedToDebtPayment && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDuplicateCurrent}
              disabled={submitting || deleting}
              icon={<Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              className="text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              تكرار هذه المعاملة
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            إلغاء
          </Button>
        </div>

        {isEditing && !isLockedTransaction && !showDeleteConfirm && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="حذف المعاملة"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 p-2.5"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isCreateCatOpen && (
        <CategoryForm
          isOpen={isCreateCatOpen}
          onClose={() => setIsCreateCatOpen(false)}
          defaultType={type}
          onSuccess={() => setIsCreateCatOpen(false)}
        />
      )}
    </form>
  )
}
