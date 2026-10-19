import React from 'react'
import { HeroCardSkeleton } from './HeroCardSkeleton'
import { Skeleton } from '../ui/Skeleton'

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
      <div className="lg:hidden grid grid-cols-2 gap-2.5 sm:gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-750 flex items-center gap-3 animate-pulse"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="w-16 h-3.5 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="w-20 h-2.5 rounded bg-slate-100 dark:bg-slate-750" />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Core Activity Grid (Recent Txs + Debts & Recurring) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Recent Transactions: lg:col-span-7 */}
        <div className="lg:col-span-7 rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
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
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-750/40 animate-pulse"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3.5 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="w-16 h-2.5 rounded bg-slate-100 dark:bg-slate-750" />
                  </div>
                </div>
                <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Debts & Upcoming: lg:col-span-5 */}
        <div className="lg:col-span-5 space-y-5">
          {/* Debts Summary Card Skeleton */}
          <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-24 h-5 rounded" />
              </div>
              <Skeleton className="w-14 h-4 rounded" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Skeleton className="h-18 rounded-xl" />
              <Skeleton className="h-18 rounded-xl" />
            </div>
            <Skeleton className="h-14 rounded-xl" />
          </div>

          {/* Upcoming Recurring Skeleton */}
          <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
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
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-750/40 animate-pulse"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <div className="space-y-1">
                      <div className="w-24 h-3 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="w-14 h-2 rounded bg-slate-100 dark:bg-slate-750" />
                    </div>
                  </div>
                  <div className="w-14 h-4 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Analytical Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
            <Skeleton className="w-32 h-5 rounded" />
            <Skeleton className="w-16 h-4 rounded" />
          </div>
          <div className="h-56 flex items-center justify-center">
            <div className="w-36 h-36 rounded-full border-8 border-slate-200/80 dark:border-slate-700/60 animate-pulse" />
          </div>
        </div>

        <div className="rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
            <Skeleton className="w-28 h-5 rounded" />
            <Skeleton className="w-24 h-4 rounded" />
          </div>
          <div className="h-56 flex items-end justify-between gap-2 px-4 pb-4">
            {[40, 65, 30, 80, 50, 95, 45, 70, 60, 85].map((height, idx) => (
              <div
                key={idx}
                className="w-full bg-slate-200/80 dark:bg-slate-700/60 rounded-t-lg animate-pulse"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
