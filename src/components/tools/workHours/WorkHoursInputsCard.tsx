import React from 'react'
import {
  Clock,
  Briefcase,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { Input } from '../../ui/Input'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { toWesternDigits } from '../../../lib/dates'
import { cn } from '../../../lib/cn'
import type { BenchmarkExample } from './workHoursPrefs'

export interface WorkHoursInputsCardProps {
  salaryStr: string
  setSalaryStr: (val: string) => void
  setIsCustomSalary: (val: boolean) => void
  setHasInteracted: (val: boolean) => void
  dailyHoursStr: string
  handleDailyHoursChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  workDaysMode: 'month' | 'week'
  setWorkDaysMode: (mode: 'month' | 'week') => void
  workDaysStr: string
  setWorkDaysStr: (val: string) => void
  handleWorkDaysChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  hourlyWageFils: number
  itemName: string
  setItemName: (val: string) => void
  itemPriceStr: string
  setItemPriceStr: (val: string) => void
  setIsCustomItemPrice: (val: boolean) => void
  benchmarks: BenchmarkExample
  config: { code: string; symbol: string }
  isSalaryExpanded: boolean
  setIsSalaryExpanded: React.Dispatch<React.SetStateAction<boolean>>
}

export const WorkHoursInputsCard: React.FC<WorkHoursInputsCardProps> = ({
  salaryStr,
  setSalaryStr,
  setIsCustomSalary,
  setHasInteracted,
  dailyHoursStr,
  handleDailyHoursChange,
  workDaysMode,
  setWorkDaysMode,
  workDaysStr,
  setWorkDaysStr,
  handleWorkDaysChange,
  hourlyWageFils,
  itemName,
  setItemName,
  itemPriceStr,
  setItemPriceStr,
  setIsCustomItemPrice,
  benchmarks,
  config,
  isSalaryExpanded,
  setIsSalaryExpanded,
}) => {
  return (
    <div className="space-y-5">
      {/* Work & Salary Card */}
      <Card title="بيانات العمل والراتب">
        {/* Mobile Compact Summary Bar */}
        <div className="lg:hidden flex items-center justify-between gap-2 pb-2 text-xs border-b border-zinc-100 dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-300 font-medium truncate">
            <span>
              الراتب: {salaryStr || '0'} {config.symbol} • أجر الساعة:{' '}
            </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              <FormattedMoney amountFils={hourlyWageFils} maskAmount={false} />
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSalaryExpanded((prev) => !prev)}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer py-0.5 px-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40"
          >
            <span>تعديل</span>
            {isSalaryExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className={cn('space-y-3 pt-1', !isSalaryExpanded && 'hidden lg:block')}>
          <div>
            <Input
              label={`صافي راتبك الشهري (${config.symbol})`}
              type="text"
              inputMode="decimal"
              value={salaryStr}
              onChange={(e) => {
                setSalaryStr(toWesternDigits(e.target.value))
                setIsCustomSalary(true)
                setHasInteracted(true)
              }}
              startIcon={<Briefcase className="w-4 h-4 text-zinc-400" />}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="ساعات الدوام / يوم"
              type="text"
              inputMode="decimal"
              value={dailyHoursStr}
              onChange={handleDailyHoursChange}
              startIcon={<Clock className="w-4 h-4 text-zinc-400" />}
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="work-days-input"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {workDaysMode === 'week' ? 'أيام العمل في الأسبوع' : 'أيام العمل / شهر'}
                </label>
                <div className="flex items-center bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkDaysMode('month')
                      setWorkDaysStr('22')
                      setHasInteracted(true)
                    }}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                      workDaysMode === 'month'
                        ? 'bg-white dark:bg-[#121215] text-blue-600 dark:text-blue-400 shadow-2xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                  >
                    شهرياً
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkDaysMode('week')
                      setWorkDaysStr('5')
                      setHasInteracted(true)
                    }}
                    className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                      workDaysMode === 'week'
                        ? 'bg-white dark:bg-[#121215] text-blue-600 dark:text-blue-400 shadow-2xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                  >
                    أسبوعياً
                  </button>
                </div>
              </div>
              <Input
                id="work-days-input"
                type="text"
                inputMode="numeric"
                value={workDaysStr}
                onChange={handleWorkDaysChange}
                aria-label={workDaysMode === 'week' ? 'أيام العمل في الأسبوع' : 'أيام العمل / شهر'}
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-medium">صافي أجرك في الساعة الواحدة:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              <FormattedMoney amountFils={hourlyWageFils} maskAmount={false} /> / ساعة
            </span>
          </div>
        </div>
      </Card>

      {/* Item details */}
      <Card title="السلعة المراد شراؤها">
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="اسم السلعة أو الخدمة"
              placeholder="مثال: ساعة يد، وجبة فاخرة، جوال"
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value)
                setHasInteracted(true)
              }}
              startIcon={<ShoppingBag className="w-4 h-4 text-zinc-400" />}
            />

            <Input
              label={`سعر السلعة (${config.symbol})`}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={itemPriceStr}
              onChange={(e) => {
                setItemPriceStr(toWesternDigits(e.target.value))
                setIsCustomItemPrice(true)
                setHasInteracted(true)
              }}
            />
          </div>

          {/* Quick comparison benchmarks */}
          <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
            <div className="text-[11px] font-bold text-zinc-400 mb-1.5">أمثلة سريعة للمقارنة:</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setItemName('كوب قهوة')
                  setItemPriceStr(String(benchmarks.coffee))
                  setIsCustomItemPrice(true)
                  setHasInteracted(true)
                }}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                قهوة ({benchmarks.coffee} {config.symbol})
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemName('عشاء مطعم')
                  setItemPriceStr(String(benchmarks.dinner))
                  setIsCustomItemPrice(true)
                  setHasInteracted(true)
                }}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                عشاء ({benchmarks.dinner} {config.symbol})
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemName('حذاء رياضي')
                  setItemPriceStr(String(benchmarks.shoes))
                  setIsCustomItemPrice(true)
                  setHasInteracted(true)
                }}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                حذاء ({benchmarks.shoes} {config.symbol})
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
