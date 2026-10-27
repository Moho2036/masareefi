import React, { useState, useMemo, useEffect } from 'react'
import {
  Clock,
  Briefcase,
  ShoppingBag,
  Percent,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { TransactionForm } from '../TransactionForm'
import { useCurrency } from '../../hooks/useCurrency'
import { useRecurring } from '../../hooks/useRecurring'
import { useTransactions } from '../../hooks/useTransactions'
import { useDebts } from '../../hooks/useDebts'
import { useUserSettings } from '../../hooks/useUserSettings'
import { toFils, fromFils } from '../../lib/money'
import { toWesternDigits, getFinancialMonthRange } from '../../lib/dates'
import { calculateForecast } from '../../lib/forecast'
import { calculateMonthlyEquivalent } from '../../lib/recurring'
import { cn } from '../../lib/cn'
import {
  clampWorkHoursPerDay,
  clampWorkDaysPerWeek,
  clampWorkDaysPerMonth,
  parseNumeric,
} from '../../lib/workHours'

const STORAGE_KEY = 'baseer_work_hours_prefs'
const LEGACY_STORAGE_KEY = 'masareefi_work_hours_prefs'

interface BenchmarkExample {
  coffee: number
  dinner: number
  shoes: number
  defaultSalary: string
  defaultItemPrice: string
}

function getCurrencyBenchmarks(currencyCode: string): BenchmarkExample {
  switch (currencyCode) {
    case 'SAR':
    case 'AED':
    case 'QAR':
      return { coffee: 15, dinner: 100, shoes: 300, defaultSalary: '5000', defaultItemPrice: '1500' }
    case 'EGP':
      return { coffee: 80, dinner: 500, shoes: 1800, defaultSalary: '15000', defaultItemPrice: '6000' }
    case 'USD':
    case 'EUR':
    case 'GBP':
      return { coffee: 5, dinner: 35, shoes: 100, defaultSalary: '3000', defaultItemPrice: '500' }
    case 'KWD':
      return { coffee: 1.5, dinner: 10, shoes: 30, defaultSalary: '500', defaultItemPrice: '250' }
    case 'BHD':
    case 'OMR':
      return { coffee: 2, dinner: 15, shoes: 40, defaultSalary: '500', defaultItemPrice: '250' }
    case 'JOD':
    default:
      return { coffee: 3.5, dinner: 25, shoes: 75, defaultSalary: '500', defaultItemPrice: '250' }
  }
}

interface StoredWorkHoursPrefs {
  currencyCode?: string
  salary?: string
  isCustomSalary?: boolean
  itemPrice?: string
  isCustomItemPrice?: boolean
  dailyHours?: string
  workDays?: string
  workDaysMode?: 'month' | 'week'
  itemName?: string
}

function loadStoredPrefs(currencyCode: string): {
  salary: string
  isCustomSalary: boolean
  itemPrice: string
  isCustomItemPrice: boolean
  dailyHours: string
  workDays: string
  workDaysMode: 'month' | 'week'
  itemName: string
  hasInteracted: boolean
} {
  const benchmarks = getCurrencyBenchmarks(currencyCode)
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      const parsed: StoredWorkHoursPrefs = JSON.parse(raw)
      const storedCurr = parsed.currencyCode || 'JOD'
      const prevBenchmarks = getCurrencyBenchmarks(storedCurr)

      let isCustomSalary = Boolean(parsed.isCustomSalary)
      if (parsed.isCustomSalary === undefined) {
        if (parsed.salary && parsed.salary !== prevBenchmarks.defaultSalary && parsed.salary !== '500') {
          isCustomSalary = true
        } else {
          isCustomSalary = false
        }
      }

      let isCustomItemPrice = Boolean(parsed.isCustomItemPrice)
      if (parsed.isCustomItemPrice === undefined) {
        if (parsed.itemPrice && parsed.itemPrice !== prevBenchmarks.defaultItemPrice && parsed.itemPrice !== '250') {
          isCustomItemPrice = true
        } else {
          isCustomItemPrice = false
        }
      }

      const salary = (currencyCode !== storedCurr && !isCustomSalary)
        ? benchmarks.defaultSalary
        : isCustomSalary
          ? String(parsed.salary || benchmarks.defaultSalary)
          : benchmarks.defaultSalary

      const itemPrice = (currencyCode !== storedCurr && !isCustomItemPrice)
        ? benchmarks.defaultItemPrice
        : isCustomItemPrice
          ? String(parsed.itemPrice || benchmarks.defaultItemPrice)
          : benchmarks.defaultItemPrice

      return {
        salary,
        isCustomSalary,
        itemPrice,
        isCustomItemPrice,
        dailyHours: parsed.dailyHours ? String(parsed.dailyHours) : '8',
        workDays: parsed.workDays ? String(parsed.workDays) : '22',
        workDaysMode: parsed.workDaysMode === 'week' ? 'week' : 'month',
        itemName: parsed.itemName ? String(parsed.itemName) : 'هاتف ذكي',
        hasInteracted: Boolean(isCustomSalary || isCustomItemPrice || parsed.dailyHours || parsed.workDays || parsed.workDaysMode),
      }
    }
  } catch {
    // ignore
  }

  return {
    salary: benchmarks.defaultSalary,
    isCustomSalary: false,
    itemPrice: benchmarks.defaultItemPrice,
    isCustomItemPrice: false,
    dailyHours: '8',
    workDays: '22',
    workDaysMode: 'month',
    itemName: 'هاتف ذكي',
    hasInteracted: false,
  }
}

export interface WorkHoursCalculatorProps {
  initialWorkDaysMode?: 'month' | 'week'
}

export const WorkHoursCalculator: React.FC<WorkHoursCalculatorProps> = ({
  initialWorkDaysMode,
}) => {
  const { format, config } = useCurrency()
  const benchmarks = useMemo(() => getCurrencyBenchmarks(config.code), [config.code])

  const initialPrefs = useMemo(() => loadStoredPrefs(config.code), [config.code])

  const [salaryStr, setSalaryStr] = useState<string>(initialPrefs.salary)
  const [isCustomSalary, setIsCustomSalary] = useState<boolean>(initialPrefs.isCustomSalary)

  const [dailyHoursStr, setDailyHoursStr] = useState<string>(initialPrefs.dailyHours)
  const [workDaysMode, setWorkDaysMode] = useState<'month' | 'week'>(
    initialWorkDaysMode || initialPrefs.workDaysMode || 'month'
  )
  const [workDaysStr, setWorkDaysStr] = useState<string>(
    initialWorkDaysMode === 'week' && initialPrefs.workDays === '22' ? '5' : initialPrefs.workDays
  )

  const [itemName, setItemName] = useState<string>(initialPrefs.itemName)
  const [itemPriceStr, setItemPriceStr] = useState<string>(initialPrefs.itemPrice)
  const [isCustomItemPrice, setIsCustomItemPrice] = useState<boolean>(initialPrefs.isCustomItemPrice)

  const [hasInteracted, setHasInteracted] = useState<boolean>(initialPrefs.hasInteracted)

  const { data: settings } = useUserSettings()
  const { data: recurringItems } = useRecurring()
  const { data: debts } = useDebts()
  const monthRange = useMemo(() => {
    return getFinancialMonthRange(new Date(), settings?.monthStartDay ?? 1)
  }, [settings?.monthStartDay])
  const { data: currentMonthTransactions } = useTransactions(monthRange)

  // Auto-detect monthly salary from active recurring rules or salary transactions if not customized
  useEffect(() => {
    if (isCustomSalary) return

    let candidateFils = 0

    // 1. Check active income recurring rules
    const activeIncomeRec = recurringItems.filter((r) => r.active && r.type === 'income')
    if (activeIncomeRec.length > 0) {
      const salaryRec = activeIncomeRec.find(
        (r) =>
          (r.title && /راتب|salary/i.test(r.title)) ||
          (r.note && /راتب|salary/i.test(r.note))
      )
      if (salaryRec) {
        candidateFils = salaryRec.amountFils
      } else {
        const stats = calculateMonthlyEquivalent(activeIncomeRec, new Date())
        candidateFils = stats.monthlyIncome
      }
    }

    // 2. Check income transactions
    if (candidateFils <= 0 && currentMonthTransactions.length > 0) {
      const salaryTx = currentMonthTransactions.find(
        (t) =>
          t.type === 'income' &&
          ((t.title && /راتب|salary/i.test(t.title)) || (t.note && /راتب|salary/i.test(t.note)))
      )
      if (salaryTx) {
        candidateFils = salaryTx.amountFils
      }
    }

    if (candidateFils > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSalaryStr(String(fromFils(candidateFils)))
    }
  }, [isCustomSalary, recurringItems, currentMonthTransactions])

  // Current Month Forecast for Purchasing Decision Insight
  const forecast = useMemo(() => {
    return calculateForecast({
      transactions: currentMonthTransactions,
      recurring: recurringItems,
      debts,
      monthStartDay: settings?.monthStartDay ?? 1,
      referenceDate: new Date(),
    })
  }, [currentMonthTransactions, recurringItems, debts, settings?.monthStartDay])

  const [isTxModalOpen, setIsTxModalOpen] = useState(false)

  // When currency changes, if user hasn't customized salary or price, update to new currency defaults
  const [prevCurrencyCode, setPrevCurrencyCode] = useState(config.code)
  if (config.code !== prevCurrencyCode) {
    setPrevCurrencyCode(config.code)
    if (!isCustomSalary) {
      setSalaryStr(benchmarks.defaultSalary)
    }
    if (!isCustomItemPrice) {
      setItemPriceStr(benchmarks.defaultItemPrice)
    }
  }

  // Only auto-save preferences to localStorage when user has actually interacted or customized values
  useEffect(() => {
    if (hasInteracted || isCustomSalary || isCustomItemPrice) {
      try {
        const payload = JSON.stringify({
          currencyCode: config.code,
          salary: salaryStr,
          isCustomSalary,
          itemPrice: itemPriceStr,
          isCustomItemPrice,
          dailyHours: dailyHoursStr,
          workDays: workDaysStr,
          workDaysMode,
          itemName,
        })
        localStorage.setItem(STORAGE_KEY, payload)
        localStorage.setItem(LEGACY_STORAGE_KEY, payload)
      } catch {
        // ignore
      }
    }
  }, [
    config.code,
    salaryStr,
    isCustomSalary,
    itemPriceStr,
    isCustomItemPrice,
    dailyHoursStr,
    workDaysStr,
    workDaysMode,
    itemName,
    hasInteracted,
  ])

  const handleDailyHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = toWesternDigits(e.target.value)
    const num = parseNumeric(raw)
    if (num > 24) {
      setDailyHoursStr('24')
    } else {
      setDailyHoursStr(raw)
    }
    setHasInteracted(true)
  }

  const handleWorkDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = toWesternDigits(e.target.value)
    const num = parseNumeric(raw)
    const max = workDaysMode === 'week' ? 7 : 31
    if (num > max) {
      setWorkDaysStr(String(max))
    } else {
      setWorkDaysStr(raw)
    }
    setHasInteracted(true)
  }

  // Calculations
  const salary = parseNumeric(salaryStr)
  const rawDailyHours = parseNumeric(dailyHoursStr)
  const dailyHours = rawDailyHours > 0 ? clampWorkHoursPerDay(rawDailyHours) : 8

  const rawWorkDays = parseNumeric(workDaysStr)
  const workDays =
    workDaysMode === 'week'
      ? (rawWorkDays > 0 ? clampWorkDaysPerWeek(rawWorkDays) : 5) * (52 / 12)
      : (rawWorkDays > 0 ? clampWorkDaysPerMonth(rawWorkDays) : 22)
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
    if (salary <= 0 || itemPrice <= 0) return 'none'
    if (requiredHours <= 4) return 'light'
    if (requiredHours <= 24) return 'medium'
    return 'heavy'
  }, [salary, itemPrice, requiredHours])

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
                  onChange={(e) => {
                    setSalaryStr(toWesternDigits(e.target.value))
                    setIsCustomSalary(true)
                    setHasInteracted(true)
                  }}
                  startIcon={<Briefcase className="w-4 h-4 text-slate-400" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="ساعات الدوام / يوم"
                  type="text"
                  inputMode="decimal"
                  value={dailyHoursStr}
                  onChange={handleDailyHoursChange}
                  startIcon={<Clock className="w-4 h-4 text-slate-400" />}
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="work-days-input"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {workDaysMode === 'week' ? 'أيام العمل في الأسبوع' : 'أيام العمل / شهر'}
                    </label>
                    <div className="flex items-center bg-slate-200/70 dark:bg-slate-700 p-0.5 rounded-lg text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setWorkDaysMode('month')
                          setWorkDaysStr('22')
                          setHasInteracted(true)
                        }}
                        className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                          workDaysMode === 'month'
                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
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
                            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
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
                onChange={(e) => {
                  setItemName(e.target.value)
                  setHasInteracted(true)
                }}
                startIcon={<ShoppingBag className="w-4 h-4 text-slate-400" />}
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
                    impactTier === 'none' &&
                      'bg-slate-100 dark:bg-slate-750 text-slate-500 dark:text-slate-400',
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
                      impactTier === 'none' && 'bg-slate-400',
                      impactTier === 'light' && 'bg-emerald-500',
                      impactTier === 'medium' && 'bg-amber-500',
                      impactTier === 'heavy' && 'bg-rose-500'
                    )}
                  />
                  <span>
                    {impactTier === 'none' && 'بانتظار البيانات'}
                    {impactTier === 'light' && 'عبء خفيف'}
                    {impactTier === 'medium' && 'عبء متوسط'}
                    {impactTier === 'heavy' && 'عبء مرتفع'}
                  </span>
                </span>
              </div>

              {/* Main hours counter */}
              {salary <= 0 || itemPrice <= 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    يرجى إدخال راتب شهري وسعر سلعة أكبر من الصفر لاحتساب ساعات العمل المطلوبة
                  </p>
                </div>
              ) : (
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
              )}

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
                    setItemPriceStr(String(benchmarks.coffee))
                    setIsCustomItemPrice(true)
                    setHasInteracted(true)
                  }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-750 text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-750 text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
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
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-750 text-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  حذاء ({benchmarks.shoes} {config.symbol})
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Purchasing Decision Insight Card */}
      {itemPrice > 0 && (
        <Card
          title="بصيرة القرار الشرائي على ميزانية هذا الشهر"
          subtitle="تحليل مباشر لأثر هذا الشراء على سيولتك وحد صرفك اليومي الآمن"
          className="border border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10"
        >
          <div className="space-y-4 pt-1">
            {/* Status Alert Banner */}
            {forecast.freeBalance <= 0 ? (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block text-sm mb-0.5">
                    تحذير: لا يوجد رصيد حر متاح هذا الشهر ({format(forecast.freeBalance)})
                  </span>
                  <span>
                    ميزانيتك للشهر الحالي مستنفدة بالكامل أو في حالة عجز مالي. إتمام هذا الشراء سيزيد من العجز المرحّل للشهر القادم.
                  </span>
                </div>
              </div>
            ) : toFils(itemPrice, config.decimals) > forecast.freeBalance ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block text-sm mb-0.5">
                    تنبيه: سعر السلعة يتجاوز رصيدك الحر المتبقي!
                  </span>
                  <span>
                    سعر السلعة ({format(toFils(itemPrice, config.decimals))}) أكبر من رصيدك الحر المتبقي ({format(forecast.freeBalance)}) بمقدار {format(toFils(itemPrice, config.decimals) - forecast.freeBalance)}.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 text-emerald-800 dark:text-emerald-200 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block text-sm mb-0.5">
                    قرار شراء آمن ضمن حدود رصيدك المتاح
                  </span>
                  <span>
                    سعر السلعة يقع بالكامل ضمن رصيدك الحر المتبقي لهذا الشهر ({format(forecast.freeBalance)}).
                  </span>
                </div>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">
                  نسبة الاستهلاك من الرصيد الحر
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {forecast.freeBalance > 0
                    ? `%${((toFils(itemPrice, config.decimals) / forecast.freeBalance) * 100).toFixed(1)}`
                    : '100%+ (عجز)'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  الرصيد الحر الحالي: {format(forecast.freeBalance)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">
                  الأثر على حد الصرف اليومي
                </span>
                <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                  - {format(Math.round(toFils(itemPrice, config.decimals) / Math.max(1, forecast.remainingDays)))} / يوم
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ينخفض من {format(forecast.dailySafeFils)} إلى {format(Math.max(0, forecast.dailySafeFils - Math.round(toFils(itemPrice, config.decimals) / Math.max(1, forecast.remainingDays))))}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">
                  الأيام المتبقية في الشهر المالي
                </span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {forecast.remainingDays} يوم
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  حتى موعد تجدد الدورة المالية
                </span>
              </div>
            </div>

            {/* Quick Record Action */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-emerald-100 dark:border-emerald-900/30">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                اتخذت قرارك النهائي بشراء هذه السلعة؟
              </span>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setIsTxModalOpen(true)}
                icon={<ShoppingBag className="w-4 h-4" />}
              >
                قررت شراءها؟ سجّلها كمصروف الآن
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Add Expense Modal */}
      {isTxModalOpen && (
        <TransactionForm
          initialType="expense"
          duplicateFrom={{
            id: '',
            type: 'expense',
            amountFils: toFils(itemPrice, config.decimals),
            title: itemName || 'مشتريات جديدة',
            note: `شراء ${itemName || 'سلعة'} (محسوبة من حاسبة ساعات العمل)`,
            categoryId: '',
            date: new Date(),
            createdAt: new Date(),
          }}
          onClose={() => setIsTxModalOpen(false)}
          onSuccess={() => setIsTxModalOpen(false)}
        />
      )}
    </div>
  )
}
