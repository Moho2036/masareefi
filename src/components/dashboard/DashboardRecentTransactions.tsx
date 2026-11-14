import React, { useState, useRef } from 'react'
import { Link } from 'react-router'
import { Receipt, Plus, ChevronLeft, Copy } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { FormattedMoney } from '../ui/FormattedMoney'
import { CategoryIcon } from '../ui/CategoryIcon'
import { EmptyState } from '../ui/EmptyState'
import { formatDayHeader } from '../../lib/dates'
import { startOfDay } from 'date-fns'
import { cn } from '../../lib/cn'
import type { Transaction, Category } from '../../types'
import type { CategoryDistributionItem } from '../../lib/reports'

interface RecentTransactionRowProps {
  tx: Transaction
  cat?: Category
  today: Date
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
}

const RecentTransactionRow: React.FC<RecentTransactionRowProps> = ({
  tx,
  cat,
  today,
  openEdit,
  openDuplicate,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchDirection = useRef<'horizontal' | 'vertical' | null>(null)

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

  return (
    <div className="relative overflow-hidden overflow-x-clip rounded-xl select-none group">
      {/* Swipe Action Reveal Button (Mobile Swipe Right) */}
      {!isSystemLinked && (
        <div
          className={cn(
            'absolute inset-y-0 end-0 flex items-center pe-2 z-0 transition-opacity',
            swipeOffset > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSwipeOffset(0)
              openDuplicate(tx)
            }}
            className="h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            aria-label="تكرار المعاملة"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>تكرار</span>
          </button>
        </div>
      )}

      {/* Main Row Content */}
      <div
        onClick={() => {
          if (swipeOffset > 0) {
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
          if (touchStartX.current === null || touchStartY.current === null || isSystemLinked) return
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
              setSwipeOffset(Math.min(diffX, 85))
            } else if (swipeOffset > 0 && diffX < -8) {
              setSwipeOffset(0)
            }
          }
        }}
        onTouchEnd={() => {
          touchStartX.current = null
          touchStartY.current = null
          touchDirection.current = null
          if (swipeOffset > 35) {
            setSwipeOffset(72)
          } else {
            setSwipeOffset(0)
          }
        }}
        style={{
          transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
        }}
        className={cn(
          'press-scale flex items-center justify-between py-2.5 px-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-xl transition-colors cursor-pointer bg-white dark:bg-[#121215] relative z-10',
          swipeOffset === 0 && 'transition-transform duration-200 ease-out'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <CategoryIcon icon={cat?.icon || '📁'} color={cat?.color} size="md" />
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

        <div className="flex items-center gap-1.5 shrink-0 ps-3">
          {!isSystemLinked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openDuplicate(tx)
              }}
              className="hidden sm:inline-flex sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
              aria-label="تكرار المعاملة"
              title="تكرار المعاملة"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
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

export interface DashboardRecentTransactionsProps {
  isInitialOrLoading: boolean
  recentTransactions: Transaction[]
  topExpenseCategories: CategoryDistributionItem[]
  categoryMap: Map<string, Category>
  today: Date
  openAdd: (type?: 'income' | 'expense') => void
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
}

export const DashboardRecentTransactions: React.FC<DashboardRecentTransactionsProps> = ({
  isInitialOrLoading,
  recentTransactions,
  topExpenseCategories,
  categoryMap,
  today,
  openAdd,
  openEdit,
  openDuplicate,
}) => {
  return (
    <div className="lg:col-span-7 space-y-5">
      {/* Recent Transactions Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              آخر المعاملات
            </h2>
          </div>
          <Link
            to="/transactions"
            className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
          >
            <span>عرض الكل</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isInitialOrLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 animate-pulse"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-16 h-2.5 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
                <div className="w-16 h-4 rounded bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              </div>
            ))}
          </div>
        ) : recentTransactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title="لا توجد معاملات مسجلة"
            description="أضف معاملتك الأولى لهذا الشهر للبدء بتتبع مصاريفك ومداخيلك."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => openAdd('expense')}
                className="gap-1 mt-1"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة معاملة</span>
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {recentTransactions.map((tx) => (
              <RecentTransactionRow
                key={tx.id}
                tx={tx}
                cat={categoryMap.get(tx.categoryId)}
                today={today}
                openEdit={openEdit}
                openDuplicate={openDuplicate}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Top 3 Monthly Expenses Card */}
      {topExpenseCategories.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              أعلى مصاريف الشهر
            </h2>
            <Link
              to="/reports"
              className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
            >
              <span>التقارير الكاملة</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {topExpenseCategories.map((item) => (
              <Link
                key={item.categoryId}
                to={`/transactions?categoryId=${item.categoryId}&type=expense`}
                className="block space-y-1.5 group cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                      <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                      <FormattedMoney amountFils={item.amountFils} />
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400 min-w-8 text-end tabular-nums select-none ps-2">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
