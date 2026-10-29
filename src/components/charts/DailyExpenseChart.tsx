import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { fromFils, formatCompactNumber } from '../../lib/money'
import { toWesternDigits } from '../../lib/dates'
import { useCurrency } from '../../hooks/useCurrency'
import { cn } from '../../lib/cn'
import type { DailyExpenseItem } from '../../lib/reports'

export interface DailyExpenseChartProps {
  data: DailyExpenseItem[]
  className?: string
  height?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: DailyExpenseItem }>
}

const CustomDailyTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  const { format: formatCurrency } = useCurrency()
  if (active && payload && payload.length > 0) {
    const item = payload[0].payload
    const dateFormatted = toWesternDigits(
      format(item.date, 'EEEE d LLLL', { locale: ar })
    )

    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl shadow-xl text-xs space-y-1 z-50 text-start min-w-[150px]">
        <div className="font-semibold text-slate-500 dark:text-slate-400">
          {dateFormatted}
        </div>
        <div className="text-red-500 dark:text-red-400 font-black text-sm">
          {formatCurrency(item.amountFils)}
        </div>
      </div>
    )
  }
  return null
}

export const DailyExpenseChart: React.FC<DailyExpenseChartProps> = React.memo(({
  data,
  className,
  height = 240,
}) => {
  const { format: formatCurrency } = useCurrency()
  const isMasked = formatCurrency(1000).includes('•••••')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const touchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    const dismissTooltip = () => {
      if (containerRef.current) {
        containerRef.current.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
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

  const hasExpenses = data.some((d) => d.amountFils > 0)

  // Format chart data with JOD value and concise Arabic date label
  const chartData = React.useMemo(() => {
    return data.map((item) => {
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date)
      return {
        ...item,
        jod: fromFils(item.amountFils),
        dateLabel: toWesternDigits(format(itemDate, 'd EEE', { locale: ar })),
      }
    })
  }, [data])

  if (data.length === 0 || !hasExpenses) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 min-h-[220px]',
          className
        )}
      >
        <div className="w-16 h-16 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
          <TrendingDown className="w-7 h-7 text-slate-400 dark:text-slate-500" strokeWidth={1.8} />
        </div>
        <p className="text-xs font-semibold">لا توجد مصاريف مسجلة لهذه الفترة</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onTouchEnd={handleTouchEnd}
      className={cn('w-full relative', className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="expenseTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700/60"
            vertical={false}
          />
          <XAxis
            dataKey="dateLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'currentColor' }}
            className="text-slate-400 dark:text-slate-500"
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            width={55}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            className="text-slate-400 dark:text-slate-500"
            tickFormatter={(val: number) => (isMasked ? '•••' : formatCompactNumber(val))}
          />
          <Tooltip content={<CustomDailyTooltip />} />
          <Area
            type="monotone"
            dataKey="jod"
            stroke="#EF4444"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#expenseTrendGradient)"
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})

DailyExpenseChart.displayName = 'DailyExpenseChart'
