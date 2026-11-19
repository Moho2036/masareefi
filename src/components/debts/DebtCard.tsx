import React from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Plus, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import { FormattedMoney } from '../ui/FormattedMoney'
import type { Debt } from '../../types'
import { getDebtRemainingFils, getDebtProgress, isDebtOverdue, formatDebtEntriesCount } from '../../lib/debts'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'

export interface DebtCardProps {
  debt: Debt
  onOpenPaymentModal: (debt: Debt) => void
  onOpenHistoryModal: (debt: Debt) => void
  onDelete?: (debt: Debt) => void
}

export const DebtCard: React.FC<DebtCardProps> = React.memo(({
  debt,
  onOpenPaymentModal,
  onOpenHistoryModal,
}) => {
  const remainingFils = getDebtRemainingFils(debt)
  const progress = getDebtProgress(debt)
  const overdue = isDebtOverdue(debt)
  const isLent = debt.type === 'lent'

  // Initials (2 letters for multi-word, 1 letter for single word)
  const initials = React.useMemo(() => {
    const parts = (debt.personName || '').trim().split(/\s+/)
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`
    }
    return (debt.personName || '').trim().charAt(0) || '؟'
  }, [debt.personName])

  const formattedStartDate = toWesternDigits(
    format(debt.startDate, 'd MMMM yyyy', { locale: ar })
  )
  const formattedDueDate = debt.dueDate
    ? toWesternDigits(format(debt.dueDate, 'd MMMM yyyy', { locale: ar }))
    : null

  return (
    <div
      onClick={() => onOpenHistoryModal(debt)}
      className={cn(
        'group rounded-2xl p-4 sm:p-5 border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] transition-all flex flex-col justify-between shadow-2xs dark:shadow-none space-y-3.5 relative overflow-hidden cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700',
        debt.settled && 'opacity-70'
      )}
    >
      {/* Top Row: Avatar, Person info & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm shrink-0 font-extrabold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
            {initials}
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 block truncate">
              {debt.personName}
            </span>
            {debt.note && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5" title={debt.note}>
                {debt.note}
              </p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {debt.entries && debt.entries.length > 1 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]"
              title="سلف مجمعة في هذا الحساب"
            >
              <span>{formatDebtEntriesCount(debt.entries.length)}</span>
            </span>
          )}

          {debt.settled ? (
            <span className="inline-flex items-center gap-1 shadow-none rounded-lg px-2 py-1 text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>مسدد</span>
            </span>
          ) : overdue ? (
            <span className="inline-flex items-center gap-1 shadow-none rounded-lg px-2 py-1 text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>متأخر</span>
            </span>
          ) : null}

          <span className="text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 bg-zinc-100 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
            {isLent ? 'لي (مستحق)' : 'عليّ (التزام)'}
          </span>
        </div>
      </div>

      {/* Middle: Remaining Amount & Breakdown */}
      <div className="space-y-2 pt-1">
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 block mb-0.5">
              {debt.settled ? 'تم السداد بالكامل' : isLent ? 'المبلغ المتبقي لك' : 'المبلغ المتبقي عليك'}
            </span>
            <div
              className={cn(
                'text-2xl sm:text-3xl font-black select-none tracking-tight tabular-nums',
                debt.settled
                  ? 'text-zinc-400 dark:text-zinc-500 line-through'
                  : isLent
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
              )}
            >
              <FormattedMoney amountFils={remainingFils} />
            </div>
          </div>
          <div className="text-end">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
              {progress}% مسدد
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
          <span>المبلغ الأصلي: <strong className="text-zinc-700 dark:text-zinc-300 tabular-nums"><FormattedMoney amountFils={debt.amountFils} /></strong></span>
          <span>المسدد: <strong className="text-zinc-700 dark:text-zinc-300 tabular-nums"><FormattedMoney amountFils={debt.paidFils || 0} /></strong></span>
        </div>

        {/* Progress Bar (Anchored to right in RTL) */}
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden mt-2 flex justify-start">
          <div
            className="h-full transition-all duration-300 rounded-full bg-blue-600 dark:bg-blue-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Dates Row */}
      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
        <span className="flex items-center gap-1 font-medium">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <span>منذ: {formattedStartDate}</span>
        </span>
        {formattedDueDate && (
          <span
            className={cn(
              'flex items-center gap-1 font-medium',
              overdue && !debt.settled
                ? 'text-amber-600 dark:text-amber-400 font-bold'
                : 'text-zinc-400 dark:text-zinc-500'
            )}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>الاستحقاق: {formattedDueDate}</span>
          </span>
        )}
      </div>

      {/* Bottom Row: Single Clean Action Button (Zero Clutter) */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {!debt.settled ? (
          (debt.payments?.length ?? 0) >= 100 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenHistoryModal(debt)
              }}
              className="w-full h-11 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A]"
              title="وصل إلى الحد الأقصى للدفعات (100 دفعة) — اضغط للدمج"
            >
              <AlertCircle className="w-4 h-4 stroke-[2.5] text-amber-600 dark:text-amber-400" />
              <span>دمج الدفعات القديمة (100)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenPaymentModal(debt)
              }}
              className="w-full h-11 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 active:scale-[0.98] shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>تسجيل {isLent ? 'دفعة استرداد' : 'دفعة سداد'}</span>
            </button>
          )
        ) : (
          <div className="w-full h-11 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>تم السداد بالكامل</span>
          </div>
        )}
      </div>
    </div>
  )
})

DebtCard.displayName = 'DebtCard'

