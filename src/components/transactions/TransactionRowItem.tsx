import React, { useState, useRef } from 'react'
import { Link } from 'react-router'
import {
  Pencil,
  Trash2,
  HandCoins,
  Copy,
  ExternalLink,
  Users,
} from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import { triggerHaptic } from '../../lib/haptics'
import { useCurrency } from '../../hooks/useCurrency'
import { formatDateInput } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Transaction, Category } from '../../types'

export interface TransactionRowItemProps {
  tx: Transaction
  showDateBadge: boolean
  cat?: Category
  isExpense: boolean
  primaryLabel: string
  timeDisplay: string
  name: string
  showCategoryInSub: boolean
  showNoteInSub: boolean
  isLockedDebt: boolean
  isLockedCircle: boolean
  isMergedDebtPayment: boolean
  isSystemLinked: boolean
  circleRecurringIdsSet: Set<string>
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
  setTxToDelete: (tx: Transaction) => void
}

export const TransactionRowItem: React.FC<TransactionRowItemProps> = ({
  tx,
  showDateBadge,
  cat,
  isExpense,
  primaryLabel,
  timeDisplay,
  name,
  showCategoryInSub,
  showNoteInSub,
  isLockedDebt,
  isLockedCircle,
  isMergedDebtPayment,
  isSystemLinked,
  circleRecurringIdsSet,
  openEdit,
  openDuplicate,
  setTxToDelete,
}) => {
  const { formatWithSign } = useCurrency()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchDirection = useRef<'horizontal' | 'vertical' | null>(null)
  const icon = cat?.icon ?? '➕'
  const color = cat?.color ?? '#94A3B8'

  const canDuplicate = !(isLockedDebt || isLockedCircle || isSystemLinked)
  const hasDebtLink = isLockedDebt
  const hasCircleLink = isLockedCircle
  const canDelete = !isMergedDebtPayment && !isLockedCircle
  const buttonCount =
    (canDuplicate ? 1 : 0) +
    (hasDebtLink ? 1 : 0) +
    (hasCircleLink ? 1 : 0) +
    1 +
    (canDelete ? 1 : 0)
  const maxSwipe = buttonCount * 70

  return (
    <div className="relative overflow-hidden overflow-x-clip select-none group">
      {/* Mobile Swipe-to-Right Action Reveal Strip */}
      <div
        className={cn(
          'absolute inset-y-0 start-0 flex items-stretch z-0 sm:hidden print:hidden',
          swipeOffset === 0 && 'pointer-events-none'
        )}
        style={{ width: `${maxSwipe}px` }}
      >
        {canDuplicate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              openDuplicate(tx)
            }}
            className="flex-1 min-w-[68px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1"
            aria-label="سحب لتكرار المعاملة"
          >
            <Copy className="w-4 h-4 shrink-0" />
            <span className="truncate">تكرار</span>
          </button>
        )}
        {hasDebtLink && (
          <Link
            to="/debts"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
            }}
            className="flex-1 min-w-[68px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors px-1"
            aria-label="سحب للانتقال إلى صفحة الديون"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span className="truncate">الديون</span>
          </Link>
        )}
        {hasCircleLink && (
          <Link
            to="/tools?tool=circles"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
            }}
            className="flex-1 min-w-[68px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors px-1"
            aria-label="سحب للانتقال إلى صفحة الجمعيات"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span className="truncate">الجمعيات</span>
          </Link>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setSwipeOffset(0)
            triggerHaptic('tick')
            openEdit(tx)
          }}
          className="flex-1 min-w-[68px] bg-zinc-600 hover:bg-zinc-700 active:bg-zinc-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1"
          aria-label="سحب لتعديل المعاملة"
        >
          <Pencil className="w-4 h-4 shrink-0" />
          <span className="truncate">تعديل</span>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              triggerHaptic('destructive')
              setTxToDelete(tx)
            }}
            className="flex-1 min-w-[68px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors cursor-pointer px-1"
            aria-label="سحب لحذف المعاملة"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span className="truncate">حذف</span>
          </button>
        )}
      </div>

      {/* Main Row Content (Slides right on touch swipe) */}
      <div
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openEdit(tx)
          }
        }}
        onClick={() => {
          if (swipeOffset > 0) {
            triggerHaptic('tick')
            setSwipeOffset(0)
            return
          }
          openEdit(tx)
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
          touchStartY.current = e.touches[0].clientY
          touchDirection.current = null
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
            if (diffX > 8) {
              setSwipeOffset(Math.min(diffX, maxSwipe + 15))
            } else if (swipeOffset > 0 && diffX < -8) {
              setSwipeOffset(0)
            }
          }
        }}
        onTouchEnd={() => {
          touchStartX.current = null
          touchStartY.current = null
          touchDirection.current = null
          if (swipeOffset > maxSwipe / 3) {
            triggerHaptic('tick')
            setSwipeOffset(maxSwipe)
          } else {
            setSwipeOffset(0)
          }
        }}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
        }}
        className={cn(
          'group flex items-center justify-between p-3 sm:p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer bg-white dark:bg-[#121215] relative z-10',
          swipeOffset === 0 && 'transition-transform duration-200 ease-out'
        )}
      >
        {/* Right side: Icon + Title + Subline */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pe-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0">
            <CategoryIcon icon={icon} color={color} size="md" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {primaryLabel}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal shrink-0">
                {timeDisplay}
              </span>
              {showDateBadge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  {formatDateInput(tx.date)}
                </span>
              )}
              {tx.id.startsWith('debt_') && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  <HandCoins className="w-2.5 h-2.5" />
                  <span>دين</span>
                </span>
              )}
              {(tx.id.startsWith('circle_payout_') ||
                /^circle_(.+)_m(\d+)$/.test(tx.id) ||
                Boolean(tx.recurringId && circleRecurringIdsSet.has(tx.recurringId))) && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  <Users className="w-2.5 h-2.5" />
                  <span>جمعية</span>
                </span>
              )}
              {tx.recurringId && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                  <span>متكررة</span>
                </span>
              )}
            </div>

            {(showCategoryInSub || showNoteInSub) && (
              <div className="flex items-start gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                {showCategoryInSub && (
                  <>
                    <span className="font-medium text-zinc-500 dark:text-zinc-400 shrink-0">{name}</span>
                    {showNoteInSub ? <span>•</span> : null}
                  </>
                )}
                {showNoteInSub && (
                  <span className="line-clamp-2 whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
                    {tx.note}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Left side: Amount & Desktop Hover Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className={cn(
              'font-extrabold text-xs sm:text-sm tabular-nums select-none ps-1',
              isExpense
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {formatWithSign(tx.amountFils, tx.type)}
          </div>

          {/* Desktop Hover Quick Actions (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity print:hidden">
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
            {hasDebtLink && (
              <Link
                to="/debts"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
                aria-label="الانتقال إلى صفحة الديون"
                title={
                  isMergedDebtPayment
                    ? 'مرتبط بدفعة دين مدمجة - افتح صفحة الديون للإدارة'
                    : 'مرتبط بسجل الديون - افتح صفحة الديون للإدارة'
                }
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            {hasCircleLink && (
              <Link
                to="/tools?tool=circles"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors"
                aria-label="الانتقال إلى صفحة الجمعيات"
                title="مرتبط بنظام الجمعيات - افتح صفحة الجمعيات للإدارة"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(tx)
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              aria-label="تعديل المعاملة"
              title="تعديل المعاملة"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setTxToDelete(tx)
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                aria-label="حذف المعاملة"
                title="حذف المعاملة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
