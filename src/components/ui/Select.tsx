import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/cn'
import { triggerHaptic } from '../../lib/haptics'
import { popoverVariants, isTestEnv } from '../../lib/motionTokens'

const PopoverWrapper = isTestEnv ? React.Fragment : AnimatePresence

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options?: SelectOption[]
  error?: string
  helperText?: string
  placeholder?: string
}

interface NormalizedOption {
  value: string | number
  label: string
  disabled?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, options, error, helperText, placeholder, id, children, disabled, value, onChange, ...props },
    ref,
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const [isOpen, setIsOpen] = useState(false)
    const [uncontrolledValue, setUncontrolledValue] = useState(props.defaultValue)
    const containerRef = useRef<HTMLDivElement>(null)
    const internalSelectRef = useRef<HTMLSelectElement | null>(null)

    const setRefs = (element: HTMLSelectElement | null) => {
      internalSelectRef.current = element
      if (typeof ref === 'function') {
        ref(element)
      } else if (ref) {
        ref.current = element
      }
    }

    const normalizedOptions = useMemo<NormalizedOption[]>(() => {
      if (options && options.length > 0) {
        return options.map((opt) => ({
          value: opt.value,
          label: opt.label,
          disabled: opt.disabled,
        }))
      }
      if (!children) return []

      const list: NormalizedOption[] = []
      const parseNodes = (nodes: React.ReactNode) => {
        React.Children.forEach(nodes, (child) => {
          if (!React.isValidElement(child)) return
          if (child.type === 'option') {
            const p = child.props as {
              value?: string | number
              children?: React.ReactNode
              disabled?: boolean
            }
            const val =
              p.value !== undefined
                ? p.value
                : typeof p.children === 'string'
                  ? p.children
                  : ''
            let lbl: string
            if (typeof p.children === 'string' || typeof p.children === 'number') {
              lbl = String(p.children)
            } else if (Array.isArray(p.children)) {
              lbl = p.children
                .map((c) => (typeof c === 'string' || typeof c === 'number' ? c : ''))
                .join('')
            } else {
              lbl = String(val)
            }
            list.push({
              value: val,
              label: lbl,
              disabled: p.disabled,
            })
          } else if (
            child.type === React.Fragment &&
            (child.props as { children?: React.ReactNode }).children
          ) {
            parseNodes((child.props as { children?: React.ReactNode }).children)
          } else if (
            child.type === 'optgroup' &&
            (child.props as { children?: React.ReactNode }).children
          ) {
            parseNodes((child.props as { children?: React.ReactNode }).children)
          }
        })
      }
      parseNodes(children)
      return list
    }, [options, children])

    const currentValue = value !== undefined ? value : uncontrolledValue

    const selectedOption = useMemo(() => {
      if (currentValue !== undefined && currentValue !== null) {
        const found = normalizedOptions.find(
          (opt) => String(opt.value) === String(currentValue),
        )
        if (found) return found
      }
      return normalizedOptions[0]
    }, [normalizedOptions, currentValue])

    const displayLabel = selectedOption ? selectedOption.label : (placeholder || '')

    // Close when clicking outside or pressing Escape
    useEffect(() => {
      if (!isOpen) return
      const handlePointerDown = (e: MouseEvent | TouchEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handlePointerDown)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [isOpen])

    const handleSelectOption = (opt: NormalizedOption) => {
      if (opt.disabled) return
      triggerHaptic('impact')
      setUncontrolledValue(opt.value)
      if (internalSelectRef.current) {
        internalSelectRef.current.value = String(opt.value)
      }
      if (onChange) {
        const syntheticEvent = {
          target: { value: String(opt.value), name: props.name || '' },
          currentTarget: { value: String(opt.value), name: props.name || '' },
        } as unknown as React.ChangeEvent<HTMLSelectElement>
        onChange(syntheticEvent)
      }
      setIsOpen(false)
    }

    return (
      <div ref={containerRef} className="w-full relative">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {/* Accessible hidden native select for full test and form compatibility */}
          <select
            id={selectId}
            ref={setRefs}
            value={value}
            defaultValue={value !== undefined ? undefined : props.defaultValue}
            onChange={(e) => {
              setUncontrolledValue(e.target.value)
              onChange?.(e)
            }}
            disabled={disabled}
            className="sr-only pointer-events-none"
            tabIndex={-1}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Custom Swiss Trigger Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                triggerHaptic('tick')
                setIsOpen((o) => !o)
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={cn(
              'w-full flex items-center justify-between rounded-xl border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ps-3.5 pe-3 py-2 text-base sm:text-sm transition-all outline-none cursor-pointer text-start',
              !className?.includes('h-') && 'h-11',
              'border-[#E4E4E7] dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20',
              isOpen && 'border-blue-600 ring-2 ring-blue-600/20',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              disabled && 'opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/50',
              className,
            )}
          >
            <span className="truncate font-medium min-w-0 flex-1">
              {displayLabel || '\u00A0'}
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 ms-2 transition-transform duration-200',
                isOpen && 'rotate-180 text-blue-600 dark:text-blue-400',
              )}
            />
          </button>

          {/* Custom Swiss Dropdown Popover */}
          <PopoverWrapper>
            {isOpen && !disabled && (
              <motion.div
                variants={popoverVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute start-0 end-0 top-[calc(100%+0.35rem)] z-50 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-xl dark:shadow-none p-1.5 max-h-60 overflow-y-auto space-y-0.5 select-none"
                role="listbox"
              >
                {normalizedOptions.map((opt) => {
                  const isSelected = String(opt.value) === String(currentValue)
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      disabled={opt.disabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectOption(opt)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer text-start',
                        isSelected
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold'
                          : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/70',
                        opt.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                      )}
                    >
                      <span className="truncate flex-1">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </motion.div>
            )}
          </PopoverWrapper>
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
