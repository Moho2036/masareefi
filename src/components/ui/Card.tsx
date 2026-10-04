import React from 'react'
import { cn } from '../../lib/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  subtitle?: string
  headerAction?: React.ReactNode
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, subtitle, headerAction, children, ...props }, ref) => {
    const hasHeader = title || subtitle || headerAction

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs transition-shadow',
          className,
        )}
        {...props}
      >
        {hasHeader && (
          <div className="flex items-center justify-between mb-4">
            <div>
              {title && (
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction && <div>{headerAction}</div>}
          </div>
        )}
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'
