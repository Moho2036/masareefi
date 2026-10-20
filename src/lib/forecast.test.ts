import { describe, it, expect } from 'vitest'
import { calculateForecast } from './forecast'
import type { Transaction, Recurring, Debt } from '../types'

describe('forecast lib', () => {
  const midMonthDate = new Date(2026, 9, 15) // Oct 15, 2026 (month range Oct 1 - Nov 1)

  const sampleIncome: Transaction = {
    id: 'tx-1',
    type: 'income',
    amountFils: 600000, // 600 JOD
    categoryId: 'cat-inc',
    date: new Date(2026, 9, 1),
    note: 'راتب',
    createdAt: new Date(),
  }

  const sampleExpense: Transaction = {
    id: 'tx-2',
    type: 'expense',
    amountFils: 150000, // 150 JOD spent in first 15 days
    categoryId: 'cat-exp',
    date: new Date(2026, 9, 10),
    note: 'مصاريف تسوق',
    createdAt: new Date(),
  }

  it('calculates daily safe budget correctly in a healthy month', () => {
    const res = calculateForecast({
      transactions: [sampleIncome, sampleExpense],
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    expect(res.isCurrentMonth).toBe(true)
    expect(res.currentIncome).toBe(600000)
    expect(res.currentExpense).toBe(150000)
    expect(res.availableBalance).toBe(450000)
    expect(res.freeBalance).toBe(450000)

    // With 16 days remaining: 450,000 / 16 ≈ 28,125 fils/day
    expect(res.dailySafeFils).toBe(Math.floor(450000 / res.remainingDays))
    // Actual pace: 150,000 / 15 = 10,000 fils/day
    expect(res.actualDailySpendFils).toBe(10000)
    expect(res.healthStatus).toBe('safe')
    expect(res.isDeficitProjected).toBe(false)
  })

  it('deducts upcoming recurring bills and due debts from free balance', () => {
    const upcomingRent: Recurring = {
      id: 'rec-1',
      type: 'expense',
      amountFils: 120000, // 120 JOD rent
      categoryId: 'cat-rent',
      frequency: 'monthly',
      startDate: new Date(2026, 8, 20),
      nextDate: new Date(2026, 9, 20), // Due in 5 days
      active: true,
      note: 'إيجار البيت',
    }

    const upcomingDebtOwed: Debt = {
      id: 'debt-1',
      personName: 'أبو أحمد',
      type: 'borrowed', // borrowed = must repay
      amountFils: 80000, // 80 JOD
      paidFils: 0,
      startDate: new Date(2026, 8, 1),
      dueDate: new Date(2026, 9, 25), // Due before month end
      settled: false,
      note: 'سداد قسط',
      payments: [],
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [sampleIncome, sampleExpense],
      recurring: [upcomingRent],
      debts: [upcomingDebtOwed],
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    expect(res.upcomingRecurringExpenses).toBe(120000)
    expect(res.upcomingDebtObligations).toBe(80000)
    // 450,000 - 120,000 - 80,000 = 250,000 free balance
    expect(res.freeBalance).toBe(250000)
    expect(res.dailySafeFils).toBe(Math.floor(250000 / res.remainingDays))
  })

  it('detects early deficit when actual spending pace exceeds income', () => {
    const heavyExpense: Transaction = {
      id: 'tx-heavy',
      type: 'expense',
      amountFils: 550000, // 550 JOD already spent out of 600 JOD by day 15!
      categoryId: 'cat-exp',
      date: new Date(2026, 9, 12),
      note: 'مصاريف ضخمة',
      createdAt: new Date(),
    }

    const upcomingBill: Recurring = {
      id: 'rec-bill',
      type: 'expense',
      amountFils: 100000, // 100 JOD bill upcoming
      categoryId: 'cat-bill',
      frequency: 'monthly',
      startDate: new Date(2026, 8, 25),
      nextDate: new Date(2026, 9, 25),
      active: true,
      note: 'فاتورة قادمة',
    }

    const res = calculateForecast({
      transactions: [sampleIncome, heavyExpense],
      recurring: [upcomingBill],
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    expect(res.isDeficitProjected).toBe(true)
    expect(res.deficitAmount).toBeGreaterThan(0)
    expect(res.healthStatus).toBe('danger')
    expect(res.recommendedDailyReductionFils).toBeGreaterThan(0)
    expect(res.estimatedDeficitDay).toBeDefined()
  })

  it('does NOT deduct money circle installment during user turn month', () => {
    // Circle started in July 2026 (Month 1 = July, Month 2 = Aug, Month 3 = Sep, Month 4 = Oct)
    // In October (midMonthDate = Oct 15), it is Month 4, which is the user's turn!
    const circleRecurring: Recurring = {
      id: 'rec-circle',
      type: 'expense',
      amountFils: 100000, // 100 JOD
      categoryId: 'cat-circle',
      frequency: 'monthly',
      startDate: new Date(2026, 6, 1), // July 1, 2026
      nextDate: new Date(2026, 9, 20), // Oct 20, 2026
      active: true,
      note: 'قسط جمعية',
      circleId: 'circle-1',
      skipMonth: 4, // Month 4 is October (the user's turn to receive payout)
    }

    const res = calculateForecast({
      transactions: [sampleIncome, sampleExpense],
      recurring: [circleRecurring],
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    // Because October is the user's turn month, upcoming recurring expenses must NOT include 100 JOD!
    expect(res.upcomingRecurringExpenses).toBe(0)
    expect(res.freeBalance).toBe(450000) // 600,000 - 150,000, zero recurring deducted!
  })

  it('correctly handles past month when periodRange is passed', () => {
    // Current date is Oct 15, 2026, but periodRange is September 2026 (past)
    const septRange = {
      start: new Date(2026, 8, 1),
      end: new Date(2026, 9, 1),
    }

    const res = calculateForecast({
      transactions: [
        {
          id: 'tx-sept',
          type: 'expense',
          amountFils: 300000,
          categoryId: 'cat-exp',
          date: new Date(2026, 8, 10),
          note: '',
          createdAt: new Date(),
        },
      ],
      monthStartDay: 1,
      referenceDate: midMonthDate, // Oct 15, 2026
      periodRange: septRange,
    })

    expect(res.isCurrentMonth).toBe(false)
    expect(res.isPastMonth).toBe(true)
    expect(res.isFutureMonth).toBe(false)
    expect(res.remainingDays).toBe(0)
    expect(res.dailySafeFils).toBe(0)
    expect(res.upcomingRecurringExpenses).toBe(0)
    expect(res.upcomingDebtObligations).toBe(0)
    expect(res.isDeficitProjected).toBe(false)
    expect(res.monthNet).toBe(-300000)
    expect(res.deficitAmount).toBe(300000)
  })

  it('correctly handles future month when periodRange is passed and divides across totalDays', () => {
    // Current date is Oct 15, 2026, but periodRange is November 2026 (future)
    const novRange = {
      start: new Date(2026, 10, 1),
      end: new Date(2026, 11, 1),
    }

    // Expected future recurring income of 600 JOD in November
    const recurringIncome: Recurring = {
      id: 'rec-future-sal',
      type: 'income',
      amountFils: 600000,
      categoryId: 'cat-sal',
      frequency: 'monthly',
      startDate: new Date(2026, 9, 25),
      nextDate: new Date(2026, 10, 25), // Nov 25
      active: true,
      note: 'راتب قادم',
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [recurringIncome],
      monthStartDay: 1,
      referenceDate: midMonthDate, // Oct 15, 2026
      periodRange: novRange,
    })

    expect(res.isCurrentMonth).toBe(false)
    expect(res.isPastMonth).toBe(false)
    expect(res.isFutureMonth).toBe(true)
    expect(res.remainingDays).toBe(res.totalDays)
    expect(res.upcomingRecurringIncome).toBe(600000)
    expect(res.freeBalance).toBe(600000)
    // Daily budget should divide free balance across all days of the future month
    expect(res.dailySafeFils).toBe(Math.floor(600000 / res.totalDays))
    expect(res.dailySafeFils).toBe(20000)
  })

  it('returns safe status in current month when transactions and obligations are empty', () => {
    const res = calculateForecast({
      transactions: [],
      recurring: [],
      debts: [],
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    expect(res.isCurrentMonth).toBe(true)
    expect(res.availableBalance).toBe(0)
    expect(res.freeBalance).toBe(0)
    expect(res.isDeficitProjected).toBe(false)
    expect(res.healthStatus).toBe('safe')
  })

  it('separates paid fixed commitments from flexible daily spend so rent does not trigger false deficit', () => {
    // User has 1000 JOD income
    const salary: Transaction = {
      id: 'tx-sal',
      type: 'income',
      amountFils: 1000000,
      categoryId: 'cat-inc',
      date: new Date(2026, 9, 1),
      note: 'راتب',
      createdAt: new Date(),
    }
    // Paid 300 JOD rent on day 2 (recurring fixed commitment)
    const rentPaid: Transaction = {
      id: 'tx-rent-paid',
      type: 'expense',
      amountFils: 300000,
      categoryId: 'cat-rent',
      date: new Date(2026, 9, 2),
      note: 'إيجار مدفوع',
      recurringId: 'rec-rent',
      createdAt: new Date(),
    }
    // Paid 50 JOD debt repayment on day 3
    const debtPaid: Transaction = {
      id: 'debt_pay_123_456',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-debt',
      date: new Date(2026, 9, 3),
      note: 'سداد دين',
      createdAt: new Date(),
    }
    // Spent 30 JOD on groceries across the 15 days
    const groceries: Transaction = {
      id: 'tx-groc',
      type: 'expense',
      amountFils: 30000,
      categoryId: 'cat-groc',
      date: new Date(2026, 9, 5),
      note: 'طعام وبقالة',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [salary, rentPaid, debtPaid, groceries],
      monthStartDay: 1,
      referenceDate: midMonthDate, // Day 15
    })

    // Total expense is 380,000 fils
    expect(res.currentExpense).toBe(380000)
    // Flexible daily spend only derives from groceries: 30,000 / 15 days = 2,000 fils/day!
    // NOT 380,000 / 15 = 25,333 fils/day!
    expect(res.actualDailySpendFils).toBe(2000)
    expect(res.healthStatus).toBe('safe')
    expect(res.isDeficitProjected).toBe(false)
  })

  it('accumulates all weekly recurring occurrences within the remaining cycle', () => {
    // Reference date: Oct 15. Cycle ends Nov 1.
    // Weekly expense of 20 JOD on Oct 16, Oct 23, Oct 30 (3 occurrences remaining in October!)
    const weeklyGroceries: Recurring = {
      id: 'rec-weekly',
      type: 'expense',
      amountFils: 20000,
      categoryId: 'cat-groc',
      frequency: 'weekly',
      startDate: new Date(2026, 9, 2),
      nextDate: new Date(2026, 9, 16),
      active: true,
      note: 'تسوق أسبوعي',
    }

    const res = calculateForecast({
      transactions: [sampleIncome],
      recurring: [weeklyGroceries],
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    // 3 occurrences * 20,000 = 60,000 fils
    expect(res.upcomingRecurringExpenses).toBe(60000)
  })

  it('incorporates positive rollover balance from previous months into available balance', () => {
    // Current month has only 10 JOD expense and 0 income so far on day 3
    const earlyExpense: Transaction = {
      id: 'tx-early',
      type: 'expense',
      amountFils: 10000,
      categoryId: 'cat-groceries',
      date: new Date(2026, 9, 2),
      note: 'مشتريات بداية الشهر',
      createdAt: new Date(2026, 9, 2),
    }

    // Without rollover: balance is -10,000 (deficit / danger)
    const withoutRollover = calculateForecast({
      transactions: [earlyExpense],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 3),
    })
    expect(withoutRollover.availableBalance).toBe(-10000)
    expect(withoutRollover.isDeficitProjected).toBe(true)
    expect(withoutRollover.healthStatus).toBe('danger')

    // With 300 JOD (300,000 fils) rollover surplus from previous months
    const withRollover = calculateForecast({
      transactions: [earlyExpense],
      rolloverBalanceFils: 300000,
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 3),
    })
    expect(withRollover.rolloverBalance).toBe(300000)
    expect(withRollover.monthNet).toBe(-10000)
    expect(withRollover.availableBalance).toBe(290000) // 300,000 - 10,000 = +290,000 (safe!)
    expect(withRollover.freeBalance).toBe(290000)
    expect(withRollover.healthStatus).toBe('safe')
  })

  it('accounts for upcoming recurring income and prevents false deficit warning', () => {
    // Current date: Oct 5. No income transaction yet, only 50 JOD expense.
    const earlyExpense: Transaction = {
      id: 'tx-early',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-1',
      date: new Date(2026, 9, 3),
      note: 'مشتريات',
      createdAt: new Date(),
    }

    // Salary expected on Oct 25 (500 JOD)
    const upcomingSalary: Recurring = {
      id: 'rec-salary',
      type: 'income',
      amountFils: 500000,
      categoryId: 'cat-sal',
      frequency: 'monthly',
      startDate: new Date(2026, 8, 25),
      nextDate: new Date(2026, 9, 25),
      active: true,
      note: 'راتب شهري',
    }

    const res = calculateForecast({
      transactions: [earlyExpense],
      recurring: [upcomingSalary],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 5),
    })

    expect(res.upcomingRecurringIncome).toBe(500000)
    // -50,000 + 500,000 = +450,000
    expect(res.freeBalance).toBe(450000)
    expect(res.isDeficitProjected).toBe(false)
    expect(res.projectedNet).toBeGreaterThan(0)
  })

  it('includes past overdue debts from prior months that remain unpaid alongside current cycle debts', () => {
    // Debt 1: was due in August (prior month cycle) and remains unpaid
    const pastOverdueDebt: Debt = {
      id: 'debt-old',
      personName: 'خالد',
      type: 'borrowed',
      amountFils: 100000,
      paidFils: 0,
      startDate: new Date(2026, 7, 1),
      dueDate: new Date(2026, 7, 20), // August 20, before Oct 1 start
      settled: false,
      note: '',
      payments: [],
      createdAt: new Date(),
    }

    // Debt 2: due on Oct 20 at noon (within current cycle)
    const currentDebt: Debt = {
      id: 'debt-curr',
      personName: 'عمر',
      type: 'borrowed',
      amountFils: 60000,
      paidFils: 0,
      startDate: new Date(2026, 9, 1),
      dueDate: new Date(2026, 9, 20, 12, 0, 0), // Oct 20 at 12:00
      settled: false,
      note: '',
      payments: [],
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [sampleIncome], // 600,000 income
      debts: [pastOverdueDebt, currentDebt],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 10),
    })

    // Both currentDebt (60,000) and pastOverdueDebt (100,000) must be reserved
    expect(res.upcomingDebtObligations).toBe(160000)
    expect(res.freeBalance).toBe(600000 - 160000)
  })

  it('includes unrecorded recurring bills due in current cycle before now, and excludes them once recorded', () => {
    const unrecordedBill: Recurring = {
      id: 'rec-wifi',
      type: 'expense',
      amountFils: 25000,
      categoryId: 'cat-sub',
      frequency: 'monthly',
      startDate: new Date(2026, 8, 5),
      nextDate: new Date(2026, 9, 5), // Due on Oct 5 (before now = Oct 15)
      active: true,
      note: 'إنترنت',
    }

    // Case A: Not yet recorded in transactions
    const resUnrecorded = calculateForecast({
      transactions: [],
      recurring: [unrecordedBill],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 15), // Oct 15
    })
    expect(resUnrecorded.upcomingRecurringExpenses).toBe(25000)

    // Case B: Already recorded in transactions with deterministic ID
    const recordedTx: Transaction = {
      id: 'rec-wifi_2026-10-05',
      type: 'expense',
      amountFils: 25000,
      categoryId: 'cat-sub',
      date: new Date(2026, 9, 5),
      note: 'إنترنت',
      recurringId: 'rec-wifi',
      createdAt: new Date(),
    }
    const resRecorded = calculateForecast({
      transactions: [recordedTx],
      recurring: [unrecordedBill],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 15),
    })
    // Already in transactions, so not counted again as upcoming
    expect(resRecorded.upcomingRecurringExpenses).toBe(0)
    expect(resRecorded.currentExpense).toBe(25000)
  })

  it('calculates estimatedDeficitDay across calendar month boundary within the same fiscal cycle', () => {
    // Fiscal month starts on 25th: Sep 25, 2026 to Oct 25, 2026
    const refDate = new Date(2026, 8, 27) // Sep 27, 2026
    // Elapsed days: Sep 25, 26, 27 -> 3 days
    // Discretionary spending: 60,000 fils -> 20,000 fils/day pace
    // Remaining days: 28 days
    // Projected expense: 60,000 + 20,000 * 28 = 620,000
    // Income: 100,000 -> Deficit projected!
    // Free balance: 100,000 - 60,000 = 40,000
    // Depletion in 40,000 / 20,000 = 2 days -> Sep 27 + 2 days = Sep 29
    // If pace is 5,000 fils/day:
    // Discretionary: 15,000 fils in 3 days = 5,000/day
    // Free balance: 35,000 fils -> Depletes in 7 days -> Sep 27 + 7 days = Oct 4!
    const smallIncome: Transaction = {
      id: 'tx-inc',
      type: 'income',
      amountFils: 50000,
      categoryId: 'cat-inc',
      date: new Date(2026, 8, 25),
      note: 'دخل',
      createdAt: new Date(),
    }
    const smallExpense: Transaction = {
      id: 'tx-exp',
      type: 'expense',
      amountFils: 15000, // 5000/day over 3 elapsed days
      categoryId: 'cat-exp',
      date: new Date(2026, 8, 26),
      note: 'تسوق',
      createdAt: new Date(),
    }
    const bigFutureObligation: Recurring = {
      id: 'rec-future',
      type: 'expense',
      amountFils: 40000,
      categoryId: 'cat-exp',
      frequency: 'monthly',
      startDate: new Date(2026, 8, 25),
      nextDate: new Date(2026, 9, 20),
      active: true,
      note: 'التزام قادم',
    }

    const res = calculateForecast({
      transactions: [smallIncome, smallExpense],
      recurring: [bigFutureObligation],
      monthStartDay: 25,
      referenceDate: refDate,
    })

    // Projected net is negative (deficit projected)
    expect(res.isDeficitProjected).toBe(true)
    // Depletion day should be defined even though it lands in October (the next calendar month, but within cycle)
    expect(res.estimatedDeficitDay).toBeDefined()
    expect(typeof res.estimatedDeficitDay).toBe('number')
  })

  it('preserves target day (e.g. 31st) when advancing recurring occurrences across short months', () => {
    // Start date Jan 31, 2026, frequency monthly
    // In March 2026, advancing from Feb 28 should restore to March 31
    const recDay31: Recurring = {
      id: 'rec-31',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-sub',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 31), // Jan 31
      nextDate: new Date(2026, 1, 28), // Feb 28
      active: true,
      note: 'اشتراك شهري يوم 31',
    }

    // Forecasting for March (March 1 - April 1)
    const marchRef = new Date(2026, 2, 5)
    const res = calculateForecast({
      transactions: [],
      recurring: [recDay31],
      monthStartDay: 1,
      referenceDate: marchRef,
    })

    // Feb 28 was prior to March 1. It advances to March 31, which is >= March 5 and < April 1.
    expect(res.upcomingRecurringExpenses).toBe(50000)
  })

  it('correctly integrates negative rollover deficit into available balance and exposes availablePool', () => {
    // Current month: 500 JOD income, 100 JOD expense
    // Rollover from previous months is a deficit of -150 JOD (-150,000 fils)
    const incomeTx: Transaction = {
      id: 'tx-inc-500',
      type: 'income',
      amountFils: 500000,
      categoryId: 'cat-inc',
      date: new Date(2026, 9, 2),
      note: 'راتب',
      createdAt: new Date(),
    }
    const expenseTx: Transaction = {
      id: 'tx-exp-100',
      type: 'expense',
      amountFils: 100000,
      categoryId: 'cat-exp',
      date: new Date(2026, 9, 5),
      note: 'مصاريف',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [incomeTx, expenseTx],
      rolloverBalanceFils: -150000, // Deficit from prior month
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    expect(res.rolloverBalance).toBe(-150000)
    // monthNet = 500,000 - 100,000 = +400,000
    expect(res.monthNet).toBe(400000)
    // availableBalance = -150,000 + 400,000 = +250,000
    expect(res.availableBalance).toBe(250000)
    // availablePool = 500,000 + (-150,000) = 350,000
    expect(res.availablePool).toBe(350000)
    // freeBalance = 250,000
    expect(res.freeBalance).toBe(250000)
    expect(res.healthStatus).toBe('safe')
  })

  it('triggers deficit/danger status when negative rollover deficit exceeds current income', () => {
    // Current month: 200 JOD income, 50 JOD expense
    // Rollover deficit: -300 JOD (-300,000 fils)
    const incomeTx: Transaction = {
      id: 'tx-inc-200',
      type: 'income',
      amountFils: 200000,
      categoryId: 'cat-inc',
      date: new Date(2026, 9, 2),
      note: 'دخل',
      createdAt: new Date(),
    }
    const expenseTx: Transaction = {
      id: 'tx-exp-50',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-exp',
      date: new Date(2026, 9, 5),
      note: 'مصاريف',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [incomeTx, expenseTx],
      rolloverBalanceFils: -300000,
      monthStartDay: 1,
      referenceDate: midMonthDate,
    })

    expect(res.rolloverBalance).toBe(-300000)
    // monthNet = +150,000. availableBalance = -300,000 + 150,000 = -150,000
    expect(res.availableBalance).toBe(-150000)
    expect(res.availablePool).toBe(-100000)
    expect(res.freeBalance).toBe(-150000)
    expect(res.dailySafeFils).toBe(0)
    expect(res.healthStatus).toBe('danger')
    expect(res.isDeficitProjected).toBe(true)
  })
})
