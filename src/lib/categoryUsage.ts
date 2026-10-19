const USAGE_KEY = 'masareefi_category_usage'

export function getCategoryUsageMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function saveCategoryUsageMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(map))
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
