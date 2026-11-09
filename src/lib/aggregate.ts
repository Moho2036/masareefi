import { fromFils } from './money'
import { toWesternDigits } from './dates'
import type { Transaction, TxType } from '../types'

/**
 * Normalizes Arabic text for tolerant search:
 * - Removes tashkeel / harakat diacritics
 * - Normalizes hamzahs on Alef (أ, إ, آ, ٱ -> ا)
 * - Normalizes Taa Marbutah (ة -> ه)
 * - Normalizes Yaa / Alef Maksura (ى -> ي)
 * - Lowercases English characters and trims
 */
export function normalizeArabic(text: string): string {
  if (!text) return ''
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove diacritics / tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim()
}

export interface FilterTransactionsOptions {
  query?: string
  type?: TxType | 'all'
  categoryId?: string
  categoryIds?: string[]
  sourceType?: 'all' | 'manual' | 'recurring' | 'debt' | 'circle'
  dateRange?: { from?: Date; to?: Date }
  circleRecurringIdsSet?: Set<string>
  debtTransactionIdsSet?: Set<string>
}

export type CategoryResolver =
  | Map<string, { name?: string }>
  | Record<string, { name?: string }>
  | ((categoryId: string) => string | undefined)

const AMOUNT_FMT_3 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})
const AMOUNT_FMT_2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const AMOUNT_FMT_BASIC = new Intl.NumberFormat('en-US')

export function filterTransactions(
  txs: Transaction[],
  filters: FilterTransactionsOptions = {},
  categoryResolver?: CategoryResolver
): Transaction[] {
  const { query, type, categoryId, categoryIds, sourceType, dateRange } = filters
  const rawQuery = query ? query.trim() : ''
  const normalizedQuery = rawQuery ? normalizeArabic(toWesternDigits(rawQuery)) : ''

  const categorySet =
    categoryIds && categoryIds.length > 0 && !categoryIds.includes('all')
      ? new Set(categoryIds)
      : null

  let fromTime: number | null = null
  let toTime: number | null = null
  if (dateRange?.from) {
    const fromMidnight = new Date(dateRange.from)
    fromMidnight.setHours(0, 0, 0, 0)
    fromTime = fromMidnight.getTime()
  }
  if (dateRange?.to) {
    const toEndDay = new Date(dateRange.to)
    toEndDay.setHours(23, 59, 59, 999)
    toTime = toEndDay.getTime()
  }

  const queryHasDigits = normalizedQuery ? /\d/.test(normalizedQuery) : false
  const cleanQuery = normalizedQuery ? normalizedQuery.replace(/[,،]/g, '') : ''
  const normalizedCatCache = new Map<string, string>()

  return txs.filter((tx) => {
    if (type && type !== 'all' && tx.type !== type) {
      return false
    }

    // Category filtering: support multiple categoryIds if provided and non-empty (excluding 'all')
    if (categorySet) {
      if (!categorySet.has(tx.categoryId)) {
        return false
      }
    } else if (categoryId && categoryId !== 'all' && tx.categoryId !== categoryId) {
      return false
    }

    // Source filtering
    if (sourceType && sourceType !== 'all') {
      const isDebt =
        tx.id.startsWith('debt_init_') ||
        tx.id.startsWith('debt_entry_') ||
        tx.id.startsWith('debt_pay_') ||
        (filters.debtTransactionIdsSet ? filters.debtTransactionIdsSet.has(tx.id) : false)
      const isCircle =
        tx.id.startsWith('circle_') ||
        Boolean(filters.circleRecurringIdsSet && tx.recurringId && filters.circleRecurringIdsSet.has(tx.recurringId))
      const isRecurring = Boolean(tx.recurringId) && !isCircle

      if (sourceType === 'debt' && !isDebt) return false
      if (sourceType === 'circle' && !isCircle) return false
      if (sourceType === 'recurring' && !isRecurring) return false
      if (sourceType === 'manual' && (isDebt || isCircle || isRecurring)) return false
    }

    // Custom Date range filtering
    if (fromTime !== null || toTime !== null) {
      const txTime = (tx.date instanceof Date ? tx.date : new Date(tx.date)).getTime()
      if (Number.isNaN(txTime)) return false
      if (fromTime !== null && txTime < fromTime) return false
      if (toTime !== null && txTime > toTime) return false
    }

    if (normalizedQuery) {
      const normalizedTitle = tx.title ? normalizeArabic(toWesternDigits(tx.title)) : ''
      const normalizedNote = tx.note ? normalizeArabic(toWesternDigits(tx.note)) : ''
      let normalizedCatName = ''
      if (categoryResolver && tx.categoryId) {
        const cached = normalizedCatCache.get(tx.categoryId)
        if (cached !== undefined) {
          normalizedCatName = cached
        } else {
          let catName = ''
          if (typeof categoryResolver === 'function') {
            catName = categoryResolver(tx.categoryId) || ''
          } else if (categoryResolver instanceof Map) {
            catName = categoryResolver.get(tx.categoryId)?.name || ''
          } else if (typeof categoryResolver === 'object') {
            catName = categoryResolver[tx.categoryId]?.name || ''
          }
          normalizedCatName = catName ? normalizeArabic(toWesternDigits(catName)) : ''
          normalizedCatCache.set(tx.categoryId, normalizedCatName)
        }
      }

      // Check amount matching in standard currency units (e.g. 25, 25.000, 12.500, 1,000)
      let matchesAmount = false
      if (queryHasDigits && cleanQuery) {
        const units = fromFils(tx.amountFils)
        const unitsStr = String(units)
        const fixed3 = units.toFixed(3)
        const fixed2 = units.toFixed(2)

        const formatted3 = AMOUNT_FMT_3.format(units)
        const formatted2 = AMOUNT_FMT_2.format(units)
        const formattedBasic = AMOUNT_FMT_BASIC.format(units)

        matchesAmount =
          unitsStr.includes(cleanQuery) ||
          fixed3.includes(cleanQuery) ||
          fixed2.includes(cleanQuery) ||
          formatted3.includes(normalizedQuery) ||
          formatted2.includes(normalizedQuery) ||
          formattedBasic.includes(normalizedQuery) ||
          (normalizedQuery.includes(',') &&
            !normalizedQuery.match(/,\d{3}/) &&
            unitsStr.includes(normalizedQuery.replace(',', '.')))
      }

      const matches =
        normalizedTitle.includes(normalizedQuery) ||
        normalizedNote.includes(normalizedQuery) ||
        (normalizedCatName ? normalizedCatName.includes(normalizedQuery) : false) ||
        matchesAmount

      if (!matches) {
        return false
      }
    }
    return true
  })
}

export interface SumByTypeResult {
  expense: number
  income: number
  balance: number
}

export function sumByType(txs: Transaction[]): SumByTypeResult {
  let expense = 0
  let income = 0

  for (const tx of txs) {
    if (!tx || typeof tx.amountFils !== 'number' || !Number.isFinite(tx.amountFils)) {
      continue
    }
    const amount = Math.abs(tx.amountFils)
    if (tx.type === 'expense') {
      expense += amount
    } else if (tx.type === 'income') {
      income += amount
    }
  }

  return {
    expense,
    income,
    balance: income - expense,
  }
}

export interface DayGroup {
  date: Date
  dateKey: string
  transactions: Transaction[]
}

export function groupByDay(
  txs: Transaction[],
  direction: 'asc' | 'desc' = 'desc'
): DayGroup[] {
  const groupsMap = new Map<string, { date: Date; transactions: Transaction[] }>()

  for (const tx of txs) {
    const rawDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const rawTime = rawDate.getTime()
    const d = Number.isNaN(rawTime) ? new Date(0) : rawDate
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateKey = `${year}-${month}-${day}`

    let group = groupsMap.get(dateKey)
    if (!group) {
      group = {
        date: new Date(year, d.getMonth(), d.getDate(), 12, 0, 0, 0),
        transactions: [],
      }
      groupsMap.set(dateKey, group)
    }
    group.transactions.push(tx)
  }

  // Sort groups by dateKey according to direction
  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) =>
    direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
  )

  return sortedKeys.map((key) => {
    const g = groupsMap.get(key)!
    // Sort transactions within day by date/time, then createdAt
    g.transactions.sort((a, b) => {
      const rawA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
      const rawB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
      const timeA = Number.isNaN(rawA) ? 0 : rawA
      const timeB = Number.isNaN(rawB) ? 0 : rawB
      if (timeB !== timeA) {
        return direction === 'asc' ? timeA - timeB : timeB - timeA
      }
      const rawCreatedA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
      const rawCreatedB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
      const createdA = Number.isNaN(rawCreatedA) ? 0 : rawCreatedA
      const createdB = Number.isNaN(rawCreatedB) ? 0 : rawCreatedB
      return direction === 'asc' ? createdA - createdB : createdB - createdA
    })
    return {
      dateKey: key,
      date: g.date,
      transactions: g.transactions,
    }
  })
}

export type TransactionSortOption = 'newest' | 'oldest' | 'highest' | 'lowest'

export function sortTransactions(
  txs: Transaction[],
  sortBy: TransactionSortOption = 'newest'
): Transaction[] {
  const copy = [...txs]
  const getTime = (d: unknown): number => {
    const t = (d instanceof Date ? d : new Date(d as string | number)).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  const getCreatedTime = (d: unknown): number => {
    const t = d instanceof Date ? d.getTime() : new Date((d as string | number) || 0).getTime()
    return Number.isNaN(t) ? 0 : t
  }
  const getAmount = (a: number): number => {
    return typeof a === 'number' && Number.isFinite(a) ? a : 0
  }

  switch (sortBy) {
    case 'newest':
      return copy.sort((a, b) => {
        const timeA = getTime(a.date)
        const timeB = getTime(b.date)
        if (timeB !== timeA) return timeB - timeA
        const createdA = getCreatedTime(a.createdAt)
        const createdB = getCreatedTime(b.createdAt)
        return createdB - createdA
      })
    case 'oldest':
      return copy.sort((a, b) => {
        const timeA = getTime(a.date)
        const timeB = getTime(b.date)
        if (timeA !== timeB) return timeA - timeB
        const createdA = getCreatedTime(a.createdAt)
        const createdB = getCreatedTime(b.createdAt)
        return createdA - createdB
      })
    case 'highest':
      return copy.sort((a, b) => {
        const amtA = getAmount(a.amountFils)
        const amtB = getAmount(b.amountFils)
        if (amtB !== amtA) return amtB - amtA
        const timeA = getTime(a.date)
        const timeB = getTime(b.date)
        return timeB - timeA
      })
    case 'lowest':
      return copy.sort((a, b) => {
        const amtA = getAmount(a.amountFils)
        const amtB = getAmount(b.amountFils)
        if (amtA !== amtB) return amtA - amtB
        const timeA = getTime(a.date)
        const timeB = getTime(b.date)
        return timeB - timeA
      })
    default:
      return copy
  }
}

