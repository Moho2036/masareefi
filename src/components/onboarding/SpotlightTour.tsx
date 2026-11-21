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

interface ComputedPosition {
  top: number
  left: number
  width: number
  maxHeight: number
  arrowPlacement: 'top' | 'bottom' | null
  arrowLeft: number
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

function computeCardPosition(
  targetRect: Rect | null,
  vw: number,
  vh: number
): ComputedPosition {
  const isMobile = vw < 640
  const cardWidth = isMobile ? Math.min(vw - 24, 420) : 440
  const defaultMaxHeight = isMobile
    ? Math.min(460, Math.floor(vh * 0.58))
    : Math.min(520, vh - 40)

  // 1. Fallback: No target element in DOM -> perfectly centered
  if (!targetRect) {
    const left = Math.max(12, Math.round((vw - cardWidth) / 2))
    const top = Math.max(16, Math.round((vh - defaultMaxHeight) / 2))
    return {
      top,
      left,
      width: cardWidth,
      maxHeight: defaultMaxHeight,
      arrowPlacement: null,
      arrowLeft: 16,
    }
  }

  // 2. Mobile positioning: dock to bottom or top depending on target location
  if (isMobile) {
    const targetMidY = targetRect.top + targetRect.height / 2
    const targetInUpperHalf = targetMidY < vh * 0.52
    const left = Math.max(12, Math.round((vw - cardWidth) / 2))

    const top = targetInUpperHalf
      ? Math.max(12, vh - defaultMaxHeight - 12)
      : 12

    return {
      top,
      left,
      width: cardWidth,
      maxHeight: defaultMaxHeight,
      arrowPlacement: null,
      arrowLeft: 16,
    }
  }

  // 3. Desktop positioning: strictly clamped within viewport
  const spaceBelow = vh - targetRect.bottom - 20
  const spaceAbove = targetRect.top - 20
  const idealLeft = targetRect.left + targetRect.width / 2 - cardWidth / 2
  let left = Math.max(16, Math.min(idealLeft, vw - cardWidth - 16))
  const arrowLeft = Math.max(
    20,
    Math.min(cardWidth - 28, targetRect.left + targetRect.width / 2 - left - 6)
  )

  let top: number
  let maxHeight: number
  let arrowPlacement: 'top' | 'bottom' | null

  if (spaceBelow >= 340) {
    // Fits comfortably below target
    top = targetRect.bottom + 12
    maxHeight = Math.min(520, spaceBelow)
    arrowPlacement = 'top'
  } else if (spaceAbove >= 340) {
    // Fits comfortably above target
    maxHeight = Math.min(520, spaceAbove)
    top = targetRect.top - 12 - maxHeight
    arrowPlacement = 'bottom'
  } else {
    // Target is tall (e.g. large section) or centrally placed: dock to the side
    const targetCenter = targetRect.left + targetRect.width / 2
    if (targetCenter > vw / 2) {
      left = 24
    } else {
      left = Math.max(16, vw - cardWidth - 24)
    }
    maxHeight = Math.min(520, vh - 40)
    top = Math.max(16, vh - maxHeight - 20)
    arrowPlacement = null
  }

  // ABSOLUTE SAFETY CLAMP: Guarantees top is NEVER < 16px and bottom NEVER > vh - 16px
  maxHeight = Math.min(maxHeight, vh - 32)
  top = Math.max(16, Math.min(top, vh - maxHeight - 16))

  return { top, left, width: cardWidth, maxHeight, arrowPlacement, arrowLeft }
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
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const isMobile = vw < 640

  const pos = computeCardPosition(targetRect, vw, vh)

  const renderCardContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 1. FIXED HEADER: Step counter, Title, and Skip button (ALWAYS VISIBLE AT TOP) */}
      <div className="shrink-0 p-3 sm:p-4 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between gap-3 bg-white dark:bg-[#121215]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
              جولة تعريفية متعمقة
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 truncate">
            {stepData.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleFinishTour}
          className="text-xs font-bold px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
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
        className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 py-2 space-y-2.5 min-h-0 focus:outline-none [scrollbar-width:thin] [scrollbar-color:#a1a1aa_#f4f4f5] dark:[scrollbar-color:#52525b_#18181b]"
      >
        {/* Description */}
        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {stepData.description}
        </p>

        {/* Deep Feature Highlights */}
        <div className="space-y-1">
          {stepData.highlights.map((h, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px] sm:text-xs">
              <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0 mt-0.5">•</span>
              <div className="leading-snug">
                <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">{h.label}: </strong>
                <span className="text-zinc-500 dark:text-zinc-400">{h.text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop vs Mobile Context Tip */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-[#E4E4E7]/60 dark:border-[#27272A] space-y-1 text-[10.5px] sm:text-[11px]">
          <div className="flex items-start gap-1.5">
            <Laptop className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
            <span className="text-zinc-700 dark:text-zinc-300 leading-snug">
              <strong>الحاسوب:</strong> {stepData.deviceTip.desktop}
            </span>
          </div>
          <div className="flex items-start gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
            <Smartphone className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
            <span className="text-zinc-700 dark:text-zinc-300 leading-snug">
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

      {/* 3. FIXED FOOTER: Progress Dots & Action Buttons (ALWAYS VISIBLE AT BOTTOM) */}
      <div className="shrink-0 p-3 sm:p-4 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 bg-white dark:bg-[#121215]">
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
    <div className="fixed inset-0 z-[110] pointer-events-none">
      {/* 1. Backdrop / Spotlight cutout */}
      {hasTarget && targetRect ? (
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
      ) : (
        <div className="fixed inset-0 z-[111] bg-black/70 pointer-events-auto" />
      )}

      {/* 2. Floating / Docked Tour Card with Pointer Event Passthrough */}
      <div
        ref={cardRef}
        role="dialog"
        aria-label="جولة بَصير السريعة"
        className="pointer-events-auto fixed z-[112] bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-2xl select-none animate-fade-in overflow-hidden flex flex-col"
        style={{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          width: `${pos.width}px`,
          maxHeight: `${pos.maxHeight}px`,
        }}
      >
        {/* Pointer Arrow (Desktop only, when positioned above or below target) */}
        {!isMobile && pos.arrowPlacement === 'top' && (
          <div
            className="absolute -top-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-t border-s border-[#E4E4E7] dark:border-[#27272A] z-20 pointer-events-none"
            style={{ left: `${pos.arrowLeft}px` }}
          />
        )}
        {!isMobile && pos.arrowPlacement === 'bottom' && (
          <div
            className="absolute -bottom-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-b border-e border-[#E4E4E7] dark:border-[#27272A] z-20 pointer-events-none"
            style={{ left: `${pos.arrowLeft}px` }}
          />
        )}

        {renderCardContent()}
      </div>
    </div>,
    document.body
  )
}
