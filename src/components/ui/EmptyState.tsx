import React from 'react'
import { FolderOpen } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700/60',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-xs">
        {icon || <FolderOpen className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
