import React from 'react'
import { cn } from '../../lib/cn'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4',
        className,
      )}
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="hidden sm:block text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
