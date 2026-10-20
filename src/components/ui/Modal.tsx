import React, { useEffect, useRef, useState, useId } from 'react'
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

let scrollLockCount = 0
let savedScrollY = 0
let savedBodyStyle: {
  overflow: string
  position: string
  top: string
  width: string
} | null = null

function lockBodyScroll() {
  if (typeof document === 'undefined') return
  scrollLockCount++
  if (scrollLockCount === 1) {
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
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0 && savedBodyStyle) {
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

  // Hardware Back Button / popstate handling
  useEffect(() => {
    if (!isOpen || enableHistoryBack === false) return

    isClosingFromPopStateRef.current = false

    try {
      window.history.pushState({ modalOpen: true, modalId }, '')
      isPushedRef.current = true
    } catch {
      isPushedRef.current = false
    }

    const handlePopState = () => {
      if (isPushedRef.current) {
        isPushedRef.current = false
        isClosingFromPopStateRef.current = true
        onClose()
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (isPushedRef.current && !isClosingFromPopStateRef.current) {
        isPushedRef.current = false
        try {
          if (window.history.state?.modalId === modalId) {
            window.history.back()
          }
        } catch {
          // ignore
        }
      }
    }
  }, [isOpen, onClose, enableHistoryBack, modalId])

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent background scrolling when open & focus dialog
  useEffect(() => {
    if (isOpen) {
      lockBodyScroll()
      dialogRef.current?.focus()

      return () => {
        unlockBodyScroll()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only respond if both mousedown and click originated directly on the backdrop element
    if (e.target !== e.currentTarget || mouseDownTargetRef.current !== e.currentTarget) {
      return
    }

    if (allowBackdropClose) {
      onClose()
    } else {
      // Gentle feedback indicating the modal requires explicit close
      setIsNudging(true)
      setTimeout(() => setIsNudging(false), 200)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center overflow-hidden"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Dialog container: bottom sheet on < lg, centered dialog on >= lg */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
        className={cn(
          'relative z-10 w-full bg-white dark:bg-slate-800 shadow-2xl outline-none smooth-touch-scroll transition-transform duration-150',
          isNudging && 'scale-[1.015]',
          // Mobile: Bottom Sheet with native momentum touch scrolling
          'rounded-t-3xl max-h-[88dvh] overflow-y-auto overscroll-contain touch-pan-y p-5 pb-10',
          // Desktop >= lg: Centered Dialog
          'lg:rounded-2xl lg:max-w-lg lg:p-6 lg:m-4 lg:max-h-[85vh]',
          className,
        )}
      >
        {/* Mobile drag handle indicator */}
        <div className="flex justify-center mb-2 lg:hidden">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 mb-4">
          {title ? (
            <h2
              id="modal-title"
              className="text-lg font-bold text-slate-800 dark:text-slate-100"
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="text-slate-700 dark:text-slate-300">{children}</div>
      </div>
    </div>
  )
}
