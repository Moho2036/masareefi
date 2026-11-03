import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'

export interface SpotlightTourProps {
  isOpen: boolean
  onFinish: () => void
}

interface TourStep {
  target: string
  title: string
  description: string
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'hero-balance',
    title: 'الرصيد المتاح وحد الصرف اليومي',
    description:
      'تعرض سيولتك الفعلية ومجموع دخلك ومصروفك، وفي أسفلها يظهر الحد اليومي الآمن للصرف لحمايتك من العجز قبل نهاية الشهر.',
  },
  {
    target: 'add-transaction-btn',
    title: 'إضافة معاملة سريعة (+)',
    description:
      'سجّل أي مصروف أو دخل في ثوانٍ من أي شاشة، مع إمكانية إجراء عمليات حسابية مباشرة داخل حقل المبلغ أو جعلها معاملة دورية.',
  },
  {
    target: 'transactions-nav',
    title: 'سجل المعاملات',
    description:
      'استعرض حركاتك المالية مجمعةً بالأيام، وابحث فيها أو صفِّها حسب التصنيف والفترة، مع إمكانية تصديرها لملف Excel أو طباعتها كـ PDF.',
  },
  {
    target: 'debts-nav',
    title: 'دفتر الديون والالتزامات',
    description:
      'وثّق ما لك وما عليك من ديون وسلف، وسجّل الدفعات الجزئية، وشارك كشف حساب مفصل مع الطرف الآخر عبر واتساب.',
  },
  {
    target: 'more-and-tools',
    title: 'التقارير والأدوات المالية',
    description:
      'من هنا تصل إلى التقارير التحليلية والرسوم البيانية، وأداة إدارة الجمعيات المشتركة، وجدولة الفواتير المتكررة، وحاسبة ساعات العمل.',
  },
  {
    target: 'notifications-bell',
    title: 'مركز التنبيهات',
    description:
      'يذكّرك تلقائياً بمواعيد الفواتير المتكررة التي تنتظر تأكيدك، وأقساط الجمعيات، ومواعيد استحقاق الديون.',
  },
]

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
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)

  const handleFinishTour = useCallback(() => {
    if (uid && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`baseer_tour_shown_${uid}`, 'true')
        window.localStorage.setItem(`masareefi_tour_shown_${uid}`, 'true')
      } catch {
        // ignore
      }
    }
    onFinish()
  }, [uid, onFinish])

  const updateRect = useCallback(() => {
    const el = findVisibleTarget(TOUR_STEPS[currentStep].target)
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return

    const el = findVisibleTarget(TOUR_STEPS[currentStep].target)
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
    const timer = setTimeout(updateRect, 250)

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [isOpen, currentStep, updateRect])
  /* eslint-enable react-hooks/set-state-in-effect */

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
  const cardWidth = typeof window !== 'undefined' ? Math.min(340, window.innerWidth - 32) : 340
  const isTop =
    targetRect && typeof window !== 'undefined'
      ? targetRect.bottom + 210 < window.innerHeight || targetRect.top < 180
      : true

  const cardLeft =
    targetRect && typeof window !== 'undefined'
      ? Math.max(
          16,
          Math.min(window.innerWidth - cardWidth - 16, targetRect.left + targetRect.width / 2 - cardWidth / 2)
        )
      : 16

  const arrowLeft = targetRect
    ? Math.max(16, Math.min(cardWidth - 28, targetRect.left + targetRect.width / 2 - cardLeft - 6))
    : 16

  const renderCardContent = () => (
    <>
      {/* Top Header: Step counter on right, Skip button on left */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-zinc-400 tabular-nums">
          {currentStep + 1} / {TOUR_STEPS.length}
        </span>
        <button
          type="button"
          onClick={handleFinishTour}
          className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          aria-label="إغلاق الجولة"
        >
          تخطي
        </button>
      </div>

      {/* Step title & description */}
      <div>
        <h3 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
          {stepData.title}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1">
          {stepData.description}
        </p>
      </div>

      {/* Bottom: Progress dots on right, Previous & Next / Finish on left */}
      <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
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
    </>
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

        {/* Floating Card */}
        <div
          role="dialog"
          aria-label="جولة بَصير السريعة"
          className="fixed z-[112] bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-xl p-4 sm:p-5 select-none animate-fade-in"
          style={{
            width: `${cardWidth}px`,
            left: `${cardLeft}px`,
            ...(isTop
              ? { top: `${targetRect.bottom + 14}px` }
              : { bottom: `${window.innerHeight - targetRect.top + 14}px` }),
          }}
        >
          {/* Pointer Arrow */}
          {isTop ? (
            <div
              className="absolute -top-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-t border-s border-[#E4E4E7] dark:border-[#27272A]"
              style={{ left: `${arrowLeft}px` }}
            />
          ) : (
            <div
              className="absolute -bottom-1.5 w-3 h-3 rotate-45 bg-white dark:bg-[#121215] border-b border-e border-[#E4E4E7] dark:border-[#27272A]"
              style={{ left: `${arrowLeft}px` }}
            />
          )}

          {renderCardContent()}
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-label="جولة بَصير السريعة"
          className="w-full max-w-[340px] bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-50 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-xl p-4 sm:p-5 select-none animate-fade-in"
        >
          {renderCardContent()}
        </div>
      </div>
    ),
    document.body
  )
}
