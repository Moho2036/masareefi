import React from 'react'
import { AlertCircle, Search, X } from 'lucide-react'
import { FormattedMoney } from '../ui/FormattedMoney'
import { cn } from '../../lib/cn'

export interface TransactionFilterSummaryProps {
  allMonths: boolean
  onToggleAllMonths: () => void
  isFilterActive: boolean
  onResetFilters: () => void
  filteredCount: number
  totals: { income: number; expense: number; balance: number }
}

export const TransactionFilterSummary: React.FC<TransactionFilterSummaryProps> = ({
  allMonths,
  onToggleAllMonths,
  isFilterActive,
  onResetFilters,
  filteredCount,
  totals,
}) => {
  return (
    <>
      {/* All Months Indicator Banner (Neutral Swiss Surface) */}
      {allMonths && (
        <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl text-xs text-zinc-700 dark:text-zinc-300 shadow-2xs dark:shadow-none print-hide">
          <div className="flex items-center gap-2 min-w-0 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="truncate">وضع البحث في كامل السجل (كل الأشهر) مفعّل حالياً</span>
          </div>
          <button
            type="button"
            onClick={onToggleAllMonths}
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* Active Filter & Search Summary Strip (Neutral Swiss Surface) */}
      {isFilterActive && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl text-xs shadow-2xs dark:shadow-none print-hide">
          <span className="inline-flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
            <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>النتائج المطابقة:</span>
            <span className="px-1.5 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-black">
              {filteredCount}
            </span>
          </span>
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>مسح الفلتر</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Totals Strip Card with Net Balance (TX-12) */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] bg-white dark:bg-[#121215] p-3 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none text-center">
        <div className="px-1">
          <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate mb-1">
            {allMonths ? 'المداخيل (الكل)' : 'المداخيل'}
          </div>
          <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 truncate">
            <FormattedMoney amountFils={totals.income} className="text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="px-1">
          <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate mb-1">
            {allMonths ? 'المصاريف (الكل)' : 'المصاريف'}
          </div>
          <div className="text-xs sm:text-sm font-black text-red-600 dark:text-red-400 truncate">
            <FormattedMoney amountFils={totals.expense} className="text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="px-1">
          <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate mb-1">
            الصافي
          </div>
          <div
            className={cn(
              'text-xs sm:text-sm font-black truncate',
              totals.balance > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : totals.balance < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-500'
            )}
          >
            <FormattedMoney amountFils={totals.balance} withSign="auto" />
          </div>
        </div>
      </div>
    </>
  )
}
