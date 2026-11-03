import React, { useState, useMemo, useEffect } from 'react'
import { Link, useSearchParams, useInRouterContext } from 'react-router'
import { format as formatDate, differenceInDays, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Crown,
  History,
  CheckCircle2,
  SkipForward,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Toggle } from '../components/ui/Toggle'
import { Input } from '../components/ui/Input'
import { RecurringForm } from '../components/RecurringForm'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { FormattedMoney } from '../components/ui/FormattedMoney'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useTransactions } from '../hooks/useTransactions'
import { useCurrency } from '../hooks/useCurrency'
import { useToast } from '../hooks/useToast'
import { useUserSettings } from '../hooks/useUserSettings'
import {
  updateRecurring,
  deleteRecurring,
  processDueRecurring,
  confirmRecurringOccurrence,
  skipRecurringOccurrence,
} from '../services/recurring'
import { isUserTurnMonth, updateMoneyCircle } from '../services/moneyCircles'
import { calculateMonthlyEquivalent, isOccurrenceSkipped } from '../lib/recurring'
import { toFils, fromFils } from '../lib/money'
import { toWesternDigits } from '../lib/dates'
import { cn } from '../lib/cn'
import type { Recurring, Frequency } from '../types'

const ParamWatcher: React.FC<{
  recurringItems: Recurring[]
  onConfirm: (item: Recurring) => void
}> = ({ recurringItems, onConfirm }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const confirmId = searchParams.get('confirmId')
    if (!confirmId || recurringItems.length === 0) return
    const target = recurringItems.find((r) => r.id === confirmId)
    if (target) {
      onConfirm(target)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('confirmId')
          return next
        },
        { replace: true }
      )
    }
  }, [searchParams, setSearchParams, recurringItems, onConfirm])

  return null
}

export const RecurringPage: React.FC = () => {
  const inRouter = useInRouterContext()
  const { user } = useAuth()
  const { data: settings } = useUserSettings()
  const monthStartDay = settings?.monthStartDay ?? 1
  const { data: recurringItems, loading: recurringLoading } = useRecurring()
  const { data: categories } = useCategories()
  const { data: circles } = useMoneyCircles()
  const { showToast } = useToast()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Recurring | null>(null)
  const [itemToDelete, setItemToDelete] = useState<Recurring | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: allTransactions } = useTransactions()
  const { config: currencyConfig } = useCurrency()

  const [confirmingItem, setConfirmingItem] = useState<Recurring | null>(null)
  const [confirmAmountStr, setConfirmAmountStr] = useState('')
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const [historyItem, setHistoryItem] = useState<Recurring | null>(null)
  const [skippingId, setSkippingId] = useState<string | null>(null)

  const handleOpenConfirm = (item: Recurring) => {
    setConfirmingItem(item)
    setConfirmAmountStr(String(fromFils(item.amountFils)))
    setConfirmError(null)
  }

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !confirmingItem) return
    setConfirmError(null)

    const parsedFils = toFils(confirmAmountStr, currencyConfig.decimals)
    if (parsedFils <= 0) {
      setConfirmError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    setConfirmSubmitting(true)
    try {
      await confirmRecurringOccurrence(user.uid, confirmingItem, parsedFils)
      showToast('تم تأكيد وتسجيل المعاملة بنجاح وتحديث الموعد القادم', 'success')
      setConfirmingItem(null)
    } catch (err) {
      console.error('Failed to confirm recurring occurrence:', err)
      setConfirmError('تعذر تأكيد المعاملة. يرجى المحاولة مرة أخرى.')
    } finally {
      setConfirmSubmitting(false)
    }
  }

  const handleSkipOccurrence = async (item: Recurring) => {
    if (!user) return
    setSkippingId(item.id)
    try {
      await skipRecurringOccurrence(user.uid, item)
      showToast('تم تخطي هذه الدورة بنجاح والانتقال للموعد القادم', 'info')
    } catch (err) {
      console.error('Failed to skip recurring occurrence:', err)
      showToast('تعذر تخطي الدورة', 'error')
    } finally {
      setSkippingId(null)
    }
  }

  // Map categoryId to Category
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  // Monthly equivalents (waives turn month for circle recurring items)
  const monthlyStats = useMemo(() => {
    return calculateMonthlyEquivalent(recurringItems, new Date())
  }, [recurringItems])

  // Active expense commitments due within 7 days
  const dueWithin7DaysStats = useMemo(() => {
    const todayStart = startOfDay(new Date())
    let totalFils = 0
    let count = 0
    for (const item of recurringItems) {
      if (!item.active || item.type !== 'expense') continue
      const nextD = startOfDay(item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate))
      const diff = differenceInDays(nextD, todayStart)
      if (diff <= 7) {
        totalFils += item.amountFils
        count += 1
      }
    }
    return { totalFils, count }
  }, [recurringItems])

  // Sorted recurring items: active (active !== false) first, paused (active === false) last.
  // Within each group, closest upcoming nextDate ascending first.
  const sortedRecurringItems = useMemo(() => {
    return [...recurringItems].sort((a, b) => {
      const aActive = a.active !== false
      const bActive = b.active !== false
      if (aActive !== bActive) {
        return aActive ? -1 : 1
      }
      const aTime = a.nextDate instanceof Date ? a.nextDate.getTime() : new Date(a.nextDate).getTime()
      const bTime = b.nextDate instanceof Date ? b.nextDate.getTime() : new Date(b.nextDate).getTime()
      return aTime - bTime
    })
  }, [recurringItems])

  const handleToggleActive = async (item: Recurring) => {
    if (!user) return
    const newActive = !item.active
    try {
      await updateRecurring(user.uid, item.id, { active: newActive })
      if (newActive) {
        await processDueRecurring(user.uid)
      }
      showToast(
        newActive
          ? 'تم تفعيل المعاملة المتكررة'
          : 'تم إيقاف المعاملة المتكررة مؤقتاً',
        'info'
      )
    } catch (err) {
      console.error('Failed to toggle recurring item:', err)
      showToast('تعذر تغيير حالة المعاملة', 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!user || !itemToDelete) return
    setDeleting(true)
    try {
      if (itemToDelete.circleId) {
        await updateMoneyCircle(
          user.uid,
          itemToDelete.circleId,
          { recurringId: '' },
          { monthStartDay }
        ).catch(() => {})
      }
      await deleteRecurring(user.uid, itemToDelete.id)
      showToast('تم حذف المعاملة المتكررة بنجاح', 'info')
      setItemToDelete(null)
    } catch (err) {
      console.error('Failed to delete recurring item:', err)
      showToast('تعذر حذف المعاملة', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const frequencyLabels: Record<Frequency, string> = {
    daily: 'يومي',
    weekly: 'أسبوعي',
    biweekly: 'كل أسبوعين',
    monthly: 'شهري',
    quarterly: 'ربع سنوي',
    semiannual: 'نصف سنوي',
    yearly: 'سنوي',
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {inRouter && (
        <ParamWatcher
          recurringItems={recurringItems}
          onConfirm={(item) => {
            setConfirmingItem(item)
            setConfirmAmountStr(String(fromFils(item.amountFils)))
            setConfirmError(null)
          }}
        />
      )}
      {/* Page Header */}
      <PageHeader
        title="المعاملات المتكررة"
        subtitle="جدولة المصاريف والمداخيل الدورية كالراتب والإيجار والاشتراكات"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => {
              setEditingItem(null)
              setIsFormOpen(true)
            }}
            className="font-semibold"
          >
            إضافة متكررة
          </Button>
        }
      />

      {/* KPI Cards: Monthly Income, Expense, Due in 7 Days */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Income Card */}
        <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              مداخيل ثابتة شهرياً
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
              <FormattedMoney amountFils={monthlyStats.monthlyIncome} />
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Expense Card */}
        <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              مصاريف ثابتة شهرياً
            </span>
            <span className="text-xl sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
              <FormattedMoney amountFils={monthlyStats.monthlyExpense} />
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* Due in 7 Days Card */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              مستحق خلال 7 أيام
            </span>
            <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 select-none">
              <FormattedMoney amountFils={dueWithin7DaysStats.totalFils} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block mt-0.5">
              {dueWithin7DaysStats.count === 0 ? 'لا توجد دفعات قريبة' : `${dueWithin7DaysStats.count} دفعات قادمة`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Recurring Items Grid */}
      {recurringLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none animate-pulse"
            />
          ))}
        </div>
      ) : recurringItems.length === 0 ? (
        <EmptyState
          icon={<RefreshCw className="w-8 h-8" />}
          title="لا توجد معاملات متكررة"
          description="أضف التزاماتك الثابتة (رواتب، إيجار، اشتراكات) ليقوم التطبيق بتسجيلها تلقائياً عند حلول موعدها."
          action={
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => {
                setEditingItem(null)
                setIsFormOpen(true)
              }}
            >
              إضافة أول معاملة متكررة
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedRecurringItems.map((item) => {
            const cat = categoryMap.get(item.categoryId)
            const icon = cat?.icon ?? '➕'
            const color = cat?.color ?? '#94A3B8'
            const name = cat?.name ?? 'غير مصنف'
            const isExpense = item.type === 'expense'
            const isCircleItem = Boolean(item.circleId || item.skipMonth)
            const linkedCircle = isCircleItem
              ? circles.find((c) => c.id === item.circleId || c.recurringId === item.id)
              : undefined
            const isCurrentMonthTurn =
              isCircleItem &&
              (linkedCircle
                ? isUserTurnMonth(linkedCircle, new Date(), monthStartDay)
                : isOccurrenceSkipped(item, new Date()))

            const nextDateObj = item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate)
            const diffDays = differenceInDays(startOfDay(nextDateObj), startOfDay(new Date()))
            const relativeDueText =
              diffDays < 0
                ? 'مستحقة'
                : diffDays === 0
                  ? 'اليوم'
                  : diffDays === 1
                    ? 'غداً'
                    : diffDays === 2
                      ? 'بعد يومين'
                      : diffDays <= 10
                        ? `بعد ${diffDays} أيام`
                        : `بعد ${diffDays} يوماً`

            const nextDateFormatted = toWesternDigits(
              formatDate(nextDateObj, 'd LLLL yyyy', { locale: ar })
            )

            return (
              <div
                key={item.id}
                className={cn(
                  'group rounded-2xl p-4 sm:p-5 border border-[#E4E4E7] dark:border-[#27272A] transition-all flex flex-col justify-between shadow-2xs dark:shadow-none',
                  item.active
                    ? 'bg-white dark:bg-[#121215]'
                    : 'bg-zinc-50/80 dark:bg-zinc-900/40 opacity-70'
                )}
              >
                {/* Top Row: Category + Frequency Badge */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}25` }}
                    >
                      <CategoryIcon icon={icon} color={color} size="md" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 block truncate">
                        {item.title || name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {item.title ? (
                          <>
                            <span className="font-medium text-zinc-600 dark:text-zinc-300">{name}</span>
                            {item.note ? <span>•</span> : null}
                          </>
                        ) : null}
                        {item.note ? <span>{item.note}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!item.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-750 text-zinc-700 dark:text-zinc-300 font-semibold">
                        متوقفة مؤقتاً
                      </span>
                    )}
                    {item.requireConfirmation && (
                      <span
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-bold border',
                          item.active &&
                            (item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate)) <=
                              new Date()
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                        )}
                      >
                        {item.active &&
                        (item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate)) <=
                          new Date()
                          ? 'بانتظار تأكيدك'
                          : 'تأكيد يدوي'}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border border-[#E4E4E7] dark:border-[#27272A]">
                      {frequencyLabels[item.frequency]}
                    </span>
                  </div>
                </div>

                {/* Middle: Amount & Relative Due */}
                <div className="my-3 flex items-baseline justify-between gap-2">
                  <div
                    className={cn(
                      'text-xl sm:text-2xl font-black select-none',
                      isExpense
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    <FormattedMoney amountFils={item.amountFils} withSign={item.type} />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                    {relativeDueText}
                  </span>
                </div>

                {/* Circle Skip Month Indicator */}
                {isCircleItem && (
                  <div className="my-1.5">
                    {isCurrentMonthTurn ? (
                      <Link
                        to="/tools?tool=circles"
                        className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-between hover:bg-zinc-200/60 dark:hover:bg-zinc-750 transition-colors"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>دورك في الاستلام هذا الشهر!</span>
                        </span>
                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded-full font-bold">
                          معفى من الخصم
                        </span>
                      </Link>
                    ) : (
                      <Link
                        to="/tools?tool=circles"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <span>قسط جمعية{item.skipMonth ? ` (معفى في الشهر ${item.skipMonth})` : ''}</span>
                        <span className="text-[10px]">←</span>
                      </Link>
                    )}
                  </div>
                )}

                {/* Due Confirmation Banner for manual confirmation items */}
                {item.requireConfirmation &&
                  item.active &&
                  (item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate)) <=
                    new Date() && (
                    <div className="my-2 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>هذه الدفعة مستحقة وبانتظار تأكيدك</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenConfirm(item)}
                          className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تأكيد وتسجيل الآن</span>
                        </button>
                        <button
                          type="button"
                          disabled={skippingId === item.id}
                          onClick={() => handleSkipOccurrence(item)}
                          className="py-1.5 px-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="تخطي دورة الاستحقاق الحالية دون خصم"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          <span>تخطي</span>
                        </button>
                      </div>
                    </div>
                  )}

                {/* Bottom Row: Next date, Active toggle, Actions */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 truncate">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">الموعد القادم: {nextDateFormatted}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.active &&
                      !isCircleItem &&
                      !(
                        item.requireConfirmation &&
                        (item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate)) <=
                          new Date()
                      ) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenConfirm(item)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:text-emerald-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            aria-label="تسجيل دفعة هذه الدورة الآن"
                            title="تسجيل دفعة هذه الدورة الآن"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={skippingId === item.id}
                            onClick={() => handleSkipOccurrence(item)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-100 dark:hover:text-amber-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                            aria-label="تخطي الدورة القادمة"
                            title="تخطي هذه الدورة والانتقال للموعد التالي"
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </>
                      )}

                    {/* Payment History button */}
                    <button
                      type="button"
                      onClick={() => setHistoryItem(item)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:text-blue-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      aria-label="سجل الدفعات"
                      title="عرض سجل دفعات هذه المعاملة"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item)
                        setIsFormOpen(true)
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      aria-label="تعديل المعاملة المتكررة"
                      title="تعديل المعاملة المتكررة"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:text-red-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      aria-label="حذف المعاملة المتكررة"
                      title="حذف المعاملة المتكررة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Toggle button */}
                    <Toggle
                      checked={item.active}
                      onChange={() => handleToggleActive(item)}
                      aria-label={item.active ? 'إيقاف مؤقت' : 'تفعيل'}
                      className="shrink-0 ms-1"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recurring Form Modal */}
      <RecurringForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialRecurring={editingItem}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="تأكيد حذف المعاملة المتكررة"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              هل أنت متأكد من حذف هذه المعاملة المتكررة؟ لن يتم إنشاء أي معاملات مستقبلية منها.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setItemToDelete(null)}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'جاري الحذف...' : 'حذف المعاملة المتكررة'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Due Occurrence Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmingItem)}
        onClose={() => setConfirmingItem(null)}
        title="تأكيد وتسجيل الدفعة الدورية"
      >
        {confirmingItem && (
          <form onSubmit={handleConfirmSubmit} noValidate className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block">
                المعاملة:
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                {confirmingItem.title || categoryMap.get(confirmingItem.categoryId)?.name || 'معاملة دورية'}
              </span>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                تاريخ الاستحقاق:{' '}
                {toWesternDigits(
                  formatDate(
                    confirmingItem.nextDate instanceof Date
                      ? confirmingItem.nextDate
                      : new Date(confirmingItem.nextDate),
                    'd LLLL yyyy',
                    { locale: ar }
                  )
                )}
              </div>
            </div>

            <div>
              <Input
                label="المبلغ المسجل لهذه الدفعة"
                type="text"
                inputMode="decimal"
                value={confirmAmountStr}
                onChange={(e) => {
                  setConfirmAmountStr(e.target.value)
                  setConfirmError(null)
                }}
                required
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                يمكنك تعديل المبلغ الفعلي لهذه الدفعة دون تغيير المبلغ الأساسي للمعاملة.
              </p>
            </div>

            {confirmError && (
              <div
                role="alert"
                className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-800/50"
              >
                {confirmError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setConfirmingItem(null)}
                disabled={confirmSubmitting}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={confirmSubmitting}
              >
                {confirmSubmitting ? 'جاري التأكيد...' : 'تأكيد وتسجيل المعاملة'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        isOpen={Boolean(historyItem)}
        onClose={() => setHistoryItem(null)}
        title={
          historyItem
            ? `سجل دفعات: ${historyItem.title || categoryMap.get(historyItem.categoryId)?.name || 'المعاملة'}`
            : 'سجل الدفعات'
        }
      >
        {historyItem && (
          <div className="space-y-3">
            {(() => {
              const historyTxs = allTransactions
                .filter((t) => t.recurringId === historyItem.id)
                .sort((a, b) => {
                  const aDate = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()
                  const bDate = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()
                  return bDate - aDate
                })

              if (historyTxs.length === 0) {
                return (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    لم يتم تسجيل أي دفعات سابقة لهذه المعاملة المتكررة حتى الآن.
                  </div>
                )
              }

              return (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {historyTxs.map((tx) => {
                    const txDateFormatted = toWesternDigits(
                      formatDate(
                        tx.date instanceof Date ? tx.date : new Date(tx.date),
                        'd LLLL yyyy',
                        { locale: ar }
                      )
                    )
                    return (
                      <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {tx.title || txDateFormatted}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            {txDateFormatted}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'font-black text-sm',
                            tx.type === 'expense'
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          <FormattedMoney amountFils={tx.amountFils} withSign={tx.type} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setHistoryItem(null)}
              >
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
