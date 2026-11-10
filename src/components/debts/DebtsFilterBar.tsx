import React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { DebtType } from '../../types'

export interface DebtsFilterBarProps {
  search: string
  setSearch: (val: string) => void
  typeFilter: 'all' | DebtType
  setTypeFilter: (type: 'all' | DebtType) => void
  statusFilter: 'all' | 'active' | 'settled' | 'overdue'
  setStatusFilter: (status: 'all' | 'active' | 'settled' | 'overdue') => void
  totalCount: number
  activeCount: number
  overdueCount: number
  settledCount: number
}

export const DebtsFilterBar: React.FC<DebtsFilterBarProps> = ({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  totalCount,
  activeCount,
  overdueCount,
  settledCount,
}) => {
  return (
    <div className="space-y-3">
      {/* Search & Type Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-[#121215] p-3.5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs">
        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الشخص أو الملاحظة أو المبلغ..."
            className="w-full ps-10 pe-10 h-11 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-zinc-50/80 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-base sm:text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 end-0 pe-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              aria-label="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type Filter Buttons */}
        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              typeFilter === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs dark:shadow-none border border-transparent dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('lent')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              typeFilter === 'lent'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs dark:shadow-none border border-transparent dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            لي (أطلبهم)
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('borrowed')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              typeFilter === 'borrowed'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs dark:shadow-none border border-transparent dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            عليّ (يطلبوني)
          </button>
        </div>
      </div>

      {/* Secondary Status Pills */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            كافة الحالات ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'active'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            الديون المفتوحة ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('overdue')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'overdue'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            المتأخرة عن الموعد ({overdueCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('settled')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'settled'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            المسددة بالكامل ({settledCount})
          </button>
        </div>
      </div>
    </div>
  )
}
