import React, { useState, useMemo, useEffect } from 'react'
import {
  Clock,
  Briefcase,
  ShoppingBag,
  Percent,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { useCurrency } from '../../hooks/useCurrency'
import { toFils } from '../../lib/money'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'

function parseNumeric(val: string): number {
  const western = toWesternDigits(val)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/,/g, '.')
    .trim()
  const parsed = parseFloat(western)
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed
}

const STORAGE_KEY = 'masareefi_work_hours_prefs'

export const WorkHoursCalculator: React.FC = () => {
  const { format, config } = useCurrency()

  // Salary & Work schedule preferences initialized from localStorage
  const [salaryStr, setSalaryStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.salary) return String(parsed.salary)
      }
    } catch {
      // ignore
    }
    return '500'
  })

  const [dailyHoursStr, setDailyHoursStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.dailyHours) return String(parsed.dailyHours)
      }
    } catch {
      // ignore
    }
    return '8'
  })

  const [workDaysStr, setWorkDaysStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.workDays) return String(parsed.workDays)
      }
    } catch {
      // ignore
    }
    return '22'
  })

  // Item to buy
  const [itemName, setItemName] = useState<string>('هاتف ذكي')
  const [itemPriceStr, setItemPriceStr] = useState<string>('250')

  // Auto-save preferences to localStorage without stale-state race conditions
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          salary: salaryStr,
          dailyHours: dailyHoursStr,
          workDays: workDaysStr,
        })
      )
    } catch {
      // ignore
    }
  }, [salaryStr, dailyHoursStr, workDaysStr])

  // Calculations
  const salary = parseNumeric(salaryStr)
  const dailyHours = parseNumeric(dailyHoursStr) || 8
  const workDays = parseNumeric(workDaysStr) || 22
  const itemPrice = parseNumeric(itemPriceStr)

  const totalMonthlyHours = useMemo(() => {
    return Math.max(1, dailyHours * workDays)
  }, [dailyHours, workDays])

  // Hourly wage in fils
  const hourlyWageFils = useMemo(() => {
    if (salary <= 0) return 0
    const salaryFils = toFils(salary)
    return Math.round(salaryFils / totalMonthlyHours)
  }, [salary, totalMonthlyHours])

  // Required hours of life to purchase item
  const requiredHours = useMemo(() => {
    if (hourlyWageFils <= 0 || itemPrice <= 0) return 0
    const itemPriceFils = toFils(itemPrice)
    return itemPriceFils / hourlyWageFils
  }, [hourlyWageFils, itemPrice])

  const totalMinutes = Math.round(requiredHours * 60)
  const fullHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const equivalentWorkDays = (requiredHours / Math.max(1, dailyHours)).toFixed(1)

  // Item percentage of monthly salary
  const salaryPercent = useMemo(() => {
    if (salary <= 0 || itemPrice <= 0) return '0'
    return ((itemPrice / salary) * 100).toFixed(1)
  }, [salary, itemPrice])

  // Psychological impact tier
  const impactTier = useMemo(() => {
    if (requiredHours <= 4) return 'light'
    if (requiredHours <= 24) return 'medium'
    return 'heavy'
  }, [requiredHours])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Work Settings & Item Input */}
        <div className="lg:col-span-5 space-y-5">
          {/* Work & Salary Card */}
          <Card title="بيانات العمل والراتب" subtitle="تُستخدم لاحتساب قيمتك بالساعة بدقة">
            <div className="space-y-3.5 pt-1">
              <div>
                <Input
                  label={`صافي راتبك الشهري (${config.symbol})`}
                  type="text"
                  inputMode="decimal"
                  value={salaryStr}
                  onChange={(e) => setSalaryStr(toWesternDigits(e.target.value))}
                  startIcon={<Briefcase className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="ساعات الدوام / يوم"
                  type="text"
                  inputMode="decimal"
                  value={dailyHoursStr}
                  onChange={(e) => setDailyHoursStr(toWesternDigits(e.target.value))}
                  startIcon={<Clock className="w-4 h-4 text-slate-400" />}
                />

                <Input
                  label="أيام العمل / شهر"
                  type="text"
                  inputMode="numeric"
                  value={workDaysStr}
                  onChange={(e) => setWorkDaysStr(toWesternDigits(e.target.value))}
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-750/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">صافي أجرك في الساعة الواحدة:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {format(hourlyWageFils)} / ساعة
                </span>
              </div>
            </div>
          </Card>

          {/* Item details */}
          <Card title="السلعة المراد شراؤها" subtitle="ما الشيء الذي تفكر في شرائه الآن؟">
            <div className="space-y-3.5 pt-1">
              <Input
                label="اسم السلعة أو الخدمة"
                placeholder="مثال: ساعة يد، وجبة فاخرة، جوال"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                startIcon={<ShoppingBag className="w-4 h-4 text-slate-400" />}
              />

              <Input
                label={`سعر السلعة (${config.symbol})`}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={itemPriceStr}
                onChange={(e) => setItemPriceStr(toWesternDigits(e.target.value))}
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Visual Result Card */}
        <div className="lg:col-span-7">
          <Card className="h-full flex flex-col justify-between border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400">التكلفة الفعلية للشراء</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full',
                    impactTier === 'light' &&
                      'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
                    impactTier === 'medium' &&
                      'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
                    impactTier === 'heavy' &&
                      'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      impactTier === 'light' && 'bg-emerald-500',
                      impactTier === 'medium' && 'bg-amber-500',
                      impactTier === 'heavy' && 'bg-rose-500'
                    )}
                  />
                  <span>
                    {impactTier === 'light' && 'عبء خفيف'}
                    {impactTier === 'medium' && 'عبء متوسط'}
                    {impactTier === 'heavy' && 'عبء مرتفع'}
                  </span>
                </span>
              </div>

              {/* Main hours counter */}
              <div className="py-2 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-400">
                  لشراء <span className="font-bold text-slate-700 dark:text-slate-200">"{itemName || 'هذه السلعة'}"</span> بسعر {format(toFils(itemPrice))}، تحتاج إلى:
                </p>

                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white select-none tracking-tight">
                  {fullHours}{' '}
                  <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    ساعة
                  </span>
                  {remainingMinutes > 0 && (
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-400 ms-2">
                      و {remainingMinutes} دقيقة
                    </span>
                  )}
                </div>

                <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 pt-1">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  <span>
                    ما يعادل تقريباً{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-black">
                      {equivalentWorkDays}
                    </strong>{' '}
                    يوم دوام عملي
                  </span>
                </div>
              </div>

              {/* Direct Metrics Breakdown */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-750/50 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">من الراتب الشهري</div>
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                        %{salaryPercent}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-750/50 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">أجرك في الساعة</div>
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {format(hourlyWageFils)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick comparison benchmarks */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4">
              <div className="text-[11px] font-bold text-slate-400 mb-2">أمثلة سريعة للمقارنة:</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setItemName('كوب قهوة')
                    setItemPriceStr('3.5')
                  }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-750 text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  قهوة (3.5)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemName('عشاء مطعم')
                    setItemPriceStr('25')
                  }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-750 text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  عشاء (25)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItemName('حذاء رياضي')
                    setItemPriceStr('75')
                  }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-750 text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  حذاء (75)
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
