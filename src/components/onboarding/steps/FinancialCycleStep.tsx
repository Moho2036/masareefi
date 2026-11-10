import React from 'react'
import { Toggle } from '../../ui/Toggle'

export interface FinancialCycleStepProps {
  monthStartDay: number
  setMonthStartDay: (val: number) => void
  rolloverBalance: boolean
  setRolloverBalance: (val: boolean) => void
}

export const FinancialCycleStep: React.FC<FinancialCycleStepProps> = ({
  monthStartDay,
  setMonthStartDay,
  rolloverBalance,
  setRolloverBalance,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="onboarding-start-day" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
            يوم بداية الدورة المالية (نزول الراتب)
          </label>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-black">
            يوم {monthStartDay} من كل شهر
          </span>
        </div>
        <input
          id="onboarding-start-day"
          type="range"
          min="1"
          max="28"
          value={monthStartDay}
          onChange={(e) => setMonthStartDay(Number(e.target.value))}
          className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2.5">
          {[1, 15, 25, 26, 27, 28].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setMonthStartDay(d)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center ${
                monthStartDay === d
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              يوم {d}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
          تبدأ جميع تقاريرك الشهرية وحسابات الصرف والحد اليومي الآمن من هذا اليوم (أقصى يوم هو 28 لضمان انتظام الحساب في شهر فبراير وكافة الأشهر).
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              ترحيل الرصيد التلقائي (Rollover)
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              نقل الفائض أو العجز إلى الدورة الشهرية التالية
            </div>
          </div>
          <Toggle
            checked={rolloverBalance}
            onChange={setRolloverBalance}
            id="onboarding-rollover-toggle"
            label="تفعيل ترحيل الرصيد"
          />
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2 leading-relaxed">
          عند تفعيل هذا الخيار، يتم ترحيل الفائض المالي المتبقي كسيولة إضافية في رصيد الشهر التالي، وحسم العجز لضمان عدم تجاوز ميزانيتك الواقعية.
        </p>
      </div>
    </div>
  )
}
