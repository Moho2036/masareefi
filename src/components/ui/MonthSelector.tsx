import React, { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { getFiscalMonthInfo } from '../../lib/dates'
import { ARABIC_MONTH_NAMES } from '../../lib/reports'
import { cn } from '../../lib/cn'

interface MonthSelectorProps {
  className?: string
  showIcon?: boolean
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  className,
  showIcon = true,
}) => {
  const {
    selectedDate,
    setSelectedDate,
    monthLabel,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    monthStartDay,
    rangeLabel,
    isCurrentMonth,
  } = useSelectedMonth()

  const activeFiscal = getFiscalMonthInfo(selectedDate, monthStartDay)

  const [isOpen, setIsOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState<number>(() => activeFiscal.year)

  const containerRef = useRef<HTMLDivElement>(null)

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      if (!prev) {
        setPickerYear(activeFiscal.year)
      }
      return !prev
    })
  }

  const handleSelectMonth = (monthIndex: number) => {
    const safeDay = Math.max(1, Math.min(28, monthStartDay))
    setSelectedDate(new Date(pickerYear, monthIndex, safeDay, 12, 0, 0, 0))
    setIsOpen(false)
  }

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex items-center gap-1 p-1 bg-white dark:bg-[#121215] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none',
        className
      )}
      role="group"
      aria-label="اختيار الشهر المالي"
    >
      <button
        type="button"
        onClick={goToPreviousMonth}
        className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="الشهر السابق"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Center Interactive Month Title Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className="flex flex-col items-center justify-center px-1.5 sm:px-2.5 py-1 min-h-[36px] text-center select-none min-w-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
        aria-expanded={isOpen}
        aria-label="فتح قائمة اختيار الشهر والسنة"
      >
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
          {showIcon && (
            <Calendar className="hidden sm:inline-block w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          )}
          <span>{monthLabel}</span>
        </div>
        {monthStartDay !== 1 && rangeLabel && (
          <span className="text-[10px] sm:text-[11px] font-semibold text-blue-600 dark:text-blue-400 leading-tight whitespace-nowrap">
            {rangeLabel}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={goToNextMonth}
        className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="الشهر التالي"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Swiss Popover Picker Panel */}
      {isOpen && (
        <div
          className="absolute top-[calc(100%+0.35rem)] end-0 sm:left-1/2 sm:-translate-x-1/2 z-50 w-72 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-xl dark:shadow-none p-3.5 space-y-3 select-none animate-slide-down"
          role="dialog"
          aria-label="منتقي الشهر والسنة"
        >
          {/* Year Navigation Bar */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setPickerYear((y) => y - 1)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="السنة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
              {pickerYear}
            </span>
            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="السنة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {ARABIC_MONTH_NAMES.map((name, idx) => {
              const isSelected =
                pickerYear === activeFiscal.year && idx === activeFiscal.monthIndex
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={cn(
                    'text-xs py-2 px-1 rounded-xl text-center transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-blue-600 text-white font-black shadow-xs'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold'
                  )}
                >
                  {name}
                </button>
              )
            })}
          </div>

          {/* Bottom Quick Return Button */}
          {!isCurrentMonth && (
            <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  goToCurrentMonth()
                  setIsOpen(false)
                }}
                className="w-full text-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                العودة إلى الشهر الحالي
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
