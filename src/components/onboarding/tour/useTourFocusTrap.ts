import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useTourFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  onEscape?: () => void
): void {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousActiveElement.current = document.activeElement
    }

    const container = containerRef.current
    if (container) {
      // Focus first focusable element or the container
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        container.focus()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onEscape) {
          e.preventDefault()
          onEscape()
        }
        return
      }

      if (e.key !== 'Tab') return

      const currentContainer = containerRef.current
      if (!currentContainer) return

      const focusableElements = Array.from(
        currentContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el.getAttribute('tabindex') !== '-1')

      if (focusableElements.length === 0) {
        e.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const currentActive = document.activeElement

      if (e.shiftKey) {
        // Shift + Tab
        if (currentActive === firstElement || !currentContainer.contains(currentActive)) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (currentActive === lastElement || !currentContainer.contains(currentActive)) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        try {
          previousActiveElement.current.focus()
        } catch {
          // ignore
        }
      }
    }
  }, [isActive, containerRef, onEscape])
}
