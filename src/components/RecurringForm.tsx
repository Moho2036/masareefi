import React, { useState } from 'react'
import { format } from 'date-fns'
import { Check } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { SegmentedControl } from './ui/SegmentedControl'
import { Toggle } from './ui/Toggle'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useToast } from '../hooks/useToast'
import { addRecurring, updateRecurring } from '../services/recurring'
import { toFils } from '../lib/money'
import { cn } from '../lib/cn'
import type { Recurring, TxType, Frequency } from '../types'

export interface RecurringFormProps {
  isOpen: boolean
  onClose: () => void
  initialRecurring?: Recurring | null
  defaultType?: TxType
  onSuccess?: () => void
}

interface RecurringFormContentProps {
  initialRecurring?: Recurring | null
  defaultType: TxType
  onClose: () => void
  onSuccess?: () => void
}

const RecurringFormContent: React.FC<RecurringFormContentProps> = ({
  initialRecurring,
  defaultType,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const { showToast } = useToast()

  const isEditing = Boolean(initialRecurring)

  const [type, setType] = useState<TxType>(
    initialRecurring ? initialRecurring.type : defaultType
  )

  const [amountStr, setAmountStr] = useState<string>(() => {
    if (!initialRecurring) return ''
    const val = initialRecurring.amountFils / 1000
    return String(val)
  })

  const [categoryId, setCategoryId] = useState<string>(
    initialRecurring ? initialRecurring.categoryId : ''
  )

  const [frequency, setFrequency] = useState<Frequency>(
    initialRecurring ? initialRecurring.frequency : 'monthly'
  )

  const [startDateStr, setStartDateStr] = useState<string>(() => {
    if (initialRecurring?.startDate) {
      const d =
        initialRecurring.startDate instanceof Date
          ? initialRecurring.startDate
          : new Date(initialRecurring.startDate)
      return format(d, 'yyyy-MM-dd')
    }
    return format(new Date(), 'yyyy-MM-dd')
  })

  const [hasEndDate, setHasEndDate] = useState<boolean>(Boolean(initialRecurring?.endDate))

  const [endDateStr, setEndDateStr] = useState<string>(() => {
    if (initialRecurring?.endDate) {
      const d =
        initialRecurring.endDate instanceof Date
          ? initialRecurring.endDate
          : new Date(initialRecurring.endDate)
      return format(d, 'yyyy-MM-dd')
    }
    return ''
  })

  const [note, setNote] = useState<string>(initialRecurring?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Filter available categories for current transaction type
  const availableCategories = categories.filter(
    (c) => c.type === type && !c.archived
  )

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

    const parsedStartDate = new Date(startDateStr)
    if (isNaN(parsedStartDate.getTime())) {
      setError('يرجى اختيار تاريخ بداية صالح')
      return
    }

    let parsedEndDate: Date | null = null
    if (hasEndDate && endDateStr) {
      parsedEndDate = new Date(endDateStr)
      if (isNaN(parsedEndDate.getTime())) {
        setError('يرجى اختيار تاريخ انتهاء صالح')
        return
      }
      if (parsedEndDate < parsedStartDate) {
        setError('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية')
        return
      }
    }

    setSubmitting(true)
    try {
      if (isEditing && initialRecurring) {
        await updateRecurring(user.uid, initialRecurring.id, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          note: note.trim().slice(0, 500),
          frequency,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        })
        showToast('تم تعديل المعاملة المتكررة بنجاح', 'success')
      } else {
        await addRecurring(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          note: note.trim().slice(0, 500),
          frequency,
          startDate: parsedStartDate,
          nextDate: parsedStartDate,
          endDate: parsedEndDate ?? undefined,
          active: true,
        })
        showToast('تمت إضافة المعاملة المتكررة بنجاح', 'success')
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to save recurring transaction:', err)
      setError('تعذر حفظ المعاملة المتكررة. يرجى التحقق من البيانات.')
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { value: TxType; label: string }[] = [
    { value: 'expense', label: 'مصروف' },
    { value: 'income', label: 'دخل' },
  ]

  const frequencyOptions: { value: Frequency; label: string }[] = [
    { value: 'weekly', label: 'أسبوعي' },
    { value: 'monthly', label: 'شهري' },
    { value: 'yearly', label: 'سنوي' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          htmlFor="rec-amount"
          className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1"
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
            id="rec-amount"
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
          <span className="text-base font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
            د.أ
          </span>
        </div>
      </div>

      {/* Category Chips Grid */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          التصنيف
        </label>
        {categoriesLoading ? (
          <div className="py-3 text-center text-xs text-slate-400">جاري تحميل التصنيفات...</div>
        ) : availableCategories.length === 0 ? (
          <div className="py-2.5 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl">
            لا توجد تصنيفات متاحة لهذا النوع
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
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
                    'flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none',
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

      {/* Frequency selector: أسبوعي / شهري / سنوي */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          التكرار
        </label>
        <SegmentedControl<Frequency>
          value={frequency}
          onChange={setFrequency}
          options={frequencyOptions}
          className="w-full"
        />
      </div>

      {/* Dates: Start Date & Optional End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="date"
          label="تاريخ البداية"
          value={startDateStr}
          onChange={(e) => setStartDateStr(e.target.value)}
          required
        />

        {hasEndDate ? (
          <Input
            type="date"
            label="تاريخ الانتهاء"
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value)}
            required={hasEndDate}
          />
        ) : null}
      </div>

      {/* Checkbox toggle for end date */}
      <div>
        <Toggle
          checked={hasEndDate}
          onChange={setHasEndDate}
          label="تحديد تاريخ انتهاء"
          description="تتوقف المعاملة المتكررة تلقائياً بعد هذا التاريخ"
        />
      </div>

      {/* Note Input */}
      <div>
        <Input
          type="text"
          label="ملاحظة (اختياري)"
          placeholder="مثال: اشتراك نت، قسط شهري..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="p-3 text-start rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-semibold"
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
        >
          {submitting ? 'جاري الحفظ...' : isEditing ? 'تعديل المعاملة' : 'حفظ'}
        </Button>
      </div>
    </form>
  )
}

export const RecurringForm: React.FC<RecurringFormProps> = ({
  isOpen,
  onClose,
  initialRecurring,
  defaultType = 'expense',
  onSuccess,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRecurring ? 'تعديل المعاملة المتكررة' : 'إضافة معاملة متكررة'}
    >
      <RecurringFormContent
        key={initialRecurring ? `edit-${initialRecurring.id}` : `new-${defaultType}`}
        initialRecurring={initialRecurring}
        defaultType={defaultType}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}
