import React from 'react'
import { cn } from '../../lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      startIcon,
      endIcon,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute start-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {startIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm transition-colors outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
              startIcon && 'ps-10',
              endIcon && 'pe-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              disabled && 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-850',
              className,
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute end-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              {endIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {!error && helperText && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
