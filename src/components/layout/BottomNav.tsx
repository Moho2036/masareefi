import React, { useState, useEffect, useRef } from 'react'
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
import { triggerHaptic } from '../../lib/haptics'
import { useSelectedMonth } from '../../hooks/useSelectedMonth'

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
  const { isCurrentMonth, goToCurrentMonth } = useSelectedMonth()
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const isPushedRef = useRef(false)
  const isClosingFromPopStateRef = useRef(false)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const touchStartYRef = useRef<number | null>(null)

  const [prevLocationKey, setPrevLocationKey] = useState(location.pathname + location.search)

  // Auto-close drawer when route or query changes
  if (location.pathname + location.search !== prevLocationKey) {
    setPrevLocationKey(location.pathname + location.search)
    setIsMoreOpen(false)
  }

  // Push history state on open & handle popstate / Escape key
  useEffect(() => {
    if (!isMoreOpen) return

    isClosingFromPopStateRef.current = false
    try {
      window.history.pushState({ moreDrawerOpen: true }, '')
      isPushedRef.current = true
    } catch {
      isPushedRef.current = false
    }

    const handlePopState = () => {
      if (isPushedRef.current) {
        isPushedRef.current = false
        isClosingFromPopStateRef.current = true
        setIsMoreOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)
      if (isPushedRef.current && !isClosingFromPopStateRef.current) {
        isPushedRef.current = false
        try {
          if (window.history.state?.moreDrawerOpen) {
            window.history.back()
          }
        } catch {
          // ignore
        }
      }
    }
  }, [isMoreOpen])

  // Swipe-down touch handlers for mobile drawer handle
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current !== null && e.touches.length === 1) {
      const currentY = e.touches[0].clientY
      const diffY = currentY - touchStartYRef.current
      if (diffY > 0) {
        setDragOffsetY(diffY)
      }
    }
  }

  const handleTouchEnd = () => {
    if (dragOffsetY > 70) {
      setDragOffsetY(0)
      touchStartYRef.current = null
      setIsMoreOpen(false)
    } else {
      setDragOffsetY(0)
      touchStartYRef.current = null
    }
  }

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
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setIsMoreOpen(false)}
        >
          <div
            className="fixed inset-x-0 bottom-0 bg-white dark:bg-[#121215] rounded-t-[2rem] p-5 shadow-2xl border-t border-[#E4E4E7] dark:border-[#27272A] max-w-lg mx-auto max-h-[88dvh] overflow-y-auto"
            style={{
              transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
              transition: dragOffsetY === 0 ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Native Drag Handle */}
            <div
              className="py-1 cursor-grab active:cursor-grabbing select-none touch-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mb-4" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                جميع الأدوات والميزات
              </h3>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="إغلاق القائمة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Smart Tools */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
                  الأدوات المالية
                </span>
                <Link
                  to="/tools"
                  onClick={() => setIsMoreOpen(false)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  مركز الأدوات
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
                        'press-scale flex items-center gap-3 p-3 rounded-2xl border transition-all text-start group cursor-pointer',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/70 text-blue-900 dark:text-blue-100 shadow-xs'
                          : 'bg-zinc-50/80 dark:bg-zinc-900/80 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      )}
                    >
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-4.5 h-4.5 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {item.title}
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-zinc-400 dark:text-zinc-600 shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Management & Settings */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 px-1">
                الإدارة والتنظيم
              </div>
              <div className="grid grid-cols-2 gap-2">
                {managementItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.to)
                  return (
                    <Link
                      key={item.title}
                      to={item.to}
                      onClick={() => setIsMoreOpen(false)}
                      className={cn(
                        'press-scale flex items-center gap-2.5 p-3 rounded-2xl border transition-all text-start group cursor-pointer',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/70 text-blue-900 dark:text-blue-100 shadow-xs'
                          : 'bg-zinc-50/80 dark:bg-zinc-900/80 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      )}
                    >
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {item.title}
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
        <div className="pointer-events-auto bg-white/95 dark:bg-[#121215]/95 backdrop-blur-md border border-[#E4E4E7] dark:border-[#27272A] rounded-3xl shadow-lg px-3 py-1 flex items-center justify-around max-w-md mx-auto">
          {/* 1. الرئيسية */}
          <Link
            to="/"
            onClick={() => {
              if (!isCurrentMonth) {
                goToCurrentMonth()
              }
            }}
            className={cn(
              'press-scale flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all',
              pathname === '/'
                ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200'
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">الرئيسية</span>
            {pathname === '/' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5 transition-opacity" />
            )}
          </Link>

          {/* 2. المعاملات */}
          <Link
            to="/transactions"
            className={cn(
              'press-scale flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all',
              pathname === '/transactions'
                ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200'
            )}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">المعاملات</span>
            {pathname === '/transactions' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5 transition-opacity" />
            )}
          </Link>

          {/* 3. Central FAB */}
          <div className="relative -top-5 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                onOpenAddModal()
              }}
              aria-label="إضافة معاملة جديدة"
              className="press-scale w-13 h-13 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md border-4 border-[#F4F4F5] dark:border-[#09090B] active:scale-90 transition-all duration-200 cursor-pointer"
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
                ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200'
            )}
          >
            <HandCoins className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">الديون</span>
            {pathname === '/debts' && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5 transition-opacity" />
            )}
          </Link>

          {/* 5. المزيد / الأدوات */}
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={cn(
              'press-scale flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer',
              isMoreActive || isMoreOpen
                ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200'
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">المزيد</span>
            {(isMoreActive || isMoreOpen) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5 transition-opacity" />
            )}
          </button>
        </div>
      </nav>
    </>
  )
}
