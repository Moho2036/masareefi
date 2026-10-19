import React from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Calendar,
  ArrowDownRight,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { useCurrency } from '../../hooks/useCurrency'
import type { ForecastResult } from '../../lib/forecast'
import { cn } from '../../lib/cn'

export interface SafeDailySpendCardProps {
  forecast: ForecastResult
  className?: string
}

export const SafeDailySpendCard: React.FC<SafeDailySpendCardProps> = ({
  forecast,
  className,
}) => {
  const { format } = useCurrency()

  const {
    dailySafeFils,
    actualDailySpendFils,
    healthStatus,
    remainingDays,
    freeBalance,
    upcomingRecurringExpenses,
    upcomingDebtObligations,
    isDeficitProjected,
    deficitAmount,
    surplusAmount,
    estimatedDeficitDay,
    recommendedDailyReductionFils,
    isCurrentMonth,
  } = forecast

  if (!isCurrentMonth) {
    return null
  }

  const totalUpcomingObligations = upcomingRecurringExpenses + upcomingDebtObligations

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-2 transition-all',
        healthStatus === 'safe' &&
          'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent',
        healthStatus === 'warning' &&
          'border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent',
        healthStatus === 'danger' &&
          'border-red-500/40 bg-gradient-to-br from-red-500/5 via-transparent to-transparent',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
              healthStatus === 'safe' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              healthStatus === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              healthStatus === 'danger' && 'bg-red-500/10 text-red-600 dark:text-red-400'
            )}
          >
            {healthStatus === 'safe' && <ShieldCheck className="w-5 h-5" />}
            {healthStatus === 'warning' && <AlertTriangle className="w-5 h-5" />}
            {healthStatus === 'danger' && <AlertCircle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              ميزانية الأمان اليومي وتوقّع الشهر
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              تحليل استباقي يراعي الفواتير المتكررة والديون القادمة
            </p>
          </div>
        </div>

        {/* Days remaining badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>متبقي {remainingDays} يوماً في الدورة</span>
        </div>
      </div>

      {/* Main highlight numbers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        {/* Daily Safe Spend */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
              حد الصرف اليومي الآمن
            </div>
            <div
              className={cn(
                'text-2xl sm:text-3xl font-black select-none tracking-tight',
                dailySafeFils > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
              )}
            >
              {format(dailySafeFils)}{' '}
              <span className="text-xs font-semibold text-slate-400">/ اليوم</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
            المبلغ الأقصى المسموح بصرفه اليوم لضمان سداد التزاماتك دون عجز.
          </p>
        </div>

        {/* Actual Spend Pace vs Free Balance */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold text-slate-400 mb-1">معدل صرفك الفعلي</div>
              <div className="text-lg font-black text-slate-700 dark:text-slate-200">
                {format(actualDailySpendFils)}{' '}
                <span className="text-[10px] text-slate-400 font-normal">/ اليوم</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 mb-1">الرصيد الحر المتبقي</div>
              <div
                className={cn(
                  'text-lg font-black',
                  freeBalance > 0
                    ? 'text-slate-800 dark:text-slate-200'
                    : 'text-red-500 dark:text-red-400'
                )}
              >
                {format(freeBalance)}
              </div>
            </div>
          </div>

          {totalUpcomingObligations > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>التزامات محجوزة (فواتير + ديون):</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {format(totalUpcomingObligations)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Early Deficit Warning / Positive Forecast Banner */}
      {isDeficitProjected ? (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-900 dark:text-red-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1">
              <div className="font-bold text-red-600 dark:text-red-400">
                تنبيه مبكر من خطر العجز المالي
              </div>
              <p>
                إذا استمر إنفاقك بهذه الوتيرة، ستواجه عجزاً قدره{' '}
                <span className="font-black text-red-600 dark:text-red-400 underline decoration-red-400">
                  {format(deficitAmount)}
                </span>{' '}
                {estimatedDeficitDay ? `بحلول يوم ${estimatedDeficitDay} من الشهر تقريباً!` : 'قبل نهاية الشهر!'}
              </p>
              {recommendedDailyReductionFils > 0 && (
                <div className="flex items-center gap-1.5 pt-1 text-slate-700 dark:text-slate-300 font-medium">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    الحل الموصى به: خفّض إنفاقك اليومي بمقدار{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {format(recommendedDailyReductionFils)}
                    </strong>{' '}
                    لتجنب الوقوع في العجز.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2.5 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="font-bold">مسارك المالي ممتاز!</span> وتيرة إنفاقك الحالية ضمن
              الحدود الآمنة، ويتوقع إنهاء الشهر بفائض ادخار يقارب{' '}
              <strong className="font-black text-emerald-600 dark:text-emerald-400">
                {format(surplusAmount)}
              </strong>
              .
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
