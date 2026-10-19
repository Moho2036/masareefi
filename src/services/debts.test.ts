import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOrCreateDebtCategory,
  addDebt,
  updateDebt,
  deleteDebt,
  addDebtPayment,
  deleteDebtPayment,
} from './debts'
import type { Debt } from '../types'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockBatchSet = vi.fn()
const mockBatchUpdate = vi.fn()
const mockBatchDelete = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)

const mockBatch = {
  set: mockBatchSet,
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
}

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined)
const mockSetDoc = vi.fn().mockResolvedValue(undefined)
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined)

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  doc: vi.fn((_collOrDb, ...parts) => ({
    id: parts[parts.length - 1] || 'mock-generated-id',
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  query: vi.fn((c) => c),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: () => mockBatch,
  Timestamp: {
    fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
  serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
}))

describe('debts service with accounting link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrCreateDebtCategory', () => {
    it('finds existing debt category for expense', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-debt', name: 'سداد الديون والأقساط', type: 'expense', archived: false }) },
          { data: () => ({ id: 'cat-other', name: 'أخرى', type: 'expense', archived: false }) },
        ],
      })

      const catId = await getOrCreateDebtCategory('user-1', 'expense')
      expect(catId).toBe('cat-debt')
    })

    it('finds other category if specific debt category does not exist for expense', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-food', name: 'طعام', type: 'expense', archived: false }) },
          { data: () => ({ id: 'cat-other-exp', name: 'أخرى', type: 'expense', archived: false }) },
        ],
      })

      const catId = await getOrCreateDebtCategory('user-1', 'expense')
      expect(catId).toBe('cat-other-exp')
    })

    it('creates default category if none exist', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] })

      const catId = await getOrCreateDebtCategory('user-1', 'income')
      expect(catId).toBe('mock-generated-id')
      expect(mockSetDoc).toHaveBeenCalledTimes(1)
    })
  })

  describe('addDebt with accounting link', () => {
    it('creates debt and links expense transaction when type is lent and syncTransaction is true', async () => {
      // Mock category lookup
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-debt', name: 'سداد الديون والأقساط', type: 'expense', archived: false }) },
        ],
      })

      const debtId = await addDebt(
        'user-1',
        {
          personName: 'أحمد',
          type: 'lent',
          amountFils: 50000,
          startDate: new Date('2026-10-01'),
          dueDate: null,
          note: 'سلفة',
        },
        { syncTransaction: true }
      )

      expect(debtId).toBe('mock-generated-id')
      expect(mockBatchSet).toHaveBeenCalledTimes(2) // debt + transaction
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)

      // First call is debt doc
      expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
        personName: 'أحمد',
        type: 'lent',
        amountFils: 50000,
        paidFils: 0,
        settled: false,
      })

      // Second call is transaction doc
      expect(mockBatchSet.mock.calls[1][1]).toMatchObject({
        type: 'expense',
        amountFils: 50000,
        categoryId: 'cat-debt',
        title: 'إقراض: أحمد',
      })
    })

    it('creates debt and links income transaction when type is borrowed', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-other-inc', name: 'أخرى', type: 'income', archived: false }) },
        ],
      })

      await addDebt(
        'user-1',
        {
          personName: 'خالد',
          type: 'borrowed',
          amountFils: 100000,
          startDate: new Date('2026-10-01'),
          dueDate: null,
          note: '',
        },
        { syncTransaction: true }
      )

      expect(mockBatchSet.mock.calls[1][1]).toMatchObject({
        type: 'income',
        amountFils: 100000,
        categoryId: 'cat-other-inc',
        title: 'اقتراض من: خالد',
      })
    })
  })

  describe('addDebtPayment with accounting link', () => {
    const sampleDebt: Debt = {
      id: 'debt-100',
      personName: 'محمود',
      type: 'lent',
      amountFils: 50000,
      paidFils: 10000,
      startDate: new Date(),
      dueDate: null,
      note: '',
      settled: false,
      payments: [],
      createdAt: new Date(),
    }

    it('omits undefined note and creates income transaction for lent debt repayment', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-inc', name: 'أخرى', type: 'income', archived: false }) },
        ],
      })

      const paymentId = await addDebtPayment(
        'user-1',
        sampleDebt,
        {
          amountFils: 20000,
          date: new Date('2026-10-05'),
          note: '  ', // empty note should be omitted
        },
        { syncTransaction: true }
      )

      expect(paymentId).toBeTruthy()
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      expect(mockBatchSet).toHaveBeenCalledTimes(1)

      const updatedPayload = mockBatchUpdate.mock.calls[0][1]
      expect(updatedPayload.paidFils).toBe(30000)
      expect(updatedPayload.settled).toBe(false)
      // Empty/whitespace note falls back to default descriptive note
      expect(updatedPayload.payments[0].note).toBe('دفعة استرداد دين')

      // Transaction verification
      const txPayload = mockBatchSet.mock.calls[0][1]
      expect(txPayload).toMatchObject({
        type: 'income',
        amountFils: 20000,
        categoryId: 'cat-inc',
        title: 'استرداد دفعة دين: محمود',
      })
    })

    it('rejects payment larger than remaining balance', async () => {
      await expect(
        addDebtPayment('user-1', sampleDebt, {
          amountFils: 45000, // remaining is 40000
          date: new Date(),
        })
      ).rejects.toThrow('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
    })
  })

  describe('deleteDebtPayment with sync', () => {
    it('updates remaining debt and deletes debt_pay_${paymentId} transaction', async () => {
      const sampleDebtWithPayments: Debt = {
        id: 'debt-100',
        personName: 'محمود',
        type: 'lent',
        amountFils: 50000,
        paidFils: 20000,
        startDate: new Date(),
        dueDate: null,
        note: '',
        settled: false,
        payments: [
          {
            id: 'pay-1',
            amountFils: 20000,
            date: new Date(),
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(),
      }

      await deleteDebtPayment('user-1', sampleDebtWithPayments, 'pay-1')

      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      expect(mockBatchDelete).toHaveBeenCalledTimes(1)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteDebt with cascade sync', () => {
    it('deletes debt, initial transaction, and all payment transactions', async () => {
      mockGetDoc.mockResolvedValueOnce({
        data: () => ({
          payments: [{ id: 'p1' }, { id: 'p2' }],
        }),
      })

      await deleteDebt('user-1', 'debt-123')

      // 1 debt + 1 initTx + 2 payTx = 4 delete calls
      expect(mockBatchDelete).toHaveBeenCalledTimes(4)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateDebt with sync', () => {
    it('updates initial transaction when it exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ personName: 'سامي', type: 'lent', paidFils: 0 }),
      })

      await updateDebt('user-1', 'debt-999', {
        amountFils: 75000,
        personName: 'سامي الجديد',
      })

      expect(mockUpdateDoc).toHaveBeenCalledTimes(2) // debt + transaction
      expect(mockUpdateDoc.mock.calls[1][1]).toMatchObject({
        amountFils: 75000,
        title: 'إقراض: سامي الجديد',
      })
    })
  })
})
