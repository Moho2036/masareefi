import React from 'react'
import { Plus, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import { cn } from '../../lib/cn'
import type { Category } from '../../types'

export interface RecurringCategoryPickerProps {
  categoriesLoading: boolean
  availableCategories: Category[]
  displayedCategories: Category[]
  activeCategoryId: string
  isCategoriesExpanded: boolean
  onToggleExpand: () => void
  onSelectCategory: (id: string) => void
  onOpenCreateCategory: () => void
}

export const RecurringCategoryPicker: React.FC<RecurringCategoryPickerProps> = ({
  categoriesLoading,
  availableCategories,
  displayedCategories,
  activeCategoryId,
  isCategoriesExpanded,
  onToggleExpand,
  onSelectCategory,
  onOpenCreateCategory,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
          التصنيف
        </label>
        <button
          type="button"
          onClick={onOpenCreateCategory}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>تصنيف جديد</span>
        </button>
      </div>
      {categoriesLoading ? (
        <div className="grid grid-cols-3 gap-1.5 p-0.5 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 flex items-center gap-2 p-2"
            >
              <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-700 shrink-0" />
              <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      ) : availableCategories.length === 0 ? (
        <div className="py-2.5 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
          لا توجد تصنيفات متاحة لهذا النوع
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-0.5">
            {displayedCategories.map((cat) => {
              const isSelected = activeCategoryId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none min-w-0',
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 ring-2 ring-blue-600/20'
                      : 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  )}
                >
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  </span>
                  <span className="truncate flex-1">
                    {cat.name}
                    {cat.archived ? ' (مؤرشف)' : ''}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
          {availableCategories.length > 6 && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="mt-1.5 w-full py-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              {isCategoriesExpanded ? (
                <>
                  <span>طي التصنيفات</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>عرض كل التصنيفات ({availableCategories.length})</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
