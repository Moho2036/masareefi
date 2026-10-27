import React, { useState, useMemo } from 'react'
import { format, addMonths } from 'date-fns'
import { Check, Info, ChevronDown } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { DatePickerInput } from './ui/DatePickerInput'
import { SegmentedControl } from './ui/SegmentedControl'
import { Toggle } from './ui/Toggle'
import { CategoryIcon } from './ui/CategoryIcon'
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
import { calculateNextDateOnEdit, advanceDateWithTargetDay, getNextCircleDueDate } from '../lib/recurring'
import { cn } from '../lib/cn'
import type { Recurring, TxType, Frequency } from '../types'

export interface RecurringSubmitPayload {
  type: TxType
  amountFils: number
  categoryId: string
  title: string
  note: string
  frequency: Frequency
  startDate: Date
  nextDate?: Date
  endDate?: Date | null
  circleId?: string
  skipMonth?: number
  requireConfirmation?: boolean
}

export interface RecurringFormProps {
  isOpen: boolean
  onClose: () => void
  initialRecurring?: Recurring | null
  defaultType?: TxType
  onSuccess?: () => void
  onSubmit?: (payload: RecurringSubmitPayload) => Promise<void> | void
}

interface RecurringFormContentProps {
  initialRecurring?: Recurring | null
  defaultType: TxType
  onClose: () => void
  onSuccess?: () => void
  onSubmit?: (payload: RecurringSubmitPayload) => Promise<void> | void
}

const RecurringFormContent: React.FC<RecurringFormContentProps> = ({
  initialRecurring,
  defaultType,
  onClose,
  onSuccess,
  onSubmit,
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
  const [requireConfirmation, setRequireConfirmation] = useState<boolean>(
    Boolean(initialRecurring?.requireConfirmation)
  )
  const [showExtraDropdown, setShowExtraDropdown] = useState(false)

  const isCircleLinked = Boolean(initialRecurring?.circleId)
  const hasSelectedCircle = Boolean(circleId || isCircleLinked)

  // Filter available categories for current transaction type
  // Preserve recurring item's category even if archived
  const originalCatId = initialRecurring?.categoryId
  const availableCategories = useMemo(() => {
    return categories.filter(
      (c) => c.type === type && (!c.archived || c.id === originalCatId)
    )
  }, [categories, type, originalCatId])

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

        const payload: RecurringSubmitPayload = {
          type,
          amountFils,
          categoryId: activeCategoryId,
          title: trimmedTitle,
          note: note.trim().slice(0, 500),
          frequency,
          startDate: parsedStartDate,
          nextDate,
          endDate: parsedEndDate,
          circleId: circleId || undefined,
          skipMonth: skipMonth !== undefined ? skipMonth : undefined,
          requireConfirmation,
        }

        if (onSubmit) {
          await onSubmit(payload)
        } else {
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
            requireConfirmation,
          })
        }

        // Two-way sync with money circles
        if (initialRecurring.circleId && initialRecurring.circleId !== circleId) {
          await updateMoneyCircle(user.uid, initialRecurring.circleId, { recurringId: '' }).catch(() => {})
        }
        if (circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: initialRecurring.id }).catch(() => {})
        }

        // Synchronize circle amounts if recurring installment amount changed
        const effectiveCircleId = circleId || initialRecurring.circleId
        if (effectiveCircleId) {
          const linked = circles.find((c) => c.id === effectiveCircleId)
          if (linked && linked.monthlyAmountFils !== amountFils) {
            await updateMoneyCircle(user.uid, linked.id, {
              monthlyAmountFils: amountFils,
              totalAmountFils: amountFils * linked.membersCount,
            }).catch(() => {})
          }
        }

        await processDueRecurring(user.uid)
        showToast('تم تعديل المعاملة المتكررة بنجاح', 'success')
      } else {
        const linkedCircle = circleId ? circles.find((c) => c.id === circleId) : null
        const userMember = linkedCircle?.members.find((m) => m.turnMonth === linkedCircle.myTurnMonth)
        let initialNextDate = linkedCircle
          ? getNextCircleDueDate(
              parsedStartDate,
              linkedCircle.membersCount,
              linkedCircle.myTurnMonth,
              userMember?.paidMonths || [],
              userMember?.paymentsByMonth
            )
          : parsedStartDate

        // Retroactive protection: if start date is in the past and not a circle, start from the upcoming cycle
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const startOfStart = new Date(parsedStartDate.getTime())
        startOfStart.setHours(0, 0, 0, 0)
        if (!linkedCircle && startOfStart < startOfToday) {
          initialNextDate = calculateNextDateOnEdit(parsedStartDate, frequency)
        }

        const recId = await addRecurring(user.uid, {
          type,
          amountFils,
          categoryId: activeCategoryId,
          ...(trimmedTitle ? { title: trimmedTitle } : {}),
          note: note.trim().slice(0, 500),
          frequency,
          startDate: parsedStartDate,
          nextDate: initialNextDate,
          endDate: parsedEndDate ?? undefined,
          active: true,
          circleId: circleId || undefined,
          skipMonth: skipMonth !== undefined ? skipMonth : undefined,
          requireConfirmation,
        })

        // Two-way sync with money circles
        if (circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: recId }).catch(() => {})

          // Synchronize circle amounts if recurring installment amount changed
          if (linkedCircle && linkedCircle.monthlyAmountFils !== amountFils) {
            await updateMoneyCircle(user.uid, linkedCircle.id, {
              monthlyAmountFils: amountFils,
              totalAmountFils: amountFils * linkedCircle.membersCount,
            }).catch(() => {})
          }
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

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Linked Circle Info Banner */}
      {hasSelectedCircle && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            تاريخ البدء، تاريخ الانتهاء، التكرار الشهري، وشهر الإعفاء يتم ضبطها وإدارتها تلقائياً بناءً على إعدادات الجمعية المالية المختارة
          </span>
        </div>
      )}

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
          disabled={hasSelectedCircle}
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
            autoFocus={!isEditing && !isTouchDevice}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-0.5 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-750 flex items-center gap-2 p-2"
              >
                <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
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
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}25` }}
                  >
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  </span>
                  <span className="truncate flex-1">
                    {cat.name}
                    {cat.archived ? ' (مؤرشف)' : ''}
                  </span>
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

      {/* Frequency selector: 4 options [ أسبوعي | شهري | سنوي | أخرى ▾ ] */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          التكرار
        </label>
        <div role="radiogroup" className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
          <button
            type="button"
            role="radio"
            aria-checked={frequency === 'weekly'}
            disabled={hasSelectedCircle}
            onClick={() => {
              setFrequency('weekly')
              setShowExtraDropdown(false)
            }}
            className={cn(
              'py-1.5 text-xs font-bold rounded-lg transition-all',
              frequency === 'weekly'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            أسبوعي
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={frequency === 'monthly'}
            disabled={hasSelectedCircle}
            onClick={() => {
              setFrequency('monthly')
              setShowExtraDropdown(false)
            }}
            className={cn(
              'py-1.5 text-xs font-bold rounded-lg transition-all',
              frequency === 'monthly'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            شهري
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={frequency === 'yearly'}
            disabled={hasSelectedCircle}
            onClick={() => {
              setFrequency('yearly')
              setShowExtraDropdown(false)
            }}
            className={cn(
              'py-1.5 text-xs font-bold rounded-lg transition-all',
              frequency === 'yearly'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            سنوي
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={['daily', 'biweekly', 'quarterly', 'semiannual'].includes(frequency)}
            disabled={hasSelectedCircle}
            onClick={() => setShowExtraDropdown((prev) => !prev)}
            className={cn(
              'py-1.5 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-0.5',
              ['daily', 'biweekly', 'quarterly', 'semiannual'].includes(frequency)
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <span className="truncate">
              {frequency === 'daily'
                ? 'يومي'
                : frequency === 'biweekly'
                  ? 'أسبوعين'
                  : frequency === 'quarterly'
                    ? 'ربع سنوي'
                    : frequency === 'semiannual'
                      ? 'نصف سنوي'
                      : 'أخرى'}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </button>
        </div>

        {/* Dropdown menu for extra frequencies */}
        {showExtraDropdown && !hasSelectedCircle && (
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
                  setFrequency(f.value)
                  setShowExtraDropdown(false)
                }}
                className={cn(
                  'px-2.5 py-2 text-xs font-bold rounded-lg text-start flex items-center justify-between transition-colors',
                  frequency === f.value
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                )}
              >
                <span>{f.label}</span>
                {frequency === f.value && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Money Circle Link / Skip Month */}
      {type === 'expense' && availableCircles.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
          <label htmlFor="recurring-circle-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            ربط مع جمعية نشطة (تخطي الخصم في شهر الاستلام):
          </label>
          <select
            id="recurring-circle-select"
            value={circleId}
            disabled={isCircleLinked}
            onChange={(e) => {
              const selectedId = e.target.value
              const prevCircleId = circleId
              setCircleId(selectedId)
              if (selectedId) {
                const c = availableCircles.find((circ) => circ.id === selectedId)
                if (c) {
                  setSkipMonth(c.myTurnMonth)
                  setFrequency('monthly')
                  if (!title) setTitle(`قسط ${c.name}`)
                  setAmountStr(String(fromFils(c.monthlyAmountFils)))
                  const cStart = c.startDate instanceof Date ? c.startDate : new Date(c.startDate)
                  setStartDateStr(format(cStart, 'yyyy-MM-dd'))
                  const cEnd = addMonths(cStart, c.membersCount - 1)
                  setEndDateStr(format(cEnd, 'yyyy-MM-dd'))
                  setHasEndDate(true)
                }
              } else {
                setSkipMonth(undefined)
                setHasEndDate(false)
                setEndDateStr('')
                setStartDateStr(format(new Date(), 'yyyy-MM-dd'))
                const prevCircle = availableCircles.find((circ) => circ.id === prevCircleId)
                if (prevCircle && title === `قسط ${prevCircle.name}`) {
                  setTitle('')
                }
              }
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
        <DatePickerInput
          id="rec-start-date"
          label="تاريخ البداية"
          value={startDateStr}
          onChange={(val) => setStartDateStr(val)}
          disabled={hasSelectedCircle}
          required
        />

        {hasEndDate ? (
          <DatePickerInput
            id="rec-end-date"
            label="تاريخ الانتهاء"
            value={endDateStr}
            onChange={(val) => setEndDateStr(val)}
            disabled={hasSelectedCircle}
            required={hasEndDate}
          />
        ) : null}
      </div>

      {/* Checkbox toggle for end date */}
      <div>
        <Toggle
          checked={hasEndDate}
          onChange={setHasEndDate}
          disabled={hasSelectedCircle}
          label="تحديد تاريخ انتهاء"
          description="تتوقف المعاملة المتكررة تلقائياً بعد هذا التاريخ"
        />
      </div>

      {/* Require Confirmation Toggle */}
      <div>
        <Toggle
          checked={requireConfirmation}
          onChange={setRequireConfirmation}
          label="طلب تأكيد الدفعة يدوياً قبل التسجيل"
          description="تنبيهك قبل التسجيل لإتاحة مراجعة أو تعديل المبلغ الفعلي (مناسب لفواتير الكهرباء والماء المتغيرة)"
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
      <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
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
  onSubmit,
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
        onSubmit={onSubmit}
      />
    </Modal>
  )
}
