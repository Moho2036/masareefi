import React, { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams, Outlet } from 'react-router'
import {
  Settings, Plus, WifiOff, RotateCcw, Bell, Eye, EyeOff,
} from 'lucide-react'
import { motion } from 'motion/react'
import { BottomNav } from './BottomNav'
import { Button } from '../ui/Button'
import { MonthSelector } from '../ui/MonthSelector'
import { YearSelector } from '../ui/YearSelector'
import { OverscrollBounceContainer } from './OverscrollBounceContainer'
import { navGroups } from './navConfig'
import { useAuth } from '../../hooks/useAuth'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useTransactionModal } from '../../hooks/useTransactionModal'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useNotifications } from '../../hooks/useNotifications'
import { hasExistingUserData } from '../../services/userProfile'
import { PageSkeleton } from '../skeletons/PageSkeleton'
import { cn } from '../../lib/cn'
import { isTestEnv } from '../../lib/motionTokens'
import { triggerHaptic } from '../../lib/haptics'

const OnboardingWizard = React.lazy(() =>
  import('../onboarding/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard }))
)
const SpotlightTour = React.lazy(() =>
  import('../onboarding/SpotlightTour').then((m) => ({ default: m.SpotlightTour }))
)
const NotificationCenterModal = React.lazy(() =>
  import('../notifications/NotificationCenterModal').then((m) => ({
    default: m.NotificationCenterModal,
  }))
)


export const AppShell: React.FC = () => {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()
  const { openAdd } = useTransactionModal()
  const isOnline = useOnlineStatus()
  const { goToCurrentMonth, isCurrentMonth } = useSelectedMonth()
  const [searchParams, setSearchParams] = useSearchParams()
  const isReportsYearly = pathname === '/reports' && searchParams.get('period') === 'yearly'

  const isMonthPage = pathname === '/' || pathname === '/transactions' || pathname === '/reports'

  const getPageTitle = (path: string): string => {
    if (path === '/') return 'لوحة التحكم'
    if (path.startsWith('/transactions')) return 'المعاملات'
    if (path.startsWith('/debts')) return 'الديون والالتزامات'
    if (path.startsWith('/recurring')) return 'المعاملات المتكررة'
    if (path.startsWith('/tools')) return 'الأدوات المالية'
    if (path.startsWith('/reports')) return 'التقارير المالية'
    if (path.startsWith('/categories')) return 'التصنيفات'
    if (path.startsWith('/settings')) return 'الإعدادات'
    return 'لوحة التحكم'
  }
  const currentPageTitle = getPageTitle(pathname)

  const uid = user?.uid
  const { data: settings, updateSettings, loading: settingsLoading } = useUserSettings()
  const displayName = settings?.displayName?.trim() || user?.displayName?.trim() || 'مستخدم بَصير'
  const avatarInitial = displayName.charAt(0) || 'ب'

  const { unreadCount } = useNotifications()
  const [showWizard, setShowWizard] = useState<boolean>(false)
  const [showTour, setShowTour] = useState<boolean>(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false)
  const [hasMountedNotifications, setHasMountedNotifications] = useState<boolean>(false)

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

  useEffect(() => {
    const handleStartTour = () => setShowTour(true)
    window.addEventListener('baseer-start-tour', handleStartTour)
    return () => window.removeEventListener('baseer-start-tour', handleStartTour)
  }, [])

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F4F4F5] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 antialiased font-sans overflow-x-clip max-w-full">
      {/* Desktop Sidebar (start side / right side in RTL) */}
      <aside
        aria-label="القائمة الجانبية"
        className="hidden lg:flex flex-col w-[280px] shrink-0 bg-white dark:bg-[#121215] border-e border-[#E4E4E7] dark:border-[#27272A] p-6 min-h-screen sticky top-0 h-screen overflow-y-auto"
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
          <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-white flex items-center justify-center shadow-xs">
            <img src="/icons/icon.svg" alt="بَصير" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
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
                    data-tour={
                      item.to === '/transactions'
                        ? 'transactions-nav'
                        : item.to === '/debts'
                        ? 'debts-nav'
                        : item.to === '/reports'
                        ? 'more-and-tools'
                        : undefined
                    }
                    onClick={() => {
                      if (item.to === '/' && !isCurrentMonth) {
                        goToCurrentMonth()
                      }
                    }}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-sm select-none',
                      isActive
                        ? 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white shadow-2xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                    )}
                  >
                    <Icon className={cn('w-4.5 h-4.5 shrink-0', isActive ? 'text-white' : 'text-zinc-400 dark:text-zinc-500')} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer / User Profile snippet */}
        <div className="pt-4 border-t border-[#E4E4E7] dark:border-[#27272A]">
          <Link
            to="/settings"
            className="press-scale flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors w-full group"
            title="إعدادات الحساب الشخصي"
          >
            <div className="flex items-center gap-3 min-w-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  style={{ backgroundColor: settings?.avatarColor || undefined }}
                  className={cn(
                    'w-9 h-9 rounded-full text-white font-bold flex items-center justify-center text-sm shrink-0 transition-colors',
                    !settings?.avatarColor && 'bg-blue-600 dark:bg-blue-600'
                  )}
                >
                  {avatarInitial}
                </div>
              )}
              <div className="truncate text-start min-w-0 flex-1 max-w-[130px]">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {displayName}
                </div>
                <div className="text-[11px] text-zinc-400 truncate" dir="ltr">
                  {user?.email || ''}
                </div>
              </div>
            </div>
            <Settings className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 shrink-0 transition-colors" />
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
            <span>غير متصل بالإنترنت — تُحفظ التغييرات محلياً</span>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#09090B]/90 backdrop-blur-md border-b border-[#E4E4E7] dark:border-[#27272A] px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 transition-all min-w-0 max-w-full">
          {/* Mobile brand logo & User avatar shortcut */}
          <div className="flex items-center gap-2 sm:gap-2.5 lg:hidden shrink min-w-0">
            <Link to="/settings" className="press-scale flex items-center gap-2 shrink-0" title="الإعدادات">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  style={{ backgroundColor: settings?.avatarColor || undefined }}
                  className={cn(
                    'w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs transition-colors',
                    !settings?.avatarColor && 'bg-blue-600'
                  )}
                >
                  {avatarInitial}
                </div>
              )}
            </Link>
            <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white shrink-0">
              بَصير
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              {currentPageTitle}
            </span>
          </div>

          {/* Top Header Actions / Month Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Privacy Mode (hideBalances) Toggle Button */}
            <button
              type="button"
              onClick={() => updateSettings?.({ hideBalances: !settings?.hideBalances })}
              aria-label={settings?.hideBalances ? 'إظهار الأرصدة' : 'إخفاء الأرصدة'}
              title={settings?.hideBalances ? 'إظهار الأرصدة' : 'وضع الخصوصية (إخفاء الأرصدة)'}
              className={cn(
                'relative p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer',
                settings?.hideBalances
                  ? 'text-blue-600 dark:text-blue-400 bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              )}
            >
              {settings?.hideBalances ? (
                <EyeOff className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Eye className="w-5 h-5 stroke-[2.2]" />
              )}
            </button>

            {/* Notifications Bell Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                setHasMountedNotifications(true)
                setShowNotificationsModal(true)
              }}
              aria-label="مركز التنبيهات"
              data-tour="notifications-bell"
              title="مركز التنبيهات"
              className="relative p-1.5 sm:p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5 stroke-[2.2]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isReportsYearly ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <YearSelector
                  selectedYear={searchParams.get('year') ? Number(searchParams.get('year')) : new Date().getFullYear()}
                  onSelectYear={(year) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('year', String(year)); return next }, { replace: true })}
                />
              </div>
            ) : isMonthPage ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {!isCurrentMonth && (
                  <button
                    type="button"
                    onClick={goToCurrentMonth}
                    className="press-scale hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl text-zinc-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                    title="العودة إلى الشهر الحالي"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>الشهر الحالي</span>
                  </button>
                )}
                <MonthSelector />
              </div>
            ) : !['/debts', '/tools', '/recurring', '/categories', '/settings', '/reports'].some((p) => pathname.startsWith(p)) ? (
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
        <main className="flex-1 min-w-0 p-3.5 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-7xl w-full mx-auto overflow-x-clip">
          <OverscrollBounceContainer>
            {isTestEnv ? (
              <React.Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </React.Suspense>
            ) : (
              <motion.div
                key={pathname}
                initial={false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="flex-1 w-full"
              >
                <React.Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </React.Suspense>
              </motion.div>
            )}
          </OverscrollBounceContainer>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onOpenAddModal={() => openAdd('expense')} />

      <React.Suspense fallback={null}>
        {showWizard && uid && (
          <OnboardingWizard isOpen={showWizard} onComplete={handleOnboardingComplete} />
        )}
        {showTour && uid && (
          <SpotlightTour isOpen={showTour} onFinish={() => setShowTour(false)} />
        )}
        {hasMountedNotifications && (
          <NotificationCenterModal
            isOpen={showNotificationsModal}
            onClose={() => setShowNotificationsModal(false)}
          />
        )}
      </React.Suspense>
    </div>
  )
}
