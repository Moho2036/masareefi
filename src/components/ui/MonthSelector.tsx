import React, { useState } from 'react'
import { ChevronRight, ChevronLeft, Calendar, RotateCw } from 'lucide-react'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/cn'

interface MonthSelectorProps {
  className?: string
  showIcon?: boolean
  showRefresh?: boolean
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  className,
  showIcon = true,
  showRefresh = true,
}) => {
  const { monthLabel, goToPreviousMonth, goToNextMonth, refreshData } = useSelectedMonth()
  const { showToast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    refreshData()
    showToast('تم تحديث البيانات', 'info')
    setTimeout(() => {
      setIsRefreshing(false)
    }, 600)
  }

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

      {/* Quick Refresh Button */}
      {showRefresh && (
        <>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:text-emerald-400 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            aria-label="تحديث البيانات"
            title="تحديث البيانات"
          >
            <RotateCw
              className={cn(
                'w-3.5 h-3.5 transition-transform',
                isRefreshing && 'animate-spin text-emerald-600 dark:text-emerald-400'
              )}
            />
          </button>
        </>
      )}
    </div>
  )
}
