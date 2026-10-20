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
  const { query, type, categoryId } = filters
  const normalizedQuery = query ? normalizeArabic(query) : ''

  return txs.filter((tx) => {
    if (type && type !== 'all' && tx.type !== type) {
      return false
    }
    if (categoryId && categoryId !== 'all' && tx.categoryId !== categoryId) {
      return false
    }
    if (normalizedQuery) {
      const normalizedTitle = tx.title ? normalizeArabic(tx.title) : ''
      const normalizedNote = normalizeArabic(tx.note)
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
          normalizedCatName = normalizeArabic(catName)
        }
      }

      const matches =
        normalizedTitle.includes(normalizedQuery) ||
        normalizedNote.includes(normalizedQuery) ||
        (normalizedCatName ? normalizedCatName.includes(normalizedQuery) : false)

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
    // Sort transactions within day descending by time
    g.transactions.sort((a, b) => {
      const timeA = (a.date instanceof Date ? a.date : new Date(a.date)).getTime()
      const timeB = (b.date instanceof Date ? b.date : new Date(b.date)).getTime()
      return timeB - timeA
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
