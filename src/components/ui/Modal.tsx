import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)

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
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      dialogRef.current?.focus()

      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog container: bottom sheet on < lg, centered dialog on >= lg */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full bg-white dark:bg-slate-800 shadow-2xl outline-none transition-all',
          // Mobile: Bottom Sheet
          'rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 pb-8',
          // Desktop >= lg: Centered Dialog
          'lg:rounded-2xl lg:max-w-md lg:p-6 lg:m-4 lg:max-h-[85vh]',
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
