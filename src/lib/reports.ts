import type { Transaction, Category, TxType } from '../types'
import { getFiscalMonthInfo } from './dates'

export interface DailyExpenseItem {
  day: number
  date: Date
  amountFils: number
}

export interface CategoryDistributionItem {
  categoryId: string
  name: string
  icon: string
  color: string
  amountFils: number
  percentage: number
}

export interface MonthlyBreakdownItem {
  monthIndex: number
  monthName: string
  income: number
  expense: number
  balance: number
}

export const ARABIC_MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

/**
 * Calculates daily expense breakdown for calendar days within the specified range.
 * Ensures days with 0 expenses are present to provide a smooth continuous chart line/area.
 *
 * Rules:
 * - If today is provided and lies within [rangeStartDay, rangeEndDay) (the current month):
 *   normally the chart points end at todayDay.
 *   HOWEVER, if there are future expenses registered within the same month (date > todayDay),
 *   effectiveEnd extends to include the latest expense date (or todayDay, whichever is greater,
 *   capped at rangeEndDay), so the daily chart's total points match the month's total expenses.
 * - If today >= rangeEndDay (a completed past month), effectiveEnd is rangeEndDay (all days of the month).
 * - If today is omitted, effectiveEnd defaults to rangeEndDay.
 */
export function generateDailyExpenses(
  txs: Transaction[],
  rangeOrStart: { start: Date; end: Date } | Date,
  endOrToday?: Date,
  maybeToday?: Date
): DailyExpenseItem[] {
  let start: Date
  let end: Date
  let today: Date | undefined

  if (rangeOrStart instanceof Date) {
    start = rangeOrStart
    end = endOrToday instanceof Date ? endOrToday : new Date()
    today = maybeToday
  } else {
    start = rangeOrStart.start
    end = rangeOrStart.end
    today = endOrToday
  }

  const rangeStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0)
  const rangeEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0)

  if (rangeStartDay.getTime() >= rangeEndDay.getTime()) {
    return []
  }

  // Pre-aggregate expenses by YYYY-MM-DD and track latest expense within [rangeStartDay, rangeEndDay)
  const expenseMap = new Map<string, number>()
  let latestExpenseDay: Date | null = null

  for (const tx of txs) {
    if (tx.type !== 'expense') continue
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate(), 0, 0, 0, 0)
    if (txDay.getTime() >= rangeStartDay.getTime() && txDay.getTime() < rangeEndDay.getTime()) {
      const y = txDay.getFullYear()
      const m = String(txDay.getMonth() + 1).padStart(2, '0')
      const d = String(txDay.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${d}`
      expenseMap.set(key, (expenseMap.get(key) || 0) + tx.amountFils)

      if (!latestExpenseDay || txDay.getTime() > latestExpenseDay.getTime()) {
        latestExpenseDay = txDay
      }
    }
  }

  let effectiveEnd = rangeEndDay

  if (today) {
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)

    if (todayDay.getTime() >= rangeStartDay.getTime() && todayDay.getTime() < rangeEndDay.getTime()) {
      // In current month: default to todayDay, but extend if there are future expenses within this month
      const maxDay =
        latestExpenseDay && latestExpenseDay.getTime() > todayDay.getTime()
          ? latestExpenseDay
          : todayDay

      // Include maxDay in the loop: cutoff is maxDay + 1 day, capped at rangeEndDay
      const nextDay = new Date(maxDay.getFullYear(), maxDay.getMonth(), maxDay.getDate() + 1, 0, 0, 0, 0)
      effectiveEnd = nextDay.getTime() > rangeEndDay.getTime() ? rangeEndDay : nextDay
    } else if (todayDay.getTime() < rangeStartDay.getTime()) {
      // In a future month: if there are future expenses, extend to include them
      if (latestExpenseDay) {
        const nextDay = new Date(
          latestExpenseDay.getFullYear(),
          latestExpenseDay.getMonth(),
          latestExpenseDay.getDate() + 1,
          0,
          0,
          0,
          0
        )
        effectiveEnd = nextDay.getTime() > rangeEndDay.getTime() ? rangeEndDay : nextDay
      } else {
        effectiveEnd = rangeStartDay
      }
    } else {
      // Completed past month: show all days
      effectiveEnd = rangeEndDay
    }
  }

  const result: DailyExpenseItem[] = []
  let current = new Date(rangeStartDay)

  while (current.getTime() < effectiveEnd.getTime()) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${d}`
    const amountFils = expenseMap.get(key) || 0

    result.push({
      day: current.getDate(),
      date: new Date(current),
      amountFils,
    })

    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 0, 0, 0, 0)
  }

  return result
}

export const calculateDailyExpenses = generateDailyExpenses

/**
 * Groups transactions by category, calculates total amounts and percentages (rounded to 1 decimal).
 * Sorts descending by amountFils.
 */
export function calculateCategoryDistribution(
  txs: Transaction[],
  categories: Category[],
  type: TxType = 'expense'
): CategoryDistributionItem[] {
  const categoryMap = new Map<string, Category>()
  for (const c of categories) {
    categoryMap.set(c.id, c)
  }

  const totals = new Map<string, number>()
  let totalFils = 0

  for (const tx of txs) {
    if (tx.type !== type) continue
    totals.set(tx.categoryId, (totals.get(tx.categoryId) || 0) + tx.amountFils)
    totalFils += tx.amountFils
  }

  if (totalFils === 0 || totals.size === 0) {
    return []
  }

  const items: CategoryDistributionItem[] = []
  for (const [catId, amount] of totals.entries()) {
    if (amount <= 0) continue
    const cat = categoryMap.get(catId)
    const percentage =
      totalFils > 0 ? Math.round((amount / totalFils) * 1000) / 10 : 0

    items.push({
      categoryId: catId,
      name: cat ? cat.name : 'غير مصنف',
      icon: cat ? cat.icon : '📁',
      color: cat ? cat.color : '#94A3B8',
      amountFils: amount,
      percentage,
    })
  }

  // Sort descending by amount
  items.sort((a, b) => b.amountFils - a.amountFils)

  return items
}

/**
 * Aggregates all transactions for a specific year into 12 months (indices 0..11).
 * Respects monthStartDay: when monthStartDay > 1, transactions are placed into their
 * corresponding fiscal month cycle (0..11) for that year.
 * Zero-fills months with no activity.
 */
export function calculateYearlyBreakdown(
  txs: Transaction[],
  year: number,
  monthStartDay: number = 1
): MonthlyBreakdownItem[] {
  const safeStartDay = Math.max(1, Math.min(28, Math.floor(monthStartDay) || 1))
  const monthlyData: { income: number; expense: number }[] = Array.from(
    { length: 12 },
    () => ({ income: 0, expense: 0 })
  )

  for (const tx of txs) {
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)

    let txYear = txDate.getFullYear()
    let monthIndex = txDate.getMonth()

    if (safeStartDay > 1) {
      const fiscal = getFiscalMonthInfo(txDate, safeStartDay)
      txYear = fiscal.year
      monthIndex = fiscal.monthIndex
    }

    if (txYear !== year) continue

    if (monthIndex >= 0 && monthIndex < 12) {
      if (tx.type === 'income') {
        monthlyData[monthIndex].income += tx.amountFils
      } else if (tx.type === 'expense') {
        monthlyData[monthIndex].expense += tx.amountFils
      }
    }
  }

  return monthlyData.map((data, index) => ({
    monthIndex: index,
    monthName: ARABIC_MONTH_NAMES[index],
    income: data.income,
    expense: data.expense,
    balance: data.income - data.expense,
  }))
}

/**
 * Calculates the savings rate percentage: ((income - expense) / income) * 100.
 * Clamped between -100% and 100%. Returns 0 if income <= 0.
 * Rounded to 1 decimal place.
 */
export function calculateSavingsRate(income: number, expense: number): number {
  if (income <= 0) {
    return 0
  }

  const rawRate = ((income - expense) / income) * 100
  const clamped = Math.max(-100, Math.min(100, rawRate))
  return Math.round(clamped * 10) / 10
}

export interface AnnualSummaryResult {
  averageMonthlyExpenseFils: number
  activeMonthsCount: number
  isCurrentMonthOnly: boolean
  note?: string
}

/**
 * Calculates a mathematically sound annual summary of expenses and monthly average.
 *
 * Rules:
 * 1. Only months with actual expenses (expense > 0) are factored into the expense divisor.
 *    Months with income only and 0 expense are NEVER included in the expense divisor.
 * 2. When selectedYear === currentYear:
 *    - Future months (> currentMonthIndex) are strictly excluded.
 *    - If there are completed past months (< currentMonthIndex) with expenses,
 *      the average is computed over those completed months to reflect true completed spending pace.
 *    - If NO completed past months have expenses, but the current (incomplete) month has expenses,
 *      its expense is shown with note: "بيانات الشهر الجاري فقط — لم يكتمل شهر كامل بعد".
 * 3. When selectedYear < currentYear (completed past year):
 *    - Divides total expenses by the number of months with actual expenses (> 0).
 *    - If no months had expenses, average is 0.
 * 4. When selectedYear > currentYear (future year):
 *    - Divides total expenses by months with actual expenses, or 0 if none.
 */
export function calculateAnnualSummary(
  breakdown: MonthlyBreakdownItem[],
  selectedYear: number,
  currentYear: number,
  currentMonthIndex: number
): AnnualSummaryResult {
  if (!breakdown || breakdown.length === 0) {
    return {
      averageMonthlyExpenseFils: 0,
      activeMonthsCount: 0,
      isCurrentMonthOnly: false,
    }
  }

  // Current year handling
  if (selectedYear === currentYear) {
    // Only consider months up to currentMonthIndex (exclude future months)
    const completedPastExpenseMonths = breakdown.filter(
      (m) => m.monthIndex < currentMonthIndex && m.expense > 0
    )
    const currentMonthItem = breakdown.find((m) => m.monthIndex === currentMonthIndex)
    const hasCurrentMonthExpense = Boolean(currentMonthItem && currentMonthItem.expense > 0)

    if (completedPastExpenseMonths.length > 0) {
      const totalExpense = completedPastExpenseMonths.reduce((acc, m) => acc + m.expense, 0)
      const count = completedPastExpenseMonths.length
      return {
        averageMonthlyExpenseFils: Math.round(totalExpense / count),
        activeMonthsCount: count,
        isCurrentMonthOnly: false,
      }
    }

    if (hasCurrentMonthExpense && currentMonthItem) {
      return {
        averageMonthlyExpenseFils: currentMonthItem.expense,
        activeMonthsCount: 1,
        isCurrentMonthOnly: true,
        note: 'بيانات الشهر الجاري فقط — لم يكتمل شهر كامل بعد',
      }
    }

    return {
      averageMonthlyExpenseFils: 0,
      activeMonthsCount: 0,
      isCurrentMonthOnly: false,
    }
  }

  // Past years or other years
  const activeExpenseMonths = breakdown.filter((m) => m.expense > 0)
  if (activeExpenseMonths.length === 0) {
    return {
      averageMonthlyExpenseFils: 0,
      activeMonthsCount: 0,
      isCurrentMonthOnly: false,
    }
  }

  const totalExpense = activeExpenseMonths.reduce((acc, m) => acc + m.expense, 0)
  const count = activeExpenseMonths.length
  return {
    averageMonthlyExpenseFils: Math.round(totalExpense / count),
    activeMonthsCount: count,
    isCurrentMonthOnly: false,
  }
}

/**
 * Calculates the monthly average expense for a yearly report.
 * Divides yearExpenseFils by activeMonthsCount (minimum 1 when expenses exist).
 */
export function calculateYearlyMonthlyAverage(
  yearExpenseFils: number,
  _selectedYear: number,
  _currentYear: number,
  _currentMonthIndex: number,
  activeMonthsCount: number
): number {
  if (yearExpenseFils <= 0 || activeMonthsCount <= 0) return 0
  const divisor = Math.max(1, activeMonthsCount)
  return Math.round(yearExpenseFils / divisor)
}
