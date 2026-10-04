import React from 'react'
import { cn } from '../../lib/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      icon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-medium transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 rounded-lg',
      md: 'text-sm px-4 py-2 rounded-xl',
      lg: 'text-base px-5 py-2.5 rounded-xl',
    }[size]

    const variantStyles = {
      primary:
        'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm focus-visible:ring-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500',
      outline:
        'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 focus-visible:ring-slate-400',
      ghost:
        'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 focus-visible:ring-slate-400',
      danger:
        'bg-red-500 hover:bg-red-600 text-white shadow-sm focus-visible:ring-red-500 dark:bg-red-600 dark:hover:bg-red-500',
    }[variant]

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, sizeStyles, variantStyles, className)}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
