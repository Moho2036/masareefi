import React from 'react'
import { cn } from '../../lib/cn'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  className?: string
  id?: string
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
  id,
}) => {
  const toggleId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      {(label || description) && (
        <div className="flex-1 cursor-pointer" onClick={() => !disabled && onChange(!checked)}>
          {label && (
            <label
              htmlFor={toggleId}
              className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 select-none">
              {description}
            </p>
          )}
        </div>
      )}
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'bg-emerald-500 dark:bg-emerald-500'
            : 'bg-slate-300 dark:bg-slate-700',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
            checked
              ? 'ltr:translate-x-5 rtl:-translate-x-5'
              : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}
