import React from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { History, Pencil, Trash2, Plus, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Debt } from '../../types'
import { useCurrency } from '../../hooks/useCurrency'
import { getDebtRemainingFils, getDebtProgress, isDebtOverdue } from '../../lib/debts'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'

export interface DebtCardProps {
  debt: Debt
  onOpenPaymentModal: (debt: Debt) => void
  onOpenHistoryModal: (debt: Debt) => void
  onEdit: (debt: Debt) => void
  onDelete: (debt: Debt) => void
}

export const DebtCard: React.FC<DebtCardProps> = ({
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
        'group rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between shadow-xs hover:shadow-sm space-y-3.5 relative overflow-hidden',
        'bg-white dark:bg-slate-800',
        debt.settled
          ? 'border-slate-200/60 dark:border-slate-700/40 opacity-75'
          : overdue
            ? 'border-amber-300 dark:border-amber-700/80'
            : isLent
              ? 'border-slate-200/80 dark:border-slate-700/60 hover:border-emerald-300 dark:hover:border-emerald-700/60'
              : 'border-slate-200/80 dark:border-slate-700/60 hover:border-red-300 dark:hover:border-red-700/60'
      )}
    >
      {/* Top Row: Avatar, Person info & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 font-black shadow-xs',
              isLent
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/15 text-red-700 dark:text-red-300'
            )}
          >
            {firstLetter}
          </div>
          <div className="min-w-0">
            <span className="font-extrabold text-base text-slate-800 dark:text-slate-100 block truncate">
              {debt.personName}
            </span>
            {debt.note && (
              <p className="text-xs text-slate-400 dark:text-slate-400 truncate mt-0.5" title={debt.note}>
                {debt.note}
              </p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {debt.settled ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200/60 dark:border-emerald-800/40 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>مسدد</span>
            </span>
          ) : overdue ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-amber-800/40 shadow-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>متأخر</span>
            </span>
          ) : null}

          <span
            className={cn(
              'text-xs px-3 py-1 rounded-xl font-black shrink-0 border shadow-xs',
              isLent
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200/60 dark:border-red-900/40'
            )}
          >
            {isLent ? 'لي (مستحق)' : 'عليّ (التزام)'}
          </span>
        </div>
      </div>

      {/* Middle: Remaining Amount & Breakdown */}
      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 space-y-2">
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 block mb-0.5">
              {debt.settled ? 'تم السداد بالكامل' : isLent ? 'المبلغ المتبقي لك' : 'المبلغ المتبقي عليك'}
            </span>
            <div
              className={cn(
                'text-2xl sm:text-3xl font-black select-none tracking-tight',
                debt.settled
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : isLent
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
              )}
            >
              {formatCurrency(remainingFils)}
            </div>
          </div>
          <div className="text-end">
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
              {progress}% مسدد
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-400 pt-1">
          <span>المبلغ الأصلي: <strong className="text-slate-600 dark:text-slate-300">{formatCurrency(debt.amountFils)}</strong></span>
          <span>المسدد: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(debt.paidFils || 0)}</strong></span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/70 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden mt-2">
          <div
            className={cn(
              'h-full transition-all duration-300 rounded-full',
              debt.settled
                ? 'bg-emerald-500'
                : isLent
                  ? 'bg-emerald-500'
                  : 'bg-red-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Dates Row */}
      <div className="text-[11px] text-slate-400 dark:text-slate-400 flex flex-wrap items-center gap-3 px-1">
        <span className="flex items-center gap-1 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>منذ: {formattedStartDate}</span>
        </span>
        {formattedDueDate && (
          <span
            className={cn(
              'flex items-center gap-1 font-medium',
              overdue && !debt.settled
                ? 'text-amber-600 dark:text-amber-400 font-bold'
                : 'text-slate-400'
            )}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>الاستحقاق: {formattedDueDate}</span>
          </span>
        )}
      </div>

      {/* Bottom Row: Actions */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
        {!debt.settled ? (
          (debt.payments?.length ?? 0) >= 100 ? (
            <button
              type="button"
              onClick={() => onOpenPaymentModal(debt)}
              className="px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60"
              title="وصل إلى الحد الأقصى للدفعات (100 دفعة)"
            >
              <AlertCircle className="w-4 h-4 stroke-[2.5] text-amber-600 dark:text-amber-400" />
              <span>الحد الأقصى للدفعات (100)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenPaymentModal(debt)}
              className={cn(
                'px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95',
                isLent
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              )}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>تسجيل {isLent ? 'دفعة استرداد' : 'دفعة سداد'}</span>
            </button>
          )
        ) : (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم السداد بالكامل</span>
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpenHistoryModal(debt)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer relative"
            title="سجل الدفعات"
          >
            <History className="w-4 h-4" />
            {(debt.payments?.length ?? 0) > 0 && (
              <span className="absolute -top-1 -end-1 px-1 min-w-[14px] h-[14px] rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">
                {debt.payments.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onEdit(debt)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="تعديل"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(debt)}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
