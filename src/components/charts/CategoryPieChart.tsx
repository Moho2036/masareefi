import React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { cn } from '../../lib/cn'
import type { CategoryDistributionItem } from '../../lib/reports'

export interface CategoryPieChartProps {
  data: CategoryDistributionItem[]
  className?: string
  height?: number
  type?: 'expense' | 'income'
  onSelectCategory?: (categoryId: string) => void
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: CategoryDistributionItem }>
  type?: 'expense' | 'income'
}

const CustomPieTooltip: React.FC<CustomTooltipProps> = ({ active, payload, type = 'expense' }) => {
  if (active && payload && payload.length > 0) {
    const item = payload[0].payload
    const isIncome = type === 'income'
    return (
      <div className="bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] p-3 rounded-xl shadow-lg dark:shadow-none text-xs space-y-1 z-50 text-start min-w-[140px]">
        <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-100">
          <CategoryIcon icon={item.icon} color={item.color} size="sm" />
          <span className="truncate">{item.name}</span>
        </div>
        <div
          className={cn(
            'font-black text-sm',
            isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          <FormattedMoney amountFils={item.amountFils} />
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
          {item.percentage}% من إجمالي {isIncome ? 'المداخيل' : 'المصاريف'}
        </div>
      </div>
    )
  }
  return null
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = React.memo(({
  data,
  className,
  height = 260,
  type = 'expense',
  onSelectCategory,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const touchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    let ticking = false
    const dismissTooltip = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
          }
          ticking = false
        })
        ticking = true
      }
    }
    const handleTouchOutside = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismissTooltip()
      }
    }
    document.addEventListener('touchstart', handleTouchOutside, { passive: true })
    window.addEventListener('scroll', dismissTooltip, { passive: true, capture: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchOutside)
      window.removeEventListener('scroll', dismissTooltip, { capture: true })
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    }
  }, [])

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    touchTimerRef.current = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
      }
    }, 1000)
  }

  const totalAmount = React.useMemo(
    () => data.reduce((sum, item) => sum + item.amountFils, 0),
    [data]
  )

  const isIncome = type === 'income'

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center p-6 text-zinc-400 dark:text-zinc-500 min-h-[190px]',
          className
        )}
      >
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center mb-2.5">
          <PieChartIcon className="w-6 h-6 text-zinc-400 dark:text-zinc-500" strokeWidth={1.8} />
        </div>
        <p className="text-xs font-semibold">
          {isIncome ? 'لا توجد مداخيل مسجلة لهذه الفترة' : 'لا توجد مصاريف مسجلة لهذه الفترة'}
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onTouchEnd={handleTouchEnd}
      className={cn('w-full relative flex items-center justify-center min-w-0 max-w-full overflow-hidden touch-pan-y', className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amountFils"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell
                key={entry.categoryId}
                fill={entry.color}
                stroke="transparent"
                className={onSelectCategory ? 'cursor-pointer hover:opacity-85 transition-opacity' : undefined}
                onClick={() => onSelectCategory?.(entry.categoryId)}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomPieTooltip type={type} />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Donut Center Label: Total Amount */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center">
        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
          {isIncome ? 'إجمالي المداخيل' : 'إجمالي المصاريف'}
        </span>
        <span className="text-sm sm:text-base font-black text-zinc-800 dark:text-zinc-100">
          <FormattedMoney amountFils={totalAmount} />
        </span>
      </div>
    </div>
  )
})

CategoryPieChart.displayName = 'CategoryPieChart'
