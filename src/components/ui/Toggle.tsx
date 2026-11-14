import React from 'react'
import { cn } from '../../lib/cn'
import { triggerHaptic } from '../../lib/haptics'

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
  const labelId = toggleId && label ? `${toggleId}-label` : undefined
  const descId = toggleId && description ? `${toggleId}-desc` : undefined

  const handleToggle = () => {
    if (disabled) return
    triggerHaptic('tick')
    onChange(!checked)
  }

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      {(label || description) && (
        <div
          className={cn('flex-1', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
          onClick={handleToggle}
        >
          {label && (
            <span
              id={labelId}
              className={cn(
                'text-sm font-medium text-zinc-900 dark:text-zinc-100 select-none block',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer'
              )}
            >
              {label}
            </span>
          )}
          {description && (
            <p
              id={descId}
              className="text-xs text-zinc-500 dark:text-zinc-400 select-none"
            >
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
        aria-labelledby={labelId}
        aria-describedby={descId}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'bg-blue-600 dark:bg-blue-500'
            : 'bg-zinc-300 dark:bg-zinc-700',
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
