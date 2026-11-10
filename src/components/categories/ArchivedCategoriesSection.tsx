import React from 'react'
import { Archive, ChevronDown, ChevronUp, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import type { Category } from '../../types'

export interface ArchivedCategoriesSectionProps {
  archivedCategories: Category[]
  isArchivedExpanded: boolean
  onToggleExpand: () => void
  onRestore: (cat: Category) => void
  onEdit: (cat: Category) => void
  onDelete: (cat: Category) => void
}

export const ArchivedCategoriesSection: React.FC<ArchivedCategoriesSectionProps> = ({
  archivedCategories,
  isArchivedExpanded,
  onToggleExpand,
  onRestore,
  onEdit,
  onDelete,
}) => {
  if (archivedCategories.length === 0) return null

  return (
    <div className="pt-6 border-t border-zinc-200/80 dark:border-zinc-800">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex items-center justify-between w-full p-4 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-sm transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-zinc-400" />
          <span>التصنيفات المؤرشفة ({archivedCategories.length})</span>
        </div>
        {isArchivedExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {isArchivedExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {archivedCategories.map((cat) => {
            return (
              <div
                key={cat.id}
                className="bg-white dark:bg-[#121215] rounded-2xl p-3.5 sm:p-4 border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between gap-3 opacity-80"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                    <CategoryIcon icon={cat.icon} color={cat.color} size="md" />
                  </div>
                  <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 truncate">
                    {cat.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => onRestore(cat)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    استعادة
                  </Button>
                  <button
                    type="button"
                    onClick={() => onEdit(cat)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    aria-label={`تعديل تصنيف ${cat.name}`}
                    title="تعديل التصنيف"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(cat)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    aria-label={`حذف تصنيف ${cat.name} نهائياً`}
                    title="حذف نهائي"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
