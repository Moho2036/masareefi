import React from 'react'
import { useSearchParams } from 'react-router'
import {
  Clock,
  Users,
  ArrowRight,
  ChevronLeft,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { WorkHoursCalculator } from '../components/tools/WorkHoursCalculator'
import { MoneyCirclesManager } from '../components/tools/MoneyCirclesManager'
import { triggerHaptic } from '../lib/haptics'

type ToolKey = 'work_hours' | 'circles'

export const ToolsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawParam = searchParams.get('tool') || searchParams.get('tab')
  const activeTool: ToolKey | null =
    rawParam === 'circles' ? 'circles' : rawParam === 'work_hours' ? 'work_hours' : null

  const handleOpenTool = (tool: ToolKey) => {
    triggerHaptic('tick')
    setSearchParams({ tool })
  }

  const handleBackToDirectory = () => {
    triggerHaptic('tick')
    setSearchParams({})
  }

  // 1. Dedicated View for Money Circles
  if (activeTool === 'circles') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-slide-up">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E4E7] dark:border-[#27272A]">
          <button
            type="button"
            onClick={handleBackToDirectory}
            className="press-scale inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] text-xs sm:text-sm font-black text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 shadow-2xs dark:shadow-none cursor-pointer transition-all"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0" />
            <span>العودة إلى قائمة الأدوات</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-[#E4E4E7] dark:border-[#27272A]">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>أداة الجمعيات والصناديق المشتركة</span>
          </div>
        </div>

        <MoneyCirclesManager />
      </div>
    )
  }

  // 2. Dedicated View for Work Hours Calculator
  if (activeTool === 'work_hours') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-slide-up">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E4E7] dark:border-[#27272A]">
          <button
            type="button"
            onClick={handleBackToDirectory}
            className="press-scale inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] text-xs sm:text-sm font-black text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/50 shadow-2xs dark:shadow-none cursor-pointer transition-all"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0" />
            <span>العودة إلى قائمة الأدوات</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full border border-[#E4E4E7] dark:border-[#27272A]">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>حاسبة الشراء بساعات العمل</span>
          </div>
        </div>

        <WorkHoursCalculator />
      </div>
    )
  }

  // 3. Main Tools Hub / Directory
  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-slide-up">
      <PageHeader
        title="مركز الأدوات المالية"
        subtitle="أدوات وحاسبات متخصصة للتخطيط المالي والقرارات اليومية"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tool 1: Money Circles */}
        <div
          data-tour="tools-circles"
          role="button"
          tabIndex={0}
          onClick={() => handleOpenTool('circles')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleOpenTool('circles')
            }
          }}
          className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-xs dark:shadow-none hover:border-blue-500/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 flex items-center justify-center shrink-0 transition-colors">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                الجمعيات والصناديق المشتركة
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                إدارة الأدوار والأقساط الشهرية
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
            <span className="group-hover:underline">فتح أداة الجمعيات</span>
            <ChevronLeft className="w-4 h-4 rtl:rotate-0 group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Tool 2: Work Hours Calculator */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleOpenTool('work_hours')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleOpenTool('work_hours')
            }
          }}
          className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-xs dark:shadow-none hover:border-blue-500/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 flex items-center justify-center shrink-0 transition-colors">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                تكلفة الشراء بساعات العمل
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                تقييم المشتريات بساعات عملك وأثرها المالي
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
            <span className="group-hover:underline">فتح حاسبة ساعات العمل</span>
            <ChevronLeft className="w-4 h-4 rtl:rotate-0 group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  )
}
