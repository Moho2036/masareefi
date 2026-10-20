import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WriteBatch, DocumentReference } from 'firebase/firestore'
import { DEFAULT_CATEGORIES, addDefaultCategoriesToBatch, syncCategoriesForUser } from './seed'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockBatchSet = vi.fn()
const mockBatchUpdate = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)
const mockBatch = {
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}

const mockGetDocs = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    id: parts[parts.length - 1],
  })),
  doc: vi.fn((_collOrDb, ...parts) => ({
    id: parts[parts.length - 1] || 'mock-doc-id',
    path: parts.join('/'),
  })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: () => mockBatch,
}))

describe('DEFAULT_CATEGORIES seed data', () => {
  it('contains exactly 23 categories (18 expenses, 5 incomes)', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(23)

    const expenses = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense')
    const incomes = DEFAULT_CATEGORIES.filter((c) => c.type === 'income')

    expect(expenses).toHaveLength(18)
    expect(incomes).toHaveLength(5)
  })

  it('matches category names required by user specification', () => {
    const expectedExpenses = [
      'طعام وبقالة',
      'مطاعم',
      'مواصلات ووقود',
      'إيجار وسكن',
      'فواتير',
      'اتصالات',
      'صحة',
      'ملابس وإكسسوارات',
      'ترفيه',
      'تعليم',
      'اشتراكات',
      'الهدايا والمناسبات',
      'التأمين',
      'العطاء الخيري',
      'المصاريف المصرفية',
      'سداد الديون والأقساط',
      'العناية الشخصية',
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

  it('addDefaultCategoriesToBatch sets all 23 categories to the batch', () => {
    const setCalls: { ref: unknown; data: unknown }[] = []
    const mockBatch = {
      set: vi.fn((ref: DocumentReference, data: unknown) => {
        setCalls.push({ ref, data })
        return mockBatch
      }),
    } as unknown as WriteBatch

    addDefaultCategoriesToBatch(mockBatch, 'test-uid')

    expect(mockBatch.set).toHaveBeenCalledTimes(23)
    expect(setCalls).toHaveLength(23)

    // Verify deterministic IDs and first/last category
    expect((setCalls[0].ref as DocumentReference).id).toBe('seed_expense_0')
    expect(setCalls[0].data).toEqual({
      name: 'طعام وبقالة',
      type: 'expense',
      icon: '🛒',
      color: '#F59E0B',
      archived: false,
      order: 0,
    })
    expect((setCalls[22].ref as DocumentReference).id).toBe('seed_income_22')
    expect(setCalls[22].data).toEqual({
      name: 'أخرى',
      type: 'income',
      icon: '➕',
      color: '#64748B',
      archived: false,
      order: 22,
    })
  })
})

describe('syncCategoriesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('correctly keys by type and name so expense "أخرى" does not prevent syncing income "أخرى"', async () => {
    const existingExpenseDocs = DEFAULT_CATEGORIES.filter((c) => c.type === 'expense').map((c, i) => ({
      id: `doc_${i}`,
      data: () => ({ name: c.name, type: c.type, order: c.order }),
    }))

    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: existingExpenseDocs,
    })

    await syncCategoriesForUser('user-test')

    expect(mockBatchCommit).toHaveBeenCalled()
    const addedCategories = mockBatchSet.mock.calls.map((call) => call[1] as { name: string; type: string })
    const incomeOther = addedCategories.find(
      (c) => c.type === 'income' && c.name === 'أخرى'
    )
    expect(incomeOther).toBeDefined()
    expect(incomeOther?.name).toBe('أخرى')
    expect(incomeOther?.type).toBe('income')
  })
})
