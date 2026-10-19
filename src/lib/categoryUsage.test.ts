import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCategoryUsageMap,
  recordCategoryUsage,
  sortCategoriesByUsage,
  buildUsageFromTransactions,
  mergeAndSaveUsage,
} from './categoryUsage'

describe('categoryUsage utilities', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty object when no usage recorded', () => {
    expect(getCategoryUsageMap()).toEqual({})
  })

  it('records category usage and increments counts properly', () => {
    recordCategoryUsage('cat-food')
    recordCategoryUsage('cat-food')
    recordCategoryUsage('cat-fuel')

    const map = getCategoryUsageMap()
    expect(map['cat-food']).toBe(2)
    expect(map['cat-fuel']).toBe(1)
  })

  it('builds category usage map correctly from transactions', () => {
    const txs = [
      { categoryId: 'c-food' },
      { categoryId: 'c-fuel' },
      { categoryId: 'c-food' },
      { categoryId: 'c-rent' },
    ]
    const map = buildUsageFromTransactions(txs)
    expect(map).toEqual({
      'c-food': 2,
      'c-fuel': 1,
      'c-rent': 1,
    })
  })

  it('merges transaction usage with local storage usage', () => {
    recordCategoryUsage('c-fuel')
    recordCategoryUsage('c-fuel') // local = 2

    const txMap = { 'c-fuel': 5, 'c-food': 10 }
    const merged = mergeAndSaveUsage(txMap)

    expect(merged['c-food']).toBe(10)
    expect(merged['c-fuel']).toBe(5) // max of 5 and 2
    expect(getCategoryUsageMap()['c-food']).toBe(10)
  })

  it('sorts categories with higher usage first, falling back to original order', () => {
    const cats = [
      { id: 'cat-1', name: 'Cat 1', order: 0 },
      { id: 'cat-2', name: 'Cat 2', order: 1 },
      { id: 'cat-3', name: 'Cat 3', order: 2 },
    ]

    const usageMap = {
      'cat-2': 10,
      'cat-3': 5,
    }

    const sorted = sortCategoriesByUsage(cats, usageMap)
    expect(sorted.map((c) => c.id)).toEqual(['cat-2', 'cat-3', 'cat-1'])
  })

  it('preserves order when usage counts are equal', () => {
    const cats = [
      { id: 'cat-a', name: 'Cat A', order: 0 },
      { id: 'cat-b', name: 'Cat B', order: 1 },
    ]

    const sorted = sortCategoriesByUsage(cats, {})
    expect(sorted.map((c) => c.id)).toEqual(['cat-a', 'cat-b'])
  })
})
