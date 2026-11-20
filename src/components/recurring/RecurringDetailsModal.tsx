import React, { useMemo, useState } from 'react'
import { format as formatDate, differenceInDays, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Pencil,
  Trash2,
  Calendar,
  Crown,
  History,
  CheckCircle2,
  SkipForward,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { isUserTurnMonth } from '../../services/moneyCircles'
import { isOccurrenceSkipped } from '../../lib/recurring'
import { toWesternDigits } from '../../lib/dates'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'
import type { Recurring, MoneyCircle, Category, Transaction } from '../../types'
import { frequencyLabels } from './recurringFormHelpers'

export interface RecurringDetailsModalProps {
  item: Recurring | null
  onClose: () => void
  categoryMap: Map<string, Category>
  circles?: MoneyCircle[]
  monthStartDay?: number
  allTransactions?: Transaction[]
  onEdit: (item: Recurring) => void
  onDelete: (item: Recurring) => void
  onToggleActive: (item: Recurring) => void
  onOpenConfirm: (item: Recurring) => void
  onSkipOccurrence: (item: Recurring) => void
  onDepositCircleDirect?: (circle: MoneyCircle) => void
  depositingCircleId?: string | null
  skippingId?: string | null
}

export const RecurringDetailsModal: React.FC<RecurringDetailsModalProps> = ({
  item,
  onClose,
  categoryMap,
  circles = [],
  monthStartDay = 1,
  allTransactions = [],
  onEdit,
  onDelete,
  onToggleActive,
  onOpenConfirm,
  onSkipOccurrence,
  onDepositCircleDirect,
  depositingCircleId,
  skippingId,
}) => {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true)

  const cat = item ? categoryMap.get(item.categoryId) : undefined
  const icon = cat?.icon ?? '➕'
  const color = cat?.color ?? '#94A3B8'
  const catName = cat?.name ?? 'غير مصنف'
  const isExpense = item?.type === 'expense'

  const isCircleItem = Boolean(item?.circleId || item?.skipMonth)
  const linkedCircle = isCircleItem
    ? circles.find((c) => c.id === item?.circleId || c.recurringId === item?.id)
    : undefined

  const isCurrentMonthTurn =
    Boolean(item) &&
    isCircleItem &&
    (linkedCircle
      ? isUserTurnMonth(linkedCircle, new Date(), monthStartDay)
      : isOccurrenceSkipped(item!, new Date()))

  const nextDateObj = item
    ? item.nextDate instanceof Date
      ? item.nextDate
      : new Date(item.nextDate)
    : new Date()

  const diffDays = differenceInDays(startOfDay(nextDateObj), startOfDay(new Date()))
  const relativeDueText =
    diffDays < 0
      ? 'مستحقة'
      : diffDays === 0
        ? 'مستحقة اليوم'
        : diffDays === 1
          ? 'تستحق غداً'
          : diffDays === 2
            ? 'تستحق بعد يومين'
            : diffDays <= 10
              ? `تستحق بعد ${diffDays} أيام`
              : `تستحق بعد ${diffDays} يوماً`

  const nextDateFormatted = toWesternDigits(
    formatDate(nextDateObj, 'd LLLL yyyy', { locale: ar })
  )

  const historyTxs = useMemo(() => {
    if (!item) return []
    return allTransactions
      .filter((t) => t.recurringId === item.id)
      .sort((a, b) => {
        const aDate = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime()
        const bDate = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime()
        return bDate - aDate
      })
  }, [allTransactions, item])

  const cumulativeStats = useMemo(() => {
    let totalFils = 0
    for (const tx of historyTxs) {
      totalFils += tx.amountFils
    }
    return {
      totalFils,
      count: historyTxs.length,
    }
  }, [historyTxs])

  if (!item) return null

  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title="تفاصيل وكشف المعاملة المتكررة"
      hideCloseButton={true}
    >
      <div className="space-y-4">
        {/* Top Summary Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-3.5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs">
                <CategoryIcon icon={icon} color={color} size="md" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate">
                  {item.title || catName}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                  {item.title ? (
                    <>
                      <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                        {catName}
                      </span>
                      {item.note ? <span>•</span> : null}
                    </>
                  ) : null}
                  {item.note ? <span className="truncate">{item.note}</span> : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              <span className="text-xs px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border border-[#E4E4E7] dark:border-[#27272A]">
                {frequencyLabels[item.frequency]}
              </span>
              {!item.active && (
                <span className="text-xs px-2.5 py-1 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold border border-[#E4E4E7] dark:border-[#27272A]">
                  متوقفة مؤقتاً
                </span>
              )}
            </div>
          </div>

          {/* Amount & Due Row */}
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800 flex items-baseline justify-between gap-2">
            <div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium mb-0.5">
                {isExpense ? 'قيمة المصروف الدوري' : 'قيمة الدخل الدوري'}
              </span>
              <div
                className={cn(
                  'text-2xl sm:text-3xl font-black select-none',
                  isExpense
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                <FormattedMoney amountFils={item.amountFils} withSign={item.type} />
              </div>
            </div>

            <div className="text-end">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block font-medium mb-0.5">
                حالة الاستحقاق
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>{relativeDueText}</span>
              </span>
            </div>
          </div>

          {/* Schedule Info Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A]">
              <span className="text-[11px] text-zinc-400 block">الموعد القادم:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {nextDateFormatted}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A]">
              <span className="text-[11px] text-zinc-400 block">نوع المعالجة:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {item.requireConfirmation
                  ? 'تأكيد يدوي مطلوب قبل القيد'
                  : 'تسجيل تلقائي عند حلول الموعد'}
              </span>
            </div>
          </div>

          {/* Circle Banner if applicable */}
          {isCircleItem && (
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {isCurrentMonthTurn
                    ? 'دورك في الاستلام هذا الشهر! (معفى من الخصم)'
                    : `قسط جمعية مالية${item.skipMonth ? ` (شهر الإعفاء: ${item.skipMonth})` : ''}`}
                </span>
              </div>
              {isCurrentMonthTurn && linkedCircle && (
                <div className="mt-2 flex items-center justify-end">
                  {allTransactions.some((t) => t.id === `circle_payout_${linkedCircle.id}`) ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تم إيداع الصافي بالرصيد</span>
                    </span>
                  ) : onDepositCircleDirect ? (
                    <button
                      type="button"
                      disabled={depositingCircleId === linkedCircle.id}
                      onClick={() => onDepositCircleDirect(linkedCircle)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>إيداع الصافي بالرصيد الآن</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Cumulative Metrics */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] text-zinc-400 block">إجمالي ما تم دفعه تراكمياً:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                <FormattedMoney amountFils={cumulativeStats.totalFils} />
              </span>
            </div>
            <div className="text-end">
              <span className="text-[11px] text-zinc-400 block">عدد الدفعات المنفذة:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {cumulativeStats.count} {cumulativeStats.count === 1 ? 'دفعة' : 'دفعات'}
              </span>
            </div>
          </div>
        </div>

        {/* Administrative Action Bar */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            icon={<Pencil className="w-4 h-4" />}
            onClick={() => {
              triggerHaptic('tick')
              onClose()
              onEdit(item)
            }}
            className="w-full text-xs font-bold min-h-[44px]"
          >
            تعديل
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            icon={
              item.active ? (
                <Pause className="w-4 h-4 text-amber-500" />
              ) : (
                <Play className="w-4 h-4 text-emerald-500" />
              )
            }
            onClick={() => {
              triggerHaptic('warning')
              onToggleActive(item)
            }}
            className="w-full text-xs font-bold min-h-[44px]"
          >
            {item.active ? 'إيقاف مؤقت' : 'تفعيل'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            icon={<Trash2 className="w-4 h-4 text-red-500" />}
            onClick={() => {
              triggerHaptic('destructive')
              onClose()
              onDelete(item)
            }}
            className="w-full text-xs font-bold text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[44px]"
          >
            حذف
          </Button>
        </div>

        {/* Fast Operational Execution: Register / Skip Occurrence */}
        {item.active && !isCurrentMonthTurn && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                onClose()
                onOpenConfirm(item)
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تسجيل وتأكيد دفعة هذه الدورة</span>
            </button>

            <button
              type="button"
              disabled={skippingId === item.id}
              onClick={() => {
                triggerHaptic('warning')
                onSkipOccurrence(item)
              }}
              className="py-2.5 px-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 min-h-[44px]"
              title="تخطي الدورة القادمة"
            >
              <SkipForward className="w-4 h-4" />
              <span>تخطي</span>
            </button>
          </div>
        )}

        {/* Previous Executions (History Section) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="flex items-center justify-between w-full py-2.5 px-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-500" />
              <span>سجل الدفعات السابقة ({historyTxs.length})</span>
            </div>
            {isHistoryExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {isHistoryExpanded && (
            <div className="mt-2 space-y-2">
              {historyTxs.length === 0 ? (
                <div className="py-6 text-center text-zinc-400 text-xs bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  لم يتم تسجيل أي دفعات سابقة لهذه المعاملة المتكررة حتى الآن.
                </div>
              ) : (
                <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] px-3 bg-white dark:bg-[#121215] max-h-48 overflow-y-auto">
                  {historyTxs.map((tx) => {
                    const txDateFormatted = toWesternDigits(
                      formatDate(
                        tx.date instanceof Date ? tx.date : new Date(tx.date),
                        'd LLLL yyyy',
                        { locale: ar }
                      )
                    )
                    return (
                      <div
                        key={tx.id}
                        className="py-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1 pe-2">
                          <div className="font-bold text-zinc-800 dark:text-zinc-100 truncate">
                            {tx.title || txDateFormatted}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {txDateFormatted}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'font-black text-xs select-none shrink-0',
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
              )}
            </div>
          )}
        </div>

        {/* Footer: Single Cancel/Close button */}
        <div className="flex items-center justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button variant="outline" size="md" onClick={onClose} className="min-h-[44px]">
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  )
}
