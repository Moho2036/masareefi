import React, { useState, useRef } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { FormattedMoney } from '../ui/FormattedMoney'
import { CategoryIcon } from '../ui/CategoryIcon'
import { formatDayHeader } from '../../lib/dates'
import { triggerHaptic } from '../../lib/haptics'
import { startOfDay } from 'date-fns'
import { cn } from '../../lib/cn'
import type { Transaction, Category } from '../../types'

export interface RecentTransactionRowProps {
  tx: Transaction
  cat?: Category
  today: Date
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
  onDelete?: (tx: Transaction) => void
  isSwipedOpen: boolean
  onSwipeChange: (isOpen: boolean) => void
}

export const RecentTransactionRow: React.FC<RecentTransactionRowProps> = ({
  tx,
  cat,
  today,
  openEdit,
  openDuplicate,
  onDelete,
  isSwipedOpen,
  onSwipeChange,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchDirection = useRef<'horizontal' | 'vertical' | null>(null)
  const startOffsetRef = useRef(0)
  const hasMovedRef = useRef(false)

  const isExpense = tx.type === 'expense'
  const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
  const dateHeader = formatDayHeader(txDate, today)
  const isFuture = startOfDay(txDate).getTime() > startOfDay(today).getTime()
  const isSystemLinked =
    tx.id.startsWith('debt_') ||
    tx.id.startsWith('circle_') ||
    Boolean(tx.note?.includes('تسوية رصيد'))
  const hasCustomLabel = Boolean(tx.title?.trim() || tx.note?.trim())
  const isDebtInitOrEntry = tx.id.startsWith('debt_init_') || tx.id.startsWith('debt_entry_')
  const rawCatName = cat ? cat.name : 'معاملة'
  const catName = isDebtInitOrEntry && rawCatName === 'سداد الديون والأقساط' ? 'الديون والسلف' : rawCatName
  const primaryLabel = tx.title?.trim() || tx.note?.trim() || catName

  const canDuplicate = !isSystemLinked
  const buttonCount = 1 + (canDuplicate ? 1 : 0) + (onDelete ? 1 : 0)
  const maxSwipe = buttonCount * 58
  const effectiveOffset = isDragging ? swipeOffset : isSwipedOpen ? maxSwipe : 0

  return (
    <div className="relative overflow-hidden overflow-x-clip rounded-xl select-none group">
      {/* Mobile Swipe Action Reveal Strip (Reveals from Left at left-0 on Swipe Right) */}
      <div
        dir="ltr"
        className={cn(
          'absolute inset-y-0 left-0 flex items-stretch z-0 sm:hidden print:hidden overflow-hidden',
          effectiveOffset === 0 && 'pointer-events-none'
        )}
        style={{ width: `${maxSwipe}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSwipeOffset(0)
            onSwipeChange(false)
            triggerHaptic('tick')
            openEdit(tx)
          }}
          className="flex-1 min-w-[58px] bg-zinc-600 hover:bg-zinc-700 active:bg-zinc-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1 min-h-[44px]"
          aria-label="تعديل المعاملة"
        >
          <Pencil className="w-4 h-4 shrink-0" />
          <span className="truncate">تعديل</span>
        </button>

        {canDuplicate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              onSwipeChange(false)
              triggerHaptic('tick')
              openDuplicate(tx)
            }}
            className="flex-1 min-w-[58px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1 min-h-[44px]"
            aria-label="تكرار المعاملة"
          >
            <Copy className="w-4 h-4 shrink-0" />
            <span className="truncate">تكرار</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              onSwipeChange(false)
              triggerHaptic('tick')
              onDelete(tx)
            }}
            className="flex-1 min-w-[58px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1 min-h-[44px]"
            aria-label="حذف المعاملة"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span className="truncate">حذف</span>
          </button>
        )}
      </div>

      {/* Main Row Content */}
      <div
        onClick={() => {
          if (effectiveOffset > 0) {
            triggerHaptic('tick')
            onSwipeChange(false)
            return
          }
          if (hasMovedRef.current) {
            hasMovedRef.current = false
            return
          }
          // Direct row click is disabled per [TABOO-17] and user parity requirement
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
          touchStartY.current = e.touches[0].clientY
          touchDirection.current = null
          hasMovedRef.current = false
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

          if (absX > 8 || absY > 8) {
            hasMovedRef.current = true
          }

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
              onSwipeChange(false)
            } else {
              onSwipeChange(true)
            }
          } else {
            const snapThreshold = maxSwipe * 0.38
            if (swipeOffset >= snapThreshold) {
              triggerHaptic('tick')
              onSwipeChange(true)
            } else {
              onSwipeChange(false)
            }
          }
        }}
        style={{
          transform: effectiveOffset > 0 ? `translateX(${effectiveOffset}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={cn(
          'flex items-center justify-between py-2.5 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-xl transition-colors cursor-default bg-white dark:bg-[#121215] relative z-10 min-h-[48px]'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <CategoryIcon icon={cat?.icon || 'folder'} color={cat?.color} size="md" />
          </span>
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {primaryLabel}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              {cat && hasCustomLabel && (
                <>
                  <span className="truncate">{catName}</span>
                  <span>•</span>
                </>
              )}
              <span className="truncate">{dateHeader}</span>
              {isFuture && (
                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md shrink-0">
                  مستقبلية
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ps-3">
          {/* Desktop Hover Quick Actions (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(tx)
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="تعديل المعاملة"
              title="تعديل المعاملة"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {canDuplicate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openDuplicate(tx)
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                aria-label="تكرار المعاملة"
                title="تكرار المعاملة"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(tx)
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                aria-label="حذف المعاملة"
                title="حذف المعاملة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div
            className={cn(
              'text-xs sm:text-sm font-extrabold select-none ps-0.5',
              isExpense
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            <FormattedMoney amountFils={tx.amountFils} withSign={tx.type} />
          </div>
        </div>
      </div>
    </div>
  )
}
