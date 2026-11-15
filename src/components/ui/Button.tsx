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
    const hasCustomDisplay = Boolean(className && /\b(hidden|flex|block|inline-block|grid)\b/.test(className))
    const baseStyles = cn(
      !hasCustomDisplay && 'inline-flex',
      'press-scale items-center justify-center gap-2 font-medium transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-[0.98]'
    )

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 rounded-lg',
      md: 'text-sm px-4 py-2 rounded-xl',
      lg: 'text-base px-5 py-2.5 rounded-xl',
    }[size]

    const variantStyles = {
      primary:
        'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs focus-visible:ring-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500',
      outline:
        'border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 focus-visible:ring-zinc-400',
      ghost:
        'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus-visible:ring-zinc-400',
      danger:
        'bg-red-600 hover:bg-red-700 text-white shadow-xs focus-visible:ring-red-500 dark:bg-red-600 dark:hover:bg-red-500',
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
