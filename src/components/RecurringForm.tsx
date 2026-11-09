import React, { useState, useMemo, useEffect } from 'react'
import { format, addMonths } from 'date-fns'
import { Check, Info, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { DatePickerInput } from './ui/DatePickerInput'
import { Select } from './ui/Select'
import { SegmentedControl } from './ui/SegmentedControl'
import { Toggle } from './ui/Toggle'
import { CategoryIcon } from './ui/CategoryIcon'
import { CategoryForm } from './CategoryForm'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useRecurring } from '../hooks/useRecurring'
import { useToast } from '../hooks/useToast'
import { useUserSettings } from '../hooks/useUserSettings'
import { addRecurring, updateRecurring, processDueRecurring } from '../services/recurring'
import { updateMoneyCircle } from '../services/moneyCircles'
import { toFils, fromFils, MAX_AMOUNT_FILS } from '../lib/money'
import { useCurrency } from '../hooks/useCurrency'
import { parseLocalDateInput, toWesternDigits } from '../lib/dates'
import { calculateNextDateOnEdit, advanceDateWithTargetDay, getNextCircleDueDate } from '../lib/recurring'
import { getCategoryUsageMap, sortCategoriesUnified } from '../lib/categoryUsage'
import { triggerHaptic } from '../lib/haptics'
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
  skipMonths?: number[]
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
  onDirtyChange?: (isDirty: boolean) => void
}

const RecurringFormContent: React.FC<RecurringFormContentProps> = ({
  initialRecurring,
  defaultType,
  onClose,
  onSuccess,
  onSubmit,
  onDirtyChange,
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
  const [scheduleNextIfPast, setScheduleNextIfPast] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    onDirtyChange?.(
      Boolean(
        initialRecurring ||
          amountStr.trim() ||
          title.trim() ||
          note.trim()
      )
    )
  }, [onDirtyChange, initialRecurring, amountStr, title, note])

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
  const [skipMonths, setSkipMonths] = useState<number[] | undefined>(initialRecurring?.skipMonths)
  const [requireConfirmation, setRequireConfirmation] = useState<boolean>(
    Boolean(initialRecurring?.requireConfirmation)
  )
  const [showExtraDropdown, setShowExtraDropdown] = useState(false)

  const isCircleLinked = Boolean(initialRecurring?.circleId)
  const hasSelectedCircle = Boolean(circleId || isCircleLinked)

  const { data: userSettings } = useUserSettings()
  const usageMap = useMemo(() => getCategoryUsageMap(), [])

  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false)
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false)

  // Filter available categories for current transaction type
  // Preserve recurring item's category even if archived and sort unified
  const originalCatId = initialRecurring?.categoryId
  const availableCategories = useMemo(() => {
    const filtered = categories.filter(
      (c) => c.type === type && (!c.archived || c.id === originalCatId)
    )
    return sortCategoriesUnified(
      filtered,
      usageMap,
      userSettings?.categorySortMode || 'usage'
    )
  }, [categories, type, originalCatId, usageMap, userSettings?.categorySortMode])

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

    if (amountFils > MAX_AMOUNT_FILS) {
      setError('المبلغ يتجاوز الحد الأقصى المسموح به')
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
          skipMonths: skipMonths && skipMonths.length > 0 ? skipMonths : undefined,
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
            skipMonths: skipMonths && skipMonths.length > 0 ? skipMonths : undefined,
            requireConfirmation,
          })
        }

        // Two-way sync with money circles
        if (initialRecurring.circleId && initialRecurring.circleId !== circleId) {
          await updateMoneyCircle(user.uid, initialRecurring.circleId, { recurringId: '' }).catch(() => {})
        }
        if (circleId && initialRecurring.circleId !== circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: initialRecurring.id }).catch(() => {})
        }

        // Synchronize circle amounts if recurring installment amount changed
        const effectiveCircleId = circleId || initialRecurring.circleId
        if (effectiveCircleId) {
          const linked = circles.find((c) => c.id === effectiveCircleId)
          if (linked) {
            const expectedCircleMonthly =
              linked.shareType === 'half'
                ? amountFils * 2
                : linked.shareType === 'double'
                  ? Math.round(amountFils / 2)
                  : amountFils
            if (linked.monthlyAmountFils !== expectedCircleMonthly) {
              await updateMoneyCircle(user.uid, linked.id, {
                monthlyAmountFils: expectedCircleMonthly,
                totalAmountFils: expectedCircleMonthly * linked.membersCount,
              }).catch(() => {})
            }
          }
        }

        await processDueRecurring(user.uid)
        triggerHaptic('light')
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
              userMember?.paymentsByMonth,
              new Date(),
              skipMonths
            )
          : parsedStartDate

        // Retroactive protection: if start date is in the past and not a circle, start from the upcoming cycle
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)
        const startOfStart = new Date(parsedStartDate.getTime())
        startOfStart.setHours(0, 0, 0, 0)
        if (!linkedCircle && startOfStart < startOfToday && scheduleNextIfPast) {
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
          skipMonths: skipMonths && skipMonths.length > 0 ? skipMonths : undefined,
          requireConfirmation,
        })

        // Two-way sync with money circles
        if (circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: recId }).catch(() => {})

          // Synchronize circle amounts if recurring installment amount changed
          if (linkedCircle) {
            const expectedCircleMonthly =
              linkedCircle.shareType === 'half'
                ? amountFils * 2
                : linkedCircle.shareType === 'double'
                  ? Math.round(amountFils / 2)
                  : amountFils
            if (linkedCircle.monthlyAmountFils !== expectedCircleMonthly) {
              await updateMoneyCircle(user.uid, linkedCircle.id, {
                monthlyAmountFils: expectedCircleMonthly,
                totalAmountFils: expectedCircleMonthly * linkedCircle.membersCount,
              }).catch(() => {})
            }
          }
        }

        await processDueRecurring(user.uid)
        triggerHaptic('light')
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
          className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1"
        >
          المبلغ
        </label>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border transition-all',
            error && amountStr && toFils(amountStr, currencyConfig.decimals) <= 0
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-[#E4E4E7] dark:border-[#27272A] focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20'
          )}
        >
          <input
            id="rec-amount"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => {
              setAmountStr(toWesternDigits(e.target.value))
              setError(null)
            }}
            placeholder={currencyConfig.decimals === 3 ? '0.000' : '0.00'}
            className="w-full bg-transparent text-2xl lg:text-3xl font-black text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
            autoFocus={!isEditing && !isTouchDevice}
          />
          <span className="text-base font-bold text-zinc-500 dark:text-zinc-400 select-none pe-1">
            {currencyConfig.symbol}
          </span>
        </div>
      </div>

      {/* Category Chips Grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
            التصنيف
          </label>
          <button
            type="button"
            onClick={() => setIsCreateCatOpen(true)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>تصنيف جديد</span>
          </button>
        </div>
        {categoriesLoading ? (
          <div className="grid grid-cols-3 gap-1.5 p-0.5 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 flex items-center gap-2 p-2"
              >
                <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
        ) : availableCategories.length === 0 ? (
          <div className="py-2.5 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
            لا توجد تصنيفات متاحة لهذا النوع
          </div>
        ) : (
          <div>
            <div
              className={cn(
                'grid grid-cols-3 gap-1.5 p-0.5',
                isCategoriesExpanded ? 'max-h-48 overflow-y-auto' : ''
              )}
            >
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
                      'flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none min-w-0',
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 ring-2 ring-blue-600/20'
                        : 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    )}
                  >
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                      <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                    </span>
                    <span className="truncate flex-1">
                      {cat.name}
                      {cat.archived ? ' (مؤرشف)' : ''}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
            {availableCategories.length > 6 && (
              <button
                type="button"
                onClick={() => setIsCategoriesExpanded((prev) => !prev)}
                className="mt-1.5 w-full py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1 transition-colors cursor-pointer"
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
        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
          التكرار
        </label>
        <div role="radiogroup" className="grid grid-cols-4 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
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
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
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
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
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
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
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
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
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
          <div className="mt-2 p-1.5 bg-white dark:bg-[#121215] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] shadow-lg grid grid-cols-2 gap-1.5">
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
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                <span>{f.label}</span>
                {frequency === f.value && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Money Circle Link / Skip Month */}
      {type === 'expense' && availableCircles.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
          <Select
            id="recurring-circle-select"
            label="ربط مع جمعية نشطة (تخطي الخصم في شهر الاستلام):"
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
                  if (c.shareType === 'double' && c.secondTurnMonth) {
                    setSkipMonths([c.myTurnMonth, c.secondTurnMonth])
                  } else {
                    setSkipMonths([c.myTurnMonth])
                  }
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
                setSkipMonths(undefined)
                setHasEndDate(false)
                setEndDateStr('')
                setStartDateStr(format(new Date(), 'yyyy-MM-dd'))
                const prevCircle = availableCircles.find((circ) => circ.id === prevCircleId)
                if (prevCircle && title === `قسط ${prevCircle.name}`) {
                  setTitle('')
                }
              }
            }}
          >
            <option value="">-- ليست مرتبطة بجمعية --</option>
            {availableCircles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (قسط: {formatCurrency(c.monthlyAmountFils)} - شهر استلامك: {c.myTurnMonth})
              </option>
            ))}
          </Select>
          {circleId && (skipMonths?.length || skipMonth) && (
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-bold flex items-center gap-1">
              <span>
                ✓ لن يتم خصم قسط منك في الشهر {skipMonths && skipMonths.length > 0 ? skipMonths.join(' و ') : skipMonth} لأن هذا الشهر هو دور استلامك للجمعية!
              </span>
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

      {!isEditing &&
        !hasSelectedCircle &&
        parseLocalDateInput(startDateStr) < new Date(new Date().setHours(0, 0, 0, 0)) && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A]">
            <Toggle
              checked={scheduleNextIfPast}
              onChange={setScheduleNextIfPast}
              label="تاريخ البداية في الماضي"
              description="جدولة الاستحقاق القادم من تاريخ اليوم فصاعداً دون تسجيل دفعات سابقة بأثر رجعي"
            />
          </div>
        )}

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
          description="تنبيهك لمراجعة أو تعديل المبلغ قبل تسجيله"
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
      <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
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

      {isCreateCatOpen && (
        <CategoryForm
          isOpen={isCreateCatOpen}
          onClose={() => setIsCreateCatOpen(false)}
          defaultType={type}
          onSuccess={(newCatId, newCatType) => {
            if (newCatId) {
              if (newCatType && newCatType !== type && !isEditing && !hasSelectedCircle) {
                setType(newCatType)
              }
              setCategoryId(newCatId)
            }
            setIsCreateCatOpen(false)
          }}
        />
      )}
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
  const [isDirty, setIsDirty] = useState(false)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRecurring ? 'تعديل المعاملة المتكررة' : 'إضافة معاملة متكررة'}
      closeOnBackdropClick={!isDirty && !initialRecurring}
    >
      <RecurringFormContent
        key={initialRecurring ? `edit-${initialRecurring.id}` : `new-${defaultType}`}
        initialRecurring={initialRecurring}
        defaultType={defaultType}
        onClose={onClose}
        onSuccess={onSuccess}
        onSubmit={onSubmit}
        onDirtyChange={setIsDirty}
      />
    </Modal>
  )
}
