import React from 'react'
import { Link } from 'react-router'
import { format as formatDate, differenceInDays, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
  Crown,
  History,
  CheckCircle2,
  SkipForward,
} from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { Toggle } from '../ui/Toggle'
import { isUserTurnMonth } from '../../services/moneyCircles'
import { isOccurrenceSkipped } from '../../lib/recurring'
import { toWesternDigits } from '../../lib/dates'
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
  onHistory: (item: Recurring) => void
  onEdit: (item: Recurring) => void
  onDelete: (item: Recurring) => void
  onToggleActive: (item: Recurring) => void
  onDepositCircleDirect: (circle: MoneyCircle) => void
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
  onHistory,
  onEdit,
  onDelete,
  onToggleActive,
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
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
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold border border-[#E4E4E7] dark:border-[#27272A]">
              متوقفة مؤقتاً
            </span>
          )}
          {item.requireConfirmation && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A]">
              {isDueForManualConfirm ? 'بانتظار تأكيدك' : 'تأكيد يدوي'}
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

      {/* Circle Skip Month Indicator & Direct Deposit */}
      {isCircleItem && (
        <div className="my-1.5 space-y-1.5">
          {isCurrentMonthTurn ? (
            <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                <span>دورك في الاستلام هذا الشهر!</span>
                <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 rounded-full font-bold">
                  معفى من الخصم
                </span>
              </div>
              {linkedCircle && (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {allTransactions.some((t) => t.id === `circle_payout_${linkedCircle.id}`) ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تم إيداع الصافي</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={depositingCircleId === linkedCircle.id}
                      onClick={() => onDepositCircleDirect(linkedCircle)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>إيداع الصافي بالرصيد</span>
                    </button>
                  )}
                </div>
              )}
            </div>
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
      {isDueForManualConfirm && (
        <div className="my-2 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>هذه الدفعة مستحقة وبانتظار تأكيدك</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenConfirm(item)}
              className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تأكيد وتسجيل الآن</span>
            </button>
            <button
              type="button"
              disabled={skippingId === item.id}
              onClick={() => onSkipOccurrence(item)}
              className="py-1.5 px-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              title="تخطي دورة الاستحقاق الحالية دون خصم"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>تخطي</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Row: Next date, End date, Active toggle, Actions */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 truncate flex-wrap">
          <div className="flex items-center gap-1 truncate">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">الموعد القادم: {nextDateFormatted}</span>
          </div>
          {item.endDate && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              • ينتهي في:{' '}
              {formatDate(
                item.endDate instanceof Date ? item.endDate : new Date(item.endDate),
                'd MMM yyyy',
                { locale: ar }
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {item.active && !isCurrentMonthTurn && !isDueForManualConfirm && (
            <>
              <button
                type="button"
                onClick={() => onOpenConfirm(item)}
                className="p-2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:text-emerald-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="تسجيل دفعة هذه الدورة الآن"
                title="تسجيل دفعة هذه الدورة الآن"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={skippingId === item.id}
                onClick={() => onSkipOccurrence(item)}
                className="p-2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-100 dark:hover:text-amber-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
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
            onClick={() => onHistory(item)}
            className="p-2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:text-blue-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="سجل الدفعات"
            title="عرض سجل دفعات هذه المعاملة"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Edit button */}
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="p-2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="تعديل المعاملة المتكررة"
            title="تعديل المعاملة المتكررة"
          >
            <Pencil className="w-4 h-4" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="p-2 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:text-red-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="حذف المعاملة المتكررة"
            title="حذف المعاملة المتكررة"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Toggle button */}
          <Toggle
            checked={item.active}
            onChange={() => onToggleActive(item)}
            aria-label={item.active ? 'إيقاف مؤقت' : 'تفعيل'}
            className="shrink-0 ms-1"
          />
        </div>
      </div>
    </div>
  )
}
