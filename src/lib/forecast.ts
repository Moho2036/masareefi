import { getFinancialMonthRange } from './dates'
import {
  isOccurrenceSkipped,
  advanceDateWithTargetDay,
  getDeterministicTxId,
  getOccurrenceMonthIndex,
  getCircleCycleIndex,
} from './recurring'
import type { Recurring, Debt, Transaction, MoneyCircle } from '../types'

export interface ForecastParams {
  transactions: Transaction[]
  recurring?: Recurring[]
  debts?: Debt[]
  circles?: MoneyCircle[]
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
  availablePool: number
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

  // Next cycle soon obligations (within 3 days of new cycle)
  nextCycleSoonObligationsFils?: number
  nextCycleSoonCount?: number
  nextCycleSoonRecurringCount?: number
  nextCycleSoonDebtCount?: number
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
    // Future month (cycle has not started yet - 0 days elapsed, full cycle remains)
    elapsedDays = 0
    remainingDays = totalDays
  } else {
    // Past month (cycle has ended)
    elapsedDays = totalDays
    remainingDays = 0
  }

  // 1. Current income and expenses (separating flexible daily spending from paid fixed commitments)
  let currentIncome = 0
  let currentExpense = 0
  let pastDiscretionaryExpense = 0
  let futureDatedManualIncome = 0

  const linkedDebtTxIds = new Set<string>()
  if (params.debts) {
    for (const d of params.debts) {
      for (const p of d.payments || []) {
        if (p.transactionId) linkedDebtTxIds.add(p.transactionId)
        if (Array.isArray(p.mergedTransactionIds)) {
          for (const mId of p.mergedTransactionIds) {
            if (mId) linkedDebtTxIds.add(mId)
          }
        }
      }
      for (const e of d.entries || []) {
        if (e.transactionId) linkedDebtTxIds.add(e.transactionId)
      }
    }
  }

  for (const tx of params.transactions) {
    if (typeof tx.amountFils !== 'number' || !Number.isFinite(tx.amountFils)) continue
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    if (tx.type === 'income') {
      currentIncome += tx.amountFils
      if (isCurrentMonth && toStartOfDay(txDate) > now) {
        futureDatedManualIncome += tx.amountFils
      }
    } else if (tx.type === 'expense') {
      const amount = tx.amountFils
      currentExpense += amount

      const isFixedCommitment = Boolean(
        tx.recurringId ||
          tx.title === 'تسوية رصيد (فرق جرد)' ||
          (typeof tx.id === 'string' &&
            (tx.id.startsWith('debt_init_') ||
              tx.id.startsWith('debt_entry_') ||
              tx.id.startsWith('debt_pay_') ||
              tx.id.startsWith('circle_') ||
              linkedDebtTxIds.has(tx.id)))
      )
      if (!isFixedCommitment) {
        // Only count discretionary spending that actually occurred on or before today
        // towards past daily pace; future-dated transactions within the cycle should not inflate daily rate.
        if (isCurrentMonth && toStartOfDay(txDate) <= now) {
          pastDiscretionaryExpense += amount
        } else if (isPastMonth) {
          pastDiscretionaryExpense += amount
        }
      }
    }
  }

  // 2. Upcoming recurring expenses and income in this cycle (accumulate all occurrences within [rangeStart, rangeEnd))
  // and intermediate active recurring transactions between now and rangeStart for future months
  let upcomingRecurringExpenses = 0
  let upcomingRecurringIncome = 0
  let intermediateRecurringNet = 0
  const existingTxIds = new Set(
    params.transactions
      .map((t) => t.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )
  const bookedCircleInstallmentIds = new Set<string>()

  const circleIdByRecurringId = new Map<string, string>()
  if (params.circles) {
    for (const c of params.circles) {
      if (c.recurringId) {
        circleIdByRecurringId.set(c.recurringId, c.id)
      }
    }
  }

  if (params.recurring && (isCurrentMonth || isFutureMonth)) {
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

      // Iterate through all occurrences until rangeEnd
      while (toStartOfDay(curr) < rangeEnd) {
        if (recEnd && toStartOfDay(curr) > toStartOfDay(recEnd)) break
        const occStart = toStartOfDay(curr)
        const matchedCircleId = rec.circleId || circleIdByRecurringId.get(rec.id)
        const circleManualTxId = matchedCircleId
          ? `circle_${matchedCircleId}_m${getOccurrenceMonthIndex(rec.startDate, curr, monthStartDay)}`
          : null
        const isRecorded =
          existingTxIds.has(getDeterministicTxId(rec.id, curr)) ||
          Boolean(circleManualTxId && existingTxIds.has(circleManualTxId))

        if (occStart >= rangeStart && occStart < rangeEnd) {
          if (!isRecorded && !isOccurrenceSkipped(rec, curr, monthStartDay)) {
            if (rec.type === 'expense') {
              upcomingRecurringExpenses += rec.amountFils || 0
              if (matchedCircleId) {
                bookedCircleInstallmentIds.add(matchedCircleId)
              }
            } else if (rec.type === 'income') {
              upcomingRecurringIncome += rec.amountFils || 0
            }
          }
        } else if (isFutureMonth && occStart >= now && occStart < rangeStart) {
          if (!isRecorded && !isOccurrenceSkipped(rec, curr, monthStartDay)) {
            if (rec.type === 'expense') {
              intermediateRecurringNet -= rec.amountFils || 0
            } else if (rec.type === 'income') {
              intermediateRecurringNet += rec.amountFils || 0
            }
          }
        }
        const next = advanceDateWithTargetDay(curr, rec.frequency, targetDay)
        if (next.getTime() <= curr.getTime()) break
        curr = next
      }
    }
  }

  // 2b. Reserve unpaid circle installment for current month (if not already booked by recurring rule)
  if (params.circles && isCurrentMonth) {
    for (const circle of params.circles) {
      if (circle.status !== 'active') continue
      const circleMonth = getCircleCycleIndex(circle.startDate, now, monthStartDay) + 1
      if (circleMonth >= 1 && circleMonth <= circle.membersCount) {
        const isExempt =
          circleMonth === circle.myTurnMonth ||
          (circle.shareType === 'double' && circleMonth === circle.secondTurnMonth)
        if (isExempt) continue

        const userMember = circle.members?.find(
          (m) =>
            m.turnMonth === circle.myTurnMonth ||
            (circle.shareType === 'double' &&
              circle.secondTurnMonth !== undefined &&
              m.turnMonth === circle.secondTurnMonth)
        )

        if (
          userMember?.paymentsByMonth?.[String(circleMonth)] === false ||
          userMember?.paymentsByMonth?.[circleMonth] === false
        ) {
          continue
        }

        const isPaid =
          Boolean(userMember?.paidMonths?.includes(circleMonth)) ||
          userMember?.paymentsByMonth?.[String(circleMonth)] === true ||
          userMember?.paymentsByMonth?.[circleMonth] === true ||
          existingTxIds.has(`circle_${circle.id}_m${circleMonth}`)

        if (!isPaid) {
          const userMonthlyFils =
            circle.shareType === 'half'
              ? Math.round(circle.monthlyAmountFils / 2)
              : circle.shareType === 'double'
                ? circle.monthlyAmountFils * 2
                : circle.monthlyAmountFils

          if (!bookedCircleInstallmentIds.has(circle.id)) {
            upcomingRecurringExpenses += userMonthlyFils
            bookedCircleInstallmentIds.add(circle.id)
          }
        }
      }
    }
  }

  // 3. Upcoming debts owed by user ('borrowed') due within this cycle [rangeStart, rangeEnd)
  // and intermediate unpaid borrowed debts due before rangeStart for future months
  let upcomingDebtObligations = 0
  let intermediateDebtObligations = 0
  if (params.debts && (isCurrentMonth || isFutureMonth)) {
    for (const debt of params.debts) {
      if (debt.type !== 'borrowed' || debt.settled) continue
      const remainingUnpaid = Math.max(0, debt.amountFils - (debt.paidFils || 0))
      if (remainingUnpaid <= 0) continue

      if (debt.dueDate) {
        const dueDate = debt.dueDate instanceof Date ? debt.dueDate : new Date(debt.dueDate)
        const dueDay = toStartOfDay(dueDate)
        const isPastOverdue = dueDay < now
        const isDueInWindow = isFutureMonth
          ? (dueDay >= rangeStart && dueDay < rangeEnd) || (isPastOverdue && params.rolloverBalanceFils === undefined)
          : dueDay < rangeEnd
        if (isDueInWindow) {
          upcomingDebtObligations += remainingUnpaid
        } else if (isFutureMonth && params.rolloverBalanceFils !== undefined && dueDay < rangeStart) {
          intermediateDebtObligations += remainingUnpaid
        }
      }
    }
  }

  // 3b. Proactive horizon for obligations due in next cycle within 3 days
  let nextCycleSoonObligationsFils = 0
  let nextCycleSoonCount = 0
  let nextCycleSoonRecurringCount = 0
  let nextCycleSoonDebtCount = 0

  if (isCurrentMonth) {
    const threeDaysHorizon = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 3,
      23,
      59,
      59,
      999
    )
    if (threeDaysHorizon >= rangeEnd) {
      if (params.recurring) {
        for (const rec of params.recurring) {
          if (!rec.active || rec.type !== 'expense') continue
          let curr = rec.nextDate instanceof Date ? new Date(rec.nextDate.getTime()) : new Date(rec.nextDate)
          const recStart = rec.startDate instanceof Date ? rec.startDate : new Date(rec.startDate)
          const targetDay = recStart.getDate()
          const recEnd = rec.endDate
            ? rec.endDate instanceof Date
              ? new Date(rec.endDate.getTime())
              : new Date(rec.endDate)
            : null

          while (toStartOfDay(curr) < rangeEnd) {
            const next = advanceDateWithTargetDay(curr, rec.frequency, targetDay)
            if (next.getTime() <= curr.getTime()) break
            curr = next
          }

          if (recEnd && toStartOfDay(curr) > toStartOfDay(recEnd)) continue

          const occStart = toStartOfDay(curr)
          if (occStart >= rangeEnd && occStart <= threeDaysHorizon) {
            if (!isOccurrenceSkipped(rec, curr, monthStartDay)) {
              nextCycleSoonObligationsFils += rec.amountFils || 0
              nextCycleSoonCount++
              nextCycleSoonRecurringCount++
            }
          }
        }
      }

      if (params.debts) {
        for (const debt of params.debts) {
          if (debt.type !== 'borrowed' || debt.settled || !debt.dueDate) continue
          const remainingUnpaid = Math.max(0, debt.amountFils - (debt.paidFils || 0))
          if (remainingUnpaid <= 0) continue

          const dueDate = debt.dueDate instanceof Date ? debt.dueDate : new Date(debt.dueDate)
          const dueDay = toStartOfDay(dueDate)
          if (dueDay >= rangeEnd && dueDay <= threeDaysHorizon) {
            nextCycleSoonObligationsFils += remainingUnpaid
            nextCycleSoonCount++
            nextCycleSoonDebtCount++
          }
        }
      }
    }
  }

  const baseRollover = params.rolloverBalanceFils ?? 0
  const rolloverBalance =
    isFutureMonth && params.rolloverBalanceFils !== undefined
      ? baseRollover + intermediateRecurringNet - intermediateDebtObligations
      : baseRollover
  const monthNet = currentIncome - currentExpense
  const availableBalance = rolloverBalance + monthNet
  const availablePool = currentIncome + rolloverBalance

  // Free balance available for discretionary daily spending
  const freeBalance =
    availableBalance +
    upcomingRecurringIncome -
    (upcomingRecurringExpenses + upcomingDebtObligations)

  // 4. Daily Safe Budget & Actual Flexible Daily Spending
  const dailySafeFils = remainingDays > 0 && freeBalance > 0 ? Math.floor(freeBalance / remainingDays) : 0
  const actualDailySpendFils = elapsedDays > 0 ? Math.round(pastDiscretionaryExpense / elapsedDays) : 0

  // In the first few days of the current month (elapsedDays < 5), extrapolating a single early expense (e.g. bulk groceries)
  // over the entire remaining month causes wild false projections. When spending rate exceeds the baseline discretionary budget,
  // we blend the observed daily rate with the monthly baseline daily allowance.
  const baselineDailyBudgetFils =
    totalDays > 0 && freeBalance + pastDiscretionaryExpense > 0
      ? Math.floor((freeBalance + pastDiscretionaryExpense) / totalDays)
      : dailySafeFils

  let projectedDailySpendFils = actualDailySpendFils
  if (
    isCurrentMonth &&
    elapsedDays > 0 &&
    elapsedDays < 5 &&
    actualDailySpendFils > baselineDailyBudgetFils &&
    baselineDailyBudgetFils > 0
  ) {
    const weight = elapsedDays / 5
    projectedDailySpendFils = Math.round(actualDailySpendFils * weight + baselineDailyBudgetFils * (1 - weight))
  }

  // 5. Month-End Forecast
  const futureUnelapsedDays = Math.max(0, totalDays - elapsedDays)
  const projectedDiscretionary =
    isPastMonth || isFutureMonth ? 0 : projectedDailySpendFils * futureUnelapsedDays
  const projectedExpense =
    currentExpense +
    projectedDiscretionary +
    upcomingRecurringExpenses +
    upcomingDebtObligations
  const projectedIncome = currentIncome + upcomingRecurringIncome
  const projectedNet = isPastMonth ? availableBalance : rolloverBalance + projectedIncome - projectedExpense

  const isDeficitProjected = (isCurrentMonth || isFutureMonth) && projectedNet < 0
  const deficitAmount = isDeficitProjected
    ? Math.abs(projectedNet)
    : isPastMonth && availableBalance < 0
      ? Math.abs(availableBalance)
      : 0
  const surplusAmount = isDeficitProjected
    ? 0
    : isPastMonth
      ? (availableBalance >= 0 ? availableBalance : 0)
      : (projectedNet > 0 ? projectedNet : 0)

  // Recommended daily reduction if a deficit is projected
  const recommendedDailyReductionFils = isDeficitProjected && remainingDays > 0
    ? Math.ceil(deficitAmount / remainingDays)
    : 0

  // Estimate when the deficit will occur
  let estimatedDeficitDay: number | undefined
  if (isCurrentMonth && isDeficitProjected) {
    if (availableBalance <= 0) {
      estimatedDeficitDay = now.getDate()
    } else if (freeBalance <= 0) {
      if (actualDailySpendFils > 0) {
        const daysUntilCashDepletion = Math.floor(availableBalance / actualDailySpendFils)
        const depletionDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + daysUntilCashDepletion
        )
        if (depletionDate < rangeEnd) {
          estimatedDeficitDay = depletionDate.getDate()
        } else {
          estimatedDeficitDay = now.getDate()
        }
      } else {
        estimatedDeficitDay = now.getDate()
      }
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
    if (availableBalance < 0) {
      healthStatus = 'danger'
    } else if (monthNet < 0) {
      healthStatus = 'warning'
    } else {
      healthStatus = 'safe'
    }
  } else if (isFutureMonth) {
    // In future months, lack of recorded salary should not trigger red danger alert.
    // Only flag danger if starting with an actual negative rollover deficit.
    if (rolloverBalance < 0) {
      healthStatus = 'danger'
    } else if (freeBalance < 0) {
      healthStatus = 'warning'
    } else {
      healthStatus = 'safe'
    }
  } else if (
    freeBalance < 0 ||
    (isDeficitProjected && (elapsedDays >= 3 || freeBalance <= 0)) ||
    (freeBalance === 0 &&
      (upcomingRecurringExpenses > 0 || upcomingDebtObligations > 0 || currentExpense > 0))
  ) {
    healthStatus = 'danger'
  } else if (
    isDeficitProjected ||
    actualDailySpendFils > dailySafeFils ||
    (isCurrentMonth &&
      availableBalance - futureDatedManualIncome < 0 &&
      upcomingRecurringIncome + futureDatedManualIncome > 0 &&
      freeBalance > 0)
  ) {
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
    availablePool,
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
    nextCycleSoonObligationsFils,
    nextCycleSoonCount,
    nextCycleSoonRecurringCount,
    nextCycleSoonDebtCount,
  }
}
