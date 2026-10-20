import { describe, it, expect, vi } from 'vitest'
import { validateBackup, restoreBackup, downloadBackupFile, type MasareefiBackup } from './backupRestore'
import { formatDateInput } from './dates'

// Mock Firestore
vi.mock('./firebase', () => ({
  db: {},
}))

const mockSet = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockCommit = vi.fn().mockResolvedValue(undefined)
const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] })

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
    collection: vi.fn((_db, ...parts) => ({
      path: parts.join('/'),
      withConverter: () => ({ path: parts.join('/') }),
    })),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    writeBatch: vi.fn(() => ({
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
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
      mockGetDoc.mockResolvedValue({ exists: () => false })

      await restoreBackup('user-test-uid', sampleBackup)

      // Settings (1) + Category (1) + Transaction (1) + Debt (1) + Recurring (1) + Circle (1) = 6 ops
      expect(mockSet).toHaveBeenCalledTimes(6)
      expect(mockCommit).toHaveBeenCalledTimes(1)
    })

    it('calls update without createdAt when user settings document already exists', async () => {
      mockSet.mockClear()
      mockUpdate.mockClear()
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ createdAt: new Date('2025-01-01T00:00:00Z') }),
      })

      await restoreBackup('user-test-uid', sampleBackup)

      const updateCall = mockUpdate.mock.calls.find((call) => call[0].path === 'users/user-test-uid')
      expect(updateCall).toBeDefined()
      expect(updateCall![1].createdAt).toBeUndefined()
      expect(updateCall![1].displayName).toBe('أحمد')
    })

    it('deletes orphaned transactions, debts, recurring, and circles not present in backup', async () => {
      mockDelete.mockClear()
      const orphanTxRef = { path: 'users/u1/transactions/orphan-tx' }
      const orphanDebtRef = { path: 'users/u1/debts/orphan-debt' }
      const orphanRecRef = { path: 'users/u1/recurring/orphan-rec' }
      const orphanCircleRef = { path: 'users/u1/circles/orphan-circle' }

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] }) // categories
        .mockResolvedValueOnce({ docs: [{ id: 'orphan-tx', ref: orphanTxRef, data: () => ({ id: 'orphan-tx' }) }] }) // transactions
        .mockResolvedValueOnce({ docs: [{ id: 'orphan-debt', ref: orphanDebtRef, data: () => ({ id: 'orphan-debt' }) }] }) // debts
        .mockResolvedValueOnce({ docs: [{ id: 'orphan-rec', ref: orphanRecRef, data: () => ({ id: 'orphan-rec' }) }] }) // recurring
        .mockResolvedValueOnce({ docs: [{ id: 'orphan-circle', ref: orphanCircleRef, data: () => ({ id: 'orphan-circle' }) }] }) // circles

      await restoreBackup('u1', sampleBackup)

      expect(mockDelete).toHaveBeenCalledWith(orphanTxRef)
      expect(mockDelete).toHaveBeenCalledWith(orphanDebtRef)
      expect(mockDelete).toHaveBeenCalledWith(orphanRecRef)
      expect(mockDelete).toHaveBeenCalledWith(orphanCircleRef)
    })

    it('filters out non-positive amounts from incoming backup records', async () => {
      mockSet.mockClear()
      mockGetDoc.mockResolvedValue({ exists: () => false })

      const backupWithZeroAmounts: MasareefiBackup = {
        version: 1,
        app: 'masareefi',
        exportedAt: '2026-10-15T12:00:00Z',
        data: {
          categories: [],
          transactions: [
            {
              id: 'tx-zero',
              type: 'expense',
              amountFils: 0,
              categoryId: 'cat-1',
              date: new Date(),
              note: 'test',
              createdAt: new Date(),
            },
          ],
          debts: [
            {
              id: 'debt-zero',
              personName: 'خالد',
              type: 'lent',
              amountFils: 0,
              paidFils: 0,
              startDate: new Date(),
              note: '',
              settled: true,
              payments: [],
              createdAt: new Date(),
            },
          ],
          recurring: [
            {
              id: 'rec-zero',
              type: 'expense',
              amountFils: -500,
              categoryId: 'cat-1',
              note: '',
              frequency: 'monthly',
              startDate: new Date(),
              nextDate: new Date(),
              active: true,
            },
          ],
          circles: [
            {
              id: 'circle-zero',
              name: 'جمعية',
              monthlyAmountFils: 0,
              membersCount: 4,
              totalAmountFils: 0,
              myTurnMonth: 1,
              startDate: new Date(),
              members: [],
              status: 'active',
              createdAt: new Date(),
            },
          ],
        },
      }

      await restoreBackup('user-test-uid', backupWithZeroAmounts)

      const txCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/transactions/tx-zero')
      expect(txCall).toBeUndefined()

      const debtCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/debts/debt-zero')
      expect(debtCall).toBeUndefined()

      const recCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/recurring/rec-zero')
      expect(recCall).toBeUndefined()

      const circleCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/circles/circle-zero')
      expect(circleCall).toBeUndefined()
    })

    it('strips empty string optional fields and clamps debt values', async () => {
      mockSet.mockClear()
      mockGetDoc.mockResolvedValue({ exists: () => false })

      const backupWithEmptyFields: MasareefiBackup = {
        version: 1,
        app: 'masareefi',
        exportedAt: '2026-10-15T12:00:00Z',
        data: {
          categories: [],
          transactions: [
            {
              id: 'tx-strip',
              type: 'expense',
              amountFils: 2000,
              categoryId: 'cat-1',
              date: new Date(),
              note: '',
              title: '   ',
              recurringId: '',
              createdAt: new Date(),
            },
          ],
          debts: [
            {
              id: 'debt-clamp',
              personName: 'خالد',
              type: 'lent',
              amountFils: 50000,
              paidFils: 60000, // exceeds amountFils!
              startDate: new Date(),
              dueDate: null,
              note: '',
              settled: false,
              payments: [],
              createdAt: new Date(),
            },
          ],
          recurring: [
            {
              id: 'rec-strip',
              type: 'expense',
              amountFils: 10000,
              categoryId: 'cat-1',
              note: '',
              frequency: 'monthly',
              startDate: new Date(),
              nextDate: new Date(),
              active: true,
              title: '',
              circleId: '',
            },
          ],
          circles: [
            {
              id: 'circle-strip',
              name: 'جمعية',
              monthlyAmountFils: 50000,
              membersCount: 4,
              totalAmountFils: 200000,
              myTurnMonth: 1,
              startDate: new Date(),
              members: [],
              status: 'active',
              recurringId: '',
              createdAt: new Date(),
            },
          ],
        },
      }

      await restoreBackup('user-test-uid', backupWithEmptyFields)

      const txCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/transactions/tx-strip')
      expect(txCall).toBeDefined()
      expect(txCall![1].title).toBeUndefined()
      expect(txCall![1].recurringId).toBeUndefined()

      const debtCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/debts/debt-clamp')
      expect(debtCall).toBeDefined()
      expect(debtCall![1].paidFils).toBe(50000)
      expect(debtCall![1].settled).toBe(true)

      const recCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/recurring/rec-strip')
      expect(recCall).toBeDefined()
      expect(recCall![1].title).toBeUndefined()
      expect(recCall![1].circleId).toBeUndefined()

      const circleCall = mockSet.mock.calls.find((call) => call[0].path === 'users/user-test-uid/circles/circle-strip')
      expect(circleCall).toBeDefined()
      expect(circleCall![1].recurringId).toBeUndefined()
    })

    it('deletes newly seeded duplicate categories that match incoming backup categories by type and name', async () => {
      const seededRef = { path: 'users/u1/categories/seeded-food-id' }
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'seeded-food-id',
            ref: seededRef,
            data: () => ({ name: 'طعام', type: 'expense' }),
          },
        ],
      })

      await restoreBackup('u1', sampleBackup)

      expect(mockDelete).toHaveBeenCalledWith(seededRef)
    })

    it('safely handles category defaults and preserves existing type', async () => {
      // Existing category in Firestore has type 'expense'
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'cat-food',
            ref: { path: 'users/u1/categories/cat-food' },
            data: () => ({ id: 'cat-food', name: 'طعام', type: 'expense' }),
          },
        ],
      })

      const customBackup: MasareefiBackup = {
        ...sampleBackup,
        data: {
          ...sampleBackup.data,
          categories: [
            {
              id: 'cat-food',
              name: '  طعام جديد  ',
              type: 'income', // incoming backup claims income, but doc in Firestore is expense
              icon: '', // empty icon
              color: 'invalid-color', // invalid hex
              archived: false,
              order: 0,
            },
          ],
          circles: [
            {
              id: 'c1',
              name: 'جمعية تجريبية',
              monthlyAmountFils: 10000,
              membersCount: 4,
              totalAmountFils: 40000,
              myTurnMonth: 10, // out of bounds (> membersCount)
              startDate: new Date(),
              members: [],
              status: 'active',
              createdAt: new Date(),
            },
          ],
        },
      }

      await restoreBackup('u1', customBackup)

      const catCall = mockSet.mock.calls.find((call) => call[0].path === 'users/u1/categories/cat-food')
      expect(catCall).toBeDefined()
      // Preserves existing type 'expense'
      expect(catCall![1].type).toBe('expense')
      // Icon defaults to 📁
      expect(catCall![1].icon).toBe('📁')
      // Color defaults to #10B981
      expect(catCall![1].color).toBe('#10B981')

      const circleCall = mockSet.mock.calls.find((call) => call[0].path === 'users/u1/circles/c1')
      expect(circleCall).toBeDefined()
      // Clamped to membersCount (4)
      expect(circleCall![1].myTurnMonth).toBe(4)
    })

    it('does not delete existing category in use if no matching restored category exists', async () => {
      // Existing category used by a transaction
      const existingRef = { path: 'users/u1/categories/cat-old-important' }
      mockGetDocs
        .mockResolvedValueOnce({
          // categories snap
          docs: [
            {
              id: 'cat-old-important',
              ref: existingRef,
              data: () => ({ id: 'cat-old-important', name: 'تصنيف هام قديم', type: 'expense' }),
            },
          ],
        })
        .mockResolvedValueOnce({
          // transactions snap: has transaction with cat-old-important
          docs: [
            {
              id: 'tx-existing',
              ref: { path: 'users/u1/transactions/tx-existing' },
              data: () => ({ id: 'tx-existing', categoryId: 'cat-old-important' }),
            },
          ],
        })

      await restoreBackup('u1', sampleBackup)

      // existingRef should NOT be deleted because it is in use and no category named 'تصنيف هام قديم' is in sampleBackup
      expect(mockDelete).not.toHaveBeenCalledWith(existingRef)
    })
  })

  describe('downloadBackupFile', () => {
    it('generates filename matching local user date format', () => {
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      globalThis.URL.revokeObjectURL = vi.fn()

      let downloadedName = ''
      const originalCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName)
        if (tagName === 'a') {
          el.click = vi.fn(() => {
            downloadedName = (el as HTMLAnchorElement).download
          })
        }
        return el
      })

      downloadBackupFile(sampleBackup)

      const expectedDate = formatDateInput(new Date())
      expect(downloadedName).toBe(`masareefi-backup-${expectedDate}.json`)
    })
  })
})
