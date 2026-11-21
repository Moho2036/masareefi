import { useEffect } from 'react'

export function findVisibleTarget(targetKey: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const elements = document.querySelectorAll(`[data-tour="${targetKey}"]`)
  for (const el of Array.from(elements)) {
    if (!(el instanceof HTMLElement)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
    }
    return el
  }
  return null
}

export function scrollTargetIntoSmartView(
  el: HTMLElement,
  isMobileLayout: boolean,
  vh: number
): void {
  if (typeof el.getBoundingClientRect !== 'function') return
  const r = el.getBoundingClientRect()

  if (isMobileLayout) {
    // On mobile, if element is outside top half (top < 16 or bottom > vh * 0.48),
    // scroll so it sits in the upper third without being obscured by bottom card
    if (r.top < 70 || r.bottom > vh * 0.48) {
      if (typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } catch {
          // ignore
        }
      }
    }
  } else {
    // Desktop layout
    if ((r.top < 24 || r.bottom > vh - 24) && typeof el.scrollIntoView === 'function') {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        // ignore
      }
    }
  }
}

export function useTourTargetObserver(
  targetKey: string,
  onTargetUpdate: () => void,
  isOpen: boolean
): void {
  useEffect(() => {
    if (!isOpen) return

    onTargetUpdate()

    // MutationObserver to detect lazy-loaded elements (fixes BUG-03)
    let observer: MutationObserver | null = null
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      observer = new MutationObserver(() => {
        const found = findVisibleTarget(targetKey)
        if (found) {
          onTargetUpdate()
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    // Interval / timeout fallback for slow network lazy components
    const t1 = setTimeout(onTargetUpdate, 150)
    const t2 = setTimeout(onTargetUpdate, 350)
    const t3 = setTimeout(onTargetUpdate, 700)
    const t4 = setTimeout(onTargetUpdate, 1400)

    const handleWindowChange = () => onTargetUpdate()
    window.addEventListener('resize', handleWindowChange, { passive: true })
    window.addEventListener('scroll', handleWindowChange, { passive: true, capture: true })

    return () => {
      if (observer) observer.disconnect()
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
    }
  }, [isOpen, targetKey, onTargetUpdate])
}
