import { addTransaction, updateTransaction } from '../../services/transactions'
import { addRecurring, processDueRecurring } from '../../services/recurring'
import { recordCategoryUsage } from '../../lib/categoryUsage'
import { calculateNextDateOnEdit } from '../../lib/recurring'
import { parseLocalDateInput } from '../../lib/dates'
import { triggerHaptic } from '../../lib/haptics'
import { evaluateMathExpression } from '../../lib/mathExpression'
import { toFils } from '../../lib/money'
import { useTransactionDeleteHandler } from './useTransactionDeleteHandler'
import { validateAndParseTransactionInput } from './validateTransactionInput'
import { handleLinkedDebtPaymentUpdate } from './debtPaymentSubmit'
import type { Transaction, TxType, Frequency } from '../../types'
import type { TransactionLockStatus } from '../../lib/transactionLocks'

export interface UseTransactionSubmitHandlersParams {
  user: { uid: string } | null
  initialTransaction?: Transaction | null
  isEditing: boolean
  isActualDuplicate: boolean
  lockStatus: TransactionLockStatus
  isSourceDeleted?: boolean
  type: TxType
  amountStr: string
  setAmountStr: (val: string) => void
  activeCategoryId: string
  dateStr: string
  title: string
  setTitle: (val: string) => void
  note: string
  setNote: (val: string) => void
  isRecurring: boolean
  setIsRecurring: (val: boolean) => void
  recurringFrequency: Frequency
  hasEndDate: boolean
  endDateStr: string
  scheduleNextIfPast: boolean
  range: { start: Date; end: Date }
  setSelectedDate: (d: Date) => void
  currencyConfig: { decimals: number; symbol: string }
  setError: (err: string | null) => void
  setSubmitting: (val: boolean) => void
  setDeleting: (val: boolean) => void
  setDuplicateCleared: (val: boolean) => void
  amountInputRef: React.RefObject<HTMLInputElement | null>
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onSuccess?: () => void
  onClose: () => void
  onDuplicate?: (tx: Transaction) => void
}

export function useTransactionSubmitHandlers(params: UseTransactionSubmitHandlersParams) {
  const {
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
  } = params

  const {
    isLocked: isLockedTransaction,
    isLinkedToDebtPayment,
    linkedDebtPayment,
  } = lockStatus

  const { handleDelete } = useTransactionDeleteHandler({
    user,
    initialTransaction,
    lockStatus,
    isSourceDeleted,
    setError,
    setDeleting,
    showToast,
    onSuccess,
    onClose,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('يجب تسجيل الدخول أولاً')
      return
    }

    const validation = validateAndParseTransactionInput({
      amountStr,
      activeCategoryId,
      dateStr,
      title,
      currencyDecimals: currencyConfig.decimals,
      isLockedTransaction,
      initialAmountFils: initialTransaction?.amountFils,
    })

    if (!validation.success) {
      setError(validation.error)
      return
    }

    const { amountFils, parsedAmountStr, parsedDate, trimmedTitle } = validation.data
    if (parsedAmountStr !== amountStr) {
      setAmountStr(parsedAmountStr)
    }

    setSubmitting(true)
    try {
      const isOutsideMonth = parsedDate < range.start || parsedDate >= range.end

      if (isEditing && initialTransaction) {
        if (isLinkedToDebtPayment && linkedDebtPayment) {
          const debtRes = await handleLinkedDebtPaymentUpdate({
            userId: user.uid,
            linkedDebtPayment,
            initialCategoryId: initialTransaction.categoryId,
            initialNote: initialTransaction.note || '',
            activeCategoryId,
            note,
            parsedDate,
            amountFils,
            trimmedTitle,
            isOutsideMonth,
            setSelectedDate,
            showToast,
            onSuccess,
            onClose,
          })
          if (debtRes.handled) {
            if (debtRes.error) {
              setError(debtRes.error)
            }
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
          nextDate = calculateNextDateOnEdit(parsedDate, recurringFrequency)
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
          isActualDuplicate
            ? (isOutsideMonth
                ? 'تم حفظ المعاملة المكررة والانتقال إلى شهر المعاملة'
                : 'تم حفظ المعاملة المكررة بنجاح')
            : (isOutsideMonth
                ? 'تم حفظ المعاملة والانتقال إلى شهر المعاملة'
                : 'تمت إضافة المعاملة بنجاح'),
          'success'
        )
      }

      triggerHaptic('light')

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

    const validation = validateAndParseTransactionInput({
      amountStr,
      activeCategoryId,
      dateStr,
      title,
      currencyDecimals: currencyConfig.decimals,
    })

    if (!validation.success) {
      setError(validation.error)
      return
    }

    const { amountFils, parsedAmountStr, parsedDate, trimmedTitle } = validation.data
    if (parsedAmountStr !== amountStr) {
      setAmountStr(parsedAmountStr)
    }

    setSubmitting(true)
    try {
      if (isRecurring) {
        const endOfToday = new Date()
        endOfToday.setHours(23, 59, 59, 999)
        const isFuture = parsedDate > endOfToday

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        let nextDate = parsedDate
        if (scheduleNextIfPast && parsedDate < startOfToday) {
          nextDate = calculateNextDateOnEdit(parsedDate, recurringFrequency)
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

      triggerHaptic('light')

      if (isOutsideMonth) {
        setSelectedDate(parsedDate)
      }

      onSuccess?.()

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

  const handleDuplicateCurrent = async () => {
    if (!initialTransaction) return
    const evaluated = evaluateMathExpression(amountStr)
    const cleanAmountStr = evaluated !== null ? String(evaluated) : amountStr
    const parsedFils = toFils(cleanAmountStr, currencyConfig.decimals)
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

  return {
    handleSubmit,
    handleSaveAndAddAnother,
    handleDelete,
    handleDuplicateCurrent,
  }
}
