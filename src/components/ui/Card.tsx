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
          'rounded-2xl p-5 bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-xs transition-shadow',
          className,
        )}
        {...props}
      >
        {hasHeader && (
          <div className="flex items-center justify-between mb-4">
            <div>
              {title && (
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
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
