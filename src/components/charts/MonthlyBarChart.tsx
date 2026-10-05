import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { formatJOD, fromFils } from '../../lib/money'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { MonthlyBreakdownItem } from '../../lib/reports'

export interface MonthlyBarChartProps {
  data: MonthlyBreakdownItem[]
  className?: string
  height?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: MonthlyBreakdownItem }>
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length > 0) {
    const item = payload[0].payload
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-xl text-xs space-y-2 z-50 text-start min-w-[170px]">
        <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-1.5">
          {item.monthName}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              المداخيل:
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatJOD(item.income)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              المصاريف:
            </span>
            <span className="font-bold text-red-500 dark:text-red-400">
              {formatJOD(item.expense)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              الصافي:
            </span>
            <span
              className={cn(
                'font-black',
                item.balance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              )}
            >
              {formatJOD(item.balance)}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  data,
  className,
  height = 300,
}) => {
  const chartData = data.map((item) => ({
    ...item,
    incomeJod: fromFils(item.income),
    expenseJod: fromFils(item.expense),
  }))

  const hasData = data.some((d) => d.income > 0 || d.expense > 0)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Legend */}
      <div className="flex items-center justify-end gap-4 text-xs font-bold pe-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-300">المداخيل</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          <span className="text-slate-600 dark:text-slate-300">المصاريف</span>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            barGap={4}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700/60"
              vertical={false}
            />
            <XAxis
              dataKey="monthName"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400 dark:text-slate-500 font-medium"
              dy={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-slate-400 dark:text-slate-500"
              tickFormatter={(val) => toWesternDigits(String(Math.round(val)))}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar
              dataKey="incomeJod"
              name="المداخيل"
              fill="#10B981"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              animationDuration={800}
            />
            <Bar
              dataKey="expenseJod"
              name="المصاريف"
              fill="#EF4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl backdrop-blur-xs">
              لا توجد معاملات مسجلة في هذه السنة
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
