import React from 'react'
import { format as formatDate, differenceInDays, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Calendar,
  Crown,
  CheckCircle2,
  SkipForward,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { isUserTurnMonth } from '../../services/moneyCircles'
import { isOccurrenceSkipped } from '../../lib/recurring'
import { toWesternDigits } from '../../lib/dates'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'
import type { Recurring, MoneyCircle, Category, Transaction } from '../../types'
import { frequencyLabels } from './recurringFormHelpers'

export interface RecurringItemCardProps {
  item: Recurring
  categoryMap: Map<string, Category>
  circles: MoneyCircle[]
  monthStartDay: number
  allTransactions: Transaction[]
  depositingCircleId: string | null
  skippingId: string | null
  onOpenConfirm: (item: Recurring) => void
  onSkipOccurrence: (item: Recurring) => void
  onOpenDetails: (item: Recurring) => void
  onDepositCircleDirect?: (circle: MoneyCircle) => void
  onHistory?: (item: Recurring) => void
  onEdit?: (item: Recurring) => void
  onDelete?: (item: Recurring) => void
  onToggleActive?: (item: Recurring) => void
}

export const RecurringItemCard: React.FC<RecurringItemCardProps> = ({
  item,
  categoryMap,
  circles,
  monthStartDay,
  allTransactions,
  depositingCircleId,
  skippingId,
  onOpenConfirm,
  onSkipOccurrence,
  onOpenDetails,
  onDepositCircleDirect,
}) => {
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

  const isDueForManualConfirm =
    item.requireConfirmation &&
    item.active &&
    (item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate)) <= new Date()

  return (
    <div
      onClick={() => {
        triggerHaptic('tick')
        onOpenDetails(item)
      }}
      className={cn(
        'group rounded-2xl p-4 sm:p-5 border border-[#E4E4E7] dark:border-[#27272A] transition-all flex flex-col justify-between shadow-2xs dark:shadow-none cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs relative',
        item.active
          ? 'bg-white dark:bg-[#121215]'
          : 'bg-zinc-50/80 dark:bg-zinc-900/40 opacity-75'
      )}
    >
      <div>
        {/* Top Row: Category Icon & Title + Frequency & Status Badges */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-zinc-50 dark:bg-zinc-900 border border-[#E4E4E7]/60 dark:border-[#27272A]/60">
              <CategoryIcon icon={icon} color={color} size="md" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 block truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {item.title || name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {item.title ? (
                  <>
                    <span className="font-medium text-zinc-600 dark:text-zinc-300 truncate">
                      {name}
                    </span>
                    {item.note ? <span>•</span> : null}
                  </>
                ) : null}
                {item.note ? <span className="truncate">{item.note}</span> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold border border-[#E4E4E7] dark:border-[#27272A]">
              {frequencyLabels[item.frequency]}
            </span>
            {!item.active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold border border-[#E4E4E7] dark:border-[#27272A]">
                متوقفة مؤقتاً
              </span>
            )}
            {item.requireConfirmation && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A]">
                {isDueForManualConfirm ? 'بانتظار تأكيدك' : 'تأكيد يدوي'}
              </span>
            )}
          </div>
        </div>

        {/* Middle: Amount & Relative Due Date */}
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
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>الموعد القادم: {nextDateFormatted} ({relativeDueText})</span>
          </div>
        </div>

        {/* Circle Turn Indicator if applicable */}
        {isCircleItem && (
          <div className="my-2">
            {isCurrentMonthTurn ? (
              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>دورك في الاستلام هذا الشهر!</span>
                  <span className="text-[10px] bg-amber-200/70 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded-full font-bold">
                    معفى من الخصم
                  </span>
                </div>
                {linkedCircle && onDepositCircleDirect && (
                  <div className="flex items-center gap-1">
                    {allTransactions.some((t) => t.id === `circle_payout_${linkedCircle.id}`) ? (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تم الإيداع</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={depositingCircleId === linkedCircle.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDepositCircleDirect(linkedCircle)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>إيداع الصافي</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                <span>قسط جمعية مالية{item.skipMonth ? ` (شهر الإعفاء: ${item.skipMonth})` : ''}</span>
              </span>
            )}
          </div>
        )}

        {/* Due Confirmation Notice if waiting for manual confirm */}
        {isDueForManualConfirm && (
          <div className="my-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>هذه الدفعة مستحقة وبانتظار تأكيدك</span>
          </div>
        )}
      </div>

      {/* Bottom Row: Direct Primary Actions & Details Hint */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
        {item.active && !isCurrentMonthTurn ? (
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('tick')
                onOpenConfirm(item)
              }}
              className="flex-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isDueForManualConfirm ? 'تأكيد وتسجيل الآن' : 'تسجيل الدفعة'}</span>
            </button>

            <button
              type="button"
              disabled={skippingId === item.id}
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('warning')
                onSkipOccurrence(item)
              }}
              className="py-1.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 min-h-[38px]"
              title="تخطي الدورة الحالية والانتقال للموعد القادم"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>تخطي</span>
            </button>
          </div>
        ) : (
          <div className="text-xs font-medium text-zinc-400">
            {!item.active ? 'المعاملة متوقفة مؤقتاً' : 'معفى من الدفع هذا الشهر'}
          </div>
        )}

        {/* Subtle Details Prompt */}
        <div className="flex items-center gap-0.5 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-xs font-bold shrink-0 ps-2">
          <span>التفاصيل</span>
          <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
        </div>
      </div>
    </div>
  )
}
