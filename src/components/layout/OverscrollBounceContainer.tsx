import React, { useState, useRef } from 'react'
import { triggerHaptic } from '../../lib/haptics'
import { isTestEnv } from '../../lib/motionTokens'

export interface OverscrollBounceContainerProps {
  children: React.ReactNode
  className?: string
}

export const OverscrollBounceContainer: React.FC<OverscrollBounceContainerProps> = ({
  children,
  className,
}) => {
  const [offsetY, setOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startYRef = useRef<number | null>(null)
  const isEngagedRef = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTestEnv) return
    startYRef.current = e.touches[0].clientY
    isEngagedRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null || isTestEnv) return

    const currentY = e.touches[0].clientY
    const diffY = currentY - startYRef.current
    const scrollY = window.scrollY || document.documentElement.scrollTop
    const isAtTop = scrollY <= 0
    const isAtBottom =
      window.innerHeight + scrollY >= document.documentElement.scrollHeight - 4

    // Overscroll pull at the top (dragging down past top)
    if (isAtTop && diffY > 0) {
      if (!isEngagedRef.current) {
        startYRef.current = currentY
        isEngagedRef.current = true
        setIsDragging(true)
        return
      }
      const rawPull = currentY - startYRef.current
      const resisted = Math.min(50, Math.pow(Math.max(0, rawPull), 0.78) * 1.4)
      setOffsetY(resisted)
      return
    }

    // Overscroll pull at the bottom (dragging up past bottom)
    if (isAtBottom && diffY < 0) {
      if (!isEngagedRef.current) {
        startYRef.current = currentY
        isEngagedRef.current = true
        setIsDragging(true)
        return
      }
      const rawPull = Math.abs(currentY - startYRef.current)
      const resisted = -Math.min(50, Math.pow(Math.max(0, rawPull), 0.78) * 1.4)
      setOffsetY(resisted)
      return
    }

    // Normal scrolling within page
    if (offsetY !== 0) {
      setOffsetY(0)
      setIsDragging(false)
      isEngagedRef.current = false
    }
  }

  const handleTouchEnd = () => {
    if (isEngagedRef.current && Math.abs(offsetY) > 20) {
      triggerHaptic('tick')
    }
    startYRef.current = null
    isEngagedRef.current = false
    setIsDragging(false)
    setOffsetY(0)
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        transform: offsetY !== 0 ? `translate3d(0, ${offsetY}px, 0)` : undefined,
        transition: isDragging
          ? 'none'
          : 'transform 0.36s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={className}
    >
      {children}
    </div>
  )
}
