import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addTransaction, updateTransaction, deleteTransaction, subscribePriorBalance } from './transactions'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockDoc = vi.fn((_db: unknown, ...parts: string[]) => ({
  id: parts[parts.length - 1],
  path: parts.join('/'),
}))
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined)
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined)
const mockDeleteField = vi.fn(() => ({ __type: 'deleteField' }))
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'tx-new-123' })
let mockSnapshotListener: ((snap: unknown) => void) | null = null
const mockOnSnapshot = vi.fn((_q, cb) => {
  mockSnapshotListener = cb
  return vi.fn()
})

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({
    withConverter: vi.fn().mockReturnThis(),
  })),
  doc: (_db: unknown, ...parts: string[]) => mockDoc(_db, ...parts),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  deleteField: () => mockDeleteField(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(args[0], args[1]),
  getDocs: vi.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  limit: vi.fn(),
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}))

describe('transactions service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateTransaction', () => {
    it('updates title when a non-empty string is passed', async () => {
      await updateTransaction('user-1', 'tx-1', {
        title: '  فاتورة الماء  ',
      })

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-1' }),
        {
          title: 'فاتورة الماء',
        }
      )
    })

    it('uses deleteField() to remove title when title is an empty string or whitespace', async () => {
      await updateTransaction('user-1', 'tx-1', {
        title: '   ',
      })

      expect(mockDeleteField).toHaveBeenCalledTimes(1)
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-1' }),
        {
          title: { __type: 'deleteField' },
        }
      )
    })

    it('throws Arabic error when amountFils is invalid or non-positive', async () => {
      await expect(
        updateTransaction('user-1', 'tx-1', {
          amountFils: -500,
        })
      ).rejects.toThrow('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')

      await expect(
        updateTransaction('user-1', 'tx-1', {
          amountFils: 0,
        })
      ).rejects.toThrow('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
    })

    it('updates type, amountFils, categoryId, date, and note', async () => {
      const date = new Date('2026-10-15T00:00:00Z')
      await updateTransaction('user-1', 'tx-1', {
        type: 'income',
        amountFils: 100000,
        categoryId: 'cat-salary',
        date,
        note: 'ملاحظة',
      })

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-1' }),
        expect.objectContaining({
          type: 'income',
          amountFils: 100000,
          categoryId: 'cat-salary',
          note: 'ملاحظة',
        })
      )
    })
  })

  describe('deleteTransaction', () => {
    it('deletes the transaction document', async () => {
      await deleteTransaction('user-1', 'tx-99')

      expect(mockDeleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-99' })
      )
    })
  })

  describe('addTransaction', () => {
    it('sanitizes title and recurringId and omits empty title', async () => {
      const id = await addTransaction('user-1', {
        type: 'expense',
        amountFils: 5000,
        categoryId: 'cat-1',
        date: new Date('2026-10-15'),
        title: '   شراء وقود للسيارة   ',
        recurringId: '   rec-12345   ',
        note: 'تفاصيل',
      })

      expect(id).toBe('tx-new-123')
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: 'شراء وقود للسيارة',
          recurringId: 'rec-12345',
        })
      )

      // Test omitting empty title
      mockAddDoc.mockClear()
      await addTransaction('user-1', {
        type: 'expense',
        amountFils: 5000,
        categoryId: 'cat-1',
        date: new Date('2026-10-15'),
        title: '   ',
        recurringId: '   ',
        note: '',
      })

      const addedPayload = mockAddDoc.mock.calls[0][1]
      expect(addedPayload.title).toBeUndefined()
      expect(addedPayload.recurringId).toBeUndefined()
    })
  })

  describe('subscribePriorBalance', () => {
    it('guards against NaN or non-finite amountFils in snapshot', () => {
      let resultBalance = 0
      subscribePriorBalance('user-1', new Date('2026-11-01'), (b) => {
        resultBalance = b
      })

      expect(mockSnapshotListener).toBeDefined()
      mockSnapshotListener!({
        docs: [
          { data: () => ({ type: 'income', amountFils: 10000 }) },
          { data: () => ({ type: 'expense', amountFils: 3000 }) },
          { data: () => ({ type: 'income', amountFils: NaN }) },
          { data: () => ({ type: 'expense', amountFils: undefined }) },
          { data: () => ({ type: 'expense', amountFils: 'invalid' }) },
        ],
      })

      // 10000 - 3000 = 7000
      expect(resultBalance).toBe(7000)
    })
  })
})
