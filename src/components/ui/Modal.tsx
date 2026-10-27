import React, { useEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  closeOnBackdropClick?: boolean
  closeOnOverlayClick?: boolean
  enableHistoryBack?: boolean
}

// Module-level stack tracking open modal IDs for nested modal handling
const openModalStack: string[] = []

let savedScrollY = 0
let savedBodyStyle: {
  overflow: string
  position: string
  top: string
  width: string
} | null = null

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  if (openModalStack.length === 1) {
    savedScrollY = window.scrollY || window.pageYOffset || 0
    savedBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.width = '100%'
  }
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return
  if (openModalStack.length === 0 && savedBodyStyle) {
    document.body.style.overflow = savedBodyStyle.overflow
    document.body.style.position = savedBodyStyle.position
    document.body.style.top = savedBodyStyle.top
    document.body.style.width = savedBodyStyle.width
    if (
      typeof window.scrollTo === 'function' &&
      !window.scrollTo.toString().includes('notImplementedMethod')
    ) {
      window.scrollTo(0, savedScrollY)
    }
    savedBodyStyle = null
  }
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
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [isNudging, setIsNudging] = useState(false)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const touchStartYRef = useRef<number | null>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const modalId = useId()

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
      window.history.pushState({ modalOpen: true, modalId }, '')
      isPushedRef.current = true
    } catch {
      isPushedRef.current = false
    }

    const handlePopState = () => {
      // Only close if this modal is on top of the openModalStack
      const isTopModal =
        openModalStack.length === 0 ||
        openModalStack[openModalStack.length - 1] === modalId

      if (isPushedRef.current && isTopModal) {
        isPushedRef.current = false
        isClosingFromPopStateRef.current = true
        onCloseRef.current()
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (isPushedRef.current && !isClosingFromPopStateRef.current) {
        isPushedRef.current = false
        try {
          if (
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

  // Handle ESC key press (only top of stack responds)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isTopModal =
          openModalStack.length === 0 ||
          openModalStack[openModalStack.length - 1] === modalId
        if (isTopModal) {
          onCloseRef.current()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, modalId])

  // Auto-focus dialog on mount
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus()
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || mouseDownTargetRef.current !== e.currentTarget) {
      return
    }

    if (allowBackdropClose) {
      onClose()
    } else {
      setIsNudging(true)
      setTimeout(() => setIsNudging(false), 200)
    }
  }

  // Swipe-down touch handlers for mobile header / drag handle
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current !== null && e.touches.length === 1) {
      const currentY = e.touches[0].clientY
      const diffY = currentY - touchStartYRef.current
      if (diffY > 0) {
        setDragOffsetY(diffY)
      }
    }
  }

  const handleTouchEnd = () => {
    if (dragOffsetY > 70) {
      setDragOffsetY(0)
      touchStartYRef.current = null
      onClose()
    } else {
      setDragOffsetY(0)
      touchStartYRef.current = null
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

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center overflow-hidden"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Dialog container: Bottom Sheet on < lg, Centered Dialog on >= lg */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: dragOffsetY === 0 ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
        className={cn(
          'relative z-10 w-full bg-white dark:bg-zinc-900 shadow-2xl outline-none smooth-touch-scroll flex flex-col',
          isNudging && 'scale-[1.015]',
          // Mobile: Bottom Sheet with dynamic max-height
          'rounded-t-[2rem] max-h-[90dvh] p-5 pb-8',
          // Desktop >= lg: Centered Dialog
          'lg:rounded-2xl lg:max-w-lg lg:p-6 lg:m-4 lg:max-h-[85vh]',
          className
        )}
      >
        {/* Mobile Header / Drag Handle Area with swipe-down dismissal */}
        <div
          className="shrink-0 select-none touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile drag handle bar */}
          <div className="flex justify-center mb-3 lg:hidden cursor-grab active:cursor-grabbing py-1">
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          </div>

          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
            {title ? (
              <h2
                id="modal-title"
                className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </h2>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Container */}
        <div
          onFocusCapture={handleFocusCapture}
          className="flex-1 overflow-y-auto overscroll-contain min-h-0 text-zinc-700 dark:text-zinc-300"
        >
          {children}
        </div>
      </div>
    </div>
  )

  return createPortal(modalNode, document.body)
}
