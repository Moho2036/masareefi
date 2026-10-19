import React from 'react'
import { cn } from '../../lib/cn'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-750/70',
        className
      )}
      {...props}
    />
  )
}
