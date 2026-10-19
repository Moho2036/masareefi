import { cn } from '../../lib/cn'

export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 gap-1',
        disabled && 'opacity-60 cursor-not-allowed pointer-events-none',
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => !disabled && onChange(option.value)}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all cursor-pointer select-none',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              isSelected
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-750',
              disabled && 'cursor-not-allowed',
            )}
          >
            {option.icon && (
              <span
                className={cn(
                  'shrink-0',
                  isSelected
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
