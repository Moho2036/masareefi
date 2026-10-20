import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SafeDailySpendCard } from './SafeDailySpendCard'
import type { ForecastResult } from '../../lib/forecast'

describe('SafeDailySpendCard Component', () => {
  const baseForecast: ForecastResult = {
    startDate: new Date(2026, 9, 1),
    endDate: new Date(2026, 10, 1),
    totalDays: 31,
    elapsedDays: 15,
    remainingDays: 16,
    isCurrentMonth: true,
    isPastMonth: false,
    isFutureMonth: false,

    currentIncome: 600000,
    currentExpense: 150000,
    monthNet: 450000,
    rolloverBalance: 0,
    availableBalance: 450000,
    availablePool: 600000,
    upcomingRecurringExpenses: 0,
    upcomingRecurringIncome: 0,
    upcomingDebtObligations: 0,
    freeBalance: 450000,

    dailySafeFils: 28125,
    actualDailySpendFils: 10000,
    healthStatus: 'safe',

    projectedExpense: 310000,
    projectedNet: 290000,
    isDeficitProjected: false,
    deficitAmount: 0,
    surplusAmount: 290000,
    recommendedDailyReductionFils: 0,
  }

  it('renders active current month with remaining days and daily safe spend', () => {
    render(<SafeDailySpendCard forecast={baseForecast} />)

    expect(screen.getByText('ميزانية الأمان اليومي وتوقّع الشهر')).toBeInTheDocument()
    expect(screen.getByText(/متبقي 16 يوماً في الدورة/)).toBeInTheDocument()
    expect(screen.getByText('حد الصرف اليومي الآمن')).toBeInTheDocument()
  })

  it('renders completed past month with surplus saved', () => {
    const pastForecast: ForecastResult = {
      ...baseForecast,
      isCurrentMonth: false,
      isPastMonth: true,
      isFutureMonth: false,
      remainingDays: 0,
      elapsedDays: 30,
      totalDays: 30,
      currentIncome: 800000,
      currentExpense: 500000,
      monthNet: 300000,
      surplusAmount: 300000,
      deficitAmount: 0,
    }

    render(<SafeDailySpendCard forecast={pastForecast} />)

    expect(screen.getByText('ميزانية وأداء الشهر المالي')).toBeInTheDocument()
    expect(screen.getByText(/هذا الشهر قد انتهى/)).toBeInTheDocument()
    expect(screen.getByText('صافي الوفر المحقق')).toBeInTheDocument()
    expect(screen.getByText('أداء مالي ناجح!')).toBeInTheDocument()
  })

  it('renders completed past month with financial deficit', () => {
    const pastDeficitForecast: ForecastResult = {
      ...baseForecast,
      isCurrentMonth: false,
      isPastMonth: true,
      isFutureMonth: false,
      remainingDays: 0,
      elapsedDays: 30,
      totalDays: 30,
      currentIncome: 400000,
      currentExpense: 550000,
      monthNet: -150000,
      surplusAmount: 0,
      deficitAmount: 150000,
      healthStatus: 'danger',
    }

    render(<SafeDailySpendCard forecast={pastDeficitForecast} />)

    expect(screen.getByText(/هذا الشهر قد انتهى/)).toBeInTheDocument()
    expect(screen.getByText('صافي العجز المالي')).toBeInTheDocument()
    expect(screen.getByText('تنبيه مالي:')).toBeInTheDocument()
  })

  it('renders future month with proposed daily spend across all days', () => {
    const futureForecast: ForecastResult = {
      ...baseForecast,
      isCurrentMonth: false,
      isPastMonth: false,
      isFutureMonth: true,
      remainingDays: 30,
      elapsedDays: 1,
      totalDays: 30,
      currentIncome: 0,
      currentExpense: 0,
      upcomingRecurringIncome: 600000,
      freeBalance: 600000,
      dailySafeFils: 20000,
    }

    render(<SafeDailySpendCard forecast={futureForecast} />)

    expect(screen.getByText('ميزانية وتوقّع الشهر القادم')).toBeInTheDocument()
    expect(screen.getByText(/شهر مستقبلي \(متبقي كامل الدورة 30 يوماً\)/)).toBeInTheDocument()
    expect(screen.getByText('حد الصرف اليومي المقترح')).toBeInTheDocument()
  })
})
