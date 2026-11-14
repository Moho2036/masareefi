import { useId } from 'react'
import { motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { triggerHaptic } from '../../lib/haptics'
import { springSnappy } from '../../lib/motionTokens'

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
  const instanceId = useId()

  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-[#E4E4E7] dark:border-[#27272A] gap-1 relative',
        disabled && 'opacity-60 cursor-not-allowed pointer-events-none',
        className
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
            onClick={() => {
              if (!disabled) {
                if (!isSelected) {
                  triggerHaptic('tick')
                }
                onChange(option.value)
              }
            }}
            className={cn(
              'relative flex-1 inline-flex items-center justify-center gap-1.5 font-medium rounded-lg cursor-pointer select-none z-10 transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              isSelected
                ? 'text-zinc-900 dark:text-white font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              disabled && 'cursor-not-allowed'
            )}
          >
            {/* Sliding Pill Indicator */}
            {isSelected && (
              <motion.span
                layoutId={`segmentedPill-${instanceId}`}
                className="absolute inset-0 bg-white dark:bg-zinc-800 rounded-lg shadow-2xs dark:shadow-none -z-10"
                transition={springSnappy}
              />
            )}

            {option.icon && (
              <span
                className={cn(
                  'shrink-0',
                  isSelected
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-400 dark:text-zinc-500'
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
