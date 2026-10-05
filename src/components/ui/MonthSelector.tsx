import React from 'react'
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { cn } from '../../lib/cn'

interface MonthSelectorProps {
  className?: string
  showIcon?: boolean
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({ className, showIcon = true }) => {
  const { monthLabel, goToPreviousMonth, goToNextMonth } = useSelectedMonth()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs',
        className
      )}
      role="group"
      aria-label="اختيار الشهر المالي"
    >
      {/* Previous month (In RTL, ChevronRight points back to previous) */}
      <button
        type="button"
        onClick={goToPreviousMonth}
        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
        aria-label="الشهر السابق"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Month Label */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-sm font-bold text-slate-800 dark:text-slate-100 select-none">
        {showIcon && <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />}
        <span>{monthLabel}</span>
      </div>

      {/* Next month (In RTL, ChevronLeft points forward to next) */}
      <button
        type="button"
        onClick={goToNextMonth}
        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
        aria-label="الشهر التالي"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  )
}
