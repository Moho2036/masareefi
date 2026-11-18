import React, { useState, useRef, useEffect } from 'react'
import { Search, SlidersHorizontal, X, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Select } from '../ui/Select'
import { DatePickerInput } from '../ui/DatePickerInput'
import { CategoryIcon } from '../ui/CategoryIcon'
import { TransactionFilterSummary } from './TransactionFilterSummary'
import { triggerHaptic } from '../../lib/haptics'
import { springSnappy } from '../../lib/motionTokens'
import { cn } from '../../lib/cn'
import type { TxType, Category } from '../../types'
import type { TransactionSortOption } from '../../lib/aggregate'

export interface TransactionFilterToolbarProps {
  filterType: TxType | 'all'
  onFilterTypeChange: (val: TxType | 'all') => void
  query: string
  onQueryChange: (val: string) => void
  sortBy: TransactionSortOption
  onSortByChange: (val: TransactionSortOption) => void
  allMonths: boolean
  onToggleAllMonths: () => void
  isCustomDateRange: boolean
  onToggleCustomDateRange: () => void
  customDateFrom: string
  onCustomDateFromChange: (val: string) => void
  customDateTo: string
  onCustomDateToChange: (val: string) => void
  selectedSource: 'all' | 'manual' | 'recurring' | 'debt' | 'circle'
  onSelectedSourceChange: (val: 'all' | 'manual' | 'recurring' | 'debt' | 'circle') => void
  selectedCategories: string[]
  onToggleCategory: (id: string) => void
  onClearCategories: () => void
  relevantCategories: Category[]
  isFilterActive: boolean
  onResetFilters: () => void
  filteredCount: number
  totals: { income: number; expense: number; balance: number }
}

export const TransactionFilterToolbar: React.FC<TransactionFilterToolbarProps> = (props) => {
  const {
    filterType, onFilterTypeChange, query, onQueryChange, sortBy, onSortByChange,
    allMonths, onToggleAllMonths, isCustomDateRange, onToggleCustomDateRange,
    customDateFrom, onCustomDateFromChange, customDateTo, onCustomDateToChange,
    selectedSource, onSelectedSourceChange, selectedCategories, onToggleCategory,
    onClearCategories, relevantCategories, isFilterActive, onResetFilters,
    filteredCount, totals,
  } = props
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [showAllFilterCats, setShowAllFilterCats] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 1023px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(max-width: 1023px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const activeAdvancedFiltersCount =
    (allMonths ? 1 : 0) +
    (isCustomDateRange ? 1 : 0) +
    (selectedSource !== 'all' ? 1 : 0) +
    (selectedCategories.length > 0 && !selectedCategories.includes('all') ? selectedCategories.length : 0)

  return (
    <aside className="lg:col-span-4 space-y-3.5 min-w-0 max-w-full lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar print-hide">
      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#121215] p-3 sm:p-3.5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none space-y-3 print-hide">
        {/* Top Permanent Row: Type Segmented Control + Mobile Search & Filter Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <SegmentedControl<TxType | 'all'>
              value={filterType}
              onChange={onFilterTypeChange}
              options={[
                { value: 'all', label: 'الكل' },
                { value: 'expense', label: 'مصاريف' },
                { value: 'income', label: 'مداخيل' },
              ]}
              className="w-full"
              size="sm"
            />
          </div>

          {/* Mobile Only: Search & Filter Buttons */}
          <div className="lg:hidden flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                setIsMobileSearchOpen((prev) => {
                  const next = !prev
                  if (next) setTimeout(() => searchInputRef.current?.focus(), 80)
                  return next
                })
              }}
              aria-label="فتح البحث"
              className={cn(
                'w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer',
                isMobileSearchOpen || query.trim()
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A]'
              )}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                setIsMobileFiltersOpen((prev) => !prev)
              }}
              aria-label="الفلاتر المتقدمة"
              className={cn(
                'relative w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer',
                isMobileFiltersOpen || activeAdvancedFiltersCount > 0
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A]'
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeAdvancedFiltersCount > 0 && (
                <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white dark:bg-zinc-950 text-blue-600 dark:text-blue-400 border-2 border-blue-600 text-[10px] font-black flex items-center justify-center shadow-xs">
                  {activeAdvancedFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Input (Smooth animated reveal on mobile, persistent on desktop) */}
        <AnimatePresence initial={false}>
          {(!isMobile || isMobileSearchOpen || Boolean(query.trim())) && (
            <motion.div
              key="search-box"
              initial={isMobile ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              exit={isMobile ? { opacity: 0, height: 0 } : undefined}
              transition={springSnappy}
              className="overflow-hidden"
            >
              <div className="relative pt-0.5">
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-zinc-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="ابحث في العنوان، الملاحظات، التصنيف، أو المبلغ..."
                  className="w-full ps-9 pe-8 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-zinc-50 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-base sm:text-sm focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                />
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick')
                      onQueryChange('')
                    }}
                    aria-label="مسح نص البحث"
                    className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort Selector */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <span className="font-bold text-zinc-500 dark:text-zinc-400 text-[11px]">ترتيب حسب:</span>
          <div className="w-40">
            <Select
              aria-label="ترتيب حسب"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as TransactionSortOption)}
              options={[
                { value: 'newest', label: 'الأحدث أولاً' },
                { value: 'oldest', label: 'الأقدم أولاً' },
                { value: 'highest', label: 'الأعلى قيمة' },
                { value: 'lowest', label: 'الأقل قيمة' },
              ]}
              className="text-xs font-bold"
            />
          </div>
        </div>

        {/* Advanced Filters Panel (Collapsible with smooth animation on mobile, always visible on desktop) */}
        <AnimatePresence initial={false}>
          {(!isMobile || isMobileFiltersOpen) && (
            <motion.div
              key="advanced-filters"
              initial={isMobile ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              exit={isMobile ? { opacity: 0, height: 0 } : undefined}
              transition={springSnappy}
              className="overflow-hidden space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800"
            >
              {/* Date Range Options: All Months or Custom Range */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick')
                      onToggleAllMonths()
                    }}
                    className={cn(
                      'press-scale inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0',
                      allMonths
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs dark:shadow-none'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                    )}
                    title={allMonths ? 'التبديل إلى معاملات الشهر المالي المحدد فقط' : 'البحث في كامل سجل المعاملات (كافة الأشهر)'}
                    aria-pressed={allMonths}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>كل الأشهر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick')
                      onToggleCustomDateRange()
                    }}
                    className={cn(
                      'press-scale inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0',
                      isCustomDateRange
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs dark:shadow-none'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                    )}
                    title="فلترة المعاملات ضمن نطاق زمني مخصص"
                    aria-pressed={isCustomDateRange}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>فترة مخصصة</span>
                  </button>
                </div>

                <AnimatePresence>
                  {isCustomDateRange && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={springSnappy}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pt-2.5 border-t border-[#E4E4E7] dark:border-[#27272A]">
                        <div className="grid grid-cols-2 gap-2">
                          <DatePickerInput
                            id="tx-custom-from"
                            label="من تاريخ"
                            value={customDateFrom}
                            max={customDateTo || undefined}
                            onChange={onCustomDateFromChange}
                          />
                          <DatePickerInput
                            id="tx-custom-to"
                            label="إلى تاريخ"
                            value={customDateTo}
                            min={customDateFrom || undefined}
                            popoverAlign="end"
                            onChange={onCustomDateToChange}
                          />
                        </div>
                        {customDateFrom && customDateTo && customDateFrom > customDateTo ? (
                          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                            تاريخ البداية يجب أن يسبق أو يطابق تاريخ النهاية.
                          </p>
                        ) : customDateFrom && !customDateTo ? (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            يرجى تحديد تاريخ النهاية لاكتمال النطاق الزمني.
                          </p>
                        ) : !customDateFrom && customDateTo ? (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            يرجى تحديد تاريخ البداية لاكتمال النطاق الزمني.
                          </p>
                        ) : !customDateFrom && !customDateTo ? (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                            حدد تاريخ البداية والنهاية لتطبيق الفلترة المخصصة.
                          </p>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

          {/* Source Filter Chips */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              المصدر
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-0.5 select-none text-xs no-scrollbar">
              {[
                { value: 'all', label: 'كافة المصادر' },
                { value: 'manual', label: 'يدوية' },
                { value: 'recurring', label: 'متكررة' },
                { value: 'debt', label: 'ديون' },
                { value: 'circle', label: 'جمعيات' },
              ].map((s) => {
                const isSelected = selectedSource === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => onSelectedSourceChange(s.value as typeof selectedSource)}
                    className={cn(
                      'px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer',
                      isSelected
                        ? 'bg-blue-600 text-white shadow-2xs dark:shadow-none font-bold'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category Chips with Multi-Select */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                التصنيفات
              </label>
              {selectedCategories.length > 0 && !selectedCategories.includes('all') && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                  ({selectedCategories.length} محدد)
                </span>
              )}
            </div>
            <div className="relative">
              <div className="flex items-center gap-1.5 overflow-x-auto lg:overflow-visible flex-nowrap lg:flex-wrap pb-1 pt-0.5 pe-4 select-none text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={onClearCategories}
                  className={cn(
                    'px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer',
                    selectedCategories.length === 0 || selectedCategories.includes('all')
                      ? 'bg-blue-600 text-white shadow-2xs dark:shadow-none font-bold'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                  )}
                >
                  كل التصنيفات
                </button>

                {(showAllFilterCats ? relevantCategories : relevantCategories.slice(0, 8)).map((cat) => {
                  const isSelected = selectedCategories.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onToggleCategory(cat.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all shrink-0 cursor-pointer',
                        isSelected
                          ? 'bg-blue-600 text-white shadow-2xs dark:shadow-none font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
                      )}
                    >
                      <CategoryIcon icon={cat.icon} size="sm" />
                      <span className="font-semibold">{cat.name}</span>
                    </button>
                  )
                })}
                {relevantCategories.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllFilterCats((prev) => !prev)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors shrink-0 cursor-pointer"
                  >
                    {showAllFilterCats ? 'عرض أقل' : `+${relevantCategories.length - 8} أخرى`}
                  </button>
                )}
              </div>
              {/* Subtle visual fade hint on mobile for scrollable categories */}
              <div className="lg:hidden pointer-events-none absolute inset-y-0 end-0 w-6 bg-gradient-to-s from-white dark:from-[#121215] to-transparent opacity-80" />
            </div>
          </div>

          {/* Mobile Fast-Apply Action Button */}
          {isMobile && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('impact')
                  setIsMobileFiltersOpen(false)
                }}
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>تطبيق الفلاتر ({filteredCount} معاملة)</span>
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
      </div>

      <TransactionFilterSummary
        allMonths={allMonths}
        onToggleAllMonths={onToggleAllMonths}
        isFilterActive={isFilterActive}
        onResetFilters={onResetFilters}
        filteredCount={filteredCount}
        totals={totals}
      />
    </aside>
  )
}
