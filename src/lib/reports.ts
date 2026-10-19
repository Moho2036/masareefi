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
 * Calculates daily expense breakdown for every single calendar day within [start, end).
 * Ensures days with 0 expenses are present to provide a smooth continuous chart line/area.
 */
export function calculateDailyExpenses(
  txs: Transaction[],
  start: Date,
  end: Date
): DailyExpenseItem[] {
  let current = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0)
  const endBoundary = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0)

  if (current.getTime() >= endBoundary.getTime()) {
    return []
  }

  // Pre-aggregate expenses by YYYY-MM-DD
  const expenseMap = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type !== 'expense') continue
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const y = txDate.getFullYear()
    const m = String(txDate.getMonth() + 1).padStart(2, '0')
    const d = String(txDate.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${d}`
    expenseMap.set(key, (expenseMap.get(key) || 0) + tx.amountFils)
  }

  const result: DailyExpenseItem[] = []
  while (current.getTime() < endBoundary.getTime()) {
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
