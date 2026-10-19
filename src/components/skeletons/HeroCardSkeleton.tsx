import React from 'react'
import { cn } from '../../lib/cn'

export interface HeroCardSkeletonProps {
  className?: string
}

export const HeroCardSkeleton: React.FC<HeroCardSkeletonProps> = ({ className }) => {
  return (
    <div
      role="status"
      aria-label="جاري تحميل بيانات الرصيد"
      className={cn(
        'rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-emerald-600/80 via-emerald-700/80 to-teal-800/80 border border-emerald-400/30 shadow-md space-y-4 animate-pulse text-white',
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20" />
          <div className="w-28 sm:w-36 h-4 rounded-lg bg-white/20" />
        </div>
        <div className="w-20 h-6 rounded-full bg-white/20" />
      </div>

      {/* Main Balance Shimmer */}
      <div className="w-48 sm:w-64 h-10 sm:h-12 rounded-xl bg-white/25 my-1" />

      {/* Income & Expense Sub-Boxes */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/15">
          <div className="w-8 h-8 rounded-lg bg-white/20 shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="w-16 h-3 rounded bg-white/20" />
            <div className="w-20 sm:w-24 h-4 rounded bg-white/30" />
          </div>
        </div>

        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/15">
          <div className="w-8 h-8 rounded-lg bg-white/20 shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="w-16 h-3 rounded bg-white/20" />
            <div className="w-20 sm:w-24 h-4 rounded bg-white/30" />
          </div>
        </div>
      </div>

      {/* Daily Safe Budget Strip */}
      <div className="h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-white/20" />
          <div className="w-28 h-3.5 rounded bg-white/20" />
        </div>
        <div className="w-20 h-4 rounded bg-white/30" />
      </div>
    </div>
  )
}
