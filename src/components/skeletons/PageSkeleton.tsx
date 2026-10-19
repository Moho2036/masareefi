import React from 'react'
import { Skeleton } from '../ui/Skeleton'

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-slide-up" role="status" aria-label="جاري تحميل الصفحة">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-1">
        <div className="space-y-2">
          <Skeleton className="w-40 sm:w-52 h-7 sm:h-8" />
          <Skeleton className="w-56 sm:w-72 h-4" />
        </div>
        <Skeleton className="w-28 sm:w-32 h-10 rounded-xl" />
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            <Skeleton className="w-32 h-6" />
            <Skeleton className="w-full h-2 rounded-full" />
          </div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <Skeleton className="w-28 h-5" />
          <Skeleton className="w-16 h-4" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-750/40">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="w-32 h-3.5" />
                  <Skeleton className="w-20 h-2.5" />
                </div>
              </div>
              <Skeleton className="w-16 h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
