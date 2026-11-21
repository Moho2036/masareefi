import React from 'react'
import { Laptop, Smartphone } from 'lucide-react'
import { Button } from '../../ui/Button'
import { cn } from '../../../lib/cn'
import { TOUR_STEPS, type TourStep } from './tourSteps'
import { MockTransactionDemo } from './MockTransactionDemo'
import { MockDataCard } from './MockDataCard'

export interface TourCardContentProps {
  currentStep: number
  stepData: TourStep
  bodyScrollRef: React.RefObject<HTMLDivElement | null>
  onPrev: () => void
  onNext: () => void
  onFinish: () => void
}

export const TourCardContent: React.FC<TourCardContentProps> = ({
  currentStep,
  stepData,
  bodyScrollRef,
  onPrev,
  onNext,
  onFinish,
}) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Screen Reader Live Announcement (fixes BUG-19 accessibility) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`الخطوة ${currentStep + 1} من ${TOUR_STEPS.length}: ${stepData.title}`}
      </div>

      {/* 1. FIXED HEADER: Step counter, Title, and Skip button (ALWAYS VISIBLE AT TOP) */}
      <div className="shrink-0 p-3 sm:p-4 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between gap-3 bg-white dark:bg-[#121215]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {currentStep + 1} / {TOUR_STEPS.length}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
              جولة تعريفية متعمقة
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
            {stepData.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="text-xs font-bold px-2.5 py-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
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
            <Laptop className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <span className="text-zinc-700 dark:text-zinc-300 leading-snug">
              <strong>الحاسوب:</strong> {stepData.deviceTip.desktop}
            </span>
          </div>
          <div className="flex items-start gap-1.5 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/60">
            <Smartphone className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
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
              onClick={onPrev}
              className="min-h-[40px] sm:min-h-0 cursor-pointer"
            >
              السابق
            </Button>
          )}
          {currentStep < TOUR_STEPS.length - 1 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onNext}
              className="min-h-[40px] sm:min-h-0 cursor-pointer"
            >
              التالي
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onFinish}
              className="min-h-[40px] sm:min-h-0 cursor-pointer"
            >
              فهمت، ابدأ الآن
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
