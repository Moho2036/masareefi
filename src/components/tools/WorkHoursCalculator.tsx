import React, { useState, useMemo, useEffect, useContext } from 'react'
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
import {
  clampWorkHoursPerDay,
  normalizeMonthlyWorkingDays,
  calculateTotalMonthlyHours,
  calculateHourlyWageFils,
  calculateHoursRequired,
  calculateWorkTimeBreakdown,
  calculateSalaryPercentage,
  calculateWorkImpactTier,
  parseNumeric,
} from '../../lib/workHours'
import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  getCurrencyBenchmarks,
  loadStoredPrefs,
} from './workHours/workHoursPrefs'
import { WorkHoursInputsCard } from './workHours/WorkHoursInputsCard'
import { WorkHoursVisualResultCard } from './workHours/WorkHoursVisualResultCard'
import { WorkHoursDecisionInsightCard } from './workHours/WorkHoursDecisionInsightCard'

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
  const workDays = normalizeMonthlyWorkingDays(rawWorkDays, workDaysMode)
  const itemPrice = parseNumeric(itemPriceStr)

  const totalMonthlyHours = useMemo(() => {
    return calculateTotalMonthlyHours(dailyHours, workDays)
  }, [dailyHours, workDays])

  const hourlyWageFils = useMemo(() => {
    return calculateHourlyWageFils(salary, totalMonthlyHours, config.decimals)
  }, [salary, totalMonthlyHours, config.decimals])

  const requiredHours = useMemo(() => {
    return calculateHoursRequired(itemPrice, hourlyWageFils, config.decimals)
  }, [hourlyWageFils, itemPrice, config.decimals])

  const { fullHours, remainingMinutes, equivalentWorkDays } = useMemo(() => {
    return calculateWorkTimeBreakdown(requiredHours, dailyHours)
  }, [requiredHours, dailyHours])

  const salaryPercent = useMemo(() => {
    return calculateSalaryPercentage(itemPrice, salary)
  }, [salary, itemPrice])

  const impactTier = useMemo(() => {
    return calculateWorkImpactTier(salary, itemPrice, requiredHours)
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
          <WorkHoursInputsCard
            salaryStr={salaryStr}
            setSalaryStr={setSalaryStr}
            setIsCustomSalary={setIsCustomSalary}
            setHasInteracted={setHasInteracted}
            dailyHoursStr={dailyHoursStr}
            handleDailyHoursChange={handleDailyHoursChange}
            workDaysMode={workDaysMode}
            setWorkDaysMode={setWorkDaysMode}
            workDaysStr={workDaysStr}
            setWorkDaysStr={setWorkDaysStr}
            handleWorkDaysChange={handleWorkDaysChange}
            hourlyWageFils={hourlyWageFils}
            itemName={itemName}
            setItemName={setItemName}
            itemPriceStr={itemPriceStr}
            setItemPriceStr={setItemPriceStr}
            setIsCustomItemPrice={setIsCustomItemPrice}
            benchmarks={benchmarks}
            config={config}
            isSalaryExpanded={isSalaryExpanded}
            setIsSalaryExpanded={setIsSalaryExpanded}
          />
        </div>

        {/* Right Column: Visual Result Card */}
        <div className="lg:col-span-7">
          <WorkHoursVisualResultCard
            salary={salary}
            itemPrice={itemPrice}
            itemName={itemName}
            config={config}
            impactTier={impactTier}
            fullHours={fullHours}
            remainingMinutes={remainingMinutes}
            equivalentWorkDays={equivalentWorkDays}
            salaryPercent={salaryPercent}
          />
        </div>
      </div>

      {/* Purchasing Decision Insight Card */}
      <WorkHoursDecisionInsightCard
        itemPrice={itemPrice}
        itemPriceFils={itemPriceFils}
        itemName={itemName}
        config={config}
        forecast={forecast}
        newFreeBalance={newFreeBalance}
        newDailySafeFils={newDailySafeFils}
        dailySafeDropFils={dailySafeDropFils}
        itemDailyBurdenFils={itemDailyBurdenFils}
      />
    </div>
  )
}
