import React from 'react'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { FormattedMoney } from '../ui/FormattedMoney'
import { DailyExpenseChart } from '../charts/DailyExpenseChart'
import { toWesternDigits } from '../../lib/dates'
import type { DailyExpenseItem, DailyExpenseStats } from '../../lib/reports'

export interface DailyExpenseSectionProps {
  dailyExpenses: DailyExpenseItem[]
  dailyStats: DailyExpenseStats
  isFutureMonth: boolean
}

export const DailyExpenseSection: React.FC<DailyExpenseSectionProps> = ({
  dailyExpenses,
  dailyStats,
  isFutureMonth,
}) => {
  return (
    <Card className="p-5 print-avoid-break">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
            المصروف اليومي خلال الشهر
          </h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            توزيع الإنفاق اليومي لتحديد أيام الذروة والأيام الخالية من المصاريف
          </p>
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {dailyStats.highestDay && dailyStats.highestDay.amountFils > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
              <span>أعلى صرف:</span>
              <span>
                {toWesternDigits(formatDate(dailyStats.highestDay.date, 'd MMMM', { locale: ar }))}
              </span>
              <span>(<FormattedMoney amountFils={dailyStats.highestDay.amountFils} />)</span>
            </span>
          )}
          {!isFutureMonth && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>أيام بدون مصاريف:</span>
              <span>{toWesternDigits(String(dailyStats.zeroSpendDaysCount))} يوم</span>
            </span>
          )}
        </div>
      </div>

      <DailyExpenseChart data={dailyExpenses} className="pt-2" />
    </Card>
  )
}
