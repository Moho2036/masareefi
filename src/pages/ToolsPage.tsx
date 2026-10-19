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

type ToolKey = 'work_hours' | 'circles'

export const ToolsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawParam = searchParams.get('tool') || searchParams.get('tab')
  const activeTool: ToolKey | null =
    rawParam === 'circles' ? 'circles' : rawParam === 'work_hours' ? 'work_hours' : null

  const handleOpenTool = (tool: ToolKey) => {
    setSearchParams({ tool })
  }

  const handleBackToDirectory = () => {
    setSearchParams({})
  }

  // 1. Dedicated View for Money Circles
  if (activeTool === 'circles') {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-slide-up">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={handleBackToDirectory}
            className="press-scale inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 shadow-xs cursor-pointer transition-all"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0" />
            <span>العودة إلى قائمة الأدوات</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
            <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={handleBackToDirectory}
            className="press-scale inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/50 shadow-xs cursor-pointer transition-all"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0" />
            <span>العودة إلى قائمة الأدوات</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
        <div className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 shadow-xs hover:border-emerald-500/40 transition-all group">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 flex items-center justify-center shrink-0 transition-colors">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                الجمعيات والصناديق المشتركة
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                إدارة الصناديق المشتركة والأقساط الشهرية، تتبع ترتيب الأدوار والدفعات، وإعفاء شهر الاستلام تلقائياً من الالتزامات.
              </p>
            </div>
          </div>

          <div className="pt-5 mt-3 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handleOpenTool('circles')}
              className="press-scale w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow-xs cursor-pointer transition-colors"
            >
              <span>فتح أداة الجمعيات</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tool 2: Work Hours Calculator */}
        <div className="flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 shadow-xs hover:border-emerald-500/40 transition-all group">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 flex items-center justify-center shrink-0 transition-colors">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                تكلفة الشراء بساعات العمل
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
                تقييم المشتريات بمجهودك الفعلي بدلاً من الأرقام المجردة، بمعرفة عدد ساعات أو أيام العمل المطلوبة لشراء أي سلعة.
              </p>
            </div>
          </div>

          <div className="pt-5 mt-3 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handleOpenTool('work_hours')}
              className="press-scale w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm shadow-xs cursor-pointer transition-colors"
            >
              <span>فتح حاسبة ساعات العمل</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
