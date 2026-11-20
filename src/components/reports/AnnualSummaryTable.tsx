import React from 'react'
import { CalendarDays } from 'lucide-react'
import { Card } from '../ui/Card'
import { MonthlyBarChart } from '../charts/MonthlyBarChart'
import { FormattedMoney } from '../ui/FormattedMoney'
import { cn } from '../../lib/cn'
import type { MonthlyBreakdownItem } from '../../lib/reports'

export interface AnnualSummaryTableProps {
  yearlyBreakdown: (MonthlyBreakdownItem & { isFutureMonth?: boolean })[]
  yearSums: { income: number; expense: number; balance: number }
  selectedYear: number
  currentYear: number
  currentFiscalInfo: { year: number; monthIndex: number }
  monthStartDay: number
}

export const AnnualSummaryTable: React.FC<AnnualSummaryTableProps> = ({
  yearlyBreakdown,
  yearSums,
  selectedYear,
  currentYear,
  currentFiscalInfo,
  monthStartDay,
}) => {
  const isYearEmpty = yearSums.income === 0 && yearSums.expense === 0

  return (
    <div className="space-y-6">
      {/* Large Grouped Bar Chart */}
      <Card className="p-5 print-avoid-break">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
              المداخيل والمصاريف لكل شهر
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {monthStartDay > 1 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                يبدأ الشهر المالي يوم {monthStartDay}
              </span>
            )}
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
              سنة {selectedYear}
            </span>
          </div>
        </div>
        <MonthlyBarChart data={yearlyBreakdown} className="pt-2" />
      </Card>

      {/* Monthly Breakdown Table */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
            تفاصيل الشهور
          </h2>
          <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            12 شهراً
          </span>
        </div>

        <div className="overflow-x-auto min-w-0 max-w-full">
          <table className="w-full text-start border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                <th className="p-2.5 text-start font-bold sticky start-0 z-10 bg-white dark:bg-[#121215]">
                  الشهر
                </th>
                <th className="p-2.5 text-start font-bold">المداخيل</th>
                <th className="p-2.5 text-start font-bold">المصاريف</th>
                <th className="p-2.5 text-start font-bold">صافي الادخار</th>
              </tr>
            </thead>
            <tbody>
              {yearlyBreakdown.map((row) => {
                const isCurrentRowMonth =
                  selectedYear === currentYear &&
                  row.monthIndex === currentFiscalInfo.monthIndex
                const isFutureMonth =
                  selectedYear > currentYear ||
                  (selectedYear === currentYear &&
                    row.monthIndex > currentFiscalInfo.monthIndex)
                const isUnstartedFuture =
                  isFutureMonth && row.income === 0 && row.expense === 0
                const isEmptyRecord = row.income === 0 && row.expense === 0

                return (
                  <tr
                    key={row.monthIndex}
                    className={cn(
                      'border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors',
                      isCurrentRowMonth && 'bg-blue-50/60 dark:bg-blue-950/30 font-bold'
                    )}
                  >
                    <td
                      className={cn(
                        'p-2.5 font-bold sticky start-0 z-10 transition-colors',
                        isCurrentRowMonth
                          ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200'
                          : 'bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-200'
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span>{row.monthName}</span>
                          {isCurrentRowMonth && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-blue-600 text-white font-bold">
                              الشهر الحالي
                            </span>
                          )}
                        </span>
                        {row.dateRange && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                            {row.dateRange}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                      {isUnstartedFuture ? (
                        <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px] font-normal">
                          لم يبدأ بعد
                        </span>
                      ) : isEmptyRecord ? (
                        <span className="text-zinc-400 dark:text-zinc-600 font-normal">—</span>
                      ) : (
                        <FormattedMoney amountFils={row.income} />
                      )}
                    </td>
                    <td className="p-2.5 font-bold text-red-600 dark:text-red-400">
                      {isUnstartedFuture ? (
                        <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px] font-normal">
                          لم يبدأ بعد
                        </span>
                      ) : isEmptyRecord ? (
                        <span className="text-zinc-400 dark:text-zinc-600 font-normal">—</span>
                      ) : (
                        <FormattedMoney amountFils={row.expense} />
                      )}
                    </td>
                    <td
                      className={cn(
                        'p-2.5 font-extrabold',
                        row.balance >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {isUnstartedFuture ? (
                        <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px] font-normal">
                          لم يبدأ بعد
                        </span>
                      ) : isEmptyRecord ? (
                        <span className="text-zinc-400 dark:text-zinc-600 font-normal">
                          —
                        </span>
                      ) : (
                        <FormattedMoney amountFils={row.balance} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E4E4E7] dark:border-[#27272A] bg-zinc-50/80 dark:bg-[#18181B] font-black">
                <td className="p-2.5 text-zinc-800 dark:text-zinc-100 font-black sticky start-0 z-10 bg-zinc-50 dark:bg-[#18181B]">
                  الإجمالي السنوي
                </td>
                <td className="p-2.5 font-black">
                  {isYearEmpty ? (
                    <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      <FormattedMoney amountFils={yearSums.income} />
                    </span>
                  )}
                </td>
                <td className="p-2.5 font-black">
                  {isYearEmpty ? (
                    <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">
                      <FormattedMoney amountFils={yearSums.expense} />
                    </span>
                  )}
                </td>
                <td className="p-2.5 font-black">
                  {isYearEmpty ? (
                    <span className="text-zinc-400 dark:text-zinc-500 font-normal">—</span>
                  ) : (
                    <span
                      className={
                        yearSums.balance >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      <FormattedMoney amountFils={yearSums.balance} />
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
