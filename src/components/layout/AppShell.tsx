import React, { useMemo } from 'react'
import { Link, useLocation, Outlet } from 'react-router'
import {
  Home,
  ArrowLeftRight,
  RefreshCw,
  BarChart3,
  LayoutGrid,
  Settings,
  Plus,
  Wallet,
  WifiOff,
  HandCoins,
  RotateCcw,
  Calculator,
} from 'lucide-react'
import { BottomNav } from './BottomNav'
import { Button } from '../ui/Button'
import { MonthSelector } from '../ui/MonthSelector'
import { useAuth } from '../../hooks/useAuth'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useTransactionModal } from '../../hooks/useTransactionModal'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { PageSkeleton } from '../skeletons/PageSkeleton'
import { getFiscalMonthKey } from '../../lib/dates'
import { cn } from '../../lib/cn'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { to: '/', label: 'لوحة التحكم', icon: Home },
  { to: '/transactions', label: 'المعاملات', icon: ArrowLeftRight },
  { to: '/debts', label: 'الديون', icon: HandCoins },
  { to: '/tools', label: 'الأدوات الإضافية', icon: Calculator },
  { to: '/recurring', label: 'المتكررة', icon: RefreshCw },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/categories', label: 'التصنيفات', icon: LayoutGrid },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]


export const AppShell: React.FC = () => {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()
  const { openAdd } = useTransactionModal()
  const isOnline = useOnlineStatus()
  const { selectedDate, goToCurrentMonth } = useSelectedMonth()

  const isMonthPage = pathname === '/' || pathname === '/transactions'

  const { data: settings } = useUserSettings()
  const monthStartDay = settings?.monthStartDay ?? 1

  const isCurrentMonth = useMemo(() => {
    return (
      getFiscalMonthKey(selectedDate, monthStartDay) ===
      getFiscalMonthKey(new Date(), monthStartDay)
    )
  }, [selectedDate, monthStartDay])

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased font-sans">
      {/* Desktop Sidebar (start side / right side in RTL) */}
      <aside
        aria-label="القائمة الجانبية"
        className="hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-e border-slate-200/80 dark:border-slate-800 p-6 min-h-screen sticky top-0 h-screen overflow-y-auto"
      >
        {/* App Logo */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Wallet className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
              مصاريفي
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5" aria-label="تنقل الصفحات">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.to === '/'
                ? pathname === '/'
                : pathname.startsWith(item.to)

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium transition-all text-sm select-none',
                  isActive
                    ? 'bg-emerald-500 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                )}
              >
                <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500')} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer / User Profile snippet */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || ''}
                className="w-9 h-9 rounded-full object-cover border border-emerald-200 dark:border-emerald-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-200 dark:border-emerald-800">
                {user?.displayName ? user.displayName.charAt(0) : 'م'}
              </div>
            )}
            <div className="truncate">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {user?.displayName || 'مستخدم مصاريفي'}
              </div>
              <div className="text-[11px] text-slate-400 truncate" dir="ltr">
                {user?.email || ''}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Offline Status Banner */}
        {!isOnline && (
          <div
            role="status"
            className="bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50 text-xs font-bold py-2 px-4 text-center shadow-xs flex items-center justify-center gap-2 sticky top-0 z-30"
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>أنت غير متصل بالإنترنت - يتم حفظ التغييرات محلياً وستتم المزامنة تلقائياً</span>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 transition-all">
          {/* Mobile brand logo & User avatar shortcut */}
          <div className="flex items-center gap-2.5 lg:hidden shrink-0">
            <Link to="/settings" className="press-scale flex items-center gap-2" title="الإعدادات">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || ''}
                  className="w-8 h-8 rounded-full object-cover border border-emerald-300 dark:border-emerald-700 shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-xs">
                  <Wallet className="w-4 h-4" />
                </div>
              )}
            </Link>
            <span className="text-lg font-black bg-gradient-to-l from-emerald-600 via-teal-600 to-slate-800 dark:from-emerald-400 dark:via-teal-300 dark:to-white bg-clip-text text-transparent">
              مصاريفي
            </span>
          </div>

          <div className="hidden lg:block shrink-0">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              تطبيق إدارة المصاريف والمداخيل الشخصية الذكي
            </span>
          </div>

          {/* Top Header Actions / Month Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {isMonthPage ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {!isCurrentMonth && (
                  <button
                    type="button"
                    onClick={goToCurrentMonth}
                    className="press-scale inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 transition-colors"
                    title="العودة إلى الشهر الحالي"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">الشهر الحالي</span>
                    <span className="sm:hidden">اليوم</span>
                  </button>
                )}
                <MonthSelector />
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                onClick={() => openAdd('expense')}
                className="font-semibold text-xs sm:text-sm py-1.5 press-scale"
              >
                إضافة معاملة
              </Button>
            )}
          </div>
        </header>

        {/* Page View Slot */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-7xl w-full mx-auto">
          <React.Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onOpenAddModal={() => openAdd('expense')} />
    </div>
  )
}
