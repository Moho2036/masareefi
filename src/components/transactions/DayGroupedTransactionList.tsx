import React, { type RefObject } from 'react'
import { Calendar, Plus, ArrowLeftRight } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'
import { FormattedMoney } from '../ui/FormattedMoney'
import { formatDayHeader } from '../../lib/dates'
import { cn } from '../../lib/cn'
import { motion, AnimatePresence } from 'motion/react'
import { filterCrossFadeVariants, filterTransition, isTestEnv } from '../../lib/motionTokens'
import type { Transaction } from '../../types'
import type { TransactionSortOption } from '../../lib/aggregate'

const MotionDiv = isTestEnv ? 'div' : motion.div

const getPaginationPages = (current: number, total: number): (number | '...')[] => {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | '...')[] = [1]
  if (current > 3) {
    pages.push('...')
  }
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  if (current < total - 2) {
    pages.push('...')
  }
  pages.push(total)
  return pages
}

export interface DayGroupItem {
  date: Date
  dateKey: string
  transactions: Transaction[]
  dayNetFils: number
}

export interface DayGroupedTransactionListProps {
  loading: boolean
  rawTransactionsCount: number
  paginatedTransactions: Transaction[]
  displayedTransactions: Transaction[]
  dayGroups: DayGroupItem[]
  sortBy: TransactionSortOption
  isFilterActive: boolean
  allMonths: boolean
  onResetFilters: () => void
  onOpenAdd: () => void
  renderRow: (tx: Transaction, showDateBadge: boolean) => React.ReactNode
  isPrinting: boolean
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
  filteredCount: number
  listRef?: RefObject<HTMLDivElement | null>
  today: Date
}

export const DayGroupedTransactionList: React.FC<DayGroupedTransactionListProps> = ({
  loading,
  rawTransactionsCount,
  paginatedTransactions,
  displayedTransactions,
  dayGroups,
  sortBy,
  isFilterActive,
  allMonths,
  onResetFilters,
  onOpenAdd,
  renderRow,
  isPrinting,
  totalPages,
  currentPage,
  onPageChange,
  filteredCount,
  listRef,
  today,
}) => {
  if (loading && rawTransactionsCount === 0) {
    return (
      <div className="space-y-5 animate-pulse" aria-label="جاري تحميل المعاملات...">
        {[1, 2].map((g) => (
          <div key={g} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            </div>
            <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none divide-y divide-[#E4E4E7] dark:divide-[#27272A] overflow-hidden">
              {[1, 2].map((r) => (
                <div key={r} className="p-3 sm:p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      <div className="h-3 w-20 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (paginatedTransactions.length === 0) {
    return (
      <EmptyState
        icon={<ArrowLeftRight className="w-6 h-6" />}
        title={
          isFilterActive
            ? 'لا توجد معاملات مطابقة للبحث أو الفلترة'
            : 'لا توجد معاملات لهذا الشهر'
        }
        description={
          isFilterActive
            ? 'لم نجد أي معاملات تطابق معايير الفلترة أو البحث المحددة. جرب تغيير كلمات البحث أو مسح الفلاتر.'
            : allMonths
              ? 'لم يتم تسجيل أي معاملات في كامل السجل حتى الآن.'
              : 'ابدأ بتسجيل مصاريفك أو مداخيلك لهذا الشهر لمتابعة ميزانيتك أولاً بأول.'
        }
        action={
          isFilterActive ? (
            <Button
              variant="outline"
              size="md"
              onClick={onResetFilters}
            >
              مسح كافة الفلاتر
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={onOpenAdd}
            >
              إضافة معاملة
            </Button>
          )
        }
      />
    )
  }

  return (
    <div ref={listRef} className="space-y-5 scroll-mt-20">
      <AnimatePresence mode="wait">
        <MotionDiv
          key={`${currentPage}-${sortBy}`}
          variants={isTestEnv ? undefined : filterCrossFadeVariants}
          initial={isTestEnv ? undefined : 'initial'}
          animate={isTestEnv ? undefined : 'animate'}
          exit={isTestEnv ? undefined : 'exit'}
          transition={filterTransition}
          className="space-y-5"
        >
          {/* Flat list for amount-based sorting */}
          {sortBy === 'highest' || sortBy === 'lowest' ? (
            <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none divide-y divide-[#E4E4E7] dark:divide-[#27272A] overflow-hidden">
              {displayedTransactions.map((tx) => renderRow(tx, true))}
            </div>
          ) : (
            /* Grouped by day for date-based sorting */
            dayGroups.map((group) => {
              const dayNetFils = group.dayNetFils

              return (
                <div key={group.dateKey} className="space-y-2">
                  {/* Day Header with clearly displayed net spend */}
                  <div className="flex items-center justify-between px-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDayHeader(group.date, today)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">صافي اليوم:</span>
                      <span
                        className={cn(
                          'font-extrabold text-xs select-none',
                          dayNetFils > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : dayNetFils < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-zinc-400'
                        )}
                      >
                        <FormattedMoney amountFils={dayNetFils} withSign="auto" />
                      </span>
                    </div>
                  </div>

                  {/* Transactions in this day */}
                  <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none divide-y divide-[#E4E4E7] dark:divide-[#27272A] overflow-hidden">
                    {group.transactions.map((tx) => renderRow(tx, false))}
                  </div>
                </div>
              )
            })
          )}
        </MotionDiv>
      </AnimatePresence>

      {/* Pagination Controls */}
      {!isPrinting && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none text-xs font-semibold print-hide">
          <div className="text-zinc-500 dark:text-zinc-400">
            صفحة {currentPage} من {totalPages}
            <span className="ms-1.5 text-[11px] text-zinc-400">
              ({filteredCount} معاملة)
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="text-xs"
            >
              السابق
            </Button>
            <div className="flex items-center gap-1">
              {getPaginationPages(currentPage, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ell-${idx}`} className="px-1 text-zinc-400 select-none">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(Number(p))}
                    aria-label={`انتقال إلى صفحة ${p}`}
                    aria-current={currentPage === p ? 'page' : undefined}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center select-none',
                      currentPage === p
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className="text-xs"
            >
              التالي
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
