import { getFinancialMonthRange } from './dates'
import { isOccurrenceSkipped, advanceDate } from './recurring'
import type { Recurring, Debt, Transaction } from '../types'

export interface ForecastParams {
  transactions: Transaction[]
  recurring?: Recurring[]
  debts?: Debt[]
  monthStartDay?: number
  referenceDate?: Date
  periodRange?: { start: Date; end: Date }
  rolloverBalanceFils?: number
}

export type FinancialHealthStatus = 'safe' | 'warning' | 'danger'

export interface ForecastResult {
  // Range & Days
  startDate: Date
  endDate: Date
  totalDays: number
  elapsedDays: number
  remainingDays: number
  isCurrentMonth: boolean

  // Amounts in Fils
  currentIncome: number
  currentExpense: number
  monthNet: number
  rolloverBalance: number
  availableBalance: number
  upcomingRecurringExpenses: number
  upcomingDebtObligations: number
  freeBalance: number

  // Daily metrics
  dailySafeFils: number
  actualDailySpendFils: number
  healthStatus: FinancialHealthStatus

  // Month-end Forecast
  projectedExpense: number
  projectedNet: number
  isDeficitProjected: boolean
  deficitAmount: number
  surplusAmount: number
  estimatedDeficitDay?: number // Day of month when balance will be depleted
  recommendedDailyReductionFils: number // How much to cut daily to avoid deficit
}

/**
 * Calculates the Daily Safe Budget and Month-End Forecast,
 * taking into account current transactions, upcoming recurring bills, and due debts.
 */
export function calculateForecast(params: ForecastParams): ForecastResult {
  const refDate = params.referenceDate || new Date()
  const monthStartDay = params.monthStartDay ?? 1
  const { start, end } = params.periodRange ?? getFinancialMonthRange(refDate, monthStartDay)

  const now = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate())
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  const isCurrentMonth = now >= rangeStart && now < rangeEnd

  // Total days in the financial cycle
  const totalDays = Math.max(
    1,
    Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
  )

  let elapsedDays: number
  let remainingDays: number

  if (isCurrentMonth) {
    elapsedDays = Math.max(
      1,
      Math.floor((now.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    )
    remainingDays = Math.max(
      1,
      Math.ceil((rangeEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )
  } else if (now < rangeStart) {
    // Future month
    elapsedDays = 1
    remainingDays = totalDays
  } else {
    // Past month (cycle has ended)
    elapsedDays = totalDays
    remainingDays = 0
  }

  // 1. Current income and expenses (separating flexible daily spending from paid fixed commitments)
  let currentIncome = 0
  let currentExpense = 0
  let paidFixedExpenses = 0

  for (const tx of params.transactions) {
    if (tx.type === 'income') {
      currentIncome += tx.amountFils || 0
    } else if (tx.type === 'expense') {
      const amount = tx.amountFils || 0
      currentExpense += amount

      const isFixedCommitment = Boolean(
        tx.recurringId ||
          (typeof tx.id === 'string' &&
            (tx.id.startsWith('debt_init_') || tx.id.startsWith('debt_pay_')))
      )
      if (isFixedCommitment) {
        paidFixedExpenses += amount
      }
    }
  }

  const discretionaryExpense = Math.max(0, currentExpense - paidFixedExpenses)
  const rolloverBalance = params.rolloverBalanceFils ?? 0
  const monthNet = currentIncome - currentExpense
  const availableBalance = rolloverBalance + monthNet

  // 2. Upcoming recurring expenses in this cycle (accumulate all occurrences within [now, end))
  let upcomingRecurringExpenses = 0
  if (params.recurring && isCurrentMonth) {
    for (const rec of params.recurring) {
      if (!rec.active || rec.type !== 'expense') continue
      let curr = rec.nextDate instanceof Date ? new Date(rec.nextDate.getTime()) : new Date(rec.nextDate)
      const recEnd = rec.endDate
        ? rec.endDate instanceof Date
          ? rec.endDate
          : new Date(rec.endDate)
        : null

      // Iterate through all occurrences within this financial month
      while (curr < end) {
        if (recEnd && curr > recEnd) break
        if (curr >= now) {
          if (!isOccurrenceSkipped(rec, curr)) {
            upcomingRecurringExpenses += rec.amountFils || 0
          }
        }
        const next = advanceDate(curr, rec.frequency)
        if (next.getTime() <= curr.getTime()) break
        curr = next
      }
    }
  }

  // 3. Upcoming debts owed by user ('borrowed') due before the end of this month
  let upcomingDebtObligations = 0
  if (params.debts && isCurrentMonth) {
    for (const debt of params.debts) {
      if (debt.type !== 'borrowed' || debt.settled) continue
      const remainingUnpaid = Math.max(0, debt.amountFils - (debt.paidFils || 0))
      if (remainingUnpaid <= 0) continue

      if (debt.dueDate) {
        const dueDate = debt.dueDate instanceof Date ? debt.dueDate : new Date(debt.dueDate)
        if (dueDate < end) {
          upcomingDebtObligations += remainingUnpaid
        }
      }
    }
  }

  // Free balance available for discretionary daily spending
  const freeBalance = availableBalance - (upcomingRecurringExpenses + upcomingDebtObligations)

  // 4. Daily Safe Budget & Actual Flexible Daily Spending
  const dailySafeFils = remainingDays > 0 && freeBalance > 0 ? Math.floor(freeBalance / remainingDays) : 0
  const actualDailySpendFils = Math.round(discretionaryExpense / elapsedDays)

  // 5. Month-End Forecast
  const projectedDiscretionary = actualDailySpendFils * remainingDays
  const projectedExpense = currentExpense + projectedDiscretionary + upcomingRecurringExpenses + upcomingDebtObligations
  const projectedNet = rolloverBalance + currentIncome - projectedExpense

  const isDeficitProjected = isCurrentMonth && projectedNet < 0
  const deficitAmount = isDeficitProjected ? Math.abs(projectedNet) : 0
  const surplusAmount = !isDeficitProjected && projectedNet > 0 ? projectedNet : 0

  // Recommended daily reduction if a deficit is projected
  const recommendedDailyReductionFils = isDeficitProjected && remainingDays > 0
    ? Math.ceil(deficitAmount / remainingDays)
    : 0

  // Estimate when the deficit will occur
  let estimatedDeficitDay: number | undefined
  if (isCurrentMonth && isDeficitProjected && availableBalance > 0 && actualDailySpendFils > 0) {
    const daysUntilDepletion = Math.floor(availableBalance / actualDailySpendFils)
    const depletionDate = new Date(now.getTime() + daysUntilDepletion * 24 * 60 * 60 * 1000)
    estimatedDeficitDay = depletionDate.getDate()
  } else if (isCurrentMonth && isDeficitProjected && availableBalance <= 0) {
    estimatedDeficitDay = now.getDate()
  }

  // 6. Health Status
  let healthStatus: FinancialHealthStatus
  if (!isCurrentMonth) {
    healthStatus = availableBalance < 0 ? 'danger' : 'safe'
  } else if (
    freeBalance < 0 ||
    isDeficitProjected ||
    (freeBalance === 0 &&
      (upcomingRecurringExpenses > 0 || upcomingDebtObligations > 0 || currentExpense > 0))
  ) {
    healthStatus = 'danger'
  } else if (actualDailySpendFils > dailySafeFils) {
    healthStatus = 'warning'
  } else {
    healthStatus = 'safe'
  }

  return {
    startDate: start,
    endDate: end,
    totalDays,
    elapsedDays,
    remainingDays,
    isCurrentMonth,

    currentIncome,
    currentExpense,
    monthNet,
    rolloverBalance,
    availableBalance,
    upcomingRecurringExpenses,
    upcomingDebtObligations,
    freeBalance,

    dailySafeFils,
    actualDailySpendFils,
    healthStatus,

    projectedExpense,
    projectedNet,
    isDeficitProjected,
    deficitAmount,
    surplusAmount,
    estimatedDeficitDay,
    recommendedDailyReductionFils,
  }
}
