import React from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Plus, Calendar, AlertCircle, CheckCircle2, Box, Pencil, Trash2 } from 'lucide-react'
import { FormattedMoney } from '../ui/FormattedMoney'
import type { Debt } from '../../types'
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
  const remainingFils = getDebtRemainingFils(debt)
  const progress = getDebtProgress(debt)
  const overdue = isDebtOverdue(debt)
  const isLent = debt.type === 'lent'
  
  // 2-letter Arabic or 1-letter initials
  const initials = React.useMemo(() => {
    const parts = (debt.personName || '').trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`
    }
    return parts[0]?.charAt(0) || '؟'
  }, [debt.personName])

  const formattedStartDate = toWesternDigits(
    format(debt.startDate, 'd MMMM yyyy', { locale: ar })
  )
  const formattedDueDate = debt.dueDate
    ? toWesternDigits(format(debt.dueDate, 'd MMMM yyyy', { locale: ar }))
    : null

  const isMerged = Boolean(debt.entries && debt.entries.length > 1)

  return (
    <div
      onClick={() => onOpenHistoryModal(debt)}
      className={cn(
        'debt-card group rounded-2xl p-4 sm:p-5 border bg-white dark:bg-[#121215] transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-2xs hover:shadow-md relative overflow-hidden select-none',
        overdue && !debt.settled
          ? 'border-red-300 dark:border-red-900/60 hover:border-red-500'
          : 'border-[#E4E4E7] dark:border-[#27272A] hover:border-blue-500/60 dark:hover:border-blue-500/60',
        debt.settled && 'opacity-75'
      )}
    >
      {/* Top red indicator line for overdue debts */}
      {overdue && !debt.settled && (
        <div className="absolute top-0 inset-x-0 h-1 bg-red-600" />
      )}

      <div>
        {/* Header: Avatar, Person info & Status Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center shrink-0 border transition-colors',
                overdue && !debt.settled
                  ? 'bg-red-100 dark:bg-red-950/80 text-red-600 border-red-200 dark:border-red-800'
                  : isLent
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/60'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-red-600 dark:text-red-400 border-zinc-200/60 dark:border-zinc-700/60'
              )}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  {debt.personName}
                </h3>
                {isMerged && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    <Box className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>{formatDebtEntriesCount(debt.entries!.length)}</span>
                  </span>
                )}
              </div>

              {/* Due Date Status */}
              <div
                className={cn(
                  'flex items-center gap-1 text-[11px] mt-0.5 truncate',
                  overdue && !debt.settled
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {overdue && !debt.settled ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>استحق في {formattedDueDate} — متأخر!</span>
                  </>
                ) : formattedDueDate ? (
                  <>
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>الاستحقاق: {formattedDueDate}</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>منذ: {formattedStartDate}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Badges & Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {debt.settled ? (
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shrink-0">
                تم السداد بالكامل
              </span>
            ) : overdue ? (
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-red-600 text-white shrink-0 shadow-xs">
                متأخر السداد
              </span>
            ) : isLent ? (
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                مستحق لك
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200/60 dark:border-red-800/60 shrink-0">
                التزام عليك
              </span>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(debt)
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 dark:hover:text-blue-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="تعديل"
              aria-label="تعديل"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(debt)
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              title="حذف"
              aria-label="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Financial Details Recessed Box */}
        <div className="bg-zinc-50 dark:bg-[#18181c] p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 space-y-2 mb-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                {debt.settled
                  ? 'تم السداد بالكامل'
                  : isLent
                    ? 'المبلغ المتبقي لك'
                    : overdue
                      ? 'المبلغ المطلوب سداده فوراً'
                      : 'المبلغ المتبقي عليك'}
              </span>
              <div
                className={cn(
                  'text-2xl sm:text-3xl font-black tabular-nums tracking-tight',
                  debt.settled
                    ? 'text-zinc-400 line-through'
                    : isLent
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                )}
              >
                <FormattedMoney amountFils={remainingFils} />
              </div>
            </div>
            <div className="text-end">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                {progress}% مسدد
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                debt.settled
                  ? 'bg-zinc-400'
                  : isLent
                    ? 'bg-emerald-600 dark:bg-emerald-500'
                    : 'bg-red-600 dark:bg-red-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Bottom Breakdown Row */}
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <span>
              {isMerged ? 'إجمالي السلف: ' : isLent ? 'أصل السلفة: ' : 'أصل الالتزام: '}
              <strong className="text-zinc-800 dark:text-zinc-200 tabular-nums">
                <FormattedMoney amountFils={debt.amountFils} />
              </strong>
            </span>
            <span>
              المسدد: <strong className="text-zinc-800 dark:text-zinc-200 tabular-nums"><FormattedMoney amountFils={debt.paidFils || 0} /></strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action Button (Clean Single Action Button) */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {debt.settled ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-300 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>تم السداد بالكامل</span>
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
              عرض السجل والكشف ←
            </span>
          </div>
        ) : (debt.payments?.length ?? 0) >= 100 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenHistoryModal(debt)
            }}
            className="w-full h-11 px-4 rounded-xl font-bold text-xs sm:text-sm bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
            className={cn(
              'w-full h-11 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
              overdue
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            )}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>
              {overdue
                ? 'سداد فوري الآن'
                : isLent
                  ? 'استرداد دفعة سداد'
                  : 'سداد دفعة التزام'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
})

DebtCard.displayName = 'DebtCard'

DebtCard.displayName = 'DebtCard'
