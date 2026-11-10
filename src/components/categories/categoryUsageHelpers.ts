import type { Category, Recurring, MoneyCircle, Transaction } from '../../types'
import type { CategoryUsageDetails } from '../../lib/categoryUsage'

export const EMPTY_USAGE_DETAILS: CategoryUsageDetails = {
  txCount: 0,
  recurringCount: 0,
  circlesCount: 0,
  totalCount: 0,
  isInUse: false,
}

export function calculateCategoryMonthStats(
  transactions: Transaction[],
  financialRange: { start: Date; end: Date }
): Record<string, { totalFils: number; count: number }> {
  const stats: Record<string, { totalFils: number; count: number }> = {}
  const currentMonthTxs = transactions.filter((tx) => {
    const txTime = tx.date instanceof Date ? tx.date.getTime() : new Date(tx.date).getTime()
    return txTime >= financialRange.start.getTime() && txTime < financialRange.end.getTime()
  })
  for (const tx of currentMonthTxs) {
    if (!stats[tx.categoryId]) {
      stats[tx.categoryId] = { totalFils: 0, count: 0 }
    }
    stats[tx.categoryId].totalFils += tx.amountFils
    stats[tx.categoryId].count += 1
  }
  return stats
}

export function calculateCategoryUsageDetails(
  categories: Category[],
  usageMap: Record<string, number>,
  recurring: Recurring[],
  moneyCircles: MoneyCircle[]
): Record<string, CategoryUsageDetails> {
  const recCounts: Record<string, number> = {}
  for (const rec of recurring) {
    if (rec.categoryId) {
      recCounts[rec.categoryId] = (recCounts[rec.categoryId] || 0) + 1
    }
  }
  const circleCounts: Record<string, number> = {}
  for (const c of moneyCircles) {
    const linkedIds = new Set<string>()
    if (c.expenseCategoryId) linkedIds.add(c.expenseCategoryId)
    if (c.incomeCategoryId) linkedIds.add(c.incomeCategoryId)
    if (c.categoryId) linkedIds.add(c.categoryId)
    for (const cid of linkedIds) {
      circleCounts[cid] = (circleCounts[cid] || 0) + 1
    }
  }
  const result: Record<string, CategoryUsageDetails> = {}
  for (const cat of categories) {
    const txCount = usageMap[cat.id] || 0
    const recurringCount = recCounts[cat.id] || 0
    const circlesCount = circleCounts[cat.id] || 0
    const totalCount = txCount + recurringCount + circlesCount
    result[cat.id] = {
      txCount,
      recurringCount,
      circlesCount,
      totalCount,
      isInUse: totalCount > 0,
    }
  }
  return result
}

export function getLinkedCommitmentsText(
  catId: string,
  usageDetailsByCategory: Record<string, CategoryUsageDetails>
): string | null {
  const details = usageDetailsByCategory[catId]
  if (!details) return null
  const parts: string[] = []
  if (details.recurringCount > 0) {
    if (details.recurringCount === 1) parts.push('معاملة متكررة مرتبطة')
    else if (details.recurringCount === 2) parts.push('معاملتان متكررتان')
    else if (details.recurringCount <= 10) parts.push(`${details.recurringCount} معاملات متكررة`)
    else parts.push(`${details.recurringCount} معاملة متكررة`)
  }
  if (details.circlesCount > 0) {
    if (details.circlesCount === 1) parts.push('جمعية مالية مرتبطة')
    else if (details.circlesCount === 2) parts.push('جمعيتان ماليتان')
    else if (details.circlesCount <= 10) parts.push(`${details.circlesCount} جمعيات مالية`)
    else parts.push(`${details.circlesCount} جمعية مالية`)
  }
  return parts.length > 0 ? parts.join(' • ') : null
}

export function formatUsageText(
  catId: string,
  usageDetailsByCategory: Record<string, CategoryUsageDetails>,
  currentMonthTxCounts: Record<string, number>
): string {
  const details = usageDetailsByCategory[catId] || {
    txCount: 0,
    recurringCount: 0,
    circlesCount: 0,
    totalCount: 0,
    isInUse: false,
  }
  const currentMonthCount = currentMonthTxCounts[catId] || 0

  if (!details.isInUse) {
    return 'غير مستخدم'
  }

  const parts: string[] = []
  if (currentMonthCount > 0) {
    if (currentMonthCount === 1) parts.push('معاملة واحدة هذا الشهر')
    else if (currentMonthCount === 2) parts.push('معاملتان هذا الشهر')
    else if (currentMonthCount <= 10) parts.push(`${currentMonthCount} معاملات هذا الشهر`)
    else parts.push(`${currentMonthCount} معاملة هذا الشهر`)
  } else if (details.txCount > 0) {
    if (details.txCount === 1) parts.push('معاملة واحدة سابقة')
    else if (details.txCount === 2) parts.push('معاملتان سابقتان')
    else if (details.txCount <= 10) parts.push(`${details.txCount} معاملات سابقة`)
    else parts.push(`${details.txCount} معاملة سابقة`)
  }

  if (details.recurringCount > 0) {
    if (details.recurringCount === 1) parts.push('معاملة متكررة مرتبطة')
    else if (details.recurringCount === 2) parts.push('معاملتان متكررتان')
    else if (details.recurringCount <= 10) parts.push(`${details.recurringCount} معاملات متكررة`)
    else parts.push(`${details.recurringCount} معاملة متكررة`)
  }

  if (details.circlesCount > 0) {
    if (details.circlesCount === 1) parts.push('جمعية مالية مرتبطة')
    else if (details.circlesCount === 2) parts.push('جمعيتان ماليتان')
    else if (details.circlesCount <= 10) parts.push(`${details.circlesCount} جمعيات مالية`)
    else parts.push(`${details.circlesCount} جمعية مالية`)
  }

  return parts.join(' • ')
}
