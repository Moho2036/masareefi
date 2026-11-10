import React, { useState, useRef } from 'react'
import { Search, SlidersHorizontal, X, Calendar, AlertCircle } from 'lucide-react'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Select } from '../ui/Select'
import { DatePickerInput } from '../ui/DatePickerInput'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
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

export const TransactionFilterToolbar: React.FC<TransactionFilterToolbarProps> = ({
  filterType,
  onFilterTypeChange,
  query,
  onQueryChange,
  sortBy,
  onSortByChange,
  allMonths,
  onToggleAllMonths,
  isCustomDateRange,
  onToggleCustomDateRange,
  customDateFrom,
  onCustomDateFromChange,
  customDateTo,
  onCustomDateToChange,
  selectedSource,
  onSelectedSourceChange,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
  relevantCategories,
  isFilterActive,
  onResetFilters,
  filteredCount,
  totals,
}) => {
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [showAllFilterCats, setShowAllFilterCats] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

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
                setIsMobileSearchOpen((prev) => {
                  const next = !prev
                  if (next) setTimeout(() => searchInputRef.current?.focus(), 50)
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
              onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
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
                <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                  {activeAdvancedFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Input (Hidden on mobile unless opened or has query, always visible on desktop) */}
        <div className={cn('relative', !isMobileSearchOpen && !query.trim() && 'hidden lg:block')}>
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
              onClick={() => onQueryChange('')}
              aria-label="مسح نص البحث"
              className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

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

        {/* Advanced Filters Panel (Collapsible on mobile, always visible on desktop) */}
        <div className={cn('space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800', !isMobileFiltersOpen && 'hidden lg:block')}>
          {/* Date Range Options: All Months or Custom Range */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onToggleAllMonths}
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
                onClick={onToggleCustomDateRange}
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

            {isCustomDateRange && (
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
                ) : !customDateFrom && !customDateTo ? (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    حدد تاريخ البداية والنهاية لتطبيق الفلترة المخصصة.
                  </p>
                ) : null}
              </div>
            )}
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
              <div className="flex items-center gap-1.5 overflow-x-auto lg:overflow-visible flex-nowrap lg:flex-wrap pb-1 pt-0.5 select-none text-xs no-scrollbar">
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
            </div>
          </div>
        </div>
      </div>

      {/* All Months Indicator Banner */}
      {allMonths && (
        <div className="flex items-center justify-between gap-2.5 px-3.5 py-2 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-xs text-blue-800 dark:text-blue-300 shadow-2xs dark:shadow-none print-hide">
          <div className="flex items-center gap-2 min-w-0 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="truncate">وضع البحث في كامل السجل (كل الأشهر) مفعّل حالياً</span>
          </div>
          <button
            type="button"
            onClick={onToggleAllMonths}
            className="text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:underline shrink-0 cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* Active Filter & Search Summary Strip */}
      {isFilterActive && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-xs shadow-2xs dark:shadow-none print-hide">
          <span className="inline-flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
            <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>النتائج المطابقة:</span>
            <span className="px-1.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-black">
              {filteredCount}
            </span>
          </span>

          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>مسح الفلتر</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Totals Strip Card */}
      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] bg-white dark:bg-[#121215] p-3.5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none">
        <div className="px-2">
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate mb-1">
            {allMonths ? 'إجمالي المداخيل (كافة الأشهر)' : 'إجمالي المداخيل'}
          </div>
          <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 truncate">
            <FormattedMoney amountFils={totals.income} className="text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="px-2 ps-3.5">
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate mb-1">
            {allMonths ? 'إجمالي المصاريف (كافة الأشهر)' : 'إجمالي المصاريف'}
          </div>
          <div className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 truncate">
            <FormattedMoney amountFils={totals.expense} className="text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>
    </aside>
  )
}
