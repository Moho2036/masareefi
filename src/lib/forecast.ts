import { getFinancialMonthRange } from './dates'
import { isOccurrenceSkipped, advanceDateWithTargetDay, getDeterministicTxId } from './recurring'
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
  isPastMonth: boolean
  isFutureMonth: boolean

  // Amounts in Fils
  currentIncome: number
  currentExpense: number
  monthNet: number
  rolloverBalance: number
  availableBalance: number
  upcomingRecurringExpenses: number
  upcomingRecurringIncome: number
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

  const toStartOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)

  const now = toStartOfDay(refDate)
  const rangeStart = toStartOfDay(start)
  const rangeEnd = toStartOfDay(end)

  const isCurrentMonth = now >= rangeStart && now < rangeEnd
  const isPastMonth = now >= rangeEnd
  const isFutureMonth = now < rangeStart

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
      Math.round((now.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    )
    remainingDays = Math.max(
      1,
      Math.round((rangeEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )
  } else if (isFutureMonth) {
    // Future month (cycle has not started yet - full cycle remains)
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

  // 2. Upcoming recurring expenses and income in this cycle (accumulate all occurrences within [rangeStart, rangeEnd))
  let upcomingRecurringExpenses = 0
  let upcomingRecurringIncome = 0
  if (params.recurring && (isCurrentMonth || isFutureMonth)) {
    const existingTxIds = new Set(
      params.transactions
        .map((t) => t.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )

    for (const rec of params.recurring) {
      if (!rec.active) continue
      let curr = rec.nextDate instanceof Date ? new Date(rec.nextDate.getTime()) : new Date(rec.nextDate)
      const recStart = rec.startDate instanceof Date ? rec.startDate : new Date(rec.startDate)
      const targetDay = recStart.getDate()
      const recEnd = rec.endDate
        ? rec.endDate instanceof Date
          ? new Date(rec.endDate.getTime())
          : new Date(rec.endDate)
        : null

      // Iterate through all occurrences within this financial month
      while (toStartOfDay(curr) < rangeEnd) {
        if (recEnd && toStartOfDay(curr) > toStartOfDay(recEnd)) break
        const occStart = toStartOfDay(curr)
        if (occStart >= rangeStart && occStart < rangeEnd) {
          const isRecorded = existingTxIds.has(getDeterministicTxId(rec.id, curr))
          if (!isRecorded && !isOccurrenceSkipped(rec, curr)) {
            if (rec.type === 'expense') {
              upcomingRecurringExpenses += rec.amountFils || 0
            } else if (rec.type === 'income') {
              upcomingRecurringIncome += rec.amountFils || 0
            }
          }
        }
        const next = advanceDateWithTargetDay(curr, rec.frequency, targetDay)
        if (next.getTime() <= curr.getTime()) break
        curr = next
      }
    }
  }

  // 3. Upcoming debts owed by user ('borrowed') due within this cycle [rangeStart, rangeEnd)
  let upcomingDebtObligations = 0
  if (params.debts && (isCurrentMonth || isFutureMonth)) {
    for (const debt of params.debts) {
      if (debt.type !== 'borrowed' || debt.settled) continue
      const remainingUnpaid = Math.max(0, debt.amountFils - (debt.paidFils || 0))
      if (remainingUnpaid <= 0) continue

      if (debt.dueDate) {
        const dueDate = debt.dueDate instanceof Date ? debt.dueDate : new Date(debt.dueDate)
        const dueDay = toStartOfDay(dueDate)
        if (dueDay < rangeEnd) {
          upcomingDebtObligations += remainingUnpaid
        }
      }
    }
  }

  // Free balance available for discretionary daily spending
  const freeBalance =
    availableBalance +
    upcomingRecurringIncome -
    (upcomingRecurringExpenses + upcomingDebtObligations)

  // 4. Daily Safe Budget & Actual Flexible Daily Spending
  const dailySafeFils = remainingDays > 0 && freeBalance > 0 ? Math.floor(freeBalance / remainingDays) : 0
  const actualDailySpendFils = Math.round(discretionaryExpense / elapsedDays)

  // 5. Month-End Forecast
  const projectedDiscretionary = isPastMonth ? 0 : actualDailySpendFils * remainingDays
  const projectedExpense =
    currentExpense +
    projectedDiscretionary +
    upcomingRecurringExpenses +
    upcomingDebtObligations
  const projectedIncome = currentIncome + upcomingRecurringIncome
  const projectedNet = rolloverBalance + projectedIncome - projectedExpense

  const isDeficitProjected = (isCurrentMonth || isFutureMonth) && projectedNet < 0
  const deficitAmount = isDeficitProjected
    ? Math.abs(projectedNet)
    : isPastMonth && monthNet < 0
      ? Math.abs(monthNet)
      : 0
  const surplusAmount = isDeficitProjected
    ? 0
    : isPastMonth
      ? (monthNet > 0 ? monthNet : 0)
      : (projectedNet > 0 ? projectedNet : 0)

  // Recommended daily reduction if a deficit is projected
  const recommendedDailyReductionFils = isDeficitProjected && remainingDays > 0
    ? Math.ceil(deficitAmount / remainingDays)
    : 0

  // Estimate when the deficit will occur
  let estimatedDeficitDay: number | undefined
  if (isCurrentMonth && isDeficitProjected) {
    if (freeBalance <= 0) {
      estimatedDeficitDay = now.getDate()
    } else if (actualDailySpendFils > 0) {
      const daysUntilDepletion = Math.floor(freeBalance / actualDailySpendFils)
      const depletionDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + daysUntilDepletion
      )
      if (depletionDate < rangeEnd) {
        estimatedDeficitDay = depletionDate.getDate()
      }
    }
  }

  // 6. Health Status
  let healthStatus: FinancialHealthStatus
  if (isPastMonth) {
    healthStatus = monthNet < 0 ? 'danger' : 'safe'
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
    isPastMonth,
    isFutureMonth,

    currentIncome,
    currentExpense,
    monthNet,
    rolloverBalance,
    availableBalance,
    upcomingRecurringExpenses,
    upcomingRecurringIncome,
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
