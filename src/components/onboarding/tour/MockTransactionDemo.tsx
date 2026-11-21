import React, { useState, useRef, useEffect } from 'react'
import {
  Pencil,
  Copy,
  Trash2,
  ShoppingCart,
  Laptop,
  Smartphone,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '../../../lib/cn'

export const MockTransactionDemo: React.FC = () => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop')
  const [isHovered, setIsHovered] = useState(false)
  const [isSwiped, setIsSwiped] = useState(false)
  const [demoActionFeedback, setDemoActionFeedback] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartXRef = useRef<number | null>(null)

  // Clear timeout on unmount (fixes BUG-06 memory leak)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleSimulateAction = (actionName: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setDemoActionFeedback(`محاكاة: تم تجربة "${actionName}" بنجاح!`)
    timerRef.current = setTimeout(() => {
      setDemoActionFeedback(null)
    }, 2800)
  }

  // Real Touch Swipe Support (fixes BUG-15)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    const touchEndX = e.changedTouches[0].clientX
    const deltaX = touchEndX - touchStartXRef.current

    // In RTL, dragging from left to right (positive delta) reveals the action strip
    if (deltaX > 40) {
      setIsSwiped(true)
    } else if (deltaX < -40) {
      setIsSwiped(false)
    }
    touchStartXRef.current = null
  }

  return (
    <div className="mt-3 p-3 sm:p-3.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-[#E4E4E7] dark:border-[#27272A] space-y-2.5">
      {/* Top Demo Header & Device Mode Switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100">
            معاملة تجريبية تفاعلية (Demo)
          </span>
        </div>

        {/* Device Switcher Pills (min-h-[36px] for touch accessibility) */}
        <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
          <button
            type="button"
            onClick={() => {
              setDeviceMode('desktop')
              setIsSwiped(false)
              setDemoActionFeedback(null)
            }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-all cursor-pointer min-h-[36px]',
              deviceMode === 'desktop'
                ? 'bg-white dark:bg-[#121215] text-blue-600 dark:text-blue-400 shadow-2xs font-black'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>الحاسوب (الفأرة)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDeviceMode('mobile')
              setIsHovered(false)
              setDemoActionFeedback(null)
            }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-all cursor-pointer min-h-[36px]',
              deviceMode === 'mobile'
                ? 'bg-white dark:bg-[#121215] text-blue-600 dark:text-blue-400 shadow-2xs font-black'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>الهاتف (السحب)</span>
          </button>
        </div>
      </div>

      {/* Mode Instruction Hint with Vector Icons (fixes BUG-22) */}
      <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
        {deviceMode === 'desktop' ? (
          <p className="flex items-center gap-1.5">
            <Laptop className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>
              <strong>على الحاسوب:</strong> مرّر الفأرة فوق الصف لتجربة كشف الأزرار السريعة.
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>
              <strong>على الهاتف:</strong> اضغط "اسحب لليمين" لتكشف أزرار الإجراءات السريعة.
            </span>
          </p>
        )}
      </div>

      {/* Interactive Mock Transaction Row (Single clean Swiss surface, fixes BUG-16) */}
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] select-none"
        onTouchStart={deviceMode === 'mobile' ? handleTouchStart : undefined}
        onTouchEnd={deviceMode === 'mobile' ? handleTouchEnd : undefined}
      >
        {/* Mobile Swipe Action Reveal Strip (Neutral Swiss styling, fixes BUG-17) */}
        {deviceMode === 'mobile' && (
          <div
            dir="ltr"
            className={cn(
              'absolute inset-y-0 left-0 flex items-stretch z-0 overflow-hidden transition-all duration-300',
              isSwiped ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            style={{ width: '165px' }}
          >
            <button
              type="button"
              onClick={() => handleSimulateAction('تعديل المعاملة')}
              className="flex-1 bg-zinc-700 hover:bg-zinc-800 text-zinc-100 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>تعديل</span>
            </button>
            <button
              type="button"
              onClick={() => handleSimulateAction('تكرار المعاملة')}
              className="flex-1 bg-zinc-800 hover:bg-zinc-900 text-blue-400 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors border-x border-zinc-700/60"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>تكرار</span>
            </button>
            <button
              type="button"
              onClick={() => handleSimulateAction('حذف المعاملة')}
              className="flex-1 bg-zinc-800 hover:bg-zinc-900 text-red-400 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف</span>
            </button>
          </div>
        )}

        {/* Main Row Surface */}
        <div
          onMouseEnter={() => {
            if (deviceMode === 'desktop') setIsHovered(true)
          }}
          onMouseLeave={() => {
            if (deviceMode === 'desktop') setIsHovered(false)
          }}
          onClick={() => {
            if (deviceMode === 'mobile') {
              setIsSwiped((prev) => !prev)
            }
          }}
          style={{
            transform: deviceMode === 'mobile' && isSwiped ? 'translateX(165px)' : 'none',
          }}
          className={cn(
            'relative z-10 p-2.5 sm:p-3 flex items-center justify-between gap-2.5 transition-transform duration-300 bg-white dark:bg-[#121215]',
            deviceMode === 'mobile' && 'cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-900'
          )}
        >
          {/* Left: Icon & Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 border border-[#E4E4E7]/60 dark:border-[#27272A]">
              <ShoppingCart className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate">
                مشتريات بقالة وسوبرماركت
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                مشتريات الأسبوع • 10:30 ص
              </div>
            </div>
          </div>

          {/* Right: Amount & Desktop Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-xs sm:text-sm font-black text-red-600 dark:text-red-400 tabular-nums">
              -14.500 د.أ
            </div>

            {/* Desktop Hover Action Icons (Neutral Swiss surfaces, fixes BUG-17) */}
            {deviceMode === 'desktop' && (
              <div
                className={cn(
                  'flex items-center gap-1 transition-all duration-200',
                  isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSimulateAction('تعديل المعاملة')
                  }}
                  title="تعديل المعاملة"
                  className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSimulateAction('تكرار المعاملة')
                  }}
                  title="تكرار المعاملة"
                  className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSimulateAction('حذف المعاملة')
                  }}
                  title="حذف المعاملة"
                  className="w-7 h-7 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-red-600 dark:text-red-400 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Controls & Feedback */}
      <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
        {deviceMode === 'mobile' ? (
          <button
            type="button"
            onClick={() => setIsSwiped((prev) => !prev)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors min-h-[36px]"
          >
            {isSwiped ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة إغلاق السحب</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-3.5 h-3.5" />
                <span>جرّب السحب لليمين الآن</span>
              </>
            )}
          </button>
        ) : (
          <span className="text-zinc-500 font-medium">
            {isHovered ? 'تم إظهار أزرار التعديل والحذف بالتمرير!' : 'مرّر الفأرة فوق الصف لإظهار أزرار التعديل والحذف'}
          </span>
        )}

        {demoActionFeedback && (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{demoActionFeedback}</span>
          </span>
        )}
      </div>
    </div>
  )
}
