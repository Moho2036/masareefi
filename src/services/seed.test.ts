import { describe, it, expect, vi } from 'vitest'
import type { WriteBatch, DocumentReference } from 'firebase/firestore'
import { DEFAULT_CATEGORIES, addDefaultCategoriesToBatch } from './seed'

describe('DEFAULT_CATEGORIES seed data', () => {
  it('contains exactly 18 categories (13 expenses, 5 incomes)', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(18)

    const expenses = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense')
    const incomes = DEFAULT_CATEGORIES.filter((c) => c.type === 'income')

    expect(expenses).toHaveLength(13)
    expect(incomes).toHaveLength(5)
  })

  it('matches category names required by PLAN.md', () => {
    const expectedExpenses = [
      'طعام وبقالة',
      'مطاعم',
      'مواصلات ووقود',
      'إيجار وسكن',
      'فواتير',
      'اتصالات',
      'صحة',
      'تسوق وملابس',
      'ترفيه',
      'تعليم',
      'اشتراكات',
      'عائلة وهدايا',
      'أخرى',
    ]

    const expectedIncomes = ['راتب', 'عمل حر', 'هدايا', 'استثمار', 'أخرى']

    const actualExpenses = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map(
      (c) => c.name
    )
    const actualIncomes = DEFAULT_CATEGORIES.filter((c) => c.type === 'income').map(
      (c) => c.name
    )

    expect(actualExpenses).toEqual(expectedExpenses)
    expect(actualIncomes).toEqual(expectedIncomes)
  })

  it('all categories have unique names within their type', () => {
    const expenses = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map(
      (c) => c.name
    )
    const incomes = DEFAULT_CATEGORIES.filter((c) => c.type === 'income').map((c) => c.name)

    const uniqueExpenses = new Set(expenses)
    const uniqueIncomes = new Set(incomes)

    expect(uniqueExpenses.size).toBe(expenses.length)
    expect(uniqueIncomes.size).toBe(incomes.length)
  })

  it('all categories have unique, non-negative order values', () => {
    const orders = DEFAULT_CATEGORIES.map((c) => c.order)
    const uniqueOrders = new Set(orders)

    expect(uniqueOrders.size).toBe(DEFAULT_CATEGORIES.length)
    for (const order of orders) {
      expect(Number.isInteger(order)).toBe(true)
      expect(order).toBeGreaterThanOrEqual(0)
    }
  })

  it('complies with schema constraints for name, icon, color, archived, and type', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/

    for (const cat of DEFAULT_CATEGORIES) {
      expect(typeof cat.name).toBe('string')
      expect(cat.name.length).toBeGreaterThanOrEqual(1)
      expect(cat.name.length).toBeLessThanOrEqual(40)

      expect(typeof cat.icon).toBe('string')
      expect(cat.icon.length).toBeGreaterThanOrEqual(1)
      expect(cat.icon.length).toBeLessThanOrEqual(16)

      expect(cat.color).toMatch(hexRegex)

      expect(['expense', 'income']).toContain(cat.type)
      expect(cat.archived).toBe(false)
    }
  })

  it('addDefaultCategoriesToBatch sets all 18 categories to the batch', () => {
    const setCalls: { ref: unknown; data: unknown }[] = []
    const mockBatch = {
      set: vi.fn((ref: DocumentReference, data: unknown) => {
        setCalls.push({ ref, data })
        return mockBatch
      }),
    } as unknown as WriteBatch

    addDefaultCategoriesToBatch(mockBatch, 'test-uid')

    expect(mockBatch.set).toHaveBeenCalledTimes(18)
    expect(setCalls).toHaveLength(18)

    // Verify first and last category
    expect(setCalls[0].data).toEqual({
      name: 'طعام وبقالة',
      type: 'expense',
      icon: '🛒',
      color: '#F59E0B',
      archived: false,
      order: 0,
    })
    expect(setCalls[17].data).toEqual({
      name: 'أخرى',
      type: 'income',
      icon: '➕',
      color: '#64748B',
      archived: false,
      order: 17,
    })
  })
})
