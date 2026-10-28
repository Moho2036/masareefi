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
        'inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-[#E4E4E7] dark:border-[#27272A] gap-1',
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
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50',
              disabled && 'cursor-not-allowed',
            )}
          >
            {option.icon && (
              <span
                className={cn(
                  'shrink-0',
                  isSelected
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-400 dark:text-zinc-500',
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
