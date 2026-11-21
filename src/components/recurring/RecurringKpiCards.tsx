import React from 'react'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { FormattedMoney } from '../ui/FormattedMoney'

export interface RecurringKpiCardsProps {
  monthlyIncome: number
  monthlyExpense: number
  dueWithin7DaysFils: number
  dueWithin7DaysCount: number
}

export const RecurringKpiCards: React.FC<RecurringKpiCardsProps> = ({
  monthlyIncome,
  monthlyExpense,
  dueWithin7DaysFils,
  dueWithin7DaysCount,
}) => {
  return (
    <div data-tour="recurring-summary" className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {/* Income Card */}
      <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
            مداخيل ثابتة شهرياً
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
            <FormattedMoney amountFils={monthlyIncome} />
          </span>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0 border border-[#E4E4E7]/60 dark:border-[#27272A]">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {/* Expense Card */}
      <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
            مصاريف ثابتة شهرياً
          </span>
          <span className="text-xl sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
            <FormattedMoney amountFils={monthlyExpense} />
          </span>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0 border border-[#E4E4E7]/60 dark:border-[#27272A]">
          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      {/* Due in 7 Days Card */}
      <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
            مستحق خلال 7 أيام
          </span>
          <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 select-none">
            <FormattedMoney amountFils={dueWithin7DaysFils} />
          </div>
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block mt-0.5">
            {dueWithin7DaysCount === 0
              ? 'لا توجد دفعات قريبة'
              : dueWithin7DaysCount === 1
                ? 'دفعة واحدة قادمة'
                : dueWithin7DaysCount === 2
                  ? 'دفعتان قادمتان'
                  : dueWithin7DaysCount <= 10
                    ? `${dueWithin7DaysCount} دفعات قادمة`
                    : `${dueWithin7DaysCount} دفعة قادمة`}
          </span>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0 border border-[#E4E4E7]/60 dark:border-[#27272A]">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  )
}
