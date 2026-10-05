import React, { useState } from 'react'
import { format } from 'date-fns'
import { Check, Trash2, AlertCircle } from 'lucide-react'
import { SegmentedControl } from './ui/SegmentedControl'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Toggle } from './ui/Toggle'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useToast } from '../hooks/useToast'
import { addTransaction, updateTransaction, deleteTransaction } from '../services/transactions'
import { addRecurring } from '../services/recurring'
import { advanceDate } from '../lib/recurring'
import { toFils } from '../lib/money'
import { cn } from '../lib/cn'
import type { Transaction, TxType, Frequency } from '../types'

export interface TransactionFormProps {
  initialTransaction?: Transaction | null
  initialType?: TxType
  onClose: () => void
  onSuccess?: () => void
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialTransaction,
  initialType = 'expense',
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const { showToast } = useToast()

  const isEditing = Boolean(initialTransaction)

  const [type, setType] = useState<TxType>(
    initialTransaction ? initialTransaction.type : initialType
  )

  const [amountStr, setAmountStr] = useState<string>(() => {
    if (!initialTransaction) return ''
    const val = initialTransaction.amountFils / 1000
    return String(val)
  })

  const [categoryId, setCategoryId] = useState<string>(
    initialTransaction ? initialTransaction.categoryId : ''
  )

  const [dateStr, setDateStr] = useState<string>(() => {
    if (initialTransaction?.date) {
      const d =
        initialTransaction.date instanceof Date
          ? initialTransaction.date
          : new Date(initialTransaction.date)
      return format(d, 'yyyy-MM-dd')
    }
    return format(new Date(), 'yyyy-MM-dd')
  })

  const [title, setTitle] = useState<string>(initialTransaction?.title ?? '')
  const [note, setNote] = useState<string>(initialTransaction?.note ?? '')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<Frequency>('monthly')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Filter available categories for current transaction type
  const availableCategories = categories.filter(
    (c) => c.type === type && !c.archived
  )

  // Compute the effectively selected category ID:
  // If user selected one that belongs to available categories, use it.
  // Otherwise, fallback to the first available category without an effect.
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

    const amountFils = toFils(amountStr)
    if (amountFils <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    if (!activeCategoryId) {
      setError('يرجى اختيار التصنيف')
      return
    }

    const parsedDate = new Date(dateStr)
    if (isNaN(parsedDate.getTime())) {
      setError('يرجى اختيار تاريخ صالح')
      return
    }

    setSubmitting(true)
    try {
      const trimmedTitle = title.trim().slice(0, 100)
      if (isEditing && initialTransaction) {
        await updateTransaction(user.uid, initialTransaction.id, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          date: parsedDate,
          title: trimmedTitle,
          note: note.trim().slice(0, 500),
        })
        showToast('تم تعديل المعاملة بنجاح', 'success')
      } else {
        let recurringId: string | undefined
        if (isRecurring) {
          const nextDate = advanceDate(parsedDate, recurringFrequency)
          recurringId = await addRecurring(user.uid, {
            type,
            amountFils,
            categoryId: activeCategoryId,
            ...(trimmedTitle ? { title: trimmedTitle } : {}),
            note: note.trim().slice(0, 500),
            frequency: recurringFrequency,
            startDate: parsedDate,
            nextDate,
            active: true,
          })
        }

        await addTransaction(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          date: parsedDate,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
          ...(recurringId ? { recurringId } : {}),
        })
        showToast(
          isRecurring
            ? 'تمت إضافة المعاملة وتفعيل التكرار بنجاح'
            : 'تمت إضافة المعاملة بنجاح',
          'success'
        )
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

  const handleDelete = async () => {
    if (!user || !initialTransaction) return
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

  const typeOptions: { value: TxType; label: string }[] = [
    { value: 'expense', label: 'مصروف' },
    { value: 'income', label: 'دخل' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type Toggle: مصروف / دخل */}
      <div>
        <SegmentedControl<TxType>
          value={type}
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
              : 'border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20'
          )}
        >
          <input
            id="tx-amount"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => {
              setAmountStr(e.target.value)
              setError(null)
            }}
            placeholder="0.000"
            className="w-full bg-transparent text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none"
            autoFocus={!isEditing}
          />
          <span className="text-base lg:text-lg font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
            د.أ
          </span>
        </div>
      </div>

      {/* Category Chips Grid */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
          التصنيف
        </label>
        {categoriesLoading ? (
          <div className="py-4 text-center text-xs text-slate-400">جاري تحميل التصنيفات...</div>
        ) : availableCategories.length === 0 ? (
          <div className="py-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
            لا توجد تصنيفات متاحة لهذا النوع
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
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
                    'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-sm"
                    style={{ backgroundColor: `${cat.color}25` }}
                  >
                    {cat.icon}
                  </span>
                  <span className="truncate flex-1">{cat.name}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Title Input */}
      <div>
        <Input
          type="text"
          label="عنوان المعاملة (اختياري)"
          placeholder="مثال: فاتورة كهرباء، مشتريات تموينية..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
        />
      </div>

      {/* Date Input */}
      <div>
        <Input
          type="date"
          label="التاريخ"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          required
        />
      </div>

      {/* Note Input */}
      <div>
        <Input
          type="text"
          label="ملاحظة (اختياري)"
          placeholder="مثال: غداء مع الأصدقاء"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

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
      {isEditing && showDeleteConfirm ? (
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
        <div className="flex items-center gap-2 flex-1">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? 'جاري الحفظ...' : isEditing ? 'تعديل المعاملة' : 'حفظ'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            إلغاء
          </Button>
        </div>

        {isEditing && !showDeleteConfirm && (
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
