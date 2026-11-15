import React, { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { generateReportYearOptions } from '../../lib/reportYears'
import { cn } from '../../lib/cn'
import { triggerHaptic } from '../../lib/haptics'
import { popoverVariants, isTestEnv } from '../../lib/motionTokens'

const PopoverWrapper = isTestEnv ? React.Fragment : AnimatePresence

interface YearSelectorProps {
  selectedYear: number
  onSelectYear: (year: number) => void
  className?: string
}

export const YearSelector: React.FC<YearSelectorProps> = ({
  selectedYear,
  onSelectYear,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentCalendarYear = new Date().getFullYear()
  const yearOptions = generateReportYearOptions(currentCalendarYear, selectedYear)

  const handleToggleOpen = () => {
    triggerHaptic('tick')
    setIsOpen((prev) => !prev)
  }

  const handleSelect = (yearNum: number) => {
    triggerHaptic('impact')
    onSelectYear(yearNum)
    setIsOpen(false)
  }

  const handleStepYear = (delta: number) => {
    triggerHaptic('tick')
    onSelectYear(selectedYear + delta)
  }

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative inline-flex items-center gap-1 p-1 bg-white dark:bg-[#121215] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none',
        className
      )}
      role="group"
      aria-label="اختيار السنة المالية"
    >
      {/* Next Year Button (Right Chevron in RTL advances year) */}
      <button
        type="button"
        onClick={() => handleStepYear(1)}
        className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="السنة التالية"
        title="السنة التالية"
      >
        <ChevronRight className="w-4 h-4 stroke-[2.2]" />
      </button>

      {/* Center Interactive Year Title Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label="اختيار السنة"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="اختيار السنة"
        className="flex flex-col items-center justify-center px-1.5 sm:px-2.5 py-1 min-h-[36px] text-center select-none min-w-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
          <Calendar className="hidden sm:inline-block w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>سنة {selectedYear}</span>
        </div>
      </button>

      {/* Previous Year Button (Left Chevron in RTL steps back a year) */}
      <button
        type="button"
        onClick={() => handleStepYear(-1)}
        className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        aria-label="السنة السابقة"
        title="السنة السابقة"
      >
        <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
      </button>

      {/* Dropdown Popover */}
      <PopoverWrapper>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="قائمة السنوات"
            variants={popoverVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute top-full mt-2 start-0 z-50 w-44 bg-white dark:bg-[#121215] rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-2 max-h-60 overflow-y-auto"
          >
            <div className="space-y-1">
              {yearOptions.map((opt) => {
                const yearNum = Number(opt.value)
                const isSelected = yearNum === selectedYear
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(yearNum)}
                    className={cn(
                      'press-scale w-full text-start px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center justify-between',
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </PopoverWrapper>
    </div>
  )
}
