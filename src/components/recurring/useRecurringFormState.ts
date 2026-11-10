import { useState, useMemo, useEffect } from 'react'
import { format, addMonths } from 'date-fns'
import { useAuth } from '../../hooks/useAuth'
import { useCategories } from '../../hooks/useCategories'
import { useMoneyCircles } from '../../hooks/useMoneyCircles'
import { useRecurring } from '../../hooks/useRecurring'
import { useToast } from '../../hooks/useToast'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useCurrency } from '../../hooks/useCurrency'
import { addRecurring, updateRecurring, processDueRecurring } from '../../services/recurring'
import { updateMoneyCircle } from '../../services/moneyCircles'
import { toFils, fromFils, MAX_AMOUNT_FILS } from '../../lib/money'
import { parseLocalDateInput } from '../../lib/dates'
import { calculateNextDateOnEdit, advanceDateWithTargetDay, getNextCircleDueDate } from '../../lib/recurring'
import { getCategoryUsageMap, sortCategoriesUnified } from '../../lib/categoryUsage'
import { triggerHaptic } from '../../lib/haptics'
import { syncCircleRecurringAmounts } from './recurringFormHelpers'
import type { Recurring, TxType, Frequency } from '../../types'

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

export interface UseRecurringFormStateProps {
  initialRecurring?: Recurring | null
  defaultType: TxType
  onClose: () => void
  onSuccess?: () => void
  onSubmit?: (payload: RecurringSubmitPayload) => Promise<void> | void
  onDirtyChange?: (isDirty: boolean) => void
}

export function useRecurringFormState({
  initialRecurring,
  defaultType,
  onClose,
  onSuccess,
  onSubmit,
  onDirtyChange,
}: UseRecurringFormStateProps) {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const { showToast } = useToast()
  const { config: currencyConfig } = useCurrency()

  const isEditing = Boolean(initialRecurring)
  const [type, setType] = useState<TxType>(initialRecurring ? initialRecurring.type : defaultType)
  const [amountStr, setAmountStr] = useState<string>(() =>
    initialRecurring ? String(fromFils(initialRecurring.amountFils)) : ''
  )
  const [categoryId, setCategoryId] = useState<string>(initialRecurring ? initialRecurring.categoryId : '')
  const [frequency, setFrequency] = useState<Frequency>(initialRecurring ? initialRecurring.frequency : 'monthly')
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    if (initialRecurring?.startDate) {
      const d = initialRecurring.startDate instanceof Date ? initialRecurring.startDate : new Date(initialRecurring.startDate)
      return format(d, 'yyyy-MM-dd')
    }
    return format(new Date(), 'yyyy-MM-dd')
  })
  const [hasEndDate, setHasEndDate] = useState<boolean>(Boolean(initialRecurring?.endDate))
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    if (initialRecurring?.endDate) {
      const d = initialRecurring.endDate instanceof Date ? initialRecurring.endDate : new Date(initialRecurring.endDate)
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
    onDirtyChange?.(Boolean(initialRecurring || amountStr.trim() || title.trim() || note.trim()))
  }, [onDirtyChange, initialRecurring, amountStr, title, note])

  const { data: circles } = useMoneyCircles()
  const { data: recurringList } = useRecurring()

  const availableCircles = useMemo(() => {
    return circles.filter((c) => {
      if (c.status !== 'active') return false
      if (initialRecurring?.circleId === c.id || (initialRecurring?.id && c.recurringId === initialRecurring.id)) return true
      if (c.recurringId) return false
      return !recurringList.some((r) => r.circleId === c.id && r.id !== initialRecurring?.id)
    })
  }, [circles, recurringList, initialRecurring])

  const [circleId, setCircleId] = useState<string>(initialRecurring?.circleId ?? '')
  const [skipMonth, setSkipMonth] = useState<number | undefined>(initialRecurring?.skipMonth)
  const [skipMonths, setSkipMonths] = useState<number[] | undefined>(initialRecurring?.skipMonths)
  const [requireConfirmation, setRequireConfirmation] = useState<boolean>(Boolean(initialRecurring?.requireConfirmation))
  const [showExtraDropdown, setShowExtraDropdown] = useState(false)

  const isCircleLinked = Boolean(initialRecurring?.circleId)
  const hasSelectedCircle = Boolean(circleId || isCircleLinked)

  const { data: userSettings } = useUserSettings()
  const usageMap = useMemo(() => getCategoryUsageMap(), [])
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false)
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false)

  const originalCatId = initialRecurring?.categoryId
  const availableCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === type && (!c.archived || c.id === originalCatId))
    return sortCategoriesUnified(filtered, usageMap, userSettings?.categorySortMode || 'usage')
  }, [categories, type, originalCatId, usageMap, userSettings?.categorySortMode])

  const activeCategoryId = categoryId && availableCategories.some((c) => c.id === categoryId) ? categoryId : availableCategories[0]?.id ?? ''

  const displayedCategories = useMemo(() => {
    if (isCategoriesExpanded || availableCategories.length <= 6) return availableCategories
    const top6 = availableCategories.slice(0, 6)
    if (activeCategoryId && !top6.some((c) => c.id === activeCategoryId)) {
      const selected = availableCategories.find((c) => c.id === activeCategoryId)
      if (selected) return [...availableCategories.slice(0, 5), selected]
    }
    return top6
  }, [availableCategories, isCategoriesExpanded, activeCategoryId])

  const handleCircleChange = (selectedId: string) => {
    const prevCircleId = circleId
    setCircleId(selectedId)
    if (selectedId) {
      const c = availableCircles.find((circ) => circ.id === selectedId)
      if (c) {
        setSkipMonth(c.myTurnMonth)
        setSkipMonths(c.shareType === 'double' && c.secondTurnMonth ? [c.myTurnMonth, c.secondTurnMonth] : [c.myTurnMonth])
        setFrequency('monthly')
        if (!title) setTitle(`قسط ${c.name}`)
        setAmountStr(String(fromFils(c.monthlyAmountFils)))
        const cStart = c.startDate instanceof Date ? c.startDate : new Date(c.startDate)
        setStartDateStr(format(cStart, 'yyyy-MM-dd'))
        setEndDateStr(format(addMonths(cStart, c.membersCount - 1), 'yyyy-MM-dd'))
        setHasEndDate(true)
      }
    } else {
      setSkipMonth(undefined)
      setSkipMonths(undefined)
      setHasEndDate(false)
      setEndDateStr('')
      setStartDateStr(format(new Date(), 'yyyy-MM-dd'))
      const prevCircle = availableCircles.find((circ) => circ.id === prevCircleId)
      if (prevCircle && title === `قسط ${prevCircle.name}`) setTitle('')
    }
  }

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
        const initialStart = initialRecurring.startDate instanceof Date ? initialRecurring.startDate : new Date(initialRecurring.startDate)
        const startDateChanged = format(initialStart, 'yyyy-MM-dd') !== format(parsedStartDate, 'yyyy-MM-dd')
        const frequencyChanged = initialRecurring.frequency !== frequency
        let nextDate: Date | undefined = undefined

        if (startDateChanged || frequencyChanged) {
          let candidate = calculateNextDateOnEdit(parsedStartDate, frequency)
          if (frequencyChanged && !startDateChanged) {
            const currentNext = initialRecurring.nextDate instanceof Date ? initialRecurring.nextDate : new Date(initialRecurring.nextDate)
            const startOfToday = new Date()
            startOfToday.setHours(0, 0, 0, 0)
            const todayEnd = new Date()
            todayEnd.setHours(23, 59, 59, 999)
            const startOfCandidate = new Date(candidate.getTime())
            startOfCandidate.setHours(0, 0, 0, 0)
            if (startOfCandidate.getTime() === startOfToday.getTime() && (currentNext > todayEnd || currentNext > candidate)) {
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
            ...payload,
            ...(nextDate ? { nextDate } : {}),
          })
        }

        if (initialRecurring.circleId && initialRecurring.circleId !== circleId) {
          await updateMoneyCircle(user.uid, initialRecurring.circleId, { recurringId: '' }).catch(() => {})
        }
        if (circleId && initialRecurring.circleId !== circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: initialRecurring.id }).catch(() => {})
        }

        const effectiveCircleId = circleId || initialRecurring.circleId
        if (effectiveCircleId) {
          await syncCircleRecurringAmounts(user.uid, effectiveCircleId, amountFils, circles)
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

        if (circleId) {
          await updateMoneyCircle(user.uid, circleId, { recurringId: recId }).catch(() => {})
          await syncCircleRecurringAmounts(user.uid, circleId, amountFils, circles)
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

  return {
    type,
    setType,
    amountStr,
    setAmountStr,
    categoryId,
    setCategoryId,
    frequency,
    setFrequency,
    startDateStr,
    setStartDateStr,
    hasEndDate,
    setHasEndDate,
    endDateStr,
    setEndDateStr,
    title,
    setTitle,
    note,
    setNote,
    scheduleNextIfPast,
    setScheduleNextIfPast,
    error,
    setError,
    submitting,
    availableCircles,
    circleId,
    skipMonth,
    skipMonths,
    requireConfirmation,
    setRequireConfirmation,
    showExtraDropdown,
    setShowExtraDropdown,
    isCircleLinked,
    hasSelectedCircle,
    isCategoriesExpanded,
    setIsCategoriesExpanded,
    isCreateCatOpen,
    setIsCreateCatOpen,
    categoriesLoading,
    availableCategories,
    activeCategoryId,
    displayedCategories,
    handleCircleChange,
    handleSubmit,
    isEditing,
    currencyConfig,
  }
}
