import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from 'date-fns'
import { ar } from 'date-fns/locale'
import { cn } from '../../lib/cn'
import { parseLocalDateInput, toWesternDigits, formatDateInput } from '../../lib/dates'

export interface DatePickerInputProps {
  id?: string
  value: string // Format: YYYY-MM-DD
  onChange: (value: string) => void
  label?: string
  min?: string
  max?: string
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  showQuickButtons?: boolean
  popoverAlign?: 'start' | 'end'
  className?: string
  error?: string
  'aria-label'?: string
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  id,
  value,
  onChange,
  label,
  min,
  max,
  disabled = false,
  readOnly = false,
  required = false,
  showQuickButtons = false,
  popoverAlign = 'start',
  className,
  error,
  'aria-label': ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState<Date>(() => {
    try {
      return value ? parseLocalDateInput(value) : new Date()
    } catch {
      return new Date()
    }
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close calendar when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const formattedDisplay = useMemo(() => {
    if (!value) return 'اختر التاريخ'
    try {
      const d = parseLocalDateInput(value)
      return toWesternDigits(format(d, 'EEEE، d MMMM yyyy', { locale: ar }))
    } catch {
      return value
    }
  }, [value])

  const handleContainerClick = () => {
    if (disabled || readOnly) return
    if (!isOpen && value) {
      try {
        setViewDate(parseLocalDateInput(value))
      } catch {
        setViewDate(new Date())
      }
    }
    setIsOpen((prev) => !prev)
  }

  const handleQuickSelect = (daysOffset: number) => {
    if (disabled || readOnly) return
    const d = new Date()
    d.setDate(d.getDate() - daysOffset)
    const dayStr = formatDateInput(d)
    if (min && dayStr < min) return
    if (max && dayStr > max) return
    onChange(dayStr)
    try {
      setViewDate(d)
    } catch {
      // ignore
    }
    setIsOpen(false)
  }

  const todayStr = formatDateInput(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDateInput(yesterday)

  return (
    <div ref={containerRef} className={cn('space-y-1.5 relative', className)}>
      {(label || showQuickButtons) && (
        <div className="flex items-center justify-between">
          {label && (
            <label
              htmlFor={id}
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {label}
              {required && <span className="text-red-500 ms-1">*</span>}
            </label>
          )}
          {showQuickButtons && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickSelect(0)}
                disabled={disabled || readOnly || Boolean((min && todayStr < min) || (max && todayStr > max))}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                  value === todayStr
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                  (disabled || readOnly) && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(1)}
                disabled={disabled || readOnly || Boolean((min && yesterdayStr < min) || (max && yesterdayStr > max))}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                  value === yesterdayStr
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                  (disabled || readOnly) && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
              >
                أمس
              </button>
            </div>
          )}
        </div>
      )}

      {/* Styled display box */}
      <div
        role="button"
        tabIndex={disabled || readOnly ? -1 : 0}
        onClick={handleContainerClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleContainerClick()
          }
        }}
        className={cn(
          'relative flex items-center justify-between h-11 px-3.5 py-2 rounded-xl border bg-white dark:bg-zinc-900 text-sm transition-all cursor-pointer select-none',
          error
            ? 'border-red-500 ring-1 ring-red-500'
            : 'border-[#E4E4E7] dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20',
          isOpen && 'border-blue-600 ring-2 ring-blue-600/20',
          (disabled || readOnly) && 'opacity-60 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800/50'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Calendar className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <span
            className={cn(
              'truncate font-medium',
              value ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400'
            )}
          >
            {formattedDisplay}
          </span>
        </div>

        {/* Hidden date input for test compatibility and form integration */}
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-label={ariaLabel || label}
          aria-invalid={error ? 'true' : undefined}
          className="sr-only pointer-events-none"
          tabIndex={-1}
        />
      </div>

      {/* Custom Swiss Arabic Calendar Popover */}
      {isOpen && !disabled && !readOnly && (
        <div
          className={cn(
            'absolute top-[calc(100%+0.35rem)] z-50 w-72 sm:w-80 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-xl dark:shadow-none p-3.5 space-y-3 select-none animate-slide-down',
            popoverAlign === 'end' ? 'end-0' : 'start-0'
          )}
        >
          {/* Row 1: Month/Year navigation */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setViewDate((d) => subMonths(d, 1))
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="الشهر السابق"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              {toWesternDigits(format(viewDate, 'MMMM yyyy', { locale: ar }))}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setViewDate((d) => addMonths(d, 1))
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="الشهر التالي"
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
            {['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'].map((dayName, idx) => (
              <div key={idx} className="py-1">
                {dayName}
              </div>
            ))}
          </div>

          {/* Row 3: Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDay(startOfMonth(viewDate)) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8 w-full" />
            ))}
            {eachDayOfInterval({
              start: startOfMonth(viewDate),
              end: endOfMonth(viewDate),
            }).map((day) => {
              const dayStr = formatDateInput(day)
              const isSelected = dayStr === value
              const isToday = dayStr === todayStr
              const isOutOfRange = Boolean((min && dayStr < min) || (max && dayStr > max))

              return (
                <button
                  key={dayStr}
                  type="button"
                  disabled={isOutOfRange}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(dayStr)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'h-8 w-full rounded-lg text-xs font-semibold tabular-nums flex items-center justify-center transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-blue-600 text-white font-black shadow-2xs dark:shadow-none'
                      : isToday
                        ? 'border border-blue-600/50 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-950/40'
                        : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                    isOutOfRange && 'opacity-25 pointer-events-none cursor-not-allowed'
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          {/* Row 4: Quick selection bottom bar (only if not already shown in header) */}
          {!showQuickButtons && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={Boolean((min && todayStr < min) || (max && todayStr > max))}
                onClick={(e) => {
                  e.stopPropagation()
                  handleQuickSelect(0)
                }}
                className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-center"
              >
                اليوم
              </button>
              <button
                type="button"
                disabled={Boolean((min && yesterdayStr < min) || (max && yesterdayStr > max))}
                onClick={(e) => {
                  e.stopPropagation()
                  handleQuickSelect(1)
                }}
                className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-center"
              >
                أمس
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}
    </div>
  )
}
