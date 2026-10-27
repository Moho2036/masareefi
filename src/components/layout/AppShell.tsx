import React, { useState, useEffect } from 'react'
import { Link, useLocation, Outlet } from 'react-router'
import {
  Home,
  ArrowLeftRight,
  RefreshCw,
  BarChart3,
  LayoutGrid,
  Settings,
  Plus,
  WifiOff,
  HandCoins,
  RotateCcw,
  Calculator,
  Bell,
} from 'lucide-react'
import { BottomNav } from './BottomNav'
import { Button } from '../ui/Button'
import { MonthSelector } from '../ui/MonthSelector'
import { useAuth } from '../../hooks/useAuth'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useTransactionModal } from '../../hooks/useTransactionModal'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useNotifications } from '../../hooks/useNotifications'
import { hasExistingUserData } from '../../services/userProfile'
import { OnboardingWizard } from '../onboarding/OnboardingWizard'
import { SpotlightTour } from '../onboarding/SpotlightTour'
import { NotificationCenterModal } from '../notifications/NotificationCenterModal'
import { PageSkeleton } from '../skeletons/PageSkeleton'
import { cn } from '../../lib/cn'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'المتابعة اليومية',
    items: [
      { to: '/', label: 'لوحة التحكم', icon: Home },
      { to: '/transactions', label: 'المعاملات', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'الالتزامات والتخطيط',
    items: [
      { to: '/debts', label: 'الديون', icon: HandCoins },
      { to: '/recurring', label: 'المتكررة', icon: RefreshCw },
      { to: '/tools', label: 'الأدوات الإضافية', icon: Calculator },
      { to: '/reports', label: 'التقارير', icon: BarChart3 },
    ],
  },
  {
    title: 'التخصيص والنظام',
    items: [
      { to: '/categories', label: 'التصنيفات', icon: LayoutGrid },
      { to: '/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
]


export const AppShell: React.FC = () => {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()
  const { openAdd } = useTransactionModal()
  const isOnline = useOnlineStatus()
  const { goToCurrentMonth, isCurrentMonth } = useSelectedMonth()

  const isMonthPage = pathname === '/' || pathname === '/transactions'

  const uid = user?.uid
  const { data: settings, updateSettings, loading: settingsLoading } = useUserSettings()
  const displayName = settings?.displayName?.trim() || user?.displayName?.trim() || 'مستخدم بَصير'
  const avatarInitial = displayName.charAt(0) || 'ب'

  const { unreadCount } = useNotifications()
  const [showWizard, setShowWizard] = useState<boolean>(false)
  const [showTour, setShowTour] = useState<boolean>(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false)

  // Check onboarding eligibility for new vs existing users
  useEffect(() => {
    if (!uid || settingsLoading || !settings) return

    // 1. If already completed in Firestore, ensure local flag is set
    if (settings.onboardingCompleted) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`baseer_onboarding_done_${uid}`, 'true')
        window.localStorage.setItem(`masareefi_onboarding_done_${uid}`, 'true')
      }
      return
    }

    // 2. If already marked done in localStorage, don't show
    if (typeof window !== 'undefined' && window.localStorage) {
      const isDoneLocally =
        window.localStorage.getItem(`baseer_onboarding_done_${uid}`) === 'true' ||
        window.localStorage.getItem(`masareefi_onboarding_done_${uid}`) === 'true'
      if (isDoneLocally) return
    }

    // 3. Check if user is an existing user with prior data
    let isMounted = true
    const checkUserData = async () => {
      try {
        const hasData = await hasExistingUserData(uid)
        if (!isMounted) return

        if (hasData) {
          // Existing user with prior records: silently mark onboardingCompleted
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(`baseer_onboarding_done_${uid}`, 'true')
            window.localStorage.setItem(`masareefi_onboarding_done_${uid}`, 'true')
          }
          if (updateSettings) {
            await updateSettings({ onboardingCompleted: true })
          }
        } else {
          // Genuinely brand new user: open Onboarding Wizard
          setShowWizard(true)
        }
      } catch (err) {
        console.warn('Error checking existing user for onboarding:', err)
      }
    }

    checkUserData()

    return () => {
      isMounted = false
    }
  }, [uid, settingsLoading, settings, updateSettings])

  const handleOnboardingComplete = () => {
    setShowWizard(false)
    if (uid && typeof window !== 'undefined' && window.localStorage) {
      const tourShown =
        window.localStorage.getItem(`baseer_tour_shown_${uid}`) === 'true' ||
        window.localStorage.getItem(`masareefi_tour_shown_${uid}`) === 'true'
      if (!tourShown) {
        setShowTour(true)
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased font-sans">
      {/* Desktop Sidebar (start side / right side in RTL) */}
      <aside
        aria-label="القائمة الجانبية"
        className="hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-e border-slate-200/80 dark:border-slate-800 p-6 min-h-screen sticky top-0 h-screen overflow-y-auto"
      >
        {/* App Logo */}
        <Link
          to="/"
          onClick={() => {
            if (!isCurrentMonth) {
              goToCurrentMonth()
            }
          }}
          className="flex items-center gap-3 px-2 mb-8 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-800 border border-blue-500/40 text-white flex items-center justify-center shadow-md">
            <img src="/icons/icon.svg" alt="بَصير" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
              بَصير
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-4" aria-label="تنقل الصفحات">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 px-3 pt-2 pb-1 tracking-wider">
                {group.title}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.to === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.to)

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (item.to === '/' && !isCurrentMonth) {
                        goToCurrentMonth()
                      }
                    }}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-sm select-none',
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-blue-600 dark:text-white shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                    )}
                  >
                    <Icon className={cn('w-4.5 h-4.5 shrink-0', isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500')} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer / User Profile snippet */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <Link
            to="/settings"
            className="press-scale flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors w-full group"
            title="إعدادات الحساب الشخصي"
          >
            <div className="flex items-center gap-3 min-w-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-9 h-9 rounded-full object-cover border border-emerald-200 dark:border-emerald-800 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-200 dark:border-emerald-800 shrink-0">
                  {avatarInitial}
                </div>
              )}
              <div className="truncate text-start">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {displayName}
                </div>
                <div className="text-[11px] text-slate-400 truncate" dir="ltr">
                  {user?.email || ''}
                </div>
              </div>
            </div>
            <Settings className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 shrink-0 transition-colors" />
          </Link>
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
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover border border-emerald-300 dark:border-emerald-700 shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-800 border border-blue-500/40 text-white flex items-center justify-center shadow-xs">
                  <img src="/icons/icon.svg" alt="بَصير" className="w-5 h-5 object-contain" />
                </div>
              )}
            </Link>
            <span className="text-lg font-black text-zinc-900 dark:text-white">
              بَصير
            </span>
          </div>

          <div className="hidden lg:block shrink-0">
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              بَصير — نظام البصيرة والإدارة المالية الشخصية
            </span>
          </div>

          {/* Top Header Actions / Month Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Notifications Bell Button */}
            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              aria-label="مركز التنبيهات"
              title="مركز التنبيهات"
              className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5 stroke-[2.2]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

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
            ) : !['/debts', '/tools', '/recurring', '/categories', '/settings'].some((p) => pathname.startsWith(p)) ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                onClick={() => openAdd('expense')}
                className="hidden lg:inline-flex font-semibold text-xs sm:text-sm py-1.5 press-scale"
              >
                إضافة معاملة
              </Button>
            ) : null}
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

      {/* Onboarding Wizard for brand new users */}
      {showWizard && uid && (
        <OnboardingWizard isOpen={showWizard} onComplete={handleOnboardingComplete} />
      )}

      {/* Spotlight Feature Tour */}
      {showTour && uid && (
        <SpotlightTour isOpen={showTour} onFinish={() => setShowTour(false)} />
      )}

      {/* Internal Notification Center Modal */}
      <NotificationCenterModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
      />
    </div>
  )
}
