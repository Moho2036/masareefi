import React from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { History, Pencil, Trash2, Plus, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Debt } from '../../types'
import { useCurrency } from '../../hooks/useCurrency'
import { getDebtRemainingFils, getDebtProgress, isDebtOverdue, formatDebtEntriesCount } from '../../lib/debts'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'

export interface DebtCardProps {
  debt: Debt
  onOpenPaymentModal: (debt: Debt) => void
  onOpenHistoryModal: (debt: Debt) => void
  onEdit: (debt: Debt) => void
  onDelete: (debt: Debt) => void
}

export const DebtCard: React.FC<DebtCardProps> = React.memo(({
  debt,
  onOpenPaymentModal,
  onOpenHistoryModal,
  onEdit,
  onDelete,
}) => {
  const { format: formatCurrency } = useCurrency()
  const remainingFils = getDebtRemainingFils(debt)
  const progress = getDebtProgress(debt)
  const overdue = isDebtOverdue(debt)
  const isLent = debt.type === 'lent'
  const firstLetter = (debt.personName || '').trim().charAt(0) || '؟'

  const formattedStartDate = toWesternDigits(
    format(debt.startDate, 'd MMMM yyyy', { locale: ar })
  )
  const formattedDueDate = debt.dueDate
    ? toWesternDigits(format(debt.dueDate, 'd MMMM yyyy', { locale: ar }))
    : null

  return (
    <div
      className={cn(
        'group rounded-2xl p-4 sm:p-5 border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] transition-all flex flex-col justify-between shadow-2xs dark:shadow-none space-y-3.5 relative overflow-hidden',
        debt.settled && 'opacity-70'
      )}
    >
      {/* Top Row: Avatar, Person info & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0 font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
            {firstLetter}
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
        <div className="flex items-center gap-1.5 shrink-0">
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
              {formatCurrency(remainingFils)}
            </div>
          </div>
          <div className="text-end">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
              {progress}% مسدد
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
          <span>المبلغ الأصلي: <strong className="text-zinc-700 dark:text-zinc-300 tabular-nums">{formatCurrency(debt.amountFils)}</strong></span>
          <span>المسدد: <strong className="text-zinc-700 dark:text-zinc-300 tabular-nums">{formatCurrency(debt.paidFils || 0)}</strong></span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden mt-2">
          <div
            className="h-full transition-all duration-300 rounded-full bg-blue-600 dark:bg-blue-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Dates Row */}
      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex flex-wrap items-center gap-3 px-1">
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
        {debt.entries && debt.entries.length > 1 && (
          <button
            type="button"
            onClick={() => onOpenHistoryModal(debt)}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold border border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="عرض تفاصيل السلف المجمعة"
          >
            <span>{formatDebtEntriesCount(debt.entries.length)}</span>
          </button>
        )}
      </div>

      {/* Bottom Row: Actions */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 text-xs">
        {!debt.settled ? (
          (debt.payments?.length ?? 0) >= 100 ? (
            <button
              type="button"
              onClick={() => onOpenPaymentModal(debt)}
              className="px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A]"
              title="وصل إلى الحد الأقصى للدفعات (100 دفعة) — اضغط للدمج"
            >
              <AlertCircle className="w-4 h-4 stroke-[2.5] text-amber-600 dark:text-amber-400" />
              <span>دمج الدفعات القديمة (100)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenPaymentModal(debt)}
              className="px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 active:scale-95 shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>تسجيل {isLent ? 'دفعة استرداد' : 'دفعة سداد'}</span>
            </button>
          )
        ) : (
          <span className="text-xs text-zinc-600 dark:text-zinc-300 font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>تم السداد بالكامل</span>
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpenHistoryModal(debt)}
            className="p-2 sm:p-2.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer relative"
            title="سجل الدفعات"
            aria-label="سجل الدفعات"
          >
            <History className="w-4 h-4" />
            {(debt.payments?.length ?? 0) > 0 && (
              <span className="absolute -top-1 -end-1 px-1 min-w-[14px] h-[14px] rounded-full bg-zinc-700 dark:bg-zinc-600 text-white text-[9px] font-black flex items-center justify-center">
                {debt.payments.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onEdit(debt)}
            className="p-2 sm:p-2.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="تعديل"
            aria-label="تعديل الدين"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(debt)}
            className="p-2 sm:p-2.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            title="حذف"
            aria-label="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
})

DebtCard.displayName = 'DebtCard'
