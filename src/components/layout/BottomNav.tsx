import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import {
  Home,
  ArrowLeftRight,
  Plus,
  HandCoins,
  MoreHorizontal,
  Users,
  Clock,
  RefreshCw,
  BarChart3,
  LayoutGrid,
  Settings,
  X,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '../../lib/cn'

export interface BottomNavProps {
  onOpenAddModal: () => void
}

interface FeatureItem {
  to: string
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}

const smartTools: FeatureItem[] = [
  {
    to: '/tools?tool=circles',
    title: 'الجمعيات والصناديق المشتركة',
    subtitle: 'متابعة دورك، الأقساط، ودفعات الأعضاء',
    icon: Users,
  },
  {
    to: '/tools?tool=work_hours',
    title: 'تكلفة الشراء بساعات العمل',
    subtitle: 'تحويل سعر أي سلعة إلى ساعات دوام عملي',
    icon: Clock,
  },
]

const managementItems: FeatureItem[] = [
  {
    to: '/reports',
    title: 'التقارير المالية والتحليلات',
    subtitle: 'مخططات بيانية، مؤشر الأمان، وتوقع نهاية الشهر',
    icon: BarChart3,
  },
  {
    to: '/recurring',
    title: 'المعاملات المتكررة',
    subtitle: 'الرواتب، الفواتير، والاشتراكات الشهرية المجدولة',
    icon: RefreshCw,
  },
  {
    to: '/categories',
    title: 'إدارة التصنيفات',
    subtitle: 'تخصيص الأيقونات، الألوان وترتيب التصنيفات',
    icon: LayoutGrid,
  },
  {
    to: '/settings',
    title: 'الإعدادات والعملة',
    subtitle: 'تفضيلات العملة والمظهر والنسخ الاحتياطي',
    icon: Settings,
  },
]

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenAddModal }) => {
  const location = useLocation()
  const pathname = location.pathname
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const [prevLocationKey, setPrevLocationKey] = useState(location.pathname + location.search)

  // Auto-close drawer when route or query changes
  if (location.pathname + location.search !== prevLocationKey) {
    setPrevLocationKey(location.pathname + location.search)
    setIsMoreOpen(false)
  }

  // Auto-close on browser back button or Escape key
  useEffect(() => {
    if (!isMoreOpen) return

    const handlePopState = () => {
      setIsMoreOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMoreOpen])

  const isMoreActive =
    pathname.startsWith('/tools') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/recurring') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/settings')

  return (
    <>
      {/* "More" Bottom Sheet Drawer for Mobile */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="fixed inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-[2.25rem] p-5 shadow-2xl border-t border-slate-200/80 dark:border-slate-800 max-w-lg mx-auto max-h-[85vh] overflow-y-auto animate-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Native Drag Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                  جميع الأدوات والميزات
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">
                  تنقل فوري لكافة إمكانيات التطبيق
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="إغلاق القائمة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Smart Tools */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  الميزات والأدوات الذكية
                </span>
                <Link
                  to="/tools"
                  onClick={() => setIsMoreOpen(false)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  مركز الأدوات بالكامل
                </Link>
              </div>
              <div className="space-y-2">
                {smartTools.map((item) => {
                  const Icon = item.icon
                  const [itemPath, itemQuery] = item.to.split('?')
                  const itemTool = itemQuery ? new URLSearchParams(itemQuery).get('tool') : null
                  const currentSearchParams = new URLSearchParams(location.search)
                  const currentTool = currentSearchParams.get('tool') || currentSearchParams.get('tab')
                  const isActive = pathname === itemPath && currentTool === itemTool
                  return (
                    <Link
                      key={item.title}
                      to={item.to}
                      onClick={() => setIsMoreOpen(false)}
                      className={cn(
                        'press-scale flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-start group cursor-pointer',
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/70 text-emerald-900 dark:text-emerald-100 shadow-xs'
                          : 'bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/70 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-750'
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-400 truncate mt-0.5 font-medium">
                          {item.subtitle}
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Management & Settings */}
            <div className="space-y-2">
              <div className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                الإدارة والتنظيم
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {managementItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.to)
                  return (
                    <Link
                      key={item.title}
                      to={item.to}
                      onClick={() => setIsMoreOpen(false)}
                      className={cn(
                        'press-scale flex items-center gap-3 p-3 rounded-2xl border transition-all text-start group cursor-pointer',
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/70 text-emerald-900 dark:text-emerald-100 shadow-xs'
                          : 'bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/70 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-750'
                      )}
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern Bottom Navigation Dock */}
      <nav
        aria-label="شريط التنقل السفلي"
        className="fixed inset-x-0 bottom-0 z-30 lg:hidden px-3.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1 pointer-events-none"
      >
        <div className="pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/70 dark:border-slate-800/80 rounded-3xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 px-3 py-1 flex items-center justify-around max-w-md mx-auto">
            {/* 1. الرئيسية */}
          <Link
            to="/"
            className={cn(
              'press-scale flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all',
              pathname === '/'
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">الرئيسية</span>
            {pathname === '/' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5 transition-opacity" />
            )}
          </Link>

          {/* 2. المعاملات */}
          <Link
            to="/transactions"
            className={cn(
              'press-scale flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all',
              pathname === '/transactions'
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">المعاملات</span>
            {pathname === '/transactions' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5 transition-opacity" />
            )}
          </Link>

          {/* 3. Central Animated FAB */}
          <div className="relative -top-5 flex items-center justify-center">
            <button
              type="button"
              onClick={onOpenAddModal}
              aria-label="إضافة معاملة جديدة"
              className="press-scale w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35 border-4 border-slate-50 dark:border-slate-900 active:scale-90 active:rotate-45 transition-all duration-200 cursor-pointer"
            >
              <Plus className="w-6 h-6 stroke-[2.8]" />
            </button>
          </div>

          {/* 4. الديون */}
          <Link
            to="/debts"
            className={cn(
              'press-scale flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all',
              pathname === '/debts'
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            <HandCoins className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">الديون</span>
            {pathname === '/debts' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5 transition-opacity" />
            )}
          </Link>

          {/* 5. المزيد / الأدوات */}
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={cn(
              'press-scale flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer',
              isMoreActive || isMoreOpen
                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">المزيد</span>
            {(isMoreActive || isMoreOpen) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5 transition-opacity" />
            )}
          </button>
        </div>
      </nav>
    </>
  )
}
