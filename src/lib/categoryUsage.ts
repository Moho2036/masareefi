const USAGE_KEY = 'baseer_category_usage'
const LEGACY_USAGE_KEY = 'masareefi_category_usage'

export function getCategoryUsageMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(USAGE_KEY) || localStorage.getItem(LEGACY_USAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCategoryUsageMap(map: Record<string, number>): void {
  try {
    const serialized = JSON.stringify(map)
    localStorage.setItem(USAGE_KEY, serialized)
    localStorage.setItem(LEGACY_USAGE_KEY, serialized)
  } catch {
    // Ignore storage errors
  }
}

export function recordCategoryUsage(categoryId: string): void {
  if (!categoryId) return
  try {
    const map = getCategoryUsageMap()
    map[categoryId] = (map[categoryId] || 0) + 1
    saveCategoryUsageMap(map)
  } catch {
    // Ignore storage errors
  }
}

export function buildUsageFromTransactions(
  transactions: Array<{ categoryId?: string }>
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const tx of transactions) {
    if (tx.categoryId) {
      map[tx.categoryId] = (map[tx.categoryId] || 0) + 1
    }
  }
  return map
}

/**
 * Synchronizes the category usage cache in localStorage directly from the current transactions,
 * ensuring Firestore transactions remain the single source of truth without accumulating deleted counts.
 */
export function syncCategoryUsageCache(
  transactions: Array<{ categoryId?: string }>
): Record<string, number> {
  const map = buildUsageFromTransactions(transactions)
  saveCategoryUsageMap(map)
  return map
}

export function mergeUsageMaps(
  txMap: Record<string, number>,
  localMap: Record<string, number> = getCategoryUsageMap()
): Record<string, number> {
  const merged: Record<string, number> = { ...txMap }
  for (const [catId, count] of Object.entries(localMap)) {
    merged[catId] = Math.max(merged[catId] || 0, count)
  }
  return merged
}

export function mergeAndSaveUsage(
  txMap: Record<string, number>,
  localMap: Record<string, number> = getCategoryUsageMap()
): Record<string, number> {
  const merged = mergeUsageMaps(txMap, localMap)
  saveCategoryUsageMap(merged)
  return merged
}

export function sortCategoriesByUsage<T extends { id: string; order: number }>(
  categories: T[],
  usageMap: Record<string, number>
): T[] {
  return [...categories].sort((a, b) => {
    const countA = usageMap[a.id] || 0
    const countB = usageMap[b.id] || 0
    if (countB !== countA) {
      return countB - countA // Highest usage first
    }
    return a.order - b.order // Fallback to original natural order
  })
}

export function sortCategoriesUnified<T extends { id: string; order: number }>(
  categories: T[],
  usageMap: Record<string, number>,
  mode: 'usage' | 'manual' = 'usage'
): T[] {
  if (mode === 'manual') {
    return [...categories].sort((a, b) => a.order - b.order)
  }
  return sortCategoriesByUsage(categories, usageMap)
}

export interface CategoryUsageDetails {
  txCount: number
  recurringCount: number
  circlesCount: number
  totalCount: number
  isInUse: boolean
}

/**
 * Calculates detailed usage counts for a given category across:
 * - Active or current transactions list
 * - Recurring transactions rules
 * - Money circles (expense/income category linkages)
 * - Persisted local historical usage counts (localStorage)
 */
export function getCategoryUsageDetails(
  categoryId: string,
  transactions: Array<{ categoryId?: string }> = [],
  recurring: Array<{ categoryId?: string }> = [],
  _localMap: Record<string, number> = {},
  circles: Array<{ expenseCategoryId?: string; incomeCategoryId?: string; categoryId?: string }> = []
): CategoryUsageDetails {
  if (!categoryId) {
    return { txCount: 0, recurringCount: 0, circlesCount: 0, totalCount: 0, isInUse: false }
  }

  let txCount = 0
  for (const tx of transactions) {
    if (tx.categoryId === categoryId) txCount++
  }

  let recurringCount = 0
  for (const rec of recurring) {
    if (rec.categoryId === categoryId) recurringCount++
  }

  let circlesCount = 0
  for (const c of circles) {
    if (
      c.expenseCategoryId === categoryId ||
      c.incomeCategoryId === categoryId ||
      c.categoryId === categoryId
    ) {
      circlesCount++
    }
  }

  const effectiveTxCount = txCount
  const totalCount = effectiveTxCount + recurringCount + circlesCount

  return {
    txCount: effectiveTxCount,
    recurringCount,
    circlesCount,
    totalCount,
    isInUse: totalCount > 0,
  }
}

/**
 * Returns the total usage count of a category across transactions, recurring rules, and money circles.
 */
export function getCategoryUsageCount(
  categoryId: string,
  transactions: Array<{ categoryId?: string }> = [],
  recurring: Array<{ categoryId?: string }> = [],
  localMap: Record<string, number> = {},
  circles: Array<{ expenseCategoryId?: string; incomeCategoryId?: string; categoryId?: string }> = []
): number {
  return getCategoryUsageDetails(categoryId, transactions, recurring, localMap, circles).totalCount
}

/**
 * Returns true if a category is currently linked to any transaction, recurring rule, or money circle.
 */
export function isCategoryInUse(
  categoryId: string,
  transactions: Array<{ categoryId?: string }> = [],
  recurring: Array<{ categoryId?: string }> = [],
  localMap: Record<string, number> = {},
  circles: Array<{ expenseCategoryId?: string; incomeCategoryId?: string; categoryId?: string }> = []
): boolean {
  return getCategoryUsageDetails(categoryId, transactions, recurring, localMap, circles).isInUse
}
