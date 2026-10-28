import React from 'react'
import { Link } from 'react-router'
import {
  Users,
  LayoutGrid,
  BarChart3,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react'
import type { ForecastResult } from '../../lib/forecast'
import { cn } from '../../lib/cn'

export interface QuickFeatureHubProps {
  forecast?: ForecastResult
  className?: string
}

export const QuickFeatureHub: React.FC<QuickFeatureHubProps> = ({ className }) => {
  const items = [
    {
      id: 'reports',
      to: '/reports',
      title: 'التقارير',
      icon: BarChart3,
    },
    {
      id: 'circles',
      to: '/tools?tool=circles',
      title: 'الجمعيات',
      icon: Users,
    },
    {
      id: 'recurring',
      to: '/recurring',
      title: 'المتكررة',
      icon: RefreshCw,
    },
    {
      id: 'categories',
      to: '/categories',
      title: 'التصنيفات',
      icon: LayoutGrid,
    },
  ]

  return (
    <div className={cn('lg:hidden space-y-2', className)}>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
          الوصول السريع
        </h3>
        <Link
          to="/tools"
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
        >
          <span>جميع الأدوات</span>
          <ChevronLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              to={item.to}
              className="press-scale flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-xs hover:border-blue-500/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-400 flex items-center justify-center transition-colors">
                <Icon className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate mt-1.5 w-full text-center">
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
