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
            className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute start-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
              {startIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full h-11 rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 px-3.5 py-2 text-base sm:text-sm transition-colors outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
              'border-[#E4E4E7] dark:border-[#27272A] focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20',
              startIcon && 'ps-10',
              endIcon && 'pe-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              disabled && 'opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/50',
              className,
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute end-3 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
              {endIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {!error && helperText && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
