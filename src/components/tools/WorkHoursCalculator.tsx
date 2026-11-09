import React, { useState, useMemo, useEffect, useContext } from 'react'
import {
  Clock,
  Briefcase,
  ShoppingBag,
  Percent,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { FormattedMoney } from '../ui/FormattedMoney'
import { TransactionForm } from '../TransactionForm'
import { useCurrency } from '../../hooks/useCurrency'
import { useRecurring } from '../../hooks/useRecurring'
import { useTransactions } from '../../hooks/useTransactions'
import { useDebts } from '../../hooks/useDebts'
import { useMoneyCircles } from '../../hooks/useMoneyCircles'
import { useUserSettings } from '../../hooks/useUserSettings'
import { AppDataContext } from '../../context/AppDataContext'
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
  const { config } = useCurrency()
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
  const [isSalaryExpanded, setIsSalaryExpanded] = useState(false)

  const { data: settings } = useUserSettings()
  const appData = useContext(AppDataContext)
  const { data: recurringItems } = useRecurring()
  const { data: debts } = useDebts()
  const { data: circles } = useMoneyCircles()
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
    const isRolloverEnabled = settings?.rolloverBalance ?? true
    const openingFils = settings?.openingBalanceFils ?? 0
    const hasRolloverOrOpening = isRolloverEnabled || openingFils > 0
    return calculateForecast({
      transactions: currentMonthTransactions,
      recurring: recurringItems,
      debts,
      circles,
      monthStartDay: settings?.monthStartDay ?? 1,
      rolloverBalanceFils: hasRolloverOrOpening ? (appData?.rolloverBalanceFils ?? openingFils) : undefined,
      referenceDate: new Date(),
    })
  }, [
    currentMonthTransactions,
    recurringItems,
    debts,
    circles,
    settings?.monthStartDay,
    settings?.rolloverBalance,
    settings?.openingBalanceFils,
    appData?.rolloverBalanceFils,
  ])

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
    const salaryFils = toFils(salary, config.decimals)
    return Math.round(salaryFils / totalMonthlyHours)
  }, [salary, totalMonthlyHours, config.decimals])

  // Required hours of life to purchase item
  const requiredHours = useMemo(() => {
    if (hourlyWageFils <= 0 || itemPrice <= 0) return 0
    const itemPriceFils = toFils(itemPrice, config.decimals)
    return itemPriceFils / hourlyWageFils
  }, [hourlyWageFils, itemPrice, config.decimals])

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

  const itemPriceFils = toFils(itemPrice, config.decimals)
  const newFreeBalance = forecast.freeBalance - itemPriceFils
  const newDailySafeFils =
    forecast.remainingDays > 0 && newFreeBalance > 0
      ? Math.floor(newFreeBalance / forecast.remainingDays)
      : 0
  const dailySafeDropFils = Math.max(0, forecast.dailySafeFils - newDailySafeFils)
  const itemDailyBurdenFils = Math.round(itemPriceFils / Math.max(1, forecast.remainingDays))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Work Settings & Item Input */}
        <div className="lg:col-span-5 space-y-5">
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

        {/* Right Column: Visual Result Card */}
        <div className="lg:col-span-7">
          <Card className="h-full flex flex-col justify-between border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-2xs dark:shadow-none">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-zinc-400">التكلفة الفعلية للشراء</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full',
                    impactTier === 'none' &&
                      'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
                    impactTier === 'light' &&
                      'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
                    impactTier === 'medium' &&
                      'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
                    impactTier === 'heavy' &&
                      'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      impactTier === 'none' && 'bg-zinc-400',
                      impactTier === 'light' && 'bg-blue-500',
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
                <div className="py-6 text-center space-y-2">
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    يرجى إدخال راتب شهري وسعر سلعة أكبر من الصفر لاحتساب ساعات العمل المطلوبة
                  </p>
                </div>
              ) : (
                <div className="py-1 text-center space-y-1.5">
                  <p className="text-xs font-semibold text-zinc-400">
                    لشراء <span className="font-bold text-zinc-700 dark:text-zinc-200">"{itemName || 'هذه السلعة'}"</span> بسعر <FormattedMoney amountFils={toFils(itemPrice, config.decimals)} maskAmount={false} />، تحتاج إلى:
                  </p>

                  <div className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white select-none tracking-tight">
                    {fullHours}{' '}
                    <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ساعة
                    </span>
                    {remainingMinutes > 0 && (
                      <span className="text-2xl sm:text-3xl font-extrabold text-zinc-400 ms-2">
                        و {remainingMinutes} دقيقة
                      </span>
                    )}
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5 pt-1">
                    <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>
                      ما يعادل تقريباً{' '}
                      <strong className="text-blue-600 dark:text-blue-400 font-black">
                        {equivalentWorkDays}
                      </strong>{' '}
                      يوم دوام عملي
                    </span>
                  </div>
                </div>
              )}

              {/* Direct Metric: Percent of Monthly Salary */}
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">من الراتب الشهري:</span>
                </div>
                <span className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                  %{salaryPercent}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Purchasing Decision Insight Card */}
      {itemPrice > 0 && (
        <Card
          title="بصيرة القرار الشرائي على ميزانية هذا الشهر"
          className="border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-2xs dark:shadow-none"
        >
          <div className="space-y-3.5 pt-1">
            {/* Status Alert Banner */}
            {forecast.freeBalance <= 0 ? (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5">
                    تحذير: لا يوجد رصيد حر متاح هذا الشهر (<FormattedMoney amountFils={forecast.freeBalance} />)
                  </span>
                  <span className="text-[11px] leading-relaxed">
                    ميزانيتك للشهر الحالي مستنفدة بالكامل أو في حالة عجز مالي. إتمام هذا الشراء سيزيد من العجز المرحّل للشهر القادم.
                  </span>
                </div>
              </div>
            ) : toFils(itemPrice, config.decimals) > forecast.freeBalance ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5">
                    تنبيه: سعر السلعة يتجاوز رصيدك الحر المتبقي!
                  </span>
                  <span className="text-[11px] leading-relaxed">
                    سعر السلعة (<FormattedMoney amountFils={toFils(itemPrice, config.decimals)} />) أكبر من رصيدك الحر المتبقي (<FormattedMoney amountFils={forecast.freeBalance} />) بمقدار <FormattedMoney amountFils={toFils(itemPrice, config.decimals) - forecast.freeBalance} />.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-start gap-3 text-zinc-800 dark:text-zinc-200 text-xs">
                <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-0.5 text-blue-600 dark:text-blue-400">
                    قرار شراء آمن ضمن حدود رصيدك المتاح
                  </span>
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    سعر السلعة يقع بالكامل ضمن رصيدك الحر المتبقي لهذا الشهر (<FormattedMoney amountFils={forecast.freeBalance} />).
                  </span>
                </div>
              </div>
            )}

            {/* Metrics Grid: responsive on mobile to prevent truncation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 block mb-1">
                    نسبة الاستهلاك من الرصيد الحر
                  </span>
                  <span className="text-base sm:text-xl font-black text-zinc-900 dark:text-white">
                    {forecast.freeBalance <= 0
                      ? '100%+ (عجز)'
                      : toFils(itemPrice, config.decimals) > forecast.freeBalance
                        ? '100%+ (يتجاوز المتاح)'
                        : `${((toFils(itemPrice, config.decimals) / forecast.freeBalance) * 100).toFixed(1)}%`}
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-zinc-400 block mt-1">
                  الرصيد الحر الحالي: <FormattedMoney amountFils={forecast.freeBalance} />
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 block mb-1">
                    الأثر على حد الصرف اليومي
                  </span>
                  <span className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400">
                    - <FormattedMoney amountFils={forecast.dailySafeFils > 0 && newFreeBalance >= 0 ? dailySafeDropFils : itemDailyBurdenFils} maskAmount={false} /> / يوم
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-zinc-400 block mt-1">
                  {forecast.dailySafeFils > 0 && newFreeBalance >= 0 ? (
                    <>
                      ينخفض من <FormattedMoney amountFils={forecast.dailySafeFils} /> إلى <FormattedMoney amountFils={newDailySafeFils} />
                    </>
                  ) : forecast.dailySafeFils > 0 ? (
                    <>
                      ينخفض للصفر (<FormattedMoney amountFils={0} />) مع عجز يومي بقيمة <FormattedMoney amountFils={itemDailyBurdenFils - forecast.dailySafeFils} maskAmount={false} />
                    </>
                  ) : (
                    <>
                      الحد الآمن الحالي <FormattedMoney amountFils={0} /> — تُضيف عبئاً يومياً بقيمة <FormattedMoney amountFils={itemDailyBurdenFils} maskAmount={false} />
                    </>
                  )}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 block mb-1">
                    الأيام المتبقية في الشهر المالي
                  </span>
                  <span className="text-base sm:text-xl font-black text-zinc-900 dark:text-white">
                    {forecast.remainingDays} يوم
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-zinc-400 block mt-1">
                  حتى موعد تجدد الدورة المالية
                </span>
              </div>
            </div>

            {/* Quick Record Action */}
            <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                اتخذت قرارك النهائي بشراء هذه السلعة؟
              </span>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setIsTxModalOpen(true)}
                icon={<ShoppingBag className="w-4 h-4" />}
              >
                تسجيل كمصروف الآن
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Add Expense Modal */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title="تسجيل مصروف السلعة"
      >
        {isTxModalOpen && (
          <TransactionForm
            initialType="expense"
            duplicateFrom={{
              id: '',
              type: 'expense',
              amountFils: itemPriceFils,
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
      </Modal>
    </div>
  )
}
