import React from 'react'
import { Link } from 'react-router'
import {
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { FormattedMoney } from '../ui/FormattedMoney'
import { HeroCardSkeleton } from '../skeletons/DashboardSkeleton'
import { formatFinancialMonthLabel } from '../../lib/dates'
import { formatObligationsCount } from '../../lib/dashboard'
import { cn } from '../../lib/cn'
import type { ForecastResult } from '../../lib/forecast'

export interface DashboardHeroSectionProps {
  isInitialOrLoading: boolean
  isRolloverResolving: boolean
  isCurrentFiscalMonth: boolean
  range: { start: Date; end: Date }
  monthStartDay: number
  goToCurrentMonth: () => void
  safeDisplayBalance: number
  sums: { income: number; expense: number; balance: number }
  forecast: ForecastResult
  heroTopBar: string
  heroShieldColor: string
}

export const DashboardHeroSection: React.FC<DashboardHeroSectionProps> = ({
  isInitialOrLoading,
  isRolloverResolving,
  isCurrentFiscalMonth,
  range,
  monthStartDay,
  goToCurrentMonth,
  safeDisplayBalance,
  sums,
  forecast,
  heroTopBar,
  heroShieldColor,
}) => {
  if (isInitialOrLoading) {
    return <HeroCardSkeleton />
  }

  return (
    <div
      data-tour="hero-balance"
      className="bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none relative overflow-hidden rounded-2xl p-4 sm:p-5 space-y-5 flex flex-col justify-between transition-all"
    >
      {/* Top highlight bar */}
      <div className={cn('h-1 w-full absolute top-0 inset-x-0 transition-colors duration-300', heroTopBar)} />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400">
          الرصيد المتاح
        </span>
      </div>

      {/* Main Balance & Clean Typographic Subline (Persistent min-h to prevent layout shifts) */}
      <div className="space-y-1.5">
        <div className={cn('text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight select-none text-zinc-950 dark:text-zinc-50 transition-opacity', isRolloverResolving ? 'opacity-70 animate-pulse' : 'opacity-100')}>
          <FormattedMoney amountFils={safeDisplayBalance} animated />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium pt-1">
          <span>
            صافي الدورة المالية:{' '}
            <strong className="font-bold text-zinc-800 dark:text-zinc-200">
              <FormattedMoney amountFils={sums.balance} withSign="auto" />
            </strong>
          </span>
        </div>
      </div>

      {/* Income & Expenses Swiss Split Row (Zero nested boxes) */}
      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] pt-3.5 border-t border-[#E4E4E7] dark:border-[#27272A]">
        <Link
          to="/transactions?type=income"
          className="flex flex-col gap-1 ps-2 sm:ps-3 pe-3 hover:opacity-80 transition-opacity cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          title="عرض كافة معاملات الدخل"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>إجمالي المداخيل</span>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
            <FormattedMoney amountFils={sums.income} />
          </div>
        </Link>

        <Link
          to="/transactions?type=expense"
          className="flex flex-col gap-1 ps-3 sm:ps-4 pe-2 sm:pe-3 hover:opacity-80 transition-opacity cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          title="عرض كافة معاملات المصاريف"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
            <span>إجمالي المصاريف</span>
          </div>
          <div className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 truncate">
            <FormattedMoney amountFils={sums.expense} />
          </div>
        </Link>
      </div>

      {/* Daily Safe Budget Clean Footer Row */}
      <Link
        to="/reports"
        className="flex items-center justify-between pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] text-xs hover:opacity-80 transition-opacity group cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
        title="عرض التفاصيل في التقارير"
      >
        <div className="flex items-center gap-1.5 font-semibold text-zinc-600 dark:text-zinc-300">
          <ShieldCheck className={cn('w-4 h-4 shrink-0 transition-colors', heroShieldColor)} />
          <span>
            {forecast.isCurrentMonth
              ? 'ميزانية الأمان اليومي:'
              : forecast.isPastMonth
                ? 'صافي أداء الدورة:'
                : 'حد الصرف اليومي المقترح:'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-end font-bold text-zinc-900 dark:text-zinc-100">
          <span className="text-sm sm:text-base font-black">
            <FormattedMoney
              amountFils={forecast.isPastMonth ? sums.balance : forecast.dailySafeFils}
              withSign={forecast.isPastMonth ? 'auto' : undefined}
            />
          </span>
          {!forecast.isPastMonth && (
            <span className="text-[11px] font-normal text-zinc-400">/ اليوم</span>
          )}
          <ChevronLeft className="w-3.5 h-3.5 text-zinc-400 group-hover:-translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* Warning banner when browsing a different month (integrated at bottom of card) */}
      {!isCurrentFiscalMonth && (
        <button
          type="button"
          onClick={goToCurrentMonth}
          aria-label="العودة إلى الشهر الحالي"
          className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] w-full flex items-center justify-between gap-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer group text-start focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none rounded-lg"
          title="العودة إلى الشهر الحالي"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
              أنت تستعرض حالياً بيانات شهر {formatFinancialMonthLabel(range, monthStartDay)}
            </span>
          </div>
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0 group-hover:underline">
            العودة للحالي
          </span>
        </button>
      )}

      {/* Proactive alert for next cycle soon obligations (within 3 days of new cycle) */}
      {forecast.isCurrentMonth && (forecast.nextCycleSoonObligationsFils ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => {
            const section = document.getElementById('upcoming-obligations-section')
            if (section) {
              section.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
          className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] w-full flex items-center justify-between gap-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer group text-start focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-semibold truncate">
              مستحق مطلع الدورة (خلال 3 أيام):{' '}
              {formatObligationsCount(forecast.nextCycleSoonCount ?? 1)} بقيمة{' '}
              <FormattedMoney amountFils={forecast.nextCycleSoonObligationsFils!} />
            </span>
          </div>
          <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
        </button>
      )}
    </div>
  )
}
