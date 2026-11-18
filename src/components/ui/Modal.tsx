import React, { useEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react'
import { cn } from '../../lib/cn'
import { triggerHaptic } from '../../lib/haptics'
import { springSheet, isTestEnv } from '../../lib/motionTokens'
import { openModalStack, lockBodyScroll, unlockBodyScroll } from './modalScrollLock'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  closeOnBackdropClick?: boolean
  closeOnOverlayClick?: boolean
  enableHistoryBack?: boolean
  hideCloseButton?: boolean
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  closeOnBackdropClick,
  closeOnOverlayClick,
  enableHistoryBack = true,
  hideCloseButton = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const [isNudging, setIsNudging] = useState(false)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const modalId = useId()

  const dragY = useMotionValue(0)
  const [isDraggingSheet, setIsDraggingSheet] = useState(false)
  const isDraggingSheetRef = useRef(false)
  const touchStartYRef = useRef<number | null>(null)
  const touchStartXRef = useRef<number | null>(null)
  const lastTouchYRef = useRef<number | null>(null)
  const touchStartTimeRef = useRef<number>(0)
  const isMovingDownRef = useRef(false)

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return typeof window !== 'undefined' ? window.innerWidth < 1024 : false
    }
    return window.matchMedia('(max-width: 1023px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(max-width: 1023px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    touchStartYRef.current = e.touches[0].clientY
    touchStartXRef.current = e.touches[0].clientX ?? 0
    lastTouchYRef.current = e.touches[0].clientY
    touchStartTimeRef.current = Date.now()
    isDraggingSheetRef.current = false
    isMovingDownRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null || e.touches.length !== 1) return
    const currentY = e.touches[0].clientY
    const currentX = e.touches[0].clientX ?? 0
    const diffY = currentY - touchStartYRef.current
    const diffX = currentX - (touchStartXRef.current ?? currentX)

    isMovingDownRef.current = currentY > (lastTouchYRef.current ?? currentY)
    lastTouchYRef.current = currentY

    if (Math.abs(diffY) >= Math.abs(diffX)) {
      const isAtTop = !contentScrollRef.current || contentScrollRef.current.scrollTop <= 0
      if (diffY > 8 && (isAtTop || isDraggingSheetRef.current)) {
        if (!isDraggingSheetRef.current) {
          isDraggingSheetRef.current = true
          setIsDraggingSheet(true)
        }
        // Initial tactile resistance zone (8px deadzone + 0.78 elastic ratio)
        const resistedY = Math.max(0, (diffY - 8) * 0.78)
        dragY.set(resistedY)
      } else if (diffY <= 8 && isDraggingSheetRef.current) {
        // When pushing back up to cancel, track back down to 0
        dragY.set(0)
        if (diffY <= 0) {
          isDraggingSheetRef.current = false
          setIsDraggingSheet(false)
        }
      }
    }
  }

  const handleTouchEnd = () => {
    const currentOffset = dragY.get()
    const elapsed = Math.max(1, Date.now() - touchStartTimeRef.current)
    const velocity = (currentOffset / elapsed) * 1000

    // Only close if pulled significantly downwards AND user wasn't actively pushing back up
    if (isDraggingSheetRef.current && isMovingDownRef.current && (currentOffset > 50 || velocity > 350)) {
      triggerHaptic('tick')
      if (isTestEnv) {
        setIsDraggingSheet(false)
        onClose()
      } else {
        animate(dragY, 600, { duration: 0.18, ease: 'easeIn' }).then(() => {
          setIsDraggingSheet(false)
          onClose()
        })
      }
    } else if (isDraggingSheetRef.current) {
      animate(dragY, 0, springSheet).then(() => {
        setIsDraggingSheet(false)
      })
    } else {
      animate(dragY, 0, springSheet)
    }
    touchStartYRef.current = null
    touchStartXRef.current = null
    lastTouchYRef.current = null
    isDraggingSheetRef.current = false
    isMovingDownRef.current = false
  }

  const allowBackdropClose =
    closeOnBackdropClick !== undefined
      ? closeOnBackdropClick
      : closeOnOverlayClick !== undefined
        ? closeOnOverlayClick
        : true

  const isPushedRef = useRef(false)
  const isClosingFromPopStateRef = useRef(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Track openModalStack & manage body scroll lock
  useEffect(() => {
    if (!isOpen) return

    openModalStack.push(modalId)
    lockBodyScroll()

    return () => {
      const idx = openModalStack.indexOf(modalId)
      if (idx !== -1) {
        openModalStack.splice(idx, 1)
      }
      unlockBodyScroll()
    }
  }, [isOpen, modalId])

  // Hardware Back Button / popstate handling (only top of stack responds)
  useEffect(() => {
    if (!isOpen || enableHistoryBack === false) return

    isClosingFromPopStateRef.current = false
    const openedPath = window.location.pathname + window.location.search

    try {
      window.history.pushState({ modalId }, '')
      isPushedRef.current = true
    } catch {
      isPushedRef.current = false
    }

    const handlePopState = () => {
      if (!isPushedRef.current) return
      const isTop = openModalStack[openModalStack.length - 1] === modalId
      if (!isTop) return

      isPushedRef.current = false
      isClosingFromPopStateRef.current = true
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (isPushedRef.current && !isClosingFromPopStateRef.current) {
        isPushedRef.current = false
        try {
          if (
            window.location.pathname !== '/login' &&
            window.location.pathname + window.location.search === openedPath &&
            window.history.state?.modalId === modalId
          ) {
            window.history.back()
          }
        } catch {
          // ignore
        }
      }
    }
  }, [isOpen, enableHistoryBack, modalId])

  // Keyboard navigation & Accessibility
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTop = openModalStack[openModalStack.length - 1] === modalId
      if (!isTop) return

      if (e.key === 'Escape') {
        if (allowBackdropClose) {
          triggerHaptic('tick')
          onCloseRef.current()
        } else {
          setIsNudging(true)
          triggerHaptic('warning')
          setTimeout(() => setIsNudging(false), 200)
        }
      } else if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return

        const focusableElements = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (!firstElement || !lastElement) return

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, modalId, allowBackdropClose])

  const [cachedChildren, setCachedChildren] = useState<React.ReactNode>(children)
  const [prevChildren, setPrevChildren] = useState<React.ReactNode>(children)

  if (children !== prevChildren) {
    setPrevChildren(children)
    if (isOpen && children) {
      setCachedChildren(children)
    }
  }

  // Auto-focus dialog and reset drag offset on open
  useEffect(() => {
    if (isOpen) {
      isDraggingSheetRef.current = false
      dragY.set(0)
      dialogRef.current?.focus()
    }
  }, [isOpen, dragY])

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || mouseDownTargetRef.current !== e.currentTarget) {
      return
    }

    if (allowBackdropClose) {
      triggerHaptic('tick')
      onClose()
    } else {
      setIsNudging(true)
      triggerHaptic('warning')
      setTimeout(() => setIsNudging(false), 200)
    }
  }

  // Mobile focus centering when keyboard appears
  const handleFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      const target = e.target as HTMLElement
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        setTimeout(() => {
          try {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          } catch {
            // ignore
          }
        }, 250)
      }
    }
  }

  const hasTitle = Boolean(title && title.trim())

  if (typeof document === 'undefined') return null

  const modalNode = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center overflow-hidden"
          role="presentation"
        >
          {/* Backdrop with smooth exit fade */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onMouseDown={handleBackdropMouseDown}
            onClick={handleBackdropClick}
            aria-hidden="true"
            data-testid="modal-backdrop"
          />

          {/* Dialog container: Bottom Sheet with touch drag-to-dismiss on mobile, Centered Dialog on desktop */}
          <motion.div
            key="modal-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={hasTitle ? 'modal-title' : undefined}
            tabIndex={-1}
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={isMobile ? { y: 0, transition: springSheet } : { opacity: 1, scale: 1, y: 0, transition: springSheet }}
            exit={
              isMobile
                ? { y: '100%', transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }
                : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15, ease: 'easeOut' } }
            }
            style={isMobile && isDraggingSheet ? { y: dragY } : undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={cn(
              'relative z-10 w-full bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xl outline-none smooth-touch-scroll flex flex-col',
              isNudging && 'scale-[1.015]',
              // Mobile: Bottom Sheet with dynamic max-height
              'rounded-t-2xl max-h-[90dvh] p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
              // Desktop >= lg: Centered Dialog
              'lg:rounded-2xl lg:max-w-lg lg:p-6 lg:m-4 lg:max-h-[85vh]',
              className
            )}
          >
            {/* Mobile Header / Drag Handle Area with swipe-down dismissal */}
            <div className="shrink-0 select-none touch-none">
              {/* Mobile drag handle bar */}
              <div className="flex justify-center mb-3 lg:hidden cursor-grab active:cursor-grabbing py-1">
                <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
              </div>

              {/* Modal Header */}
              {hasTitle ? (
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4 gap-2">
                  <h2
                    id="modal-title"
                    className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate pe-1"
                  >
                    {title}
                  </h2>
                  {!hideCloseButton && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick')
                        onClose()
                      }}
                      aria-label="إغلاق"
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ) : !hideCloseButton ? (
                <div className="flex items-center justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick')
                      onClose()
                    }}
                    aria-label="إغلاق"
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Modal Scrollable Content Container */}
            <div
              ref={contentScrollRef}
              onFocusCapture={handleFocusCapture}
              className="flex-1 overflow-y-auto overscroll-contain min-h-0 text-zinc-700 dark:text-zinc-300"
            >
              {isOpen ? children : (children || cachedChildren)}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalNode, document.body)
}
