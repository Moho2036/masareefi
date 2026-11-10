import React from 'react'
import { ShieldCheck, AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react'
import { Card } from '../../ui/Card'
import { useCurrency } from '../../../hooks/useCurrency'
import type { ForecastResult } from '../../../lib/forecast'
import { cn } from '../../../lib/cn'

export interface PastMonthSpendCardProps {
  forecast: ForecastResult
  className?: string
}

export const PastMonthSpendCard: React.FC<PastMonthSpendCardProps> = ({
  forecast,
  className,
}) => {
  const { format } = useCurrency()

  const {
    actualDailySpendFils,
    totalDays,
    currentIncome,
    currentExpense,
    monthNet,
    rolloverBalance,
    availableBalance,
    deficitAmount,
    surplusAmount,
  } = forecast

  const isSurplus = availableBalance >= 0

  return (
    <Card
      className={cn(
        'relative overflow-hidden border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-2xs dark:shadow-none transition-all print-avoid-break',
        className
      )}
    >
      <div className={cn('h-1 w-full absolute top-0 inset-x-0', isSurplus ? 'bg-emerald-500' : 'bg-red-500')} />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E4E7] dark:border-[#27272A]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            {isSurplus ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
            )}
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
              ميزانية وأداء الشهر المالي
            </h3>
          </div>
        </div>

        {/* Month ended badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/90 text-xs font-bold text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A] self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <span>هذا الشهر قد انتهى ({totalDays} يوماً)</span>
        </div>
      </div>

      {/* Main highlight numbers */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] py-4">
        {/* Net Result (Saved or Deficit) */}
        <div className="pb-4 md:pb-0 md:pe-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              {rolloverBalance !== 0
                ? isSurplus
                  ? 'الرصيد الختامي المتبقي (شامل المرحّل)'
                  : 'عجز مالي ختامي (تجاوز الدخل والمرحّل)'
                : isSurplus
                  ? 'صافي الوفر المحقق'
                  : 'صافي العجز المالي'}
            </div>
            <div
              className={cn(
                'text-2xl sm:text-3xl font-black select-none tracking-tight',
                isSurplus ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
              )}
              dir="ltr"
            >
              {isSurplus ? `+ ${format(Math.abs(availableBalance))}` : `- ${format(Math.abs(availableBalance))}`}
            </div>
          </div>
          {rolloverBalance !== 0 ? (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
              صافي عمليات الشهر وحده: {monthNet >= 0 ? '+' : '-'}{format(Math.abs(monthNet))} | المرحّل السابق: {rolloverBalance >= 0 ? '+' : '-'}{format(Math.abs(rolloverBalance))}
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
              {isSurplus
                ? 'تم إنهاء هذا الشهر بنجاح مع تحقيق فائض مالي إيجابي.'
                : 'تجاوزت المصاريف إجمالي المداخيل المحصلة لهذا الشهر.'}
            </p>
          )}
        </div>

        {/* Actual Daily Pace & Totals */}
        <div className="pt-4 md:pt-0 md:ps-5 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold text-zinc-400 mb-1">متوسط صرفك اليومي (المرن)</div>
              <div className="text-lg font-black text-zinc-700 dark:text-zinc-200">
                {format(actualDailySpendFils)}{' '}
                <span className="text-[10px] text-zinc-400 font-normal">/ اليوم</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-400 mb-1">إجمالي المصاريف</div>
              <div className="text-lg font-black text-red-500 dark:text-red-400">
                {format(currentExpense)}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>إجمالي المداخيل المحصلة:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {format(currentIncome)}
            </span>
          </div>
        </div>
      </div>

      {/* Conclusion Banner */}
      {isSurplus ? (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 flex items-center gap-2.5 text-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">أداء مالي ناجح!</span>{' '}
            {rolloverBalance !== 0 ? (
              <>
                اكتمل هذا الشهر برصيد ختامي متبقي قدره{' '}
                <strong className="font-black text-emerald-600 dark:text-emerald-400">
                  {format(Math.abs(availableBalance))}
                </strong>
                .
              </>
            ) : (
              <>
                اكتمل هذا الشهر بوفر مالي قدره{' '}
                <strong className="font-black text-emerald-600 dark:text-emerald-400">
                  {format(surplusAmount)}
                </strong>
                .
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 flex items-center gap-2.5 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">تنبيه مالي:</span>{' '}
            {rolloverBalance !== 0 ? (
              <>
                انتهى هذا الشهر بعجز ختامي كلي قدره{' '}
                <strong className="font-black text-red-600 dark:text-red-400">
                  {format(Math.abs(availableBalance))}
                </strong>
                .
              </>
            ) : (
              <>
                انتهى هذا الشهر بعجز قدره{' '}
                <strong className="font-black text-red-600 dark:text-red-400">
                  {format(deficitAmount)}
                </strong>
                .
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
