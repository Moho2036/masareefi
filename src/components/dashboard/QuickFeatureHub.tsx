import React from 'react'
import { Link } from 'react-router'
import {
  Users,
  LayoutGrid,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'

export interface QuickFeatureHubProps {
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
    <div className={cn('lg:hidden grid grid-cols-4 gap-2', className)}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.id}
            to={item.to}
            onClick={() => triggerHaptic('tick')}
            className="flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none active:scale-95 active:bg-zinc-50 dark:active:bg-zinc-800/60 transition-all select-none"
          >
            <Icon className="w-5 h-5 stroke-[2.2] text-zinc-700 dark:text-zinc-300" />
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate mt-1 w-full text-center">
              {item.title}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
