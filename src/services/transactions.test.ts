import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateTransaction, deleteTransaction } from './transactions'

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

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: (_db: unknown, ...parts: string[]) => mockDoc(_db, ...parts),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  deleteField: () => mockDeleteField(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
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
})
