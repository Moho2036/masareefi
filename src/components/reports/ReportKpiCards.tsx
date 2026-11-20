import React from 'react'
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { FormattedMoney } from '../ui/FormattedMoney'
import { cn } from '../../lib/cn'
import type { ForecastResult } from '../../lib/forecast'
import type { AnnualSummaryResult } from '../../lib/reports'

export interface MonthlyKpiCardsProps {
  monthSums: { income: number; expense: number; balance: number }
  prevMonthSums: { income: number; expense: number; balance: number }
  monthSavingsRate: number
  monthComparison: { diff: number; percent: number; isIncrease: boolean } | null
  monthIncomeComparison: { diff: number; percent: number; isIncrease: boolean } | null
  forecast: ForecastResult
  isEarlyMonth: boolean
  effectiveRollover: number
  isRolloverEnabled: boolean
  openingBalanceFils: number
}

export const MonthlyKpiCards: React.FC<MonthlyKpiCardsProps> = ({
  monthSums,
  prevMonthSums,
  monthSavingsRate,
  monthComparison,
  monthIncomeComparison,
  forecast,
  isEarlyMonth,
  effectiveRollover,
  isRolloverEnabled,
  openingBalanceFils,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Income */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              إجمالي المداخيل
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
            <FormattedMoney amountFils={monthSums.income} />
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] leading-relaxed">
          {monthSums.income === 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500">
              {forecast.isFutureMonth
                ? 'الشهر لم يبدأ بعد'
                : isEarlyMonth
                  ? 'الشهر في بدايته — لم يُسجل دخل بعد'
                  : prevMonthSums.income > 0 ? (
                      <span className="font-bold inline-flex items-center gap-0.5 text-red-500 dark:text-red-400">
                        <ArrowDownRight className="w-3 h-3" />
                        <span>أقل بـ 100% عن الشهر السابق</span>
                      </span>
                    ) : (
                      'لا توجد مداخيل مسجلة في هذا الشهر'
                    )}
            </span>
          ) : monthIncomeComparison ? (
            monthIncomeComparison.diff === 0 ? (
              <span className="font-bold text-zinc-500 dark:text-zinc-400">
                مساوٍ للشهر السابق (0%)
              </span>
            ) : (
              <span
                className={cn(
                  'font-bold inline-flex items-center gap-0.5',
                  monthIncomeComparison.isIncrease
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
                )}
              >
                {monthIncomeComparison.isIncrease ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                <span>
                  {monthIncomeComparison.isIncrease ? 'أعلى' : 'أقل'} بـ{' '}
                  {monthIncomeComparison.percent === 0 ? '<0.1%' : `${monthIncomeComparison.percent}%`} عن الشهر السابق
                </span>
              </span>
            )
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">
              {prevMonthSums.income === 0
                ? 'لم يُسجل دخل في الشهر السابق'
                : 'الدخل المحصل في هذا الشهر'}
            </span>
          )}
        </div>
      </Card>

      {/* Expenses */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              إجمالي المصاريف
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
            <FormattedMoney amountFils={monthSums.expense} />
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] leading-relaxed">
          {monthSums.expense === 0 ? (
            <span className="text-zinc-400 dark:text-zinc-500">
              {forecast.isFutureMonth
                ? 'الشهر لم يبدأ بعد'
                : isEarlyMonth
                  ? 'الشهر في بدايته — لم تُسجل مصاريف بعد'
                  : prevMonthSums.expense > 0 ? (
                      <span className="font-bold inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                        <ArrowDownRight className="w-3 h-3" />
                        <span>أقل بـ 100% عن الشهر السابق</span>
                      </span>
                    ) : (
                      'لا توجد مصاريف مسجلة في هذا الشهر'
                    )}
            </span>
          ) : monthComparison ? (
            monthComparison.diff === 0 ? (
              <span className="font-bold text-zinc-500 dark:text-zinc-400">
                مساوٍ للشهر السابق (0%)
              </span>
            ) : (
              <span
                className={cn(
                  'font-bold inline-flex items-center gap-0.5',
                  monthComparison.isIncrease
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                )}
              >
                {monthComparison.isIncrease ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                <span>
                  {monthComparison.isIncrease ? 'أكثر' : 'أقل'} بـ{' '}
                  {monthComparison.percent === 0 ? '<0.1%' : `${monthComparison.percent}%`} عن الشهر السابق
                </span>
              </span>
            )
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">
              {prevMonthSums.expense === 0
                ? 'لم تُسجل مصاريف في الشهر السابق'
                : 'إجمالي ما تم صرفه'}
            </span>
          )}
        </div>
      </Card>

      {/* Net Savings */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              صافي الادخار
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={cn(
              'text-lg sm:text-2xl font-black select-none',
              monthSums.balance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            )}
          >
            <FormattedMoney amountFils={monthSums.balance} />
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          {isRolloverEnabled &&
          (forecast.isFutureMonth ? forecast.rolloverBalance : effectiveRollover) !== 0 ? (
            <>
              صافي الشهر المستقل (الرصيد المتاح مع المرحّل:{' '}
              <span dir="ltr" className="inline-block font-semibold">
                <FormattedMoney
                  amountFils={
                    monthSums.balance +
                    (forecast.isFutureMonth ? forecast.rolloverBalance : effectiveRollover)
                  }
                />
              </span>
              )
            </>
          ) : (
            'المبلغ المتبقي من دخل هذا الشهر بعد المصاريف'
          )}
        </div>
      </Card>

      {/* Savings Rate */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              نسبة الادخار
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={cn(
              'text-lg sm:text-2xl font-black select-none',
              monthSums.income === 0
                ? 'text-zinc-400 dark:text-zinc-500'
                : monthSums.balance < 0
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {monthSums.income === 0 ? '—' : `%${monthSavingsRate}`}
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          {monthSums.income === 0 && monthSums.expense > 0
            ? 'لا يوجد دخل مسجل لحساب النسبة'
            : 'من إجمالي الدخل المحصل'}
        </div>
      </Card>
    </div>
  )
}

export interface YearlyKpiCardsProps {
  yearSums: { income: number; expense: number; balance: number }
  yearlySavingsRate: number
  annualSummary: AnnualSummaryResult
  selectedYear: number
  monthlyAverage: number
}

export const YearlyKpiCards: React.FC<YearlyKpiCardsProps> = ({
  yearSums,
  yearlySavingsRate,
  annualSummary,
  selectedYear,
  monthlyAverage,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Total Annual Income */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              إجمالي المداخيل السنوية
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 select-none">
            <FormattedMoney amountFils={yearSums.income} />
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          {annualSummary.averageMonthlyIncomeFils > 0 ? (
            <div>متوسط الدخل: <FormattedMoney amountFils={annualSummary.averageMonthlyIncomeFils} /> / شهر</div>
          ) : (
            <div>إجمالي الدخل المحصل خلال سنة {selectedYear}</div>
          )}
        </div>
      </Card>

      {/* Total Annual Expense */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              إجمالي المصاريف السنوية
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-red-500 dark:text-red-400 select-none">
            <FormattedMoney amountFils={yearSums.expense} />
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          {annualSummary.averageMonthlyExpenseFils > 0 ? (
            <>
              <div>متوسط الصرف: <FormattedMoney amountFils={monthlyAverage} /> / شهر</div>
              {annualSummary.note && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                  ({annualSummary.note})
                </div>
              )}
            </>
          ) : (
            <div>إجمالي المصاريف خلال سنة {selectedYear}</div>
          )}
        </div>
      </Card>

      {/* Annual Net Savings */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              صافي الادخار السنوي
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={cn(
              'text-lg sm:text-2xl font-black select-none',
              yearSums.balance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            )}
          >
            <FormattedMoney amountFils={yearSums.balance} />
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          {yearSums.balance < 0 ? 'العجز المالي السنوي' : 'الفائض المالي السنوي'}
        </div>
      </Card>

      {/* Annual Savings Rate */}
      <Card className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] flex flex-col justify-between h-full print-avoid-break">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              نسبة الادخار السنوية
            </span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={cn(
              'text-lg sm:text-2xl font-black select-none',
              yearSums.income === 0
                ? 'text-zinc-400 dark:text-zinc-500'
                : yearSums.balance < 0
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {yearSums.income === 0 ? '—' : `%${yearlySavingsRate}`}
          </div>
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
          {yearSums.income === 0
            ? 'لا يوجد دخل مسجل لحساب النسبة'
            : 'من إجمالي الدخل المحصل سنوياً'}
        </div>
      </Card>
    </div>
  )
}
