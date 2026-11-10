import React from 'react'
import { Copy, MessageSquare, Share2, Printer } from 'lucide-react'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { cn } from '../../../lib/cn'
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
}) => {
  return (
    <>
      {/* Summary Card */}
      <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] grid grid-cols-3 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] text-center">
        <div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المبلغ الكلي</span>
          <span className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200 tabular-nums">
            <FormattedMoney amountFils={debt.amountFils} />
          </span>
        </div>
        <div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المسدد حتى الآن</span>
          <span className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200 tabular-nums">
            <FormattedMoney amountFils={debt.paidFils || 0} />
          </span>
        </div>
        <div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المتبقي</span>
          <span
            className={cn(
              'text-xs sm:text-sm font-black tabular-nums',
              isLent
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            <FormattedMoney amountFils={remainingFils} />
          </span>
        </div>
      </div>

      {/* Share Account Statement Strip */}
      <div className={cn('grid gap-2 print-hide', canShare ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
        <button
          type="button"
          onClick={onCopyStatement}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>نسخ للحافظة</span>
        </button>
        <button
          type="button"
          onClick={onWhatsAppShare}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>إرسال عبر واتساب</span>
        </button>
        {canShare && (
          <button
            type="button"
            onClick={onNativeShare}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>مشاركة الكشف</span>
          </button>
        )}
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
        >
          <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>طباعة الكشف</span>
        </button>
      </div>
    </>
  )
}
