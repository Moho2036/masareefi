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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] animate-pulse"
          />
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
        <div className="flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none text-xs font-semibold print-hide">
          <div className="text-zinc-500 dark:text-zinc-400">
            صفحة <span className="font-bold text-zinc-800 dark:text-zinc-200">{currentPage}</span> من{' '}
            <span className="font-bold text-zinc-800 dark:text-zinc-200">{totalPages}</span>
            <span className="ms-1.5 text-[11px] text-zinc-400">
              ({filteredCount} معاملة)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="text-xs"
            >
              السابق
            </Button>
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
