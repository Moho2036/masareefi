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
}

export type CategoryResolver =
  | Map<string, { name?: string }>
  | Record<string, { name?: string }>
  | ((categoryId: string) => string | undefined)

export function filterTransactions(
  txs: Transaction[],
  filters: FilterTransactionsOptions = {},
  categoryResolver?: CategoryResolver
): Transaction[] {
  const { query, type, categoryId, categoryIds, sourceType, dateRange } = filters
  const rawQuery = query ? query.trim() : ''
  const normalizedQuery = rawQuery ? normalizeArabic(toWesternDigits(rawQuery)) : ''

  return txs.filter((tx) => {
    if (type && type !== 'all' && tx.type !== type) {
      return false
    }

    // Category filtering: support multiple categoryIds if provided and non-empty (excluding 'all')
    if (categoryIds && categoryIds.length > 0 && !categoryIds.includes('all')) {
      if (!categoryIds.includes(tx.categoryId)) {
        return false
      }
    } else if (categoryId && categoryId !== 'all' && tx.categoryId !== categoryId) {
      return false
    }

    // Source filtering
    if (sourceType && sourceType !== 'all') {
      const isDebt = tx.id.startsWith('debt_init_') || tx.id.startsWith('debt_pay_')
      const isCircle = tx.id.startsWith('circle_')
      const isRecurring = Boolean(tx.recurringId) && !isCircle

      if (sourceType === 'debt' && !isDebt) return false
      if (sourceType === 'circle' && !isCircle) return false
      if (sourceType === 'recurring' && !isRecurring) return false
      if (sourceType === 'manual' && (isDebt || isCircle || isRecurring)) return false
    }

    // Custom Date range filtering
    if (dateRange && (dateRange.from || dateRange.to)) {
      const txTime = (tx.date instanceof Date ? tx.date : new Date(tx.date)).getTime()
      if (dateRange.from) {
        const fromMidnight = new Date(dateRange.from)
        fromMidnight.setHours(0, 0, 0, 0)
        if (txTime < fromMidnight.getTime()) return false
      }
      if (dateRange.to) {
        const toEndDay = new Date(dateRange.to)
        toEndDay.setHours(23, 59, 59, 999)
        if (txTime > toEndDay.getTime()) return false
      }
    }
    if (normalizedQuery) {
      const normalizedTitle = tx.title ? normalizeArabic(toWesternDigits(tx.title)) : ''
      const normalizedNote = normalizeArabic(toWesternDigits(tx.note))
      let normalizedCatName = ''
      if (categoryResolver && tx.categoryId) {
        let catName = ''
        if (typeof categoryResolver === 'function') {
          catName = categoryResolver(tx.categoryId) || ''
        } else if (categoryResolver instanceof Map) {
          catName = categoryResolver.get(tx.categoryId)?.name || ''
        } else if (typeof categoryResolver === 'object') {
          catName = categoryResolver[tx.categoryId]?.name || ''
        }
        if (catName) {
          normalizedCatName = normalizeArabic(toWesternDigits(catName))
        }
      }

      // Check amount matching in standard currency units (e.g. 25, 25.000, 12.500, 1,000)
      let matchesAmount = false
      if (normalizedQuery) {
        const units = fromFils(tx.amountFils)
        const unitsStr = String(units)
        const fixed3 = units.toFixed(3)
        const fixed2 = units.toFixed(2)

        const cleanQuery = normalizedQuery.replace(/[,،]/g, '')

        const formatted3 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(units)
        const formatted2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(units)
        const formattedBasic = new Intl.NumberFormat('en-US').format(units)

        if (cleanQuery) {
          matchesAmount =
            unitsStr.includes(cleanQuery) ||
            fixed3.includes(cleanQuery) ||
            fixed2.includes(cleanQuery) ||
            formatted3.includes(normalizedQuery) ||
            formatted2.includes(normalizedQuery) ||
            formattedBasic.includes(normalizedQuery) ||
            (normalizedQuery.includes(',') && !normalizedQuery.match(/,\d{3}/) && unitsStr.includes(normalizedQuery.replace(',', '.')))
        }
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
    if (tx.type === 'expense') {
      expense += tx.amountFils
    } else if (tx.type === 'income') {
      income += tx.amountFils
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

export function groupByDay(txs: Transaction[]): DayGroup[] {
  const groupsMap = new Map<string, { date: Date; transactions: Transaction[] }>()

  for (const tx of txs) {
    const d = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateKey = `${year}-${month}-${day}`

    let group = groupsMap.get(dateKey)
    if (!group) {
      group = {
        date: new Date(year, d.getMonth(), d.getDate(), 0, 0, 0, 0),
        transactions: [],
      }
      groupsMap.set(dateKey, group)
    }
    group.transactions.push(tx)
  }

  // Sort groups descending by dateKey
  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => b.localeCompare(a))

  return sortedKeys.map((key) => {
    const g = groupsMap.get(key)!
    // Sort transactions within day descending by time, then createdAt descending
    g.transactions.sort((a, b) => {
      const timeA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
      const timeB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
      if (timeB !== timeA) {
        return timeB - timeA
      }
      const createdA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
      const createdB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
      return createdB - createdA
    })
    return {
      dateKey: key,
      date: g.date,
      transactions: g.transactions,
    }
  })
}

export function countByCategory(txs: Transaction[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tx of txs) {
    counts[tx.categoryId] = (counts[tx.categoryId] || 0) + 1
  }
  return counts
}

export type TransactionSortOption = 'newest' | 'oldest' | 'highest' | 'lowest'

export function sortTransactions(
  txs: Transaction[],
  sortBy: TransactionSortOption = 'newest'
): Transaction[] {
  const copy = [...txs]
  switch (sortBy) {
    case 'newest':
      return copy.sort((a, b) => {
        const timeA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
        const timeB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
        if (timeB !== timeA) return timeB - timeA
        const createdA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
        const createdB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
        return createdB - createdA
      })
    case 'oldest':
      return copy.sort((a, b) => {
        const timeA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
        const timeB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
        if (timeA !== timeB) return timeA - timeB
        const createdA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime()
        const createdB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime()
        return createdA - createdB
      })
    case 'highest':
      return copy.sort((a, b) => {
        if (b.amountFils !== a.amountFils) return b.amountFils - a.amountFils
        const timeA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
        const timeB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
        return timeB - timeA
      })
    case 'lowest':
      return copy.sort((a, b) => {
        if (a.amountFils !== b.amountFils) return a.amountFils - b.amountFils
        const timeA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
        const timeB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
        return timeB - timeA
      })
    default:
      return copy
  }
}

