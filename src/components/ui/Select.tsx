import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectOption {
  value: string | number
  label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options?: SelectOption[]
  error?: string
  helperText?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, options, error, helperText, id, children, disabled, ...props },
    ref,
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full appearance-none rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ps-3.5 pe-10 py-2.5 text-sm transition-colors outline-none cursor-pointer',
              'border-[#E4E4E7] dark:border-[#27272A] focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              disabled && 'opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/50',
              className,
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute end-3 pointer-events-none text-zinc-400 dark:text-zinc-500">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = 'Select'
