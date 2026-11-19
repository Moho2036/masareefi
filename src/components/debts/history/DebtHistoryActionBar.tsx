import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Copy, MessageSquare, Share2, Printer, Pencil, Trash2 } from 'lucide-react'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { toWesternDigits } from '../../../lib/dates'
import { cn } from '../../../lib/cn'
import { triggerHaptic } from '../../../lib/haptics'
import { isTestEnv } from '../../../lib/motionTokens'
import type { Debt } from '../../../types'

export interface DebtHistoryActionBarProps {
  debt: Debt
  remainingFils: number
  isLent: boolean
  canShare: boolean
  onCopyStatement: () => void
  onWhatsAppShare: () => void
  onNativeShare: () => void
  onPrint: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export const DebtHistoryActionBar: React.FC<DebtHistoryActionBarProps> = ({
  debt,
  remainingFils,
  isLent,
  canShare,
  onCopyStatement,
  onWhatsAppShare,
  onNativeShare,
  onPrint,
  onEdit,
  onDelete,
}) => {
  const [isShareOpen, setIsShareOpen] = useState(() => (isTestEnv ? true : false))

  const initials = useMemo(() => {
    const parts = (debt.personName || '').trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`
    }
    return parts[0]?.charAt(0) || '؟'
  }, [debt.personName])

  const handleToggleShare = () => {
    triggerHaptic('tick')
    setIsShareOpen((prev) => !prev)
  }

  const formattedDueDate = debt.dueDate
    ? toWesternDigits(format(debt.dueDate, 'd MMMM yyyy', { locale: ar }))
    : null
  const formattedStartDate = toWesternDigits(
    format(debt.startDate, 'd MMMM yyyy', { locale: ar })
  )

  return (
    <div className="space-y-3.5">
      {/* Identity block */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-11 h-11 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 border shadow-2xs',
              isLent
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-900/60'
                : 'bg-zinc-100 dark:bg-zinc-800 text-red-600 dark:text-red-400 border-zinc-200/60 dark:border-zinc-700/60'
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate">
                {debt.personName}
              </h2>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0',
                  isLent
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800'
                )}
              >
                {isLent ? 'مستحق لك' : 'التزام عليك'}
              </span>
              {debt.entries && debt.entries.length > 1 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                  سلف مدمجة ({debt.entries.length})
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {formattedDueDate
                ? `تاريخ الاستحقاق: ${formattedDueDate}`
                : `تاريخ الإنشاء: ${formattedStartDate}`}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Quick Action Bar (Top of dossier) */}
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleToggleShare}
          aria-expanded={isShareOpen}
          aria-label="خيارات مشاركة وتصدير كشف الحساب"
          className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>مشاركة الكشف</span>
        </button>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Pencil className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>تعديل الدين</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="h-9 px-3 rounded-xl border border-red-200 dark:border-red-950/80 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            title="حذف هذا السجل"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">حذف</span>
          </button>
        )}
      </div>

      {/* Share Account Statement Strip (Visible when opened) */}
      {isShareOpen && (
        <div
          className={cn(
            'grid gap-2 animate-slide-down p-2.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800',
            canShare ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
          )}
        >
          <button
            type="button"
            onClick={onCopyStatement}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors shadow-2xs"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>نسخ للحافظة</span>
          </button>
          <button
            type="button"
            onClick={onWhatsAppShare}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>إرسال عبر واتساب</span>
          </button>
          {canShare && (
            <button
              type="button"
              onClick={onNativeShare}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-600" />
              <span>مشاركة الكشف</span>
            </button>
          )}
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>طباعة الكشف</span>
          </button>
        </div>
      )}

      {/* 3 Financial Metric Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
          <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 block font-medium">أصل المبلغ</span>
          <span className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums mt-0.5 block">
            <FormattedMoney amountFils={debt.amountFils} />
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
          <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 block font-medium">إجمالي المسدد</span>
          <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
            <FormattedMoney amountFils={debt.paidFils || 0} />
          </span>
        </div>
        <div
          className={cn(
            'p-3 rounded-2xl border text-center',
            isLent
              ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-800/60'
              : 'bg-red-50/60 dark:bg-red-950/30 border-red-200/70 dark:border-red-800/60'
          )}
        >
          <span
            className={cn(
              'text-[10px] sm:text-xs block font-bold',
              isLent ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'
            )}
          >
            المتبقي الفعلي
          </span>
          <span
            className={cn(
              'text-sm sm:text-base font-black tabular-nums mt-0.5 block',
              isLent ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            )}
          >
            <FormattedMoney amountFils={remainingFils} />
          </span>
        </div>
      </div>
    </div>
  )
}
