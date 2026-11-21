import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { TOUR_STEPS } from './tour/tourSteps'
import { type Rect, computeCardPosition } from './tour/tourPosition'
import { findVisibleTarget, scrollTargetIntoSmartView, useTourTargetObserver } from './tour/tourDomTarget'
import { useTourFocusTrap } from './tour/useTourFocusTrap'
import { TourCardContent } from './tour/TourCardContent'

export interface SpotlightTourProps {
  isOpen: boolean
  onFinish: () => void
}

export const SpotlightTour: React.FC<SpotlightTourProps> = ({ isOpen, onFinish }) => {
  const { user } = useAuth()
  const uid = user?.uid
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState<number>(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  // Reset step when user session changes (fixes BUG-05)
  const [prevUid, setPrevUid] = useState(uid)
  if (prevUid !== uid) {
    setPrevUid(uid)
    setCurrentStep(0)
  }

  const handleFinishTour = useCallback(() => {
    if (uid && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`baseer_tour_shown_${uid}`, 'true')
        window.localStorage.setItem(`masareefi_tour_shown_${uid}`, 'true')
      } catch {
        // ignore storage errors
      }
    }
    if (navigate) {
      try {
        navigate('/', { replace: true })
      } catch {
        // ignore navigation errors
      }
    }
    onFinish()
  }, [uid, navigate, onFinish])

  // Focus Trap & Escape key handling (fixes BUG-19)
  useTourFocusTrap(cardRef, isOpen, handleFinishTour)

  const updateRect = useCallback(() => {
    const step = TOUR_STEPS[currentStep]
    if (!step) return
    const el = findVisibleTarget(step.target)
    if (!el) {
      setTargetRect(null)
      return
    }

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const isMobile = vw < 1024

    // Smart scroll to avoid mobile occlusion (fixes BUG-08)
    scrollTargetIntoSmartView(el, isMobile, vh)

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

  // MutationObserver & resize/scroll tracking (fixes BUG-03)
  useTourTargetObserver(TOUR_STEPS[currentStep]?.target ?? '', updateRect, isOpen)

  // Navigate to step route with replace: true (fixes BUG-04)
  useEffect(() => {
    if (!isOpen) return
    const step = TOUR_STEPS[currentStep]
    if (navigate && step?.route) {
      try {
        navigate(step.route, { replace: true })
      } catch {
        // ignore
      }
    }
  }, [isOpen, currentStep, navigate])

  // Reset scroll position of card body to top when step changes
  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0
    }
  }, [currentStep])

  if (!isOpen || typeof document === 'undefined') return null

  // Safety guard against array out of bounds (fixes BUG-02)
  const stepData = TOUR_STEPS[currentStep]
  if (!stepData) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const pos = computeCardPosition(targetRect, vw, vh)
  const hasTarget = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0)

  // Bounded step navigation (fixes BUG-02)
  const handleNext = () => {
    setCurrentStep((s) => Math.min(TOUR_STEPS.length - 1, s + 1))
  }

  const handlePrev = () => {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  return createPortal(
    <div className="fixed inset-0 z-[110]">
      {/* 1. Backdrop layer: pointer-events-auto captures clicks, preventing background clickthrough (fixes BUG-01) */}
      {hasTarget && targetRect ? (
        <div
          className="fixed z-[111] pointer-events-auto transition-all duration-200 rounded-2xl border border-blue-500/80 dark:border-blue-400/80"
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

      {/* 2. Floating / Docked Tour Card with Focus Trap and Strict Viewport Bounds */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="جولة بَصير السريعة"
        tabIndex={-1}
        className="pointer-events-auto fixed z-[112] bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-2xl select-none animate-fade-in overflow-hidden flex flex-col focus:outline-none"
        style={{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          width: `${pos.width}px`,
          maxHeight: `${pos.maxHeight}px`,
        }}
      >
        {/* Pointer Arrow with physical borders unaffected by RTL (fixes BUG-09) */}
        {!pos.isMobileLayout && pos.arrowPlacement === 'top' && (
          <div
            className="absolute -top-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-t border-l border-[#E4E4E7] dark:border-[#27272A] z-20 pointer-events-none"
            style={{ left: `${pos.arrowLeft}px` }}
          />
        )}
        {!pos.isMobileLayout && pos.arrowPlacement === 'bottom' && (
          <div
            className="absolute -bottom-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-b border-r border-[#E4E4E7] dark:border-[#27272A] z-20 pointer-events-none"
            style={{ left: `${pos.arrowLeft}px` }}
          />
        )}

        <TourCardContent
          currentStep={currentStep}
          stepData={stepData}
          bodyScrollRef={bodyScrollRef}
          onPrev={handlePrev}
          onNext={handleNext}
          onFinish={handleFinishTour}
        />
      </div>
    </div>,
    document.body
  )
}
