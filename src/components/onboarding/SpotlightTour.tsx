import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Laptop, Smartphone } from 'lucide-react'
import { Button } from '../ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'
import { TOUR_STEPS } from './tour/tourSteps'
import { MockTransactionDemo } from './tour/MockTransactionDemo'
import { MockDataCard } from './tour/MockDataCard'

export interface SpotlightTourProps {
  isOpen: boolean
  onFinish: () => void
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

function findVisibleTarget(targetKey: string): HTMLElement | null {
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

export const SpotlightTour: React.FC<SpotlightTourProps> = ({ isOpen, onFinish }) => {
  const { user } = useAuth()
  const uid = user?.uid
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState<number>(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  const handleFinishTour = useCallback(() => {
    if (uid && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`baseer_tour_shown_${uid}`, 'true')
        window.localStorage.setItem(`masareefi_tour_shown_${uid}`, 'true')
      } catch {
        // ignore
      }
    }
    if (navigate) {
      try {
        navigate('/')
      } catch {
        // ignore
      }
    }
    onFinish()
  }, [uid, navigate, onFinish])

  const updateRect = useCallback(() => {
    const step = TOUR_STEPS[currentStep]
    if (!step) return
    const el = findVisibleTarget(step.target)
    if (!el) {
      setTargetRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setTargetRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.bottom,
      right: r.right,
    })
  }, [currentStep])

  // Navigate to step route when step changes
  useEffect(() => {
    if (!isOpen) return
    const step = TOUR_STEPS[currentStep]
    if (navigate && step?.route) {
      try {
        navigate(step.route)
      } catch {
        // ignore navigation errors in non-browser/test environments
      }
    }
  }, [isOpen, currentStep, navigate])

  // Reset scroll position of card body to top when step changes
  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0
    }
  }, [currentStep])

  /* eslint-disable react-hooks/set-state-in-effect */
  // Watch for target element appearing / resizing / scrolling
  useEffect(() => {
    if (!isOpen) return

    const step = TOUR_STEPS[currentStep]
    const el = findVisibleTarget(step.target)
    if (el) {
      const r = el.getBoundingClientRect()
      if (
        (r.top < 16 || r.bottom > window.innerHeight - 16) &&
        typeof el.scrollIntoView === 'function'
      ) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } catch {
          // ignore
        }
      }
    }

    updateRect()
    const t1 = setTimeout(updateRect, 150)
    const t2 = setTimeout(updateRect, 350)
    const t3 = setTimeout(updateRect, 650)

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [isOpen, currentStep, updateRect])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleFinishTour()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleFinishTour])

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const stepData = TOUR_STEPS[currentStep]
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : false
  const cardWidth = typeof window !== 'undefined' ? Math.min(420, window.innerWidth - 24) : 420

  // Smart Viewport Calculation: determine vertical position & max height
  let cardStyle: React.CSSProperties = {}
  let arrowPlacement: 'top' | 'bottom' | null = null
  let arrowLeft = 16

  if (targetRect && typeof window !== 'undefined') {
    const vh = window.innerHeight
    const vw = window.innerWidth

    if (isMobile) {
      // On mobile screens, dock to top or bottom depending on which half contains the target
      const targetMidY = targetRect.top + targetRect.height / 2
      const targetInUpperHalf = targetMidY < vh * 0.52

      if (targetInUpperHalf) {
        // Target is at top: dock card at bottom
        cardStyle = {
          position: 'fixed',
          bottom: '12px',
          left: '12px',
          right: '12px',
          width: 'auto',
          maxWidth: '420px',
          margin: '0 auto',
          maxHeight: `${Math.min(460, Math.max(260, vh - targetRect.bottom - 24))}px`,
        }
      } else {
        // Target is at bottom: dock card at top
        cardStyle = {
          position: 'fixed',
          top: '12px',
          left: '12px',
          right: '12px',
          width: 'auto',
          maxWidth: '420px',
          margin: '0 auto',
          maxHeight: `${Math.min(460, Math.max(260, targetRect.top - 24))}px`,
        }
      }
    } else {
      // On desktop screens: calculate clamped position
      const spaceBelow = vh - targetRect.bottom - 24
      const spaceAbove = targetRect.top - 24
      const cardLeft = Math.max(
        16,
        Math.min(vw - cardWidth - 16, targetRect.left + targetRect.width / 2 - cardWidth / 2)
      )
      arrowLeft = Math.max(20, Math.min(cardWidth - 28, targetRect.left + targetRect.width / 2 - cardLeft - 6))

      if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
        // Place below target
        const clampedTop = targetRect.bottom + 12
        cardStyle = {
          position: 'fixed',
          top: `${clampedTop}px`,
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
          maxHeight: `${Math.min(520, Math.max(280, spaceBelow))}px`,
        }
        arrowPlacement = 'top'
      } else {
        // Place above target
        const clampedBottom = vh - targetRect.top + 12
        cardStyle = {
          position: 'fixed',
          bottom: `${clampedBottom}px`,
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
          maxHeight: `${Math.min(520, Math.max(280, spaceAbove))}px`,
        }
        arrowPlacement = 'bottom'
      }
    }
  }

  const renderCardContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 1. FIXED HEADER: Step counter, Title, and Skip button (ALWAYS VISIBLE) */}
      <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between gap-3 bg-white dark:bg-[#121215]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
              جولة تعريفية متعمقة
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 truncate">
            {stepData.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleFinishTour}
          className="text-xs font-semibold px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          aria-label="إغلاق الجولة"
        >
          تخطي
        </button>
      </div>

      {/* 2. SCROLLABLE MIDDLE: Description, Highlights, Device Tips, Mock Demos */}
      <div
        ref={bodyScrollRef}
        tabIndex={0}
        aria-label="محتوى الخطوة"
        className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 py-3 space-y-3 min-h-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/30"
      >
        {/* Description */}
        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {stepData.description}
        </p>

        {/* Deep Feature Highlights */}
        <div className="space-y-1.5">
          {stepData.highlights.map((h, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-xs">
              <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0 mt-0.5">•</span>
              <div className="leading-snug">
                <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">{h.label}: </strong>
                <span className="text-zinc-500 dark:text-zinc-400">{h.text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop vs Mobile Context Tip */}
        <div className="p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-[#E4E4E7]/60 dark:border-[#27272A] space-y-1 text-[11px]">
          <div className="flex items-start gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span className="text-zinc-700 dark:text-zinc-300">
              <strong>الحاسوب:</strong> {stepData.deviceTip.desktop}
            </span>
          </div>
          <div className="flex items-start gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
            <Smartphone className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span className="text-zinc-700 dark:text-zinc-300">
              <strong>الهاتف:</strong> {stepData.deviceTip.mobile}
            </span>
          </div>
        </div>

        {/* Mock Demo / Simulation for Empty States */}
        {stepData.mockType === 'transaction' && <MockTransactionDemo />}
        {stepData.mockType && stepData.mockType !== 'transaction' && (
          <MockDataCard type={stepData.mockType} />
        )}
      </div>

      {/* 3. FIXED FOOTER: Progress Dots & Action Buttons (ALWAYS VISIBLE) */}
      <div className="shrink-0 p-4 sm:p-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 bg-white dark:bg-[#121215]">
        {/* Dots */}
        <div className="flex items-center gap-1">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                idx === currentStep
                  ? 'w-4 bg-blue-600 dark:bg-blue-500'
                  : 'w-1.5 bg-zinc-200 dark:bg-zinc-700'
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => s - 1)}
            >
              السابق
            </Button>
          )}
          {currentStep < TOUR_STEPS.length - 1 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentStep((s) => s + 1)}
            >
              التالي
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleFinishTour}
            >
              فهمت، ابدأ الآن
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  const hasTarget = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0)

  return createPortal(
    hasTarget && targetRect ? (
      <div className="fixed inset-0 z-[110]">
        {/* Spotlight cutout */}
        <div
          className="pointer-events-none fixed z-[111] transition-all duration-200 rounded-2xl border border-blue-500/80 dark:border-blue-400/80"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            boxShadow: '0 0 0 9999px rgba(9, 9, 11, 0.72)',
          }}
        />

        {/* Floating / Docked Card */}
        <div
          ref={cardRef}
          role="dialog"
          aria-label="جولة بَصير السريعة"
          className="z-[112] bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-2xl select-none animate-fade-in overflow-hidden"
          style={cardStyle}
        >
          {/* Pointer Arrow (Desktop only, when positioned above or below) */}
          {!isMobile && arrowPlacement === 'top' && (
            <div
              className="absolute -top-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-t border-s border-[#E4E4E7] dark:border-[#27272A] z-20"
              style={{ left: `${arrowLeft}px` }}
            />
          )}
          {!isMobile && arrowPlacement === 'bottom' && (
            <div
              className="absolute -bottom-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-b border-e border-[#E4E4E7] dark:border-[#27272A] z-20"
              style={{ left: `${arrowLeft}px` }}
            />
          )}

          {renderCardContent()}
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-3">
        <div
          ref={cardRef}
          role="dialog"
          aria-label="جولة بَصير السريعة"
          className="w-full bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-2xl select-none animate-fade-in overflow-hidden"
          style={{ maxWidth: `${cardWidth}px`, maxHeight: 'min(520px, calc(100vh - 24px))' }}
        >
          {renderCardContent()}
        </div>
      </div>
    ),
    document.body
  )
}
