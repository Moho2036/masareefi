import React, { useRef, useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { format } from 'date-fns'
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
  className,
  error,
  'aria-label': ariaLabel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker()
        } catch {
          inputRef.current.focus()
        }
      } else {
        inputRef.current.focus()
      }
    }
  }

  const handleQuickSelect = (daysOffset: number) => {
    if (disabled || readOnly) return
    const d = new Date()
    d.setDate(d.getDate() - daysOffset)
    onChange(formatDateInput(d))
  }

  const todayStr = formatDateInput(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDateInput(yesterday)

  return (
    <div className={cn('space-y-1.5', className)}>
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
                disabled={disabled || readOnly}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
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
                disabled={disabled || readOnly}
                className={cn(
                  'px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
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

      {/* Styled display box with hidden/overlay date input */}
      <div
        onClick={handleContainerClick}
        className={cn(
          'relative flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-white dark:bg-zinc-900 text-sm transition-all shadow-2xs cursor-pointer',
          error
            ? 'border-red-500 ring-1 ring-red-500'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent',
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

        {/* Accessible date input */}
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
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          tabIndex={0}
        />
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400 font-medium">{error}</p>}
    </div>
  )
}
