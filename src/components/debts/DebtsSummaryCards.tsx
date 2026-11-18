import React from 'react'
import { TrendingUp, TrendingDown, Scale } from 'lucide-react'
import { FormattedMoney } from '../ui/FormattedMoney'
import { cn } from '../../lib/cn'
import type { DebtSummary } from '../../lib/debts'

export interface DebtsSummaryCardsProps {
  summary: DebtSummary
  loading: boolean
}

export const DebtsSummaryCards: React.FC<DebtsSummaryCardsProps> = ({
  summary,
  loading,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-32 animate-pulse"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-28" />
              <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded w-24 my-2" />
            <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {/* Card 1: مستحقات لي */}
      <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
              مستحقات لي على الآخرين
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-1">
            <FormattedMoney amountFils={summary.lentFils} />
          </div>
        </div>
        <div className="pt-2.5 mt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {summary.lentActiveCount === 0
            ? 'لا توجد مستحقات نشطة'
            : summary.lentActiveCount === 1
              ? 'متبقية من شخص واحد'
              : summary.lentActiveCount === 2
                ? 'متبقية من شخصين'
                : summary.lentActiveCount <= 10
                  ? `متبقية من ${summary.lentActiveCount} أشخاص`
                  : `متبقية من ${summary.lentActiveCount} شخصاً`}
        </div>
      </div>

      {/* Card 2: التزامات عليّ */}
      <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
              التزامات عليّ للآخرين
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 tabular-nums block mt-1">
            <FormattedMoney amountFils={summary.borrowedFils} />
          </div>
        </div>
        <div className="pt-2.5 mt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {summary.borrowedActiveCount === 0
            ? 'لا توجد التزامات نشطة'
            : summary.borrowedActiveCount === 1
              ? 'واجبة لشخص واحد'
              : summary.borrowedActiveCount === 2
                ? 'واجبة لشخصين'
                : summary.borrowedActiveCount <= 10
                  ? `واجبة لـ ${summary.borrowedActiveCount} أشخاص`
                  : `واجبة لـ ${summary.borrowedActiveCount} شخصاً`}
        </div>
      </div>

      {/* Card 3: الديون المتأخرة والمستحقة قريباً */}
      <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
              {summary.overdueCount > 0 ? 'ديون متأخرة السداد' : 'استحقاقات خلال 7 أيام'}
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div
            className={cn(
              'text-xl sm:text-2xl font-black tabular-nums block mt-1',
              summary.overdueCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : summary.upcomingCount > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-700 dark:text-zinc-300'
            )}
          >
            <FormattedMoney
              amountFils={
                summary.overdueCount > 0
                  ? summary.overdueFils
                  : summary.upcomingCount > 0
                    ? summary.upcomingFils
                    : 0
              }
            />
          </div>
        </div>
        <div className="pt-2.5 mt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {summary.overdueCount > 0
            ? summary.overdueCount === 1
              ? 'دين واحد تجاوز موعد الاستحقاق'
              : summary.overdueCount === 2
                ? 'دينان تجاوزا موعد الاستحقاق'
                : summary.overdueCount <= 10
                  ? `${summary.overdueCount} ديون تجاوزت موعد الاستحقاق`
                  : `${summary.overdueCount} ديناً تجاوز موعد الاستحقاق`
            : summary.upcomingCount > 0
              ? summary.upcomingCount === 1
                ? 'دين واحد يحل موعده قريباً'
                : summary.upcomingCount === 2
                  ? 'دينان يحل موعدهما قريباً'
                  : summary.upcomingCount <= 10
                    ? `${summary.upcomingCount} ديون يحل موعدها قريباً`
                    : `${summary.upcomingCount} ديناً يحل موعده قريباً`
              : 'لا توجد ديون متأخرة'}
        </div>
      </div>
    </div>
  )
}
