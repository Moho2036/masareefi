import React from 'react'
import { Coins } from 'lucide-react'
import { Toggle } from '../../ui/Toggle'

export interface OpeningBalanceStepProps {
  openingBalance: string
  setOpeningBalance: (val: string) => void
  addSalary: boolean
  setAddSalary: (val: boolean) => void
  salaryAmount: string
  setSalaryAmount: (val: string) => void
  monthStartDay: number
}

export const OpeningBalanceStep: React.FC<OpeningBalanceStepProps> = ({
  openingBalance,
  setOpeningBalance,
  addSalary,
  setAddSalary,
  salaryAmount,
  setSalaryAmount,
  monthStartDay,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <label htmlFor="onboarding-opening-balance" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
          الرصيد الافتتاحي الحالي (في محفظتك أو حسابك البنكي)
        </label>
        <div className="relative">
          <input
            id="onboarding-opening-balance"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0.00"
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
          />
          <Coins className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
          المبلغ النقدي المتوفر لديك لبدء التتبع به. لا يُسجل كدخل شهر، فلا يؤثر على معدل ادخارك السنوي.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              تسجيل الراتب الشهري المتكرر تلقائياً
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              إيداع الراتب آلياً كل شهر في يوم بداية دورتك المالية ({monthStartDay})
            </div>
          </div>
          <Toggle
            checked={addSalary}
            onChange={setAddSalary}
            id="onboarding-salary-toggle"
            label="تسجيل الراتب تلقائياً"
          />
        </div>

        {addSalary && (
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 animate-in fade-in duration-150">
            <label htmlFor="onboarding-salary-amount" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              قيمة الراتب الشهري
            </label>
            <input
              id="onboarding-salary-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={salaryAmount}
              onChange={(e) => setSalaryAmount(e.target.value)}
              placeholder="مثال: 750"
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            />
          </div>
        )}
      </div>
    </div>
  )
}
