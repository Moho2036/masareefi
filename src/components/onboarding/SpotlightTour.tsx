import React, { useState } from 'react'
import {
  Plus,
  ShieldCheck,
  Calculator,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  X,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useAuth } from '../../hooks/useAuth'

export interface SpotlightTourProps {
  isOpen: boolean
  onFinish: () => void
}

interface TourStep {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  color: string
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'الرصيد المتاح وحد الصرف اليومي',
    description: 'يعكس صافي سيولتك المالية المتبقية ومعدل إنفاقك اليومي الموصى به.',
    icon: ShieldCheck,
    badge: 'الخطوة 1 من 3',
    color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
  },
  {
    title: 'إضافة معاملة سريعة (+)',
    description: 'زر تسجيل المصاريف أو المداخيل بضغطة زر واحدة أينما كنت في التطبيق.',
    icon: Plus,
    badge: 'الخطوة 2 من 3',
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  },
  {
    title: 'دفتر الديون والالتزامات',
    description: 'تتبع ما لك وما عليك من التزامات وديون وجدولتها وسدادها بدقة.',
    icon: Calculator,
    badge: 'الخطوة 3 من 3',
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  },
]

export const SpotlightTour: React.FC<SpotlightTourProps> = ({ isOpen, onFinish }) => {
  const { user } = useAuth()
  const uid = user?.uid
  const [currentStep, setCurrentStep] = useState<number>(0)

  if (!isOpen) return null

  const handleFinishTour = () => {
    if (uid && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`baseer_tour_shown_${uid}`, 'true')
        window.localStorage.setItem(`masareefi_tour_shown_${uid}`, 'true')
      } catch {
        // ignore
      }
    }
    onFinish()
  }

  const stepData = TOUR_STEPS[currentStep]
  const Icon = stepData.icon

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleFinishTour}
      enableHistoryBack={false}
      title=""
      className="max-w-md p-0 overflow-hidden rounded-3xl"
    >
      <div className="p-6 sm:p-7 space-y-6 text-start">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>جولة بَصير السريعة</span>
          </span>

          <button
            type="button"
            onClick={handleFinishTour}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="إغلاق الجولة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Feature Showcase */}
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${stepData.color}`}
          >
            <Icon className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="text-[11px] font-bold text-zinc-400">
              {stepData.badge}
            </div>
            <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50 leading-tight">
              {stepData.title}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {stepData.description}
            </p>
          </div>
        </div>

        {/* Step Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep
                  ? 'w-6 bg-blue-600 dark:bg-blue-500'
                  : 'w-1.5 bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div>
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((s) => s - 1)}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                السابق
              </Button>
            )}
          </div>

          <div>
            {currentStep < TOUR_STEPS.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep((s) => s + 1)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <span>التالي</span>
                <ArrowLeft className="w-4 h-4 ms-1.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinishTour}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-500/20"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                فهمت، ابدأ الآن
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
