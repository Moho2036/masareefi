import React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'
import { formatJOD } from '../../lib/money'
import { cn } from '../../lib/cn'
import type { CategoryDistributionItem } from '../../lib/reports'

export interface CategoryPieChartProps {
  data: CategoryDistributionItem[]
  className?: string
  height?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: CategoryDistributionItem }>
}

const CustomPieTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length > 0) {
    const item = payload[0].payload
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl shadow-xl text-xs space-y-1 z-50 text-start min-w-[140px]">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
          <span className="text-base">{item.icon}</span>
          <span className="truncate">{item.name}</span>
        </div>
        <div className="text-red-500 dark:text-red-400 font-black text-sm">
          {formatJOD(item.amountFils)}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          {item.percentage}% من إجمالي المصاريف
        </div>
      </div>
    )
  }
  return null
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data,
  className,
  height = 240,
}) => {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 min-h-[220px]',
          className
        )}
      >
        <div className="w-16 h-16 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3">
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-xs font-semibold">لا توجد مصاريف مسجلة لهذه الفترة</p>
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4 items-center', className)}>
      {/* Pie Donut Chart */}
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amountFils"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              animationDuration={800}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.categoryId}
                  fill={entry.color}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with emojis, names, amounts and percentages */}
      <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
        {data.slice(0, 6).map((item) => (
          <div
            key={item.categoryId}
            className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {formatJOD(item.amountFils)}
              </span>
              <span className="text-[11px] font-semibold text-slate-400 min-w-8 text-end">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
        {data.length > 6 && (
          <div className="text-[11px] text-center text-slate-400 pt-1">
            + {data.length - 6} تصنيفات أخرى
          </div>
        )}
      </div>
    </div>
  )
}
