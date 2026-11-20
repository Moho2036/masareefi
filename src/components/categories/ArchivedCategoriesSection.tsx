import React, { useState, useRef } from 'react'
import { Archive, ChevronDown, ChevronUp, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'
import type { Category } from '../../types'

export interface ArchivedCategoriesSectionProps {
  archivedCategories: Category[]
  isArchivedExpanded: boolean
  onToggleExpand: () => void
  onRestore: (cat: Category) => void
  onEdit: (cat: Category) => void
  onDelete: (cat: Category) => void
}

interface ArchivedCategoryCardProps {
  cat: Category
  onRestore: (cat: Category) => void
  onEdit: (cat: Category) => void
  onDelete: (cat: Category) => void
}

const ArchivedCategoryCard: React.FC<ArchivedCategoryCardProps> = ({
  cat,
  onRestore,
  onEdit,
  onDelete,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchDirection = useRef<'horizontal' | 'vertical' | null>(null)
  const startOffsetRef = useRef(0)
  const maxSwipe = 168

  const effectiveOffset = isDragging ? swipeOffset : swipeOffset > 0 ? maxSwipe : 0

  return (
    <div className="relative overflow-hidden select-none rounded-2xl group">
      {/* Mobile Swipe-to-Right Action Reveal Strip */}
      <div
        dir="ltr"
        className={cn(
          'absolute inset-y-0 left-0 flex items-stretch z-0 sm:hidden print:hidden rounded-2xl overflow-hidden',
          effectiveOffset === 0 && 'pointer-events-none'
        )}
        style={{ width: `${maxSwipe}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSwipeOffset(0)
            triggerHaptic('success')
            onRestore(cat)
          }}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1"
          aria-label={`سحب لاستعادة تصنيف ${cat.name}`}
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span>استعادة</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSwipeOffset(0)
            triggerHaptic('tick')
            onEdit(cat)
          }}
          className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1"
          aria-label={`سحب لتعديل تصنيف ${cat.name}`}
        >
          <Pencil className="w-4 h-4 shrink-0" />
          <span>تعديل</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSwipeOffset(0)
            triggerHaptic('destructive')
            onDelete(cat)
          }}
          className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1"
          aria-label={`سحب لحذف تصنيف ${cat.name}`}
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>حذف</span>
        </button>
      </div>

      {/* Foreground Card */}
      <div
        style={{
          transform: effectiveOffset > 0 ? `translateX(${effectiveOffset}px)` : undefined,
          transition: isDragging
            ? 'none'
            : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={() => {
          if (effectiveOffset > 0) {
            triggerHaptic('tick')
            setSwipeOffset(0)
          }
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
          touchStartY.current = e.touches[0].clientY
          touchDirection.current = null
          startOffsetRef.current = swipeOffset > 0 ? maxSwipe : 0
          setSwipeOffset(startOffsetRef.current)
          setIsDragging(true)
        }}
        onTouchMove={(e) => {
          if (touchStartX.current === null || touchStartY.current === null) return
          if (touchDirection.current === 'vertical') return

          const currentX = e.touches[0].clientX
          const currentY = e.touches[0].clientY
          const diffX = currentX - touchStartX.current
          const diffY = currentY - touchStartY.current
          const absX = Math.abs(diffX)
          const absY = Math.abs(diffY)

          if (touchDirection.current === null) {
            if (absX < 8 && absY < 8) return
            if (absY > absX) {
              touchDirection.current = 'vertical'
              return
            } else {
              touchDirection.current = 'horizontal'
            }
          }

          if (touchDirection.current === 'horizontal') {
            const rawTarget = startOffsetRef.current + diffX
            const clamped = Math.max(0, rawTarget)
            const resistedOffset =
              clamped <= maxSwipe
                ? clamped * 0.96
                : maxSwipe + (clamped - maxSwipe) * 0.28
            setSwipeOffset(resistedOffset)
          }
        }}
        onTouchEnd={() => {
          const wasOpen = startOffsetRef.current > 0
          touchStartX.current = null
          touchStartY.current = null
          touchDirection.current = null
          setIsDragging(false)

          if (wasOpen) {
            if (swipeOffset < maxSwipe * 0.75) {
              setSwipeOffset(0)
            } else {
              setSwipeOffset(maxSwipe)
            }
          } else {
            const snapThreshold = maxSwipe * 0.38
            if (swipeOffset >= snapThreshold) {
              triggerHaptic('tick')
              setSwipeOffset(maxSwipe)
            } else {
              setSwipeOffset(0)
            }
          }
        }}
        className="bg-white dark:bg-[#121215] rounded-2xl p-3.5 sm:p-4 border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex items-center justify-between gap-3 opacity-80 sm:!transform-none relative z-10"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <CategoryIcon icon={cat.icon} color={cat.color} size="md" />
          </div>
          <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 truncate">
            {cat.name}
          </span>
        </div>

        {/* Desktop inline hover actions */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
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
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label={`تعديل تصنيف ${cat.name}`}
            title="تعديل التصنيف"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(cat)}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            aria-label={`حذف تصنيف ${cat.name} نهائياً`}
            title="حذف نهائي"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
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
          {archivedCategories.map((cat) => (
            <ArchivedCategoryCard
              key={cat.id}
              cat={cat}
              onRestore={onRestore}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
