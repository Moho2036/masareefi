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
        'flex flex-wrap items-center justify-between gap-3 mb-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
