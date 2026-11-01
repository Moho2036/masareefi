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
      rolloverBalance: 0,
      availableBalance: 300000,
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
      rolloverBalance: 0,
      availableBalance: -150000,
      surplusAmount: 0,
      deficitAmount: 150000,
      healthStatus: 'danger',
    }

    render(<SafeDailySpendCard forecast={pastDeficitForecast} />)

    expect(screen.getByText(/هذا الشهر قد انتهى/)).toBeInTheDocument()
    expect(screen.getByText('صافي العجز المالي')).toBeInTheDocument()
    expect(screen.getByText('تنبيه مالي:')).toBeInTheDocument()
  })

  it('renders completed past month with rolloverBalance > 0 covering month deficit as ending surplus', () => {
    const pastRolloverSurplusForecast: ForecastResult = {
      ...baseForecast,
      isCurrentMonth: false,
      isPastMonth: true,
      isFutureMonth: false,
      remainingDays: 0,
      elapsedDays: 30,
      totalDays: 30,
      currentIncome: 0,
      currentExpense: 200000,
      monthNet: -200000,
      rolloverBalance: 1000000,
      availableBalance: 800000,
      surplusAmount: 800000,
      deficitAmount: 0,
      healthStatus: 'warning',
    }

    render(<SafeDailySpendCard forecast={pastRolloverSurplusForecast} />)

    expect(screen.getByText('الرصيد الختامي المتبقي (شامل المرحّل)')).toBeInTheDocument()
    expect(screen.getByText(/\+ 800(\.000)? د\.أ/)).toBeInTheDocument()
    expect(screen.getByText(/صافي عمليات الشهر وحده:.*200.*المرحّل السابق:.*1[,.]000/)).toBeInTheDocument()
    expect(screen.getByText(/اكتمل هذا الشهر برصيد ختامي متبقي قدره/)).toBeInTheDocument()
  })

  it('renders completed past month with rolloverBalance causing total deficit', () => {
    const pastRolloverDeficitForecast: ForecastResult = {
      ...baseForecast,
      isCurrentMonth: false,
      isPastMonth: true,
      isFutureMonth: false,
      remainingDays: 0,
      elapsedDays: 30,
      totalDays: 30,
      currentIncome: 500000,
      currentExpense: 400000,
      monthNet: 100000,
      rolloverBalance: -300000,
      availableBalance: -200000,
      surplusAmount: 0,
      deficitAmount: 200000,
      healthStatus: 'danger',
    }

    render(<SafeDailySpendCard forecast={pastRolloverDeficitForecast} />)

    expect(screen.getByText('عجز مالي ختامي (تجاوز الدخل والمرحّل)')).toBeInTheDocument()
    expect(screen.getByText(/- 200(\.000)? د\.أ/)).toBeInTheDocument()
    expect(screen.getByText(/صافي عمليات الشهر وحده:.*100.*المرحّل السابق:.*300/)).toBeInTheDocument()
    expect(screen.getByText(/انتهى هذا الشهر بعجز ختامي كلي قدره/)).toBeInTheDocument()
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

  it('renders amber temporary liquidity notice when current month has cash deficit but free balance is positive due to scheduled recurring income', () => {
    const temporaryLiquidityForecast: ForecastResult = {
      ...baseForecast,
      currentIncome: 0,
      currentExpense: 50000,
      monthNet: -50000,
      availableBalance: -50000,
      upcomingRecurringIncome: 500000,
      freeBalance: 450000,
      dailySafeFils: 28125,
      healthStatus: 'warning',
      isDeficitProjected: false,
    }

    render(<SafeDailySpendCard forecast={temporaryLiquidityForecast} />)

    expect(screen.getByText('تنبيه سيولة مؤقتة')).toBeInTheDocument()
    expect(screen.getByText(/رصيدك النقدي الحالي قبل نزول الدخل المتكرر القادم هو/)).toBeInTheDocument()
    expect(screen.getByText(/المسار المستقبلي آمن باحتساب الدخل القادم/)).toBeInTheDocument()
    // Does NOT render "مسارك المالي ممتاز!" when liquidity is in deficit
    expect(screen.queryByText('مسارك المالي ممتاز!')).not.toBeInTheDocument()
  })

  it('renders projected deficit warning banner and red free balance when browsing future month with deficit', () => {
    const futureDeficitForecast: ForecastResult = {
      ...baseForecast,
      isCurrentMonth: false,
      isPastMonth: false,
      isFutureMonth: true,
      remainingDays: 30,
      totalDays: 30,
      currentIncome: 0,
      currentExpense: 0,
      monthNet: 0,
      rolloverBalance: 0,
      availableBalance: 0,
      upcomingRecurringExpenses: 400000,
      upcomingRecurringIncome: 250000,
      freeBalance: -150000,
      dailySafeFils: 0,
      isDeficitProjected: true,
      deficitAmount: 150000,
      healthStatus: 'danger',
    }

    render(<SafeDailySpendCard forecast={futureDeficitForecast} />)

    expect(screen.getByText('تحذير من عجز متوقع:')).toBeInTheDocument()
    expect(screen.getByText(/الالتزامات المجدولة تفوق الدخل والرصيد المتوقع بعجز قدره/)).toBeInTheDocument()
    expect(screen.queryByText('تخطيط استباقي:')).not.toBeInTheDocument()

    // Assert freeBalance text has red color styling class
    const freeBalanceEl = screen.getByText(/-150(\.000)? د\.أ/)
    expect(freeBalanceEl).toHaveClass('text-red-500')
  })

  it('renders neutral guidance banner when month is completely empty (isEmptyMonth)', () => {
    const emptyForecast: ForecastResult = {
      ...baseForecast,
      currentIncome: 0,
      currentExpense: 0,
      monthNet: 0,
      rolloverBalance: 0,
      availableBalance: 0,
      availablePool: 0,
      upcomingRecurringExpenses: 0,
      upcomingRecurringIncome: 0,
      upcomingDebtObligations: 0,
      freeBalance: 0,
      dailySafeFils: 0,
      actualDailySpendFils: 0,
      surplusAmount: 0,
      deficitAmount: 0,
      isDeficitProjected: false,
    }

    render(<SafeDailySpendCard forecast={emptyForecast} />)

    expect(screen.getByText('بانتظار تسجيل المعاملات:')).toBeInTheDocument()
    expect(
      screen.getByText(
        /ابدأ بتسجيل مداخيلك ومصاريفك لهذا الشهر لتفعيل حسابات حد الصرف اليومي الآمن ومتابعة مسارك المالي\./
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('مسارك المالي ممتاز!')).not.toBeInTheDocument()
  })

  it('renders red warning banner when freeBalance is exhausted (freeBalance <= 0) due to obligations', () => {
    const exhaustedForecast: ForecastResult = {
      ...baseForecast,
      currentIncome: 200000,
      currentExpense: 100000,
      monthNet: 100000,
      availableBalance: 100000,
      upcomingRecurringExpenses: 100000,
      upcomingDebtObligations: 0,
      freeBalance: 0,
      dailySafeFils: 0,
      actualDailySpendFils: 6667,
      healthStatus: 'danger',
      isDeficitProjected: false,
    }

    render(<SafeDailySpendCard forecast={exhaustedForecast} />)

    expect(screen.getByText('استنفاد الرصيد الحر المتاح:')).toBeInTheDocument()
    expect(
      screen.getByText(
        /لقد استهلكت كامل الرصيد المتاح للصرف اليومي أو تم حجزه بالكامل للالتزامات المتبقية/
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('مسارك المالي ممتاز!')).not.toBeInTheDocument()
  })

  it('renders amber warning banner when spending pace exceeds safe daily spend', () => {
    const overspendingForecast: ForecastResult = {
      ...baseForecast,
      currentIncome: 500000,
      currentExpense: 300000,
      availableBalance: 200000,
      freeBalance: 200000,
      dailySafeFils: 12500,
      actualDailySpendFils: 20000,
      healthStatus: 'warning',
      isDeficitProjected: false,
    }

    render(<SafeDailySpendCard forecast={overspendingForecast} />)

    expect(screen.getByText('تنبيه وتيرة الإنفاق:')).toBeInTheDocument()
    expect(screen.getByText(/معدل صرفك اليومي الحالي.*يتجاوز حد الأمان/)).toBeInTheDocument()
    expect(screen.queryByText('مسارك المالي ممتاز!')).not.toBeInTheDocument()

    // Assert actualDailySpendFils has amber warning color styling class
    const actualSpendEl = screen.getAllByText(/20(\.000)? د\.أ/)[0]
    expect(actualSpendEl).toHaveClass('text-amber-600')
  })
})
