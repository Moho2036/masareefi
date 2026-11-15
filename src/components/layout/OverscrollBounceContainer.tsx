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
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const touchDirectionRef = useRef<'horizontal' | 'vertical' | null>(null)
  const isEngagedRef = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTestEnv || e.touches.length !== 1) return
    startXRef.current = e.touches[0].clientX
    startYRef.current = e.touches[0].clientY
    touchDirectionRef.current = null
    isEngagedRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null || startXRef.current === null || isTestEnv || e.touches.length !== 1) return

    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const diffX = currentX - startXRef.current
    const diffY = currentY - startYRef.current
    const absX = Math.abs(diffX)
    const absY = Math.abs(diffY)

    // Direction lock with 10px deadzone: if horizontal gesture detected, lock and completely ignore overscroll
    if (touchDirectionRef.current === null) {
      if (absX < 10 && absY < 10) return
      if (absX >= absY) {
        touchDirectionRef.current = 'horizontal'
        return
      } else {
        touchDirectionRef.current = 'vertical'
      }
    }

    if (touchDirectionRef.current === 'horizontal') {
      return
    }

    const scrollY = window.scrollY || document.documentElement.scrollTop
    const isAtTop = scrollY <= 0
    const isAtBottom =
      window.innerHeight + scrollY >= document.documentElement.scrollHeight - 4

    // Overscroll pull down at top (dragging down past top)
    if (isAtTop && diffY > 12 && absY > absX * 1.5) {
      if (!isEngagedRef.current) {
        startYRef.current = currentY
        isEngagedRef.current = true
        setIsDragging(true)
        return
      }
      const rawPull = currentY - startYRef.current
      const resisted = Math.min(48, Math.pow(Math.max(0, rawPull), 0.78) * 1.4)
      setOffsetY(resisted)
      return
    }

    // Overscroll pull up at bottom (dragging up past bottom)
    if (isAtBottom && diffY < -12 && absY > absX * 1.5) {
      if (!isEngagedRef.current) {
        startYRef.current = currentY
        isEngagedRef.current = true
        setIsDragging(true)
        return
      }
      const rawPull = Math.abs(currentY - startYRef.current)
      const resisted = -Math.min(48, Math.pow(Math.max(0, rawPull), 0.78) * 1.4)
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
    startXRef.current = null
    startYRef.current = null
    touchDirectionRef.current = null
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
