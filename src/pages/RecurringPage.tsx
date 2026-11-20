import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useInRouterContext } from 'react-router'
import { differenceInDays, startOfDay } from 'date-fns'
import {
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { RecurringForm } from '../components/RecurringForm'
import { RecurringKpiCards } from '../components/recurring/RecurringKpiCards'
import { RecurringItemCard } from '../components/recurring/RecurringItemCard'
import { RecurringDeleteModal } from '../components/recurring/RecurringDeleteModal'
import { RecurringConfirmModal } from '../components/recurring/RecurringConfirmModal'
import { RecurringDetailsModal } from '../components/recurring/RecurringDetailsModal'
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
import { updateMoneyCircle, depositCircleNetPayout } from '../services/moneyCircles'
import { calculateMonthlyEquivalent, isOccurrenceSkipped } from '../lib/recurring'
import { toFils, fromFils } from '../lib/money'
import type { Recurring, MoneyCircle } from '../types'

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
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('confirmId')
        return next
      }, { replace: true })
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

  const [selectedDetailsId, setSelectedDetailsId] = useState<string | null>(null)
  const [activeOverride, setActiveOverride] = useState<{ id: string; active: boolean } | null>(null)
  const [skippingId, setSkippingId] = useState<string | null>(null)
  const [depositingCircleId, setDepositingCircleId] = useState<string | null>(null)

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

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const effectiveOverride = useMemo(() => {
    if (!activeOverride) return null
    const current = recurringItems.find((r) => r.id === activeOverride.id)
    if (current && current.active === activeOverride.active) {
      return null
    }
    return activeOverride
  }, [recurringItems, activeOverride])

  const effectiveRecurringItems = useMemo(() => {
    if (!effectiveOverride) return recurringItems
    return recurringItems.map((item) =>
      item.id === effectiveOverride.id ? { ...item, active: effectiveOverride.active } : item
    )
  }, [recurringItems, effectiveOverride])

  const selectedDetailsItem = useMemo(() => {
    if (!selectedDetailsId) return null
    return effectiveRecurringItems.find((r) => r.id === selectedDetailsId) ?? null
  }, [effectiveRecurringItems, selectedDetailsId])

  const monthlyStats = useMemo(() => {
    return calculateMonthlyEquivalent(effectiveRecurringItems, new Date())
  }, [effectiveRecurringItems])

  const dueWithin7DaysStats = useMemo(() => {
    const todayStart = startOfDay(new Date())
    let totalFils = 0
    let count = 0
    for (const item of effectiveRecurringItems) {
      if (!item.active || item.type !== 'expense') continue
      const nextD = startOfDay(item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate))
      const diff = differenceInDays(nextD, todayStart)
      if (diff >= 0 && diff <= 7 && !isOccurrenceSkipped(item, nextD, settings?.monthStartDay)) {
        totalFils += item.amountFils
        count += 1
      }
    }
    return { totalFils, count }
  }, [effectiveRecurringItems, settings?.monthStartDay])

  const sortedRecurringItems = useMemo(() => {
    return [...effectiveRecurringItems].sort((a, b) => {
      const aActive = a.active !== false
      const bActive = b.active !== false
      if (aActive !== bActive) return aActive ? -1 : 1
      const aTime = a.nextDate instanceof Date ? a.nextDate.getTime() : new Date(a.nextDate).getTime()
      const bTime = b.nextDate instanceof Date ? b.nextDate.getTime() : new Date(b.nextDate).getTime()
      return aTime - bTime
    })
  }, [effectiveRecurringItems])

  const activeItems = useMemo(
    () => sortedRecurringItems.filter((r) => r.active !== false),
    [sortedRecurringItems]
  )
  const pausedItems = useMemo(
    () => sortedRecurringItems.filter((r) => r.active === false),
    [sortedRecurringItems]
  )
  const [userToggledPaused, setUserToggledPaused] = useState<boolean | null>(null)
  const isPausedExpanded =
    userToggledPaused !== null ? userToggledPaused : pausedItems.length <= 3

  const handleToggleActive = async (item: Recurring) => {
    if (!user) return
    const newActive = !item.active
    setActiveOverride({ id: item.id, active: newActive })
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
      setActiveOverride(null)
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
      if (selectedDetailsId === itemToDelete.id) {
        setSelectedDetailsId(null)
      }
    } catch (err) {
      console.error('Failed to delete recurring item:', err)
      showToast('تعذر حذف المعاملة', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleDepositCircleDirect = async (circle: MoneyCircle) => {
    if (!user) return
    setDepositingCircleId(circle.id)
    try {
      const defaultIncomeCat = categories.find((c) => c.type === 'income')
      await depositCircleNetPayout(user.uid, circle, defaultIncomeCat?.id || 'cat-custom-circle')
      showToast('تم إيداع صافي الجمعية في الرصيد بنجاح', 'success')
    } catch (err) {
      console.error('Failed to deposit circle payout:', err)
      showToast('تعذر إيداع صافي الجمعية', 'error')
    } finally {
      setDepositingCircleId(null)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {inRouter && (
        <ParamWatcher
          recurringItems={recurringItems}
          onConfirm={handleOpenConfirm}
        />
      )}
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

      <RecurringKpiCards
        monthlyIncome={monthlyStats.monthlyIncome}
        monthlyExpense={monthlyStats.monthlyExpense}
        dueWithin7DaysFils={dueWithin7DaysStats.totalFils}
        dueWithin7DaysCount={dueWithin7DaysStats.count}
      />

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
        <div className="space-y-6">
          {activeItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeItems.map((item) => (
                <RecurringItemCard
                  key={item.id}
                  item={item}
                  categoryMap={categoryMap}
                  circles={circles}
                  monthStartDay={monthStartDay}
                  allTransactions={allTransactions}
                  depositingCircleId={depositingCircleId}
                  skippingId={skippingId}
                  onOpenConfirm={handleOpenConfirm}
                  onSkipOccurrence={handleSkipOccurrence}
                  onOpenDetails={(it) => setSelectedDetailsId(it.id)}
                  onDepositCircleDirect={handleDepositCircleDirect}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-6 text-center shadow-xs">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                لا توجد معاملات متكررة نشطة حالياً.
              </p>
            </div>
          )}

          {pausedItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToggledPaused(!isPausedExpanded)}
                className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors cursor-pointer select-none border border-[#E4E4E7]/60 dark:border-[#27272A]"
                aria-expanded={isPausedExpanded}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span>المعاملات المتكررة المتوقفة ({pausedItems.length})</span>
                </div>
                {isPausedExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </button>
              {isPausedExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-down">
                  {pausedItems.map((item) => (
                    <RecurringItemCard
                      key={item.id}
                      item={item}
                      categoryMap={categoryMap}
                      circles={circles}
                      monthStartDay={monthStartDay}
                      allTransactions={allTransactions}
                      depositingCircleId={depositingCircleId}
                      skippingId={skippingId}
                      onOpenConfirm={handleOpenConfirm}
                      onSkipOccurrence={handleSkipOccurrence}
                      onOpenDetails={(it) => setSelectedDetailsId(it.id)}
                      onDepositCircleDirect={handleDepositCircleDirect}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <RecurringForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialRecurring={editingItem}
      />

      <RecurringDeleteModal
        item={itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />

      <RecurringConfirmModal
        item={confirmingItem}
        onClose={() => setConfirmingItem(null)}
        onSubmit={handleConfirmSubmit}
        amountStr={confirmAmountStr}
        setAmountStr={setConfirmAmountStr}
        submitting={confirmSubmitting}
        error={confirmError}
        categoryMap={categoryMap}
      />

      <RecurringDetailsModal
        item={selectedDetailsItem}
        onClose={() => setSelectedDetailsId(null)}
        categoryMap={categoryMap}
        circles={circles}
        monthStartDay={monthStartDay}
        allTransactions={allTransactions}
        onEdit={(it) => { setSelectedDetailsId(null); setEditingItem(it); setIsFormOpen(true) }}
        onDelete={setItemToDelete}
        onToggleActive={handleToggleActive}
        onOpenConfirm={(it) => { setSelectedDetailsId(null); handleOpenConfirm(it) }}
        onSkipOccurrence={handleSkipOccurrence}
        onDepositCircleDirect={handleDepositCircleDirect}
        depositingCircleId={depositingCircleId}
        skippingId={skippingId}
      />
    </div>
  )
}
