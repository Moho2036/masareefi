import React from 'react'
import { Folder } from 'lucide-react'
import { getCategoryLucideIcon } from '../../lib/categoryIcons'
import { cn } from '../../lib/cn'

export interface CategoryIconProps {
  icon?: string | null
  color?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

const textSizeClasses = {
  sm: 'text-xs leading-none',
  md: 'text-base leading-none',
  lg: 'text-xl leading-none',
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  color,
  size = 'md',
  className,
}) => {
  const trimmed = icon?.trim()

  if (!trimmed) {
    return (
      <Folder
        className={cn(sizeClasses[size], 'shrink-0', className)}
        style={color ? { color } : undefined}
        strokeWidth={2}
      />
    )
  }

  const IconComponent = getCategoryLucideIcon(trimmed)

  if (IconComponent) {
    return React.createElement(IconComponent, {
      className: cn(sizeClasses[size], 'shrink-0', className),
      style: color ? { color } : undefined,
      strokeWidth: 2,
    })
  }

  // Fallback for custom user emoji or character string
  return (
    <span
      className={cn(textSizeClasses[size], 'inline-flex items-center justify-center shrink-0 select-none', className)}
      style={color ? { color } : undefined}
    >
      {trimmed}
    </span>
  )
}
