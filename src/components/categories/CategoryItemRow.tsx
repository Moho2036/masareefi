import React from 'react'
import { Pencil, Archive, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { cn } from '../../lib/cn'
import type { Category } from '../../types'

export interface CategoryItemRowProps {
  cat: Category
  index: number
  totalCount: number
  isManualSort: boolean
  currencyCode: string
  currentMonthStats?: { totalFils: number; count: number }
  linkedCommitmentsText: string | null
  usageText: string
  isLastMoved: boolean
  onMove: (cat: Category, direction: 'up' | 'down') => void
  onEdit: (cat: Category) => void
  onArchive: (cat: Category) => void
  onDelete: (cat: Category) => void
}

export const CategoryItemRow: React.FC<CategoryItemRowProps> = ({
  cat,
  index,
  totalCount,
  isManualSort,
  currencyCode,
  currentMonthStats,
  linkedCommitmentsText,
  usageText,
  isLastMoved,
  onMove,
  onEdit,
  onArchive,
  onDelete,
}) => {
  return (
    <div
      className={cn(
        'group bg-white dark:bg-[#121215] rounded-2xl p-3.5 sm:p-4 border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 flex items-center justify-between gap-3',
        isLastMoved && 'ring-2 ring-blue-500/70 scale-[1.01] shadow-sm z-10'
      )}
    >
      {/* Right side: Icon & Details */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
          <CategoryIcon icon={cat.icon} color={cat.color} size="md" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
              {cat.name}
            </h3>
            {isManualSort && (
              <span
                dir="ltr"
                className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0"
              >
                #{index + 1}
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
            {currentMonthStats && currentMonthStats.count > 0 ? (
              <span className="inline-flex items-center gap-1.5 flex-wrap">
                <FormattedMoney
                  amountFils={currentMonthStats.totalFils}
                  currencyCode={currencyCode}
                  className="font-bold text-zinc-800 dark:text-zinc-200"
                />
                <span>•</span>
                <span>
                  {currentMonthStats.count === 1
                    ? 'معاملة واحدة هذا الشهر'
                    : currentMonthStats.count === 2
                      ? 'معاملتان هذا الشهر'
                      : currentMonthStats.count <= 10
                        ? `${currentMonthStats.count} معاملات هذا الشهر`
                        : `${currentMonthStats.count} معاملة هذا الشهر`}
                </span>
                {linkedCommitmentsText && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {linkedCommitmentsText}
                    </span>
                  </>
                )}
              </span>
            ) : (
              <span>{usageText}</span>
            )}
          </div>
        </div>
      </div>

      {/* Left side: Reorder & Actions in one clean row */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-0.5 pe-1 border-e border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => onMove(cat, 'up')}
            disabled={index === 0}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            aria-label={`تحريك تصنيف ${cat.name} للأعلى`}
            title="تحريك للأعلى"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(cat, 'down')}
            disabled={index === totalCount - 1}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
            aria-label={`تحريك تصنيف ${cat.name} للأسفل`}
            title="تحريك للأسفل"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onEdit(cat)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label={`تعديل تصنيف ${cat.name}`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onArchive(cat)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
          aria-label={`أرشفة تصنيف ${cat.name}`}
          title="أرشفة التصنيف"
        >
          <Archive className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(cat)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
          aria-label={`حذف تصنيف ${cat.name}`}
          title="حذف التصنيف"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
