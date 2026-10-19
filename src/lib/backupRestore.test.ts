import { describe, it, expect, vi } from 'vitest'
import { validateBackup, restoreBackup, type MasareefiBackup } from './backupRestore'

// Mock Firestore
vi.mock('./firebase', () => ({
  db: {},
}))

const mockSet = vi.fn()
const mockCommit = vi.fn().mockResolvedValue(undefined)

vi.mock('firebase/firestore', () => {
  const createMockDoc = (_db: unknown, ...parts: string[]) => {
    const docObj = {
      path: parts.join('/'),
      withConverter: () => docObj,
    }
    return docObj
  }

  return {
    doc: vi.fn(createMockDoc),
    collection: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    writeBatch: vi.fn(() => ({
      set: mockSet,
      commit: mockCommit,
    })),
    Timestamp: {
      fromDate: (d: Date) => ({ toDate: () => d }),
    },
    serverTimestamp: () => ({}),
  }
})

describe('backupRestore module', () => {
  const sampleBackup: MasareefiBackup = {
    version: 1,
    app: 'masareefi',
    exportedAt: '2026-10-15T12:00:00.000Z',
    data: {
      settings: {
        displayName: 'أحمد',
        currency: 'JOD',
        monthStartDay: 1,
        theme: 'dark',
        rolloverBalance: true,
      },
      categories: [
        {
          id: 'cat-food',
          name: 'طعام',
          type: 'expense',
          icon: 'utensils',
          color: '#10b981',
          archived: false,
          order: 0,
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          type: 'expense',
          amountFils: 5000,
          categoryId: 'cat-food',
          date: new Date('2026-10-10T12:00:00Z'),
          note: 'غداء',
          createdAt: new Date('2026-10-10T12:00:00Z'),
        },
      ],
      debts: [
        {
          id: 'debt-1',
          personName: 'خالد',
          type: 'borrowed',
          amountFils: 100000,
          paidFils: 20000,
          startDate: new Date('2026-09-01T00:00:00Z'),
          dueDate: new Date('2026-11-01T00:00:00Z'),
          note: 'قرض مؤقت',
          settled: false,
          payments: [
            {
              id: 'p-1',
              amountFils: 20000,
              date: new Date('2026-10-01T00:00:00Z'),
              createdAt: new Date('2026-10-01T00:00:00Z'),
            },
          ],
          createdAt: new Date('2026-09-01T00:00:00Z'),
        },
      ],
      recurring: [
        {
          id: 'rec-1',
          type: 'expense',
          amountFils: 30000,
          categoryId: 'cat-food',
          note: 'اشتراك شهري',
          frequency: 'monthly',
          startDate: new Date('2026-01-01T00:00:00Z'),
          nextDate: new Date('2026-11-01T00:00:00Z'),
          active: true,
        },
      ],
      circles: [
        {
          id: 'circle-1',
          name: 'جمعية العمل',
          monthlyAmountFils: 100000,
          membersCount: 5,
          totalAmountFils: 500000,
          myTurnMonth: 2,
          startDate: new Date('2026-08-01T00:00:00Z'),
          members: [
            { id: 'm1', name: 'أنت', turnMonth: 2, paidMonths: [1] },
            { id: 'm2', name: 'عمر', turnMonth: 1, paidMonths: [1] },
          ],
          status: 'active',
          isManager: true,
          createdAt: new Date('2026-08-01T00:00:00Z'),
        },
      ],
    },
  }

  describe('validateBackup', () => {
    it('validates a correct Masareefi JSON backup and returns summary', () => {
      const jsonText = JSON.stringify(sampleBackup)
      const res = validateBackup(jsonText)

      expect(res.valid).toBe(true)
      expect(res.summary).toBeDefined()
      expect(res.summary?.transactionsCount).toBe(1)
      expect(res.summary?.categoriesCount).toBe(1)
      expect(res.summary?.debtsCount).toBe(1)
      expect(res.summary?.recurringCount).toBe(1)
      expect(res.summary?.circlesCount).toBe(1)
      expect(res.summary?.hasSettings).toBe(true)
    })

    it('rejects invalid JSON text', () => {
      const res = validateBackup('{ invalid json string ...')
      expect(res.valid).toBe(false)
      expect(res.error).toBeDefined()
    })

    it('rejects JSON not from masareefi app', () => {
      const otherAppBackup = {
        app: 'other-app',
        data: {},
      }
      const res = validateBackup(JSON.stringify(otherAppBackup))
      expect(res.valid).toBe(false)
      expect(res.error).toContain('ليس نسخة احتياطية خاصة بتطبيق مصاريفي')
    })

    it('rejects JSON with missing data payload', () => {
      const badStructure = {
        app: 'masareefi',
      }
      const res = validateBackup(JSON.stringify(badStructure))
      expect(res.valid).toBe(false)
      expect(res.error).toContain('هيكل البيانات')
    })

    it('handles backup with empty arrays safely', () => {
      const emptyBackup = {
        app: 'masareefi',
        version: 1,
        exportedAt: '2026-10-15T12:00:00Z',
        data: {},
      }
      const res = validateBackup(JSON.stringify(emptyBackup))
      expect(res.valid).toBe(true)
      expect(res.summary?.transactionsCount).toBe(0)
      expect(res.summary?.hasSettings).toBe(false)
    })
  })

  describe('restoreBackup', () => {
    it('preserves document IDs and executes batch commits', async () => {
      mockSet.mockClear()
      mockCommit.mockClear()

      await restoreBackup('user-test-uid', sampleBackup)

      // Settings (1) + Category (1) + Transaction (1) + Debt (1) + Recurring (1) + Circle (1) = 6 ops
      expect(mockSet).toHaveBeenCalledTimes(6)
      expect(mockCommit).toHaveBeenCalledTimes(1)
    })
  })
})
