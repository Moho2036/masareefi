import React from 'react'
import { Skeleton } from '../ui/Skeleton'
import { cn } from '../../lib/cn'

export const HeroCardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      role="status"
      aria-label="جاري تحميل بيانات الرصيد"
      className={cn(
        'bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none rounded-2xl p-5 sm:p-6 space-y-5 animate-pulse relative overflow-hidden flex flex-col justify-between',
        className
      )}
    >
      {/* Top accent bar shimmer */}
      <div className="h-1 w-full absolute top-0 inset-x-0 bg-zinc-200 dark:bg-zinc-800" />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="w-28 sm:w-36 h-4 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Main Balance Shimmer */}
      <div className="space-y-1.5">
        <div className="w-48 sm:w-64 h-10 sm:h-12 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="w-32 h-3.5 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>

      {/* Income & Expense Swiss Split Row (Zero nested boxes) */}
      <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] pt-3.5 border-t border-[#E4E4E7] dark:border-[#27272A]">
        <div className="flex flex-col gap-1.5 pe-3">
          <div className="w-20 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="w-24 sm:w-28 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
        </div>
        <div className="flex flex-col gap-1.5 ps-4">
          <div className="w-20 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="w-24 sm:w-28 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
        </div>
      </div>

      {/* Daily Safe Budget Clean Footer Row */}
      <div className="flex items-center justify-between pt-3 border-t border-[#E4E4E7] dark:border-[#27272A]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="w-24 sm:w-32 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="w-16 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  )
}

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6" role="status" aria-label="جاري تحميل لوحة التحكم">
      {/* 1. Header Skeleton */}
      <div className="flex items-center justify-between pb-1">
        <div className="space-y-2">
          <Skeleton className="w-36 sm:w-44 h-7 sm:h-8" />
          <Skeleton className="w-48 sm:w-64 h-4" />
        </div>
        <Skeleton className="hidden lg:block w-32 h-10 rounded-xl" />
      </div>

      {/* 2. Hero Card Skeleton */}
      <HeroCardSkeleton />

      {/* 3. Quick Feature Hub Skeleton (Mobile only) */}
      <div className="lg:hidden grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none animate-pulse"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="w-12 h-3 rounded bg-zinc-200 dark:bg-zinc-800 mt-1.5" />
          </div>
        ))}
      </div>

      {/* 4. Core Activity Grid (Recent Txs + Debts & Recurring) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Recent Transactions: lg:col-span-7 */}
        <div className="lg:col-span-7 rounded-2xl p-5 bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="w-24 h-5 rounded" />
            </div>
            <Skeleton className="w-14 h-4 rounded" />
          </div>

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
        </div>

        {/* Debts & Upcoming: lg:col-span-5 */}
        <div className="lg:col-span-5 space-y-5">
          {/* Debts Summary Card Skeleton */}
          <div className="rounded-2xl p-5 bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-24 h-5 rounded" />
              </div>
              <Skeleton className="w-14 h-4 rounded" />
            </div>

            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] pt-2">
              <div className="pe-3 space-y-1.5">
                <Skeleton className="w-16 h-3 rounded" />
                <Skeleton className="w-20 h-5 rounded" />
              </div>
              <div className="ps-3 space-y-1.5">
                <Skeleton className="w-16 h-3 rounded" />
                <Skeleton className="w-20 h-5 rounded" />
              </div>
            </div>
          </div>

          {/* Upcoming Recurring Skeleton */}
          <div className="rounded-2xl p-5 bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-28 h-5 rounded" />
              </div>
              <Skeleton className="w-16 h-4 rounded" />
            </div>

            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 animate-pulse"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                    <div className="space-y-1">
                      <div className="w-24 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="w-14 h-2 rounded bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                  </div>
                  <div className="w-14 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
