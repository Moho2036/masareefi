import React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Frequency } from '../../types'

export interface RecurringFrequencySelectorProps {
  frequency: Frequency
  onChange: (freq: Frequency) => void
  disabled?: boolean
  showExtraDropdown: boolean
  setShowExtraDropdown: React.Dispatch<React.SetStateAction<boolean>>
}

const extraOptions: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'يومي' },
  { value: 'biweekly', label: 'كل أسبوعين' },
  { value: 'quarterly', label: 'ربع سنوي (3 أشهر)' },
  { value: 'semiannual', label: 'نصف سنوي (6 أشهر)' },
]

export const RecurringFrequencySelector: React.FC<RecurringFrequencySelectorProps> = ({
  frequency,
  onChange,
  disabled = false,
  showExtraDropdown,
  setShowExtraDropdown,
}) => {
  return (
    <div>
      <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
        التكرار
      </label>
      <div role="radiogroup" className="grid grid-cols-4 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
        <button
          type="button"
          role="radio"
          aria-checked={frequency === 'weekly'}
          disabled={disabled}
          onClick={() => {
            onChange('weekly')
            setShowExtraDropdown(false)
          }}
          className={cn(
            'py-1.5 text-xs font-bold rounded-lg transition-all',
            frequency === 'weekly'
              ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          أسبوعي
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={frequency === 'monthly'}
          disabled={disabled}
          onClick={() => {
            onChange('monthly')
            setShowExtraDropdown(false)
          }}
          className={cn(
            'py-1.5 text-xs font-bold rounded-lg transition-all',
            frequency === 'monthly'
              ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          شهري
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={frequency === 'yearly'}
          disabled={disabled}
          onClick={() => {
            onChange('yearly')
            setShowExtraDropdown(false)
          }}
          className={cn(
            'py-1.5 text-xs font-bold rounded-lg transition-all',
            frequency === 'yearly'
              ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          سنوي
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={['daily', 'biweekly', 'quarterly', 'semiannual'].includes(frequency)}
          disabled={disabled}
          onClick={() => setShowExtraDropdown((prev) => !prev)}
          className={cn(
            'py-1.5 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-0.5',
            ['daily', 'biweekly', 'quarterly', 'semiannual'].includes(frequency)
              ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <span className="truncate">
            {frequency === 'daily'
              ? 'يومي'
              : frequency === 'biweekly'
                ? 'أسبوعين'
                : frequency === 'quarterly'
                  ? 'ربع سنوي'
                  : frequency === 'semiannual'
                    ? 'نصف سنوي'
                    : 'أخرى'}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0" />
        </button>
      </div>

      {/* Dropdown menu for extra frequencies */}
      {showExtraDropdown && !disabled && (
        <div className="mt-2 p-1.5 bg-white dark:bg-[#121215] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] shadow-lg grid grid-cols-2 gap-1.5">
          {extraOptions.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                onChange(f.value)
                setShowExtraDropdown(false)
              }}
              className={cn(
                'px-2.5 py-2 text-xs font-bold rounded-lg text-start flex items-center justify-between transition-colors',
                frequency === f.value
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              <span>{f.label}</span>
              {frequency === f.value && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
