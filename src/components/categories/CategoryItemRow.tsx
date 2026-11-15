import React, { useState, useRef } from 'react'
import { Pencil, Archive, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { triggerHaptic } from '../../lib/haptics'
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
  isSwipedOpen?: boolean
  onSwipeChange?: (isOpen: boolean) => void
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
  isSwipedOpen = false,
  onSwipeChange,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchDirection = useRef<'horizontal' | 'vertical' | null>(null)
  const startOffsetRef = useRef(0)
  const maxSwipe = 168

  const effectiveOffset = isDragging ? swipeOffset : isSwipedOpen ? maxSwipe : 0

  return (
    <div className="relative overflow-hidden overflow-x-clip select-none rounded-2xl group">
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
            onSwipeChange?.(false)
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
            onSwipeChange?.(false)
            triggerHaptic('warning')
            onArchive(cat)
          }}
          className="flex-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1"
          aria-label={`سحب لأرشفة تصنيف ${cat.name}`}
        >
          <Archive className="w-4 h-4 shrink-0" />
          <span>أرشفة</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSwipeOffset(0)
            onSwipeChange?.(false)
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
            onSwipeChange?.(false)
          }
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
          touchStartY.current = e.touches[0].clientY
          touchDirection.current = null
          startOffsetRef.current = isSwipedOpen ? maxSwipe : 0
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
            // When already open, a reasonable swipe to the left closes it
            if (swipeOffset < maxSwipe * 0.75) {
              onSwipeChange?.(false)
            } else {
              onSwipeChange?.(true)
            }
          } else {
            // When closed, swiping past threshold opens it
            const snapThreshold = maxSwipe * 0.38
            if (swipeOffset >= snapThreshold) {
              triggerHaptic('tick')
              onSwipeChange?.(true)
            } else {
              onSwipeChange?.(false)
            }
          }
        }}
        className={cn(
          'group bg-white dark:bg-[#121215] rounded-2xl p-3.5 sm:p-4 border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700 flex items-center justify-between gap-3 relative z-10',
          isLastMoved && 'ring-2 ring-blue-500/70 scale-[1.01] shadow-sm z-20'
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

        {/* Left side: Reorder & Desktop Hover Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-0.5 pe-1 border-e border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                onMove(cat, 'up')
              }}
              disabled={index === 0}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
              aria-label={`تحريك تصنيف ${cat.name} للأعلى`}
              title="تحريك للأعلى"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                onMove(cat, 'down')
              }}
              disabled={index === totalCount - 1}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
              aria-label={`تحريك تصنيف ${cat.name} للأسفل`}
              title="تحريك للأسفل"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Desktop Hover Quick Actions (Hidden on Mobile - Mobile relies exclusively on swipe-to-right) */}
          <div className="hidden sm:flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity print:hidden">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                onEdit(cat)
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label={`تعديل تصنيف ${cat.name}`}
              title="تعديل التصنيف"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('warning')
                onArchive(cat)
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
              aria-label={`أرشفة تصنيف ${cat.name}`}
              title="أرشفة التصنيف"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('destructive')
                onDelete(cat)
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              aria-label={`حذف تصنيف ${cat.name}`}
              title="حذف التصنيف"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
