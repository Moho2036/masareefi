import React from 'react'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'

export const ReportsMonthlySkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" data-testid="reports-monthly-skeleton">
      {/* 1. Safe Spend Card Skeleton */}
      <Card className="p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="w-44 h-5 rounded-lg" />
          </div>
          <Skeleton className="w-24 h-6 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Skeleton className="w-28 h-3.5 rounded" />
            <Skeleton className="w-36 h-8 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Skeleton className="w-20 h-3.5 rounded" />
              <Skeleton className="w-24 h-6 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="w-20 h-3.5 rounded" />
              <Skeleton className="w-24 h-6 rounded-lg" />
            </div>
          </div>
        </div>
      </Card>

      {/* 2. KPI Cards 4-grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="w-20 h-3.5 rounded" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
            <Skeleton className="w-28 h-7 rounded-lg" />
            <Skeleton className="w-full h-3 rounded pt-2" />
          </Card>
        ))}
      </div>

      {/* 3. Daily Expense Chart Skeleton */}
      <Card className="p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="w-40 h-5 rounded-lg" />
          <Skeleton className="w-24 h-4 rounded" />
        </div>
        <Skeleton className="w-full h-52 rounded-xl" />
      </Card>

      {/* 4. Category Breakdown 2-col Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-4 min-h-[380px] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <Skeleton className="w-36 h-5 rounded-lg" />
            <Skeleton className="w-16 h-4 rounded" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="w-44 h-44 rounded-full" />
          </div>
        </Card>
        <Card className="p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-4 min-h-[380px]">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Skeleton className="w-32 h-5 rounded-lg" />
            <Skeleton className="w-20 h-4 rounded" />
          </div>
          <div className="space-y-3.5 pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-7 h-7 rounded-lg" />
                    <Skeleton className="w-24 h-3.5 rounded" />
                  </div>
                  <Skeleton className="w-16 h-3.5 rounded" />
                </div>
                <Skeleton className="w-full h-2 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export const ReportsYearlySkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" data-testid="reports-yearly-skeleton">
      {/* 1. Yearly KPI Cards 4-grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-3.5 sm:p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="w-24 h-3.5 rounded" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
            <Skeleton className="w-28 h-7 rounded-lg" />
            <Skeleton className="w-full h-3 rounded pt-2" />
          </Card>
        ))}
      </div>

      {/* 2. Monthly Bar Chart Skeleton */}
      <Card className="p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="w-44 h-5 rounded-lg" />
          <Skeleton className="w-20 h-4 rounded" />
        </div>
        <Skeleton className="w-full h-64 rounded-xl" />
      </Card>

      {/* 3. Annual Summary Table Skeleton */}
      <Card className="p-5 border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <Skeleton className="w-32 h-5 rounded-lg" />
          <Skeleton className="w-16 h-4 rounded" />
        </div>
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
              <Skeleton className="w-24 h-4 rounded" />
              <Skeleton className="w-20 h-4 rounded" />
              <Skeleton className="w-20 h-4 rounded" />
              <Skeleton className="w-20 h-4 rounded" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
