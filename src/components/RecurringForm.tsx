import React, { useState, useMemo } from 'react'
import { format, addMonths } from 'date-fns'
import { Check } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { SegmentedControl } from './ui/SegmentedControl'
import { Toggle } from './ui/Toggle'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useRecurring } from '../hooks/useRecurring'
import { useToast } from '../hooks/useToast'
import { addRecurring, updateRecurring, processDueRecurring } from '../services/recurring'
import { updateMoneyCircle } from '../services/moneyCircles'
import { toFils, fromFils } from '../lib/money'
import { useCurrency } from '../hooks/useCurrency'
import { parseLocalDateInput } from '../lib/dates'
import { calculateNextDateOnEdit, advanceDateWithTargetDay } from '../lib/recurring'
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
  const { format: formatCurrency, config: currencyConfig } = useCurrency()

  const isEditing = Boolean(initialRecurring)

  const [type, setType] = useState<TxType>(
    initialRecurring ? initialRecurring.type : defaultType
  )

  const [amountStr, setAmountStr] = useState<string>(() => {
    if (!initialRecurring) return ''
    return String(fromFils(initialRecurring.amountFils))
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

  const [title, setTitle] = useState<string>(initialRecurring?.title ?? '')
  const [note, setNote] = useState<string>(initialRecurring?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: circles } = useMoneyCircles()
  const { data: recurringList } = useRecurring()

  const availableCircles = useMemo(() => {
    return circles.filter((c) => {
      if (c.status !== 'active') return false
      // If editing and this circle is already linked to this recurring item, keep it
      if (
        initialRecurring?.circleId === c.id ||
        (initialRecurring?.id && c.recurringId === initialRecurring.id)
      ) {
        return true
      }
      // Exclude circles that already have a recurringId or are linked to another recurring item
      if (c.recurringId) return false
      if (recurringList.some((r) => r.circleId === c.id && r.id !== initialRecurring?.id)) {
        return false
      }
      return true
    })
  }, [circles, recurringList, initialRecurring])

  const [circleId, setCircleId] = useState<string>(initialRecurring?.circleId ?? '')
  const [skipMonth, setSkipMonth] = useState<number | undefined>(initialRecurring?.skipMonth)

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

    const amountFils = toFils(amountStr, currencyConfig.decimals)
    if (amountFils <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    if (!activeCategoryId) {
      setError('يرجى اختيار التصنيف')
      return
    }

    const parsedStartDate = parseLocalDateInput(startDateStr)
    if (isNaN(parsedStartDate.getTime())) {
      setError('يرجى اختيار تاريخ بداية صالح')
      return
    }

    let parsedEndDate: Date | null = null
    if (hasEndDate && endDateStr) {
      parsedEndDate = parseLocalDateInput(endDateStr)
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
      const trimmedTitle = title.trim().slice(0, 100)
      if (isEditing && initialRecurring) {
        const initialStart =
          initialRecurring.startDate instanceof Date
            ? initialRecurring.startDate
            : new Date(initialRecurring.startDate)
        const startDateChanged =
          format(initialStart, 'yyyy-MM-dd') !== format(parsedStartDate, 'yyyy-MM-dd')
        const frequencyChanged = initialRecurring.frequency !== frequency

        let nextDate: Date | undefined = undefined
        if (startDateChanged || frequencyChanged) {
          let candidate = calculateNextDateOnEdit(parsedStartDate, frequency)

          if (frequencyChanged && !startDateChanged) {
            const currentNext =
              initialRecurring.nextDate instanceof Date
                ? initialRecurring.nextDate
                : new Date(initialRecurring.nextDate)

            const startOfToday = new Date()
            startOfToday.setHours(0, 0, 0, 0)

            const todayEnd = new Date()
            todayEnd.setHours(23, 59, 59, 999)

            const startOfCandidate = new Date(candidate.getTime())
            startOfCandidate.setHours(0, 0, 0, 0)

            const isCandidateToday = startOfCandidate.getTime() === startOfToday.getTime()
            const wasTodayProcessed = currentNext > todayEnd || currentNext > candidate

            if (isCandidateToday && wasTodayProcessed) {
              candidate = advanceDateWithTargetDay(candidate, frequency, parsedStartDate.getDate())
            }
          }

          nextDate = candidate
        }

        await updateRecurring(user.uid, initialRecurring.id, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          title: trimmedTitle,
          note: note.trim().slice(0, 500),
          frequency,
          startDate: parsedStartDate,
          ...(nextDate ? { nextDate } : {}),
          endDate: parsedEndDate,
          circleId: circleId || undefined,
          skipMonth: skipMonth !== undefined ? skipMonth : undefined,
        })

        // Two-way sync with money circles
        if (initialRecurring.circleId && initialRecurring.circleId !== circleId) {
          await updateMoneyCircle(user.uid, initialRecurring.circleId, { recurringId: '' }).catch(() => {})
        }
        if (circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: initialRecurring.id }).catch(() => {})
        }

        await processDueRecurring(user.uid)
        showToast('تم تعديل المعاملة المتكررة بنجاح', 'success')
      } else {
        const recId = await addRecurring(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
          frequency,
          startDate: parsedStartDate,
          nextDate: parsedStartDate,
          endDate: parsedEndDate ?? undefined,
          active: true,
          circleId: circleId || undefined,
          skipMonth: skipMonth !== undefined ? skipMonth : undefined,
        })

        // Two-way sync with money circles
        if (circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: recId }).catch(() => {})
        }

        await processDueRecurring(user.uid)
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
            error && amountStr && toFils(amountStr, currencyConfig.decimals) <= 0
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
            placeholder={currencyConfig.decimals === 3 ? '0.000' : '0.00'}
            className="w-full bg-transparent text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none"
            autoFocus={!isEditing}
          />
          <span className="text-base font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
            {currencyConfig.symbol}
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

      {/* Title Input */}
      <div>
        <Input
          type="text"
          label="عنوان المعاملة (اختياري)"
          placeholder="مثال: اشتراك نت، قسط سيارة..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
        />
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

      {/* Money Circle Link / Skip Month */}
      {type === 'expense' && availableCircles.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            ربط مع جمعية نشطة (تخطي الخصم في شهر الاستلام):
          </label>
          <select
            value={circleId}
            onChange={(e) => {
              const selectedId = e.target.value
              setCircleId(selectedId)
              if (selectedId) {
                const c = availableCircles.find((circ) => circ.id === selectedId)
                if (c) {
                  setSkipMonth(c.myTurnMonth)
                  setFrequency('monthly')
                  if (!title) setTitle(`قسط ${c.name}`)
                  if (!amountStr || parseFloat(amountStr) === 0) setAmountStr(String(fromFils(c.monthlyAmountFils)))
                  const cStart = c.startDate instanceof Date ? c.startDate : new Date(c.startDate)
                  setStartDateStr(format(cStart, 'yyyy-MM-dd'))
                  const cEnd = addMonths(cStart, c.membersCount - 1)
                  setEndDateStr(format(cEnd, 'yyyy-MM-dd'))
                  setHasEndDate(true)
                }
              } else {
                setSkipMonth(undefined)
              }
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">-- ليست مرتبطة بجمعية --</option>
            {availableCircles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (قسط: {formatCurrency(c.monthlyAmountFils)} - شهر استلامك: {c.myTurnMonth})
              </option>
            ))}
          </select>
          {circleId && skipMonth && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
              <span>✓ لن يتم خصم قسط منك في الشهر {skipMonth} لأن هذا الشهر هو دور استلامك للجمعية!</span>
            </p>
          )}
        </div>
      )}

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
      closeOnBackdropClick={false}
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
