import React, { useState } from 'react'
import { ShieldCheck, AlertTriangle, AlertCircle, Calendar, Info } from 'lucide-react'
import { Card } from '../../ui/Card'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { useCurrency } from '../../../hooks/useCurrency'
import type { ForecastResult } from '../../../lib/forecast'
import { cn } from '../../../lib/cn'

export interface FutureMonthSpendCardProps {
  forecast: ForecastResult
  className?: string
}

export const FutureMonthSpendCard: React.FC<FutureMonthSpendCardProps> = ({
  forecast,
  className,
}) => {
  const { format } = useCurrency()
  const [showInfo, setShowInfo] = useState(false)

  const {
    dailySafeFils,
    healthStatus,
    totalDays,
    freeBalance,
    rolloverBalance,
    upcomingRecurringExpenses,
    upcomingDebtObligations,
    isDeficitProjected,
    deficitAmount,
  } = forecast

  const totalUpcomingObligations = upcomingRecurringExpenses + upcomingDebtObligations

  return (
    <Card
      className={cn(
        'relative overflow-hidden border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-2xs dark:shadow-none transition-all print-avoid-break',
        className
      )}
    >
      <div
        className={cn(
          'h-1 w-full absolute top-0 inset-x-0',
          healthStatus === 'safe'
            ? 'bg-emerald-500'
            : healthStatus === 'warning'
              ? 'bg-amber-500'
              : 'bg-red-500'
        )}
      />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-[#E4E4E7] dark:border-[#27272A]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            {healthStatus === 'safe' && <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            {healthStatus === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />}
            {healthStatus === 'danger' && <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />}
          </div>
          <div>
            <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
              ميزانية وتوقّع الشهر القادم
            </h3>
          </div>
        </div>

        {/* Days remaining badge & Info toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowInfo((prev) => !prev)}
            className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
            aria-label="شرح معادلة الحساب"
            title="كيف يُحسب حد الصرف اليومي؟"
          >
            <Info className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/90 text-xs font-bold text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>شهر مستقبلي (متبقي كامل الدورة {totalDays} يوماً)</span>
          </div>
        </div>
      </div>

      {/* Mathematical Explanation Box */}
      {showInfo && (
        <div className="mt-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-[#E4E4E7] dark:border-[#27272A] text-xs text-zinc-700 dark:text-zinc-300 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
            <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>كيف يُحسب حد الصرف اليومي المقترح؟</span>
          </div>
          <p className="leading-relaxed font-semibold">
            المعادلة: حد الصرف اليومي = (الرصيد الحر المتوقع) ÷ (إجمالي أيام الدورة الشهرية: {totalDays} يوماً).
          </p>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5 pt-1">
            <div>• الرصيد الحر المتوقع = إجمالي الدخل المتوقع + الرصيد المرحّل - الفواتير والديون المحجوزة.</div>
            <div>• التخطيط الاستباقي يمنحك رؤية واضحة لكيفية توزيع مصروفاتك قبل أن يبدأ الشهر.</div>
          </div>
        </div>
      )}

      {/* Main highlight numbers */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] py-4">
        {/* Daily Safe Spend */}
        <div className="pb-4 md:pb-0 md:pe-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">
              حد الصرف اليومي المقترح
            </div>
            <div
              className={cn(
                'text-2xl sm:text-3xl font-black select-none tracking-tight inline-flex items-baseline gap-1.5',
                dailySafeFils > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              <FormattedMoney amountFils={dailySafeFils} />
              <span className="text-xs font-semibold text-zinc-400">/ اليوم</span>
            </div>
          </div>
        </div>

        {/* Projected Free Balance vs Reserved */}
        <div className="pt-4 md:pt-0 md:ps-5 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold text-zinc-400 mb-1">الرصيد الحر المتوقع</div>
              <div
                className={cn(
                  'text-lg font-black',
                  freeBalance > 0
                    ? 'text-zinc-800 dark:text-zinc-200'
                    : freeBalance < 0
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-zinc-500 dark:text-zinc-400'
                )}
                dir="ltr"
              >
                {format(freeBalance)}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-400 mb-1">
                {rolloverBalance >= 0 ? 'الرصيد المرحّل المتوقع' : 'العجز المرحّل المتوقع'}
              </div>
              <div
                className={cn(
                  'text-lg font-black',
                  rolloverBalance >= 0
                    ? 'text-zinc-700 dark:text-zinc-200'
                    : 'text-red-500 dark:text-red-400'
                )}
                dir="ltr"
              >
                {rolloverBalance >= 0
                  ? `+ ${format(rolloverBalance)}`
                  : `- ${format(Math.abs(rolloverBalance))}`}
              </div>
            </div>
          </div>

          {totalUpcomingObligations > 0 && (
            <div className="mt-3 pt-2.5 border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>التزامات محجوزة (فواتير + ديون):</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {format(totalUpcomingObligations)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Forecast / Deficit Banner */}
      {isDeficitProjected ? (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 flex items-center gap-2.5 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">تحذير من عجز متوقع:</span> الالتزامات المجدولة تفوق الدخل والرصيد المتوقع بعجز قدره{' '}
            <strong className="font-black text-red-600 dark:text-red-400">
              {format(deficitAmount)}
            </strong>
            . يرجى مراجعة وتعديل التزاماتك أو توفير سيولة إضافية.
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 flex items-center gap-2.5 text-xs">
          <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">تخطيط استباقي:</span> تم احتساب ميزانية هذا الشهر بناءً على الفواتير المتكررة والديون المستحقة خلال كامل الدورة ({totalDays} يوماً).
          </div>
        </div>
      )}
    </Card>
  )
}
