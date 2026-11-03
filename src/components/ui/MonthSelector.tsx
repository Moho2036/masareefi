import React from 'react'
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { cn } from '../../lib/cn'

interface MonthSelectorProps {
  className?: string
  showIcon?: boolean
  showRefresh?: boolean
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  className,
  showIcon = true,
}) => {
  const {
    monthLabel,
    goToPreviousMonth,
    goToNextMonth,
    monthStartDay,
    rangeLabel,
  } = useSelectedMonth()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-white dark:bg-[#121215] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none',
        className
      )}
      role="group"
      aria-label="اختيار الشهر المالي"
    >
      <button
        type="button"
        onClick={goToPreviousMonth}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="الشهر السابق"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="flex flex-col items-center justify-center px-1.5 sm:px-2.5 py-0.5 text-center select-none min-w-0">
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
          {showIcon && <Calendar className="hidden sm:inline-block w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
          <span>{monthLabel}</span>
        </div>
        {monthStartDay !== 1 && rangeLabel && (
          <span className="text-[10px] sm:text-[11px] font-semibold text-blue-600 dark:text-blue-400 leading-tight whitespace-nowrap">
            {rangeLabel}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={goToNextMonth}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="الشهر التالي"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  )
}
