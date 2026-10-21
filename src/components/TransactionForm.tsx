import React, { useState, useRef, useMemo } from 'react'
import { format } from 'date-fns'
import { Check, Trash2, AlertCircle, ArrowLeft, Copy } from 'lucide-react'
import { Link } from 'react-router'
import { SegmentedControl } from './ui/SegmentedControl'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Toggle } from './ui/Toggle'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useDebts } from '../hooks/useDebts'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useToast } from '../hooks/useToast'
import { useCurrency } from '../hooks/useCurrency'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '../services/transactions'
import { addRecurring, processDueRecurring } from '../services/recurring'
import { updateDebtPayment, removeDebtPayment } from '../services/debts'
import { toFils, fromFils } from '../lib/money'
import { parseLocalDateInput } from '../lib/dates'
import { findLinkedDebtPayment } from '../lib/debts'
import {
  getCategoryUsageMap,
  recordCategoryUsage,
  sortCategoriesByUsage,
} from '../lib/categoryUsage'
import { cn } from '../lib/cn'
import type { Transaction, TxType, Frequency } from '../types'

export interface TransactionFormProps {
  initialTransaction?: Transaction | null
  duplicateFrom?: Transaction | null
  initialType?: TxType
  onClose: () => void
  onSuccess?: () => void
  onDuplicate?: (tx: Transaction) => void
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialTransaction,
  duplicateFrom,
  initialType = 'expense',
  onClose,
  onSuccess,
  onDuplicate,
}) => {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const { data: debts } = useDebts()
  const { setSelectedDate, range } = useSelectedMonth()
  const { showToast } = useToast()
  const { config: currencyConfig } = useCurrency()

  const isEditing = Boolean(initialTransaction)

  // Find linked debt payment if editing a debt payment transaction
  const linkedDebtPayment = findLinkedDebtPayment(initialTransaction?.id, debts)

  const isLinkedToDebtInit = Boolean(
    initialTransaction?.id && initialTransaction.id.startsWith('debt_init_')
  )
  const isLinkedToDebtPayment = Boolean(
    linkedDebtPayment ||
      (initialTransaction?.id && initialTransaction.id.startsWith('debt_pay_'))
  )
  const isLinkedToCircle = Boolean(
    initialTransaction?.id && initialTransaction.id.startsWith('circle_payout_')
  )
  // Only completely lock amount & date for debt_init_ and circle_payout_
  // Debt payments allow editing amount, category, date, and note!
  const isLockedTransaction = isLinkedToDebtInit || isLinkedToCircle
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

  const [dateStr, setDateStr] = useState<string>(() => {
    if (initialTransaction?.date) {
      const d =
        initialTransaction.date instanceof Date
          ? initialTransaction.date
          : new Date(initialTransaction.date)
      return format(d, 'yyyy-MM-dd')
    }
    const now = new Date()
    const isWithinRange = now >= range.start && now < range.end
    return format(isWithinRange ? now : range.start, 'yyyy-MM-dd')
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
    return sortCategoriesByUsage(filtered, usageMap)
  }, [categories, type, usageMap, originalCatId])

  // Compute the effectively selected category ID:
  // If user selected one that belongs to available categories, use it.
  // Otherwise, fallback to the top (most frequent) available category.
  const activeCategoryId =
    categoryId && availableCategories.some((c) => c.id === categoryId)
      ? categoryId
      : availableCategories[0]?.id ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('يجب تسجيل الدخول أولاً')
      return
    }

    const amountFils = isLockedTransaction && initialTransaction
      ? initialTransaction.amountFils
      : toFils(amountStr, currencyConfig.decimals)

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
          ...(finalTitle ? { title: finalTitle } : {}),
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

        await addRecurring(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
          frequency: recurringFrequency,
          startDate: parsedDate,
          nextDate: parsedDate,
          active: true,
        })

        if (!isFuture) {
          await processDueRecurring(user.uid)
        }

        recordCategoryUsage(activeCategoryId)

        showToast(
          isFuture
            ? (isOutsideMonth
                ? 'تمت جدولة المعاملة المتكررة والانتقال إلى شهر المعاملة'
                : 'تمت جدولة المعاملة المتكررة بنجاح')
            : (isOutsideMonth
                ? 'تمت إضافة المعاملة وتفعيل التكرار والانتقال إلى شهر المعاملة'
                : 'تمت إضافة المعاملة وتفعيل التكرار بنجاح'),
          'success'
        )
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
          duplicateFrom
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
      setError('تعذر حفظ المعاملة. يرجى التحقق من البيانات والمحاولة مجدداً.')
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

    const amountFils = toFils(amountStr, currencyConfig.decimals)
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

        await addRecurring(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
          frequency: recurringFrequency,
          startDate: parsedDate,
          nextDate: parsedDate,
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

      setTimeout(() => {
        amountInputRef.current?.focus()
      }, 50)
    } catch (err: unknown) {
      console.error('Failed to save transaction:', err)
      setError('تعذر حفظ المعاملة. يرجى التحقق من البيانات والمحاولة مجدداً.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !initialTransaction) return
    if (isLinkedToDebtPayment && linkedDebtPayment) {
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
    if (isLinkedToDebtInit) {
      setError('لا يمكن حذف معاملة أصل الدين من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.')
      return
    }
    if (isLinkedToCircle) {
      setError('لا يمكن حذف معاملات إيداع الجمعيات من هنا، يرجى إدارتها من صفحة الجمعيات.')
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
    if (onDuplicate) {
      onDuplicate(initialTransaction)
      return
    }
    if (!user) return
    setSubmitting(true)
    try {
      const parsedFils = toFils(amountStr, currencyConfig.decimals)
      const finalFils = parsedFils > 0 ? parsedFils : initialTransaction.amountFils
      await addTransaction(user.uid, {
        type,
        amountFils: finalFils,
        categoryId: activeCategoryId,
        date: new Date(),
        title: title.trim() || undefined,
        note: note.trim().slice(0, 500),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Linked Debt Init Warning Banner */}
      {isLinkedToDebtInit && (
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
      )}

      {/* Linked Circle Payout Warning Banner */}
      {isLinkedToCircle && (
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
        <label
          htmlFor="tx-amount"
          className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5"
        >
          المبلغ
        </label>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border transition-all',
            error && amountStr && toFils(amountStr) <= 0
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
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
            placeholder={currencyConfig.decimals === 3 ? '0.000' : '0.00'}
            className={cn(
              'w-full bg-transparent text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none',
              isLockedTransaction && 'cursor-not-allowed'
            )}
            autoFocus={!isEditing && !isLockedTransaction}
          />
          <span className="text-base lg:text-lg font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
            {currencyConfig.symbol}
          </span>
        </div>
      </div>

      {/* Category Chips Grid */}
      <div>
        <div className="mb-2">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
            التصنيف
          </label>
        </div>
        {categoriesLoading ? (
          <div className="py-4 text-center text-xs text-slate-400">جاري تحميل التصنيفات...</div>
        ) : availableCategories.length === 0 ? (
          <div className="py-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
            لا توجد تصنيفات متاحة لهذا النوع
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-0.5">
            {availableCategories.map((cat) => {
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
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-base"
                    style={{ backgroundColor: `${cat.color}25` }}
                  >
                    {cat.icon}
                  </span>
                  <span className="truncate flex-1 text-xs sm:text-sm font-semibold">
                    {cat.name}
                    {cat.archived ? ' (مؤرشف)' : ''}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Date Input with Quick Select Buttons */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="tx-date"
            className="block text-xs font-bold text-slate-500 dark:text-slate-400"
          >
            التاريخ
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isLockedTransaction}
              onClick={() => {
                if (isLockedTransaction) return
                const today = new Date()
                setDateStr(format(today, 'yyyy-MM-dd'))
              }}
              className={cn(
                'px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                dateStr === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                isLockedTransaction && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
            >
              اليوم
            </button>
            <button
              type="button"
              disabled={isLockedTransaction}
              onClick={() => {
                if (isLockedTransaction) return
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                setDateStr(format(yesterday, 'yyyy-MM-dd'))
              }}
              className={cn(
                'px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                (() => {
                  const y = new Date()
                  y.setDate(y.getDate() - 1)
                  return dateStr === format(y, 'yyyy-MM-dd')
                })()
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                isLockedTransaction && 'opacity-50 cursor-not-allowed pointer-events-none'
              )}
            >
              أمس
            </button>
          </div>
        </div>
        <Input
          id="tx-date"
          type="date"
          value={dateStr}
          onChange={(e) => {
            if (isLockedTransaction) return
            setDateStr(e.target.value)
          }}
          required
          disabled={isLockedTransaction}
          readOnly={isLockedTransaction}
        />
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
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
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
            <div className="space-y-1.5 pe-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                دورية التكرار
              </label>
              <SegmentedControl<Frequency>
                value={recurringFrequency}
                onChange={setRecurringFrequency}
                options={[
                  { value: 'weekly', label: 'أسبوعي' },
                  { value: 'monthly', label: 'شهري' },
                  { value: 'yearly', label: 'سنوي' },
                ]}
                className="w-full"
              />
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
      <div className="flex items-center justify-between gap-3 pt-2">
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
                : duplicateFrom
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

          {isEditing && !isLockedTransaction && (
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
    </form>
  )
}
