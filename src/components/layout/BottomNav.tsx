import React, { useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Home,
  ArrowLeftRight,
  Plus,
  BarChart3,
  MoreHorizontal,
  RefreshCw,
  LayoutGrid,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '../../lib/cn'

export interface BottomNavProps {
  onOpenAddModal: () => void
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenAddModal }) => {
  const location = useLocation()
  const pathname = location.pathname
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const isMoreActive =
    pathname.startsWith('/recurring') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/settings')

  return (
    <>
      {/* "More" Sheet Overlay and Menu for Mobile */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="fixed inset-x-0 bottom-16 bg-white dark:bg-slate-800 rounded-t-3xl p-5 shadow-2xl border-t border-slate-200/60 dark:border-slate-700/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-3">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                المزيد من الصفحات
              </span>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Link
                to="/recurring"
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all',
                  pathname === '/recurring'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-750 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300',
                )}
              >
                <RefreshCw className="w-5 h-5 mb-1.5" />
                <span className="text-xs font-semibold">المتكررة</span>
              </Link>

              <Link
                to="/categories"
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all',
                  pathname === '/categories'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-750 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300',
                )}
              >
                <LayoutGrid className="w-5 h-5 mb-1.5" />
                <span className="text-xs font-semibold">التصنيفات</span>
              </Link>

              <Link
                to="/settings"
                onClick={() => setIsMoreOpen(false)}
                className={cn(
                  'flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all',
                  pathname === '/settings'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-750 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300',
                )}
              >
                <Settings className="w-5 h-5 mb-1.5" />
                <span className="text-xs font-semibold">الإعدادات</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        aria-label="شريط التنقل السفلي"
        className="fixed inset-x-0 bottom-0 z-30 lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-4 py-2"
      >
        <div className="flex items-center justify-around relative max-w-md mx-auto">
          {/* الرئيسية */}
          <Link
            to="/"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors',
              pathname === '/'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            <Home className="w-5 h-5 mb-1" />
            <span className="text-[11px]">الرئيسية</span>
          </Link>

          {/* المعاملات */}
          <Link
            to="/transactions"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors',
              pathname === '/transactions'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            <ArrowLeftRight className="w-5 h-5 mb-1" />
            <span className="text-[11px]">المعاملات</span>
          </Link>

          {/* Floating Action Button (FAB) */}
          <div className="relative -top-4 flex items-center justify-center">
            <button
              type="button"
              onClick={onOpenAddModal}
              aria-label="إضافة معاملة جديدة"
              className="w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center border-4 border-slate-50 dark:border-slate-900 transition-all cursor-pointer"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* التقارير */}
          <Link
            to="/reports"
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors',
              pathname === '/reports'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            <BarChart3 className="w-5 h-5 mb-1" />
            <span className="text-[11px]">التقارير</span>
          </Link>

          {/* المزيد */}
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors cursor-pointer',
              isMoreActive || isMoreOpen
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
            )}
          >
            <MoreHorizontal className="w-5 h-5 mb-1" />
            <span className="text-[11px]">المزيد</span>
          </button>
        </div>
      </nav>
    </>
  )
}
