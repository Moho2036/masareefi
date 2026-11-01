import { describe, it, expect } from 'vitest'
import { calculateForecast } from './forecast'
import type { Transaction, Recurring, Debt, MoneyCircle } from '../types'

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
    expect(res.availableBalance).toBe(-300000)
    expect(res.healthStatus).toBe('danger')
    expect(res.deficitAmount).toBe(300000)
    expect(res.surplusAmount).toBe(0)
    expect(res.projectedNet).toBe(-300000)
  })

  it('handles past month with positive rolloverBalance covering month net deficit as surplus', () => {
    const septRange = {
      start: new Date(2026, 8, 1),
      end: new Date(2026, 9, 1),
    }

    const res = calculateForecast({
      transactions: [
        {
          id: 'tx-sept-exp',
          type: 'expense',
          amountFils: 200000,
          categoryId: 'cat-exp',
          date: new Date(2026, 8, 10),
          note: '',
          createdAt: new Date(),
        },
      ],
      rolloverBalanceFils: 1000000, // +1,000 JOD rollover
      monthStartDay: 1,
      referenceDate: midMonthDate, // Oct 15, 2026
      periodRange: septRange,
    })

    expect(res.isPastMonth).toBe(true)
    expect(res.monthNet).toBe(-200000)
    expect(res.rolloverBalance).toBe(1000000)
    expect(res.availableBalance).toBe(800000)
    expect(res.healthStatus).toBe('warning') // Withdrew from rollover but still in surplus
    expect(res.deficitAmount).toBe(0)
    expect(res.surplusAmount).toBe(800000)
    expect(res.projectedNet).toBe(800000)
  })

  it('handles past month with positive rolloverBalance NOT covering month net deficit', () => {
    const septRange = {
      start: new Date(2026, 8, 1),
      end: new Date(2026, 9, 1),
    }

    const res = calculateForecast({
      transactions: [
        {
          id: 'tx-sept-exp',
          type: 'expense',
          amountFils: 500000,
          categoryId: 'cat-exp',
          date: new Date(2026, 8, 10),
          note: '',
          createdAt: new Date(),
        },
      ],
      rolloverBalanceFils: 200000, // +200 JOD rollover, but spent 500 JOD
      monthStartDay: 1,
      referenceDate: midMonthDate,
      periodRange: septRange,
    })

    expect(res.isPastMonth).toBe(true)
    expect(res.monthNet).toBe(-500000)
    expect(res.rolloverBalance).toBe(200000)
    expect(res.availableBalance).toBe(-300000)
    expect(res.healthStatus).toBe('danger')
    expect(res.deficitAmount).toBe(300000)
    expect(res.surplusAmount).toBe(0)
    expect(res.projectedNet).toBe(-300000)
  })

  it('handles past month with negative rolloverBalance and positive month net resulting in net deficit', () => {
    const septRange = {
      start: new Date(2026, 8, 1),
      end: new Date(2026, 9, 1),
    }

    const res = calculateForecast({
      transactions: [
        {
          id: 'tx-sept-inc',
          type: 'income',
          amountFils: 500000,
          categoryId: 'cat-inc',
          date: new Date(2026, 8, 5),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'tx-sept-exp',
          type: 'expense',
          amountFils: 200000,
          categoryId: 'cat-exp',
          date: new Date(2026, 8, 10),
          note: '',
          createdAt: new Date(),
        },
      ],
      rolloverBalanceFils: -400000, // Started with -400 JOD deficit
      monthStartDay: 1,
      referenceDate: midMonthDate,
      periodRange: septRange,
    })

    expect(res.isPastMonth).toBe(true)
    expect(res.monthNet).toBe(300000)
    expect(res.rolloverBalance).toBe(-400000)
    expect(res.availableBalance).toBe(-100000)
    expect(res.healthStatus).toBe('danger')
    expect(res.deficitAmount).toBe(100000)
    expect(res.surplusAmount).toBe(0)
    expect(res.projectedNet).toBe(-100000)
  })

  it('handles past month with positive month net and positive rolloverBalance as safe surplus', () => {
    const septRange = {
      start: new Date(2026, 8, 1),
      end: new Date(2026, 9, 1),
    }

    const res = calculateForecast({
      transactions: [
        {
          id: 'tx-sept-inc',
          type: 'income',
          amountFils: 500000,
          categoryId: 'cat-inc',
          date: new Date(2026, 8, 5),
          note: '',
          createdAt: new Date(),
        },
        {
          id: 'tx-sept-exp',
          type: 'expense',
          amountFils: 300000,
          categoryId: 'cat-exp',
          date: new Date(2026, 8, 10),
          note: '',
          createdAt: new Date(),
        },
      ],
      rolloverBalanceFils: 100000,
      monthStartDay: 1,
      referenceDate: midMonthDate,
      periodRange: septRange,
    })

    expect(res.isPastMonth).toBe(true)
    expect(res.monthNet).toBe(200000)
    expect(res.rolloverBalance).toBe(100000)
    expect(res.availableBalance).toBe(300000)
    expect(res.healthStatus).toBe('safe')
    expect(res.deficitAmount).toBe(0)
    expect(res.surplusAmount).toBe(300000)
    expect(res.projectedNet).toBe(300000)
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

  it('does NOT inflate projected expense when viewing a future month with recorded transactions', () => {
    // Current date is Oct 15, 2026; viewing future month of November 2026
    const novRange = {
      start: new Date(2026, 10, 1),
      end: new Date(2026, 11, 1),
    }

    // A single 10 JOD expense in November
    const novExpense: Transaction = {
      id: 'tx-nov-1',
      type: 'expense',
      amountFils: 10000, // 10 JOD
      categoryId: 'cat-exp',
      date: new Date(2026, 10, 5),
      note: 'فاتورة قادمة',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [novExpense],
      monthStartDay: 1,
      referenceDate: midMonthDate, // Oct 15, 2026
      periodRange: novRange,
    })

    expect(res.isFutureMonth).toBe(true)
    expect(res.elapsedDays).toBe(0)
    expect(res.actualDailySpendFils).toBe(0)
    // Projected expense should ONLY be the recorded 10 JOD, NOT multiplied by 30 days into 310 JOD!
    expect(res.projectedExpense).toBe(10000)
  })

  it('does NOT inflate daily spending rate in current month when transactions are future-dated', () => {
    // Reference date is day 5 of the month (Oct 5, 2026)
    const day5Ref = new Date(2026, 9, 5)

    // Expense on day 3: 15 JOD
    const pastExpense: Transaction = {
      id: 'tx-past-3',
      type: 'expense',
      amountFils: 15000,
      categoryId: 'cat-exp',
      date: new Date(2026, 9, 3),
      note: 'مصروف ماضي',
      createdAt: new Date(),
    }

    // Expense on day 25 (future-dated within this month): 50 JOD
    const futureDatedExpense: Transaction = {
      id: 'tx-future-25',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-exp',
      date: new Date(2026, 9, 25),
      note: 'شيك مؤجل أو فاتورة نهاية الشهر',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [pastExpense, futureDatedExpense],
      monthStartDay: 1,
      referenceDate: day5Ref,
    })

    expect(res.isCurrentMonth).toBe(true)
    expect(res.elapsedDays).toBe(5)
    // actualDailySpendFils should only divide the past 15,000 fils by 5 days = 3,000 fils/day,
    // NOT (15,000 + 50,000) / 5 = 13,000 fils/day!
    expect(res.actualDailySpendFils).toBe(3000)
  })

  it('treats manual circle transactions and linked debt payments as fixed commitments, excluding them from variable spending pace', () => {
    // Reference date: Day 10 of current month
    const day10Ref = new Date(2026, 9, 10)

    // Ordinary variable expense: 20 JOD over 10 days = 2,000 fils/day
    const variableExpense: Transaction = {
      id: 'tx-var-1',
      type: 'expense',
      amountFils: 20000,
      categoryId: 'cat-groceries',
      date: new Date(2026, 9, 5),
      note: 'مشتريات بقالة',
      createdAt: new Date(),
    }

    // Manual money circle installment: 100 JOD (fixed commitment)
    const circleExpense: Transaction = {
      id: 'circle_installment_oct',
      type: 'expense',
      amountFils: 100000,
      categoryId: 'cat-circle',
      date: new Date(2026, 9, 3),
      note: 'قسط جمعية',
      createdAt: new Date(),
    }

    // Custom debt payment: 50 JOD (linked to a debt payment)
    const customDebtTx: Transaction = {
      id: 'custom_debt_pay_abc',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-debt',
      date: new Date(2026, 9, 7),
      note: 'دفعة سداد',
      createdAt: new Date(),
    }

    const debtWithLinkedTx: Debt = {
      id: 'debt-linked-1',
      personName: 'خالد',
      type: 'borrowed',
      amountFils: 100000,
      paidFils: 50000,
      startDate: new Date(2026, 8, 1),
      note: 'سلف',
      settled: false,
      payments: [
        {
          id: 'pay-1',
          amountFils: 50000,
          date: new Date(2026, 9, 7),
          transactionId: 'custom_debt_pay_abc',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [variableExpense, circleExpense, customDebtTx],
      debts: [debtWithLinkedTx],
      monthStartDay: 1,
      referenceDate: day10Ref,
    })

    expect(res.isCurrentMonth).toBe(true)
    expect(res.elapsedDays).toBe(10)
    // Total expense is 20,000 + 100,000 + 50,000 = 170,000 fils
    expect(res.currentExpense).toBe(170000)
    // But actualDailySpendFils (discretionary variable pace) should ONLY count variableExpense (20,000 / 10 = 2,000 fils/day)
    expect(res.actualDailySpendFils).toBe(2000)
  })

  it('correctly forecasts upcoming recurring income, expenses, and debts in a future month without multiplying by days', () => {
    // Reference date: Oct 15, 2026. Target period: December 2026 (31 days)
    const refDate = new Date(2026, 9, 15)
    const decRange = {
      start: new Date(2026, 11, 1),
      end: new Date(2027, 0, 1),
    }

    const recurringSalary: Recurring = {
      id: 'rec-salary',
      type: 'income',
      amountFils: 800000, // 800 JOD
      categoryId: 'cat-salary',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 1),
      nextDate: new Date(2026, 11, 1), // Dec 1, 2026
      active: true,
      note: 'راتب شهري',
    }

    const recurringBill: Recurring = {
      id: 'rec-bill',
      type: 'expense',
      amountFils: 180000, // 180 JOD
      categoryId: 'cat-bills',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 5),
      nextDate: new Date(2026, 11, 5), // Dec 5, 2026
      active: true,
      note: 'إيجار شهري',
    }

    const debtDueInDec: Debt = {
      id: 'debt-dec',
      personName: 'عمر',
      type: 'borrowed',
      amountFils: 120000, // 120 JOD
      paidFils: 20000, // 100 JOD remaining unpaid
      startDate: new Date(2026, 8, 1),
      dueDate: new Date(2026, 11, 20), // Dec 20, 2026
      settled: false,
      note: 'سداد دفعة حاسوب',
      payments: [],
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [recurringSalary, recurringBill],
      debts: [debtDueInDec],
      monthStartDay: 1,
      referenceDate: refDate,
      periodRange: decRange,
      rolloverBalanceFils: 50000, // 50 JOD surplus carried over
    })

    expect(res.isFutureMonth).toBe(true)
    expect(res.totalDays).toBe(31)
    expect(res.elapsedDays).toBe(0)
    expect(res.remainingDays).toBe(31)
    expect(res.actualDailySpendFils).toBe(0)
    expect(res.upcomingRecurringIncome).toBe(800000)
    expect(res.upcomingRecurringExpenses).toBe(180000)
    expect(res.upcomingDebtObligations).toBe(100000) // 120,000 - 20,000 = 100,000

    // Available balance = rollover (50,000) + monthNet (0) = 50,000
    expect(res.availableBalance).toBe(50000)
    // Free balance = availableBalance (50,000) + recurringIncome (800,000) - recurringExpenses (180,000) - debt (100,000) = 570,000
    expect(res.freeBalance).toBe(570000)

    // Daily safe budget divided over all 31 days: floor(570,000 / 31) = 18,387 fils/day
    expect(res.dailySafeFils).toBe(Math.floor(570000 / 31))

    // Projected expense is only the upcoming commitments (280,000), not multiplied by days
    expect(res.projectedExpense).toBe(280000)
    expect(res.projectedNet).toBe(50000 + 800000 - 280000) // 570,000
    expect(res.isDeficitProjected).toBe(false)
    expect(res.healthStatus).toBe('safe')
  })

  it('detects deficit in future month when upcoming obligations exceed income and rollover', () => {
    const refDate = new Date(2026, 9, 15)
    const novRange = {
      start: new Date(2026, 10, 1),
      end: new Date(2026, 11, 1),
    }

    // Heavy recurring obligation in November
    const heavyRecurring: Recurring = {
      id: 'rec-heavy',
      type: 'expense',
      amountFils: 600000, // 600 JOD
      categoryId: 'cat-tuition',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 10),
      nextDate: new Date(2026, 10, 10),
      active: true,
      note: 'قسط جامعي',
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [heavyRecurring],
      monthStartDay: 1,
      referenceDate: refDate,
      periodRange: novRange,
      rolloverBalanceFils: -50000, // -50 JOD deficit carried over!
    })

    expect(res.isFutureMonth).toBe(true)
    expect(res.upcomingRecurringExpenses).toBe(600000)
    expect(res.availableBalance).toBe(-50000)
    // Free balance = -50,000 - 600,000 = -650,000
    expect(res.freeBalance).toBe(-650000)
    expect(res.dailySafeFils).toBe(0)
    expect(res.isDeficitProjected).toBe(true)
    expect(res.deficitAmount).toBe(650000)
    expect(res.healthStatus).toBe('danger')
  })

  it('restricts due debts in future months strictly to the future month window [rangeStart, rangeEnd)', () => {
    // Current date: Oct 15, 2026
    const refDate = new Date(2026, 9, 15)
    // Viewing December 2026
    const decRange = {
      start: new Date(2026, 11, 1),
      end: new Date(2027, 0, 1),
    }

    // Debt 1: was due in October (prior to December)
    const octDebt: Debt = {
      id: 'debt-oct',
      personName: 'عمر',
      type: 'borrowed',
      amountFils: 100000,
      paidFils: 0,
      startDate: new Date(2026, 9, 1),
      dueDate: new Date(2026, 9, 20),
      settled: false,
      note: '',
      payments: [],
      createdAt: new Date(2026, 9, 1),
    }

    // Debt 2: due in December (within December range)
    const decDebt: Debt = {
      id: 'debt-dec',
      personName: 'سمير',
      type: 'borrowed',
      amountFils: 80000,
      paidFils: 0,
      startDate: new Date(2026, 9, 1),
      dueDate: new Date(2026, 11, 15),
      settled: false,
      note: '',
      payments: [],
      createdAt: new Date(2026, 9, 1),
    }

    // Debt 3: due in January 2027 (after December range)
    const janDebt: Debt = {
      id: 'debt-jan',
      personName: 'طارق',
      type: 'borrowed',
      amountFils: 50000,
      paidFils: 0,
      startDate: new Date(2026, 9, 1),
      dueDate: new Date(2027, 0, 10),
      settled: false,
      note: '',
      payments: [],
      createdAt: new Date(2026, 9, 1),
    }

    const res = calculateForecast({
      transactions: [],
      debts: [octDebt, decDebt, janDebt],
      monthStartDay: 1,
      referenceDate: refDate,
      periodRange: decRange,
    })

    expect(res.isFutureMonth).toBe(true)
    // Only decDebt (80,000 fils) should be included; octDebt and janDebt must NOT be included!
    expect(res.upcomingDebtObligations).toBe(80000)
  })

  it('keeps past unpaid debts visible in upcomingDebtObligations in future months when rolloverBalance is disabled', () => {
    // Current date: Oct 15, 2026
    const refDate = new Date(2026, 9, 15)
    // Viewing December 2026
    const decRange = {
      start: new Date(2026, 11, 1),
      end: new Date(2027, 0, 1),
    }

    // Past overdue unpaid debt (due Oct 5, before refDate Oct 15)
    const overduePastDebt: Debt = {
      id: 'debt-past-overdue',
      personName: 'صالح',
      type: 'borrowed',
      amountFils: 60000,
      paidFils: 0,
      startDate: new Date(2026, 8, 1),
      dueDate: new Date(2026, 9, 5), // past overdue
      settled: false,
      note: '',
      payments: [],
      createdAt: new Date(2026, 8, 1),
    }

    // Debt due in December
    const decDebt: Debt = {
      id: 'debt-dec',
      personName: 'سمير',
      type: 'borrowed',
      amountFils: 80000,
      paidFils: 0,
      startDate: new Date(2026, 9, 1),
      dueDate: new Date(2026, 11, 15),
      settled: false,
      note: '',
      payments: [],
      createdAt: new Date(2026, 9, 1),
    }

    const res = calculateForecast({
      transactions: [],
      debts: [overduePastDebt, decDebt],
      monthStartDay: 1,
      referenceDate: refDate,
      periodRange: decRange,
      // rolloverBalanceFils is omitted (disabled)
    })

    expect(res.isFutureMonth).toBe(true)
    // Both decDebt (80,000) and overduePastDebt (60,000) must be included = 140,000 fils!
    expect(res.upcomingDebtObligations).toBe(140000)
  })

  it('accumulates intermediate active recurring items between now and rangeStart into rolloverBalance for future months', () => {
    // Current date: Oct 20, 2026
    const refDate = new Date(2026, 9, 20)
    // Viewing December 2026
    const decRange = {
      start: new Date(2026, 11, 1),
      end: new Date(2027, 0, 1),
    }

    // Recurring salary: monthly on the 25th (500 JOD)
    // Oct 25 (intermediate) and Nov 25 (intermediate) occur before Dec 1!
    // Dec 25 occurs inside December!
    const salaryRec: Recurring = {
      id: 'rec-salary',
      type: 'income',
      amountFils: 500000,
      categoryId: 'cat-sal',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 25),
      nextDate: new Date(2026, 9, 25),
      active: true,
      note: 'راتب',
    }

    // Recurring rent: monthly on the 1st (200 JOD)
    // Nov 1 (intermediate) occurs before Dec 1!
    // Dec 1 occurs inside December!
    const rentRec: Recurring = {
      id: 'rec-rent',
      type: 'expense',
      amountFils: 200000,
      categoryId: 'cat-rent',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 1),
      nextDate: new Date(2026, 10, 1), // Nov 1
      active: true,
      note: 'إيجار',
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [salaryRec, rentRec],
      monthStartDay: 1,
      referenceDate: refDate,
      periodRange: decRange,
      rolloverBalanceFils: 100000, // Starts with +100 JOD base prior balance
    })

    expect(res.isFutureMonth).toBe(true)
    // Intermediate net between Oct 20 and Dec 1:
    // Income: Oct 25 (+500,000) + Nov 25 (+500,000) = +1,000,000
    // Expense: Nov 1 (-200,000)
    // Intermediate net = +800,000 fils
    // Effective rolloverBalance = 100,000 + 800,000 = 900,000 fils
    expect(res.rolloverBalance).toBe(900000)
    expect(res.availableBalance).toBe(900000)

    // Inside December:
    // Income: Dec 25 (+500,000)
    // Expense: Dec 1 (-200,000)
    expect(res.upcomingRecurringIncome).toBe(500000)
    expect(res.upcomingRecurringExpenses).toBe(200000)

    // Free balance = 900,000 + 500,000 - 200,000 = 1,200,000 fils
    expect(res.freeBalance).toBe(1200000)
  })

  it('marks healthStatus as warning when current month has cash deficit but free balance is positive due to scheduled recurring income', () => {
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

    expect(res.isCurrentMonth).toBe(true)
    expect(res.availableBalance).toBe(-50000)
    expect(res.freeBalance).toBe(450000)
    expect(res.isDeficitProjected).toBe(false)
    expect(res.healthStatus).toBe('warning')
  })

  it('correctly calculates 30-day month forecast without double-counting the current day', () => {
    // April 2026: 30 days (April 1 to May 1)
    const range = {
      start: new Date(2026, 3, 1),
      end: new Date(2026, 4, 1),
    }

    const incomeTx: Transaction = {
      id: 'tx-inc-30d',
      type: 'income',
      amountFils: 300000, // 300 JOD
      categoryId: 'cat-inc',
      date: new Date(2026, 3, 1),
      note: 'راتب',
      createdAt: new Date(),
    }

    const dayOneExpenseTx: Transaction = {
      id: 'tx-exp-day1',
      type: 'expense',
      amountFils: 10000, // 10 JOD on day 1
      categoryId: 'cat-exp',
      date: new Date(2026, 3, 1),
      note: 'مصروف اليوم الأول',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [incomeTx, dayOneExpenseTx],
      periodRange: range,
      referenceDate: new Date(2026, 3, 1), // Day 1 of the cycle
    })

    expect(res.totalDays).toBe(30)
    expect(res.elapsedDays).toBe(1)
    expect(res.remainingDays).toBe(30)
    expect(res.actualDailySpendFils).toBe(10000)
    // 10,000 spent today + 10,000 * 29 future unelapsed days = 300,000 projected expense
    expect(res.projectedExpense).toBe(300000)
    expect(res.projectedNet).toBe(0)
    expect(res.isDeficitProjected).toBe(false)
  })

  it('does not inflate actualDailySpendFils when inventory difference reconciliation transaction is present', () => {
    // Current date: Oct 2 (2 days elapsed)
    const refDate = new Date(2026, 9, 2)

    const incomeTx: Transaction = {
      id: 'tx-inc',
      type: 'income',
      amountFils: 500000,
      categoryId: 'cat-inc',
      date: new Date(2026, 9, 1),
      note: 'راتب',
      createdAt: new Date(),
    }

    const regularExpenseTx: Transaction = {
      id: 'tx-reg-exp',
      type: 'expense',
      amountFils: 10000, // 10 JOD regular spending over 2 days -> pace = 5000 fils/day
      categoryId: 'cat-exp',
      date: new Date(2026, 9, 1),
      note: 'بقالة',
      createdAt: new Date(),
    }

    const inventoryDiffTx: Transaction = {
      id: 'tx-inventory-diff',
      type: 'expense',
      amountFils: 40000, // 40 JOD automated reconciliation
      categoryId: 'cat-other',
      date: new Date(2026, 9, 1),
      title: 'تسوية رصيد (فرق جرد)',
      note: 'معاملة تسوية مسجلة آلياً لمطابقة الرصيد الفعلي',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [incomeTx, regularExpenseTx, inventoryDiffTx],
      monthStartDay: 1,
      referenceDate: refDate,
    })

    expect(res.currentExpense).toBe(50000) // Both entered currentExpense
    // Inventory difference should be excluded from flexible daily pace calculation:
    // Only regularExpense (10000) / 2 elapsed days = 5000 fils/day (not 50000 / 2 = 25000)
    expect(res.actualDailySpendFils).toBe(5000)
  })

  it('does not double count recurring circle installment in upcomingRecurringExpenses when circle_ manual transaction exists', () => {
    const circleId = 'circle-xyz'
    const recurringCircleRule: Recurring = {
      id: 'rec-circle-rule',
      circleId,
      type: 'expense',
      amountFils: 50000, // 50 JOD
      categoryId: 'cat-circle',
      frequency: 'monthly',
      startDate: new Date(2026, 9, 1),
      nextDate: new Date(2026, 9, 1),
      active: true,
      note: 'قسط جمعية',
    }

    // Manual payment transaction recorded for Month 1
    const manualCircleTx: Transaction = {
      id: `circle_${circleId}_m1`,
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-circle',
      date: new Date(2026, 9, 2),
      note: 'قسط جمعية مدفوع يدوياً',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [manualCircleTx],
      recurring: [recurringCircleRule],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 5),
    })

    // Because circle_${circleId}_m1 is recorded, upcoming recurring should be 0 (no double deduction)
    expect(res.upcomingRecurringExpenses).toBe(0)
    expect(res.currentExpense).toBe(50000)
  })

  it('reserves unpaid circle installment in upcomingRecurringExpenses for active circle when user has not paid', () => {
    const circle: MoneyCircle = {
      id: 'circle-active-1',
      name: 'جمعية نشطة',
      monthlyAmountFils: 60000,
      membersCount: 5,
      totalAmountFils: 300000,
      myTurnMonth: 3,
      startDate: new Date(2026, 9, 1),
      members: [
        { id: 'm-me', name: 'أنا', turnMonth: 3, paidMonths: [] },
      ],
      status: 'active',
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [],
      circles: [circle],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 10), // Month 1 of circle, not user's turn (turn 3)
    })

    // Unpaid installment (60.000) should be reserved in upcomingRecurringExpenses
    expect(res.upcomingRecurringExpenses).toBe(60000)
    expect(res.freeBalance).toBe(-60000) // availableBalance (0) - 60000
  })

  it('reserves unpaid circle installment when auto-pay was unchecked and rec.nextDate jumped to next month', () => {
    const circleId = 'circle-jumped'
    const circle: MoneyCircle = {
      id: circleId,
      name: 'جمعية معلقة',
      monthlyAmountFils: 50000,
      membersCount: 4,
      totalAmountFils: 200000,
      myTurnMonth: 4,
      startDate: new Date(2026, 9, 1),
      members: [
        {
          id: 'm-me',
          name: 'أنا',
          turnMonth: 4,
          paidMonths: [],
          paymentsByMonth: { '1': false }, // unchecked
        },
      ],
      status: 'active',
      createdAt: new Date(),
    }

    // Recurring rule nextDate jumped to next month (Nov 1)
    const jumpedRecurringRule: Recurring = {
      id: 'rec-jumped',
      circleId,
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-circle',
      frequency: 'monthly',
      startDate: new Date(2026, 9, 1),
      nextDate: new Date(2026, 10, 1), // Nov 1
      active: true,
      note: 'قسط جمعية',
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [jumpedRecurringRule],
      circles: [circle],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 15), // Oct 15
    })

    // Because recurring rule has nextDate in Nov, the recurring loop did not book it for Oct.
    // But the circles logic detects unpaid month 1 and reserves 50.000 in upcomingRecurringExpenses!
    expect(res.upcomingRecurringExpenses).toBe(50000)
  })

  it('does not double count circle installment when recurring rule already booked it in current cycle', () => {
    const circleId = 'circle-already-booked'
    const circle: MoneyCircle = {
      id: circleId,
      name: 'جمعية عادية',
      monthlyAmountFils: 70000,
      membersCount: 4,
      totalAmountFils: 280000,
      myTurnMonth: 3,
      startDate: new Date(2026, 9, 1),
      members: [
        { id: 'm-me', name: 'أنا', turnMonth: 3, paidMonths: [] },
      ],
      status: 'active',
      createdAt: new Date(),
    }

    const activeRecurringRule: Recurring = {
      id: 'rec-circle-oct',
      circleId,
      type: 'expense',
      amountFils: 70000,
      categoryId: 'cat-circle',
      frequency: 'monthly',
      startDate: new Date(2026, 9, 1),
      nextDate: new Date(2026, 9, 20), // Oct 20
      active: true,
      note: 'قسط جمعية',
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [activeRecurringRule],
      circles: [circle],
      monthStartDay: 1,
      referenceDate: new Date(2026, 9, 10),
    })

    // It should only be counted once (70.000, not 140.000)
    expect(res.upcomingRecurringExpenses).toBe(70000)
  })

  it('calculates nextCycleSoonObligationsFils and count when within 3 days of cycle end', () => {
    // Current cycle Oct 1 - Nov 1 (refDate: Oct 30, rangeEnd: Nov 1)
    // 3 days horizon from Oct 30 is Nov 2 23:59:59.999 >= rangeEnd (Nov 1)
    const refDate = new Date(2026, 9, 30)

    const upcomingRent: Recurring = {
      id: 'rec-rent',
      type: 'expense',
      amountFils: 300000, // 300 JOD
      categoryId: 'cat-rent',
      frequency: 'monthly',
      startDate: new Date(2026, 8, 1),
      nextDate: new Date(2026, 10, 1), // Nov 1 (falls within [rangeEnd, threeDaysHorizon])
      active: true,
      note: 'إيجار المنزل',
    }

    const dueDebt: Debt = {
      id: 'debt-due-soon',
      personName: 'أبو أحمد',
      type: 'borrowed',
      amountFils: 100000, // 100 JOD
      paidFils: 20000, // remaining 80 JOD
      settled: false,
      startDate: new Date(2026, 8, 1),
      note: 'سلفة',
      payments: [],
      dueDate: new Date(2026, 10, 2), // Nov 2 (falls within [rangeEnd, threeDaysHorizon])
      createdAt: new Date(),
    }

    const farDebt: Debt = {
      id: 'debt-far',
      personName: 'خالد',
      type: 'borrowed',
      amountFils: 50000,
      paidFils: 0,
      settled: false,
      startDate: new Date(2026, 8, 1),
      note: 'سلفة ثانية',
      payments: [],
      dueDate: new Date(2026, 10, 10), // Nov 10 (beyond 3-day horizon)
      createdAt: new Date(),
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [upcomingRent],
      debts: [dueDebt, farDebt],
      monthStartDay: 1,
      referenceDate: refDate,
    })

    expect(res.isCurrentMonth).toBe(true)
    // Rent (300.000) + Due debt (80.000) = 380.000
    expect(res.nextCycleSoonObligationsFils).toBe(380000)
    expect(res.nextCycleSoonCount).toBe(2)
  })

  it('does not calculate nextCycleSoonObligationsFils when far from cycle end', () => {
    // RefDate: Oct 15 -> 3-day horizon is Oct 18, far from Nov 1
    const refDate = new Date(2026, 9, 15)

    const upcomingRent: Recurring = {
      id: 'rec-rent',
      type: 'expense',
      amountFils: 300000,
      categoryId: 'cat-rent',
      frequency: 'monthly',
      startDate: new Date(2026, 8, 1),
      nextDate: new Date(2026, 10, 1),
      active: true,
      note: 'إيجار المنزل',
    }

    const res = calculateForecast({
      transactions: [],
      recurring: [upcomingRent],
      monthStartDay: 1,
      referenceDate: refDate,
    })

    expect(res.nextCycleSoonObligationsFils).toBe(0)
    expect(res.nextCycleSoonCount).toBe(0)
  })
})
