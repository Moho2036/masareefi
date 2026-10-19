import React from 'react'
import { DashboardSkeleton } from './DashboardSkeleton'
import { Skeleton } from '../ui/Skeleton'

export const AppShellSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="جاري تحميل التطبيق"
      className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased font-sans"
    >
      {/* Desktop Sidebar Skeleton (RTL Start / Right side) */}
      <aside
        aria-label="القائمة الجانبية"
        className="hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-e border-slate-200/80 dark:border-slate-800 p-6 min-h-screen sticky top-0 h-screen overflow-hidden"
      >
        {/* App Logo */}
        <div className="flex items-center gap-3 px-2 mb-8 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center" />
          <div className="w-24 h-6 rounded bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Nav Items Skeleton */}
        <div className="flex-1 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-3.5 px-4 py-3 rounded-xl animate-pulse">
              <Skeleton className="w-5 h-5 rounded-lg" />
              <Skeleton className="w-28 h-4 rounded" />
            </div>
          ))}
        </div>

        {/* Sidebar Footer Skeleton */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 px-2">
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="space-y-1 flex-1">
            <Skeleton className="w-20 h-3.5 rounded" />
            <Skeleton className="w-28 h-2.5 rounded" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar Skeleton */}
        <header className="sticky top-0 z-20 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="w-20 h-5 rounded" />
          </div>

          <div className="hidden lg:block">
            <Skeleton className="w-64 h-3.5 rounded" />
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="w-28 sm:w-36 h-8 sm:h-9 rounded-xl" />
          </div>
        </header>

        {/* Page View Slot */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-7xl w-full mx-auto">
          <DashboardSkeleton />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar Skeleton */}
      <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 px-3 py-2 pb-safe">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="w-8 h-2 rounded" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="w-8 h-2 rounded" />
          </div>
          <div className="relative -top-4">
            <div className="w-13 h-13 rounded-full bg-emerald-500/30 border-4 border-slate-50 dark:border-slate-900 animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="w-8 h-2 rounded" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="w-8 h-2 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
