import React from 'react'
import { Link } from 'react-router'
import {
  Users,
  Clock,
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
      id: 'work_hours',
      to: '/tools?tool=work_hours',
      title: 'حاسبة العمل',
      icon: Clock,
    },
    {
      id: 'recurring',
      to: '/recurring',
      title: 'المتكررة',
      icon: RefreshCw,
    },
  ]

  return (
    <div className={cn('lg:hidden space-y-2', className)}>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
          الوصول السريع
        </h3>
        <Link
          to="/tools"
          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
        >
          <span>الأدوات</span>
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
              className="press-scale flex flex-col items-center justify-center p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:border-emerald-500/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:group-hover:bg-emerald-950/40 dark:group-hover:text-emerald-400 flex items-center justify-center transition-colors">
                <Icon className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate mt-1.5 w-full text-center">
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
