import React, { useState } from 'react'
import {
  Download,
  CheckCircle2,
  Smartphone,
  Share2,
  PlusSquare,
  Info,
  Sparkles,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { triggerHaptic } from '../../lib/haptics'

export interface PWAInstallSectionProps {
  isInstallable: boolean
  isInstalled: boolean
  isIOS: boolean
  promptInstall: () => void
}

export const PWAInstallSection: React.FC<PWAInstallSectionProps> = ({
  isInstallable,
  isInstalled,
  isIOS,
  promptInstall,
}) => {
  const [showManualInstallGuide, setShowManualInstallGuide] = useState(false)

  return (
    <Card
      title="تثبيت التطبيق (PWA)"
      subtitle="تثبيت تطبيق بَصير على هاتفك أو حاسوبك للعمل بدون إنترنت وسرعة فائقة"
    >
      <div className="pt-2 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {isInstalled ? 'التطبيق مثبت حالياً' : 'تطبيق ويب تقدمي (PWA)'}
              </div>
              <div className="text-xs text-zinc-400">
                {isInstalled
                  ? 'يعمل التطبيق كبرنامج مستقل مع دعم كامل للعمل بلا اتصال'
                  : 'يعمل بكامل ميزاته مباشرة من الشاشة الرئيسية دون الحاجة للمتجر'}
              </div>
            </div>
          </div>

          {isInstalled ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              <span>مثبت على الجهاز</span>
            </div>
          ) : isInstallable ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={promptInstall}
              className="font-bold"
            >
              تثبيت التطبيق على جهازك
            </Button>
          ) : isIOS ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold shrink-0">
              <Smartphone className="w-4 h-4" />
              <span>أجهزة آبل iOS</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualInstallGuide((prev) => !prev)}
              className="font-bold text-xs shrink-0"
            >
              طريقة التثبيت اليدوي
            </Button>
          )}
        </div>

        {/* iOS Instructions */}
        {isIOS && !isInstalled && (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
              <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>خطوات تثبيت التطبيق على الآيفون والآيباد (iOS Safari):</span>
            </div>
            <ol className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300 list-decimal list-inside ps-1">
              <li className="leading-relaxed">
                اضغط على زر{' '}
                <span className="font-bold text-zinc-900 dark:text-white inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                  المشاركة (Share <Share2 className="w-3 h-3 inline text-blue-600 dark:text-blue-400" />)
                </span>{' '}
                في شريط أدوات متصفح سفاري (Safari).
              </li>
              <li className="leading-relaxed">
                مرر للأسفل في القائمة واختر{' '}
                <span className="font-bold text-zinc-900 dark:text-white inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                  "إضافة إلى الشاشة الرئيسية" (Add to Home Screen <PlusSquare className="w-3 h-3 inline text-blue-600 dark:text-blue-400" />)
                </span>.
              </li>
              <li className="leading-relaxed">
                اضغط على <span className="font-bold text-zinc-900 dark:text-white">"إضافة" (Add)</span> في الزاوية العلوية ليظهر التطبيق كأيقونة مستقلة على شاشتك.
              </li>
            </ol>
          </div>
        )}

        {/* Manual Install Instructions for Chrome / Edge / Android */}
        {!isInstalled && !isInstallable && !isIOS && showManualInstallGuide && (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/80 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>خطوات التثبيت اليدوي عبر متصفح Chrome أو Edge أو أندرويد:</span>
            </div>
            <ol className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300 list-decimal list-inside ps-1">
              <li className="leading-relaxed">
                اضغط على قائمة المتصفح (أيقونة الثلاث نقاط <span className="font-bold text-zinc-900 dark:text-white">⋮</span> أعلى أو أسفل الشاشة).
              </li>
              <li className="leading-relaxed">
                اختر <span className="font-bold text-zinc-900 dark:text-white">"تثبيت التطبيق"</span> أو <span className="font-bold text-zinc-900 dark:text-white">"الإضافة إلى الشاشة الرئيسية" (Add to Home Screen)</span>.
              </li>
              <li className="leading-relaxed">
                أكّد التثبيت ليظهر تطبيق بَصير مباشرة على جهازك ويعمل بدون إنترنت وبشاشة كاملة.
              </li>
            </ol>
          </div>
        )}
      </div>
    </Card>
  )
}

export interface AboutBaseerSectionProps {
  onRestartTour: () => void
}

export const AboutBaseerSection: React.FC<AboutBaseerSectionProps> = ({ onRestartTour }) => {
  return (
    <Card title="حول تطبيق بَصير" subtitle="معلومات الإصدار، التشفير، وحماية الخصوصية">
      <div className="pt-2 space-y-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 dark:bg-zinc-800 border border-blue-500/40 text-white flex items-center justify-center shadow-xs shrink-0">
            <img src="/icons/icon.svg" alt="بَصير" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                بَصير — Baseer
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                نسخة بيتا (Beta)
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">
              الإصدار 2.5.0-beta (Swiss Carbon & Sapphire Clarity)
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>حالة وتفاصيل النسخة التجريبية (Beta)</span>
          </div>
          <p className="text-blue-800 dark:text-blue-300">
            تطبيق بَصير حالياً في مرحلة الإطلاق التجريبي (Beta). يجري تحسين تجربة الاستخدام، واستجابة السحب والإيماءات، والربط السحابي، والتنبيهات الذكية بصورة دورية ومستمرة. ملاحظاتك المباشرة هي حجر الأساس لاعتماد الإصدار النهائي.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>أمان سحابي وخصوصية تامة</span>
          </div>
          <p>
            بياناتك المالية مشفرة ومحفوظة بأمان عبر Google Cloud Firestore مع قواعد أمان صارمة تضمن عدم وصول أي طرف آخر لبياناتك. التطبيق خالٍ تماماً من الإعلانات ومن أدوات التتبع الخارجية.
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerHaptic('impact')}
          >
            اختبار الاهتزاز اللمسي
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRestartTour}
          >
            إعادة تشغيل الجولة التعريفية
          </Button>
        </div>
      </div>
    </Card>
  )
}

export interface PWAAndAboutSectionProps extends PWAInstallSectionProps, AboutBaseerSectionProps {}

export const PWAAndAboutSection: React.FC<PWAAndAboutSectionProps> = ({
  isInstallable,
  isInstalled,
  isIOS,
  promptInstall,
  onRestartTour,
}) => {
  return (
    <>
      <PWAInstallSection
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        promptInstall={promptInstall}
      />
      <AboutBaseerSection onRestartTour={onRestartTour} />
    </>
  )
}
