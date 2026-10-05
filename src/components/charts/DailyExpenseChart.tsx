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
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { formatJOD, fromFils } from '../../lib/money'
import { toWesternDigits } from '../../lib/dates'
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
          {formatJOD(item.amountFils)}
        </div>
      </div>
    )
  }
  return null
}

export const DailyExpenseChart: React.FC<DailyExpenseChartProps> = ({
  data,
  className,
  height = 240,
}) => {
  const hasExpenses = data.some((d) => d.amountFils > 0)

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 min-h-[220px]',
          className
        )}
      >
        <p className="text-xs font-semibold">لا توجد بيانات لهذا الشهر</p>
      </div>
    )
  }

  // Format chart data with JOD value for tooltips & scaling
  const chartData = data.map((item) => ({
    ...item,
    jod: fromFils(item.amountFils),
  }))

  return (
    <div className={cn('w-full relative', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            className="text-slate-400 dark:text-slate-500"
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            className="text-slate-400 dark:text-slate-500"
            tickFormatter={(val) => toWesternDigits(String(Math.round(val)))}
          />
          <Tooltip content={<CustomDailyTooltip />} />
          <Area
            type="monotone"
            dataKey="jod"
            stroke="#EF4444"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#expenseTrendGradient)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
      {!hasExpenses && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl backdrop-blur-xs">
            لا توجد مصاريف مسجلة حتى الآن
          </p>
        </div>
      )}
    </div>
  )
}
