import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCategoryUsageMap,
  recordCategoryUsage,
  sortCategoriesByUsage,
  buildUsageFromTransactions,
  mergeAndSaveUsage,
  getCategoryUsageDetails,
  getCategoryUsageCount,
  isCategoryInUse,
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

  it('calculates category usage details taking transactions and recurring into account', () => {
    const txs = [{ categoryId: 'cat-rent' }, { categoryId: 'cat-rent' }]
    const recurring = [{ categoryId: 'cat-rent' }, { categoryId: 'cat-gym' }]

    // cat-rent: 2 txs + 1 recurring = 3 total
    const rentDetails = getCategoryUsageDetails('cat-rent', txs, recurring, {})
    expect(rentDetails.txCount).toBe(2)
    expect(rentDetails.recurringCount).toBe(1)
    expect(rentDetails.totalCount).toBe(3)
    expect(rentDetails.isInUse).toBe(true)
    expect(getCategoryUsageCount('cat-rent', txs, recurring, {})).toBe(3)
    expect(isCategoryInUse('cat-rent', txs, recurring, {})).toBe(true)

    // cat-gym: 0 txs + 1 recurring = 1 total
    const gymDetails = getCategoryUsageDetails('cat-gym', txs, recurring, {})
    expect(gymDetails.txCount).toBe(0)
    expect(gymDetails.recurringCount).toBe(1)
    expect(gymDetails.totalCount).toBe(1)
    expect(gymDetails.isInUse).toBe(true)
    expect(getCategoryUsageCount('cat-gym', txs, recurring, {})).toBe(1)
    expect(isCategoryInUse('cat-gym', txs, recurring, {})).toBe(true)

    // cat-unused: 0 txs + 0 recurring = 0 total
    const unusedDetails = getCategoryUsageDetails('cat-unused', txs, recurring, {})
    expect(unusedDetails.txCount).toBe(0)
    expect(unusedDetails.recurringCount).toBe(0)
    expect(unusedDetails.totalCount).toBe(0)
    expect(unusedDetails.isInUse).toBe(false)
    expect(isCategoryInUse('cat-unused', txs, recurring, {})).toBe(false)
  })

  it('considers historical local storage usage if higher than active transactions', () => {
    const txs = [{ categoryId: 'cat-past' }]
    const localMap = { 'cat-past': 10 }
    const details = getCategoryUsageDetails('cat-past', txs, [], localMap)

    expect(details.txCount).toBe(10) // max of 1 and 10
    expect(details.totalCount).toBe(10)
    expect(details.isInUse).toBe(true)
  })
})
