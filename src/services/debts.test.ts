import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOrCreateDebtCategory,
  addDebt,
  updateDebt,
  deleteDebt,
  addDebtPayment,
  updateDebtPayment,
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
      startDate: new Date('2026-10-01'),
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

    it('rejects payment with date earlier than debt start date', async () => {
      const debtWithFutureStart: Debt = {
        ...sampleDebt,
        startDate: new Date('2026-10-15'),
      }

      await expect(
        addDebtPayment('user-1', debtWithFutureStart, {
          amountFils: 5000,
          date: new Date('2026-10-10'),
        })
      ).rejects.toThrow('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
    })

    it('rejects payment larger than remaining balance', async () => {
      await expect(
        addDebtPayment('user-1', sampleDebt, {
          amountFils: 45000, // remaining is 40000
          date: new Date(),
        })
      ).rejects.toThrow('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
    })

    it('rejects payment when maximum 100 payments reached', async () => {
      const debtWith100Payments: Debt = {
        ...sampleDebt,
        payments: Array.from({ length: 100 }, (_, i) => ({
          id: `pay-${i}`,
          amountFils: 100,
          date: new Date(),
          createdAt: new Date(),
        })),
        paidFils: 10000,
      }

      await expect(
        addDebtPayment('user-1', debtWith100Payments, {
          amountFils: 1000,
          date: new Date(),
        })
      ).rejects.toThrow('تم الوصول للحد الأقصى لعدد الدفعات (100 دفعة) لهذا الدين')
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

  describe('updateDebtPayment with sync', () => {
    const sampleDebtWithPayments: Debt = {
      id: 'debt-100',
      personName: 'محمود',
      type: 'lent',
      amountFils: 50000,
      paidFils: 20000,
      startDate: new Date('2026-10-01'),
      dueDate: null,
      note: '',
      settled: false,
      payments: [
        {
          id: 'pay-1',
          amountFils: 20000,
          date: new Date('2026-10-05'),
          createdAt: new Date('2026-10-05'),
        },
      ],
      createdAt: new Date('2026-10-01'),
    }

    it('updates payment and synchronizes linked transaction when it exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'debt_pay_pay-1', amountFils: 20000 }),
      })

      await updateDebtPayment('user-1', sampleDebtWithPayments, 'pay-1', {
        amountFils: 30000,
        date: new Date('2026-10-06'),
        note: 'دفعة معدلة',
      })

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2) // debt + payment tx
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)

      const debtPayload = mockBatchUpdate.mock.calls[0][1]
      expect(debtPayload.paidFils).toBe(30000)
      expect(debtPayload.settled).toBe(false)
      expect(debtPayload.payments[0].amountFils).toBe(30000)
      expect(debtPayload.payments[0].note).toBe('دفعة معدلة')

      const txPayload = mockBatchUpdate.mock.calls[1][1]
      expect(txPayload.amountFils).toBe(30000)
      expect(txPayload.note).toBe('دفعة معدلة')
    })

    it('rejects update when payment date precedes debt start date', async () => {
      await expect(
        updateDebtPayment('user-1', sampleDebtWithPayments, 'pay-1', {
          amountFils: 20000,
          date: new Date('2026-09-25'), // before 2026-10-01
        })
      ).rejects.toThrow('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
    })

    it('rejects update when amount exceeds remaining allowed', async () => {
      await expect(
        updateDebtPayment('user-1', sampleDebtWithPayments, 'pay-1', {
          amountFils: 60000, // total debt is 50000
          date: new Date('2026-10-06'),
        })
      ).rejects.toThrow('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
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
    it('updates initial transaction when it exists atomically via batch', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ personName: 'سامي', type: 'lent', paidFils: 0 }),
      })

      await updateDebt('user-1', 'debt-999', {
        amountFils: 75000,
        personName: 'سامي الجديد',
      })

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2) // debt + transaction
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
      expect(mockBatchUpdate.mock.calls[0][1]).toMatchObject({
        amountFils: 75000,
        personName: 'سامي الجديد',
        settled: false,
      })
      expect(mockBatchUpdate.mock.calls[1][1]).toMatchObject({
        amountFils: 75000,
        title: 'إقراض: سامي الجديد',
      })
    })

    it('synchronizes type change from lent to borrowed and resolves correct category', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ personName: 'سامي', type: 'lent', paidFils: 0 }),
      })
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-borrowed-inc', name: 'أخرى', type: 'income', archived: false }) },
        ],
      })

      await updateDebt('user-1', 'debt-999', {
        type: 'borrowed',
      })

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2) // debt + initial tx
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)

      // Debt doc update
      expect(mockBatchUpdate.mock.calls[0][1]).toMatchObject({
        type: 'borrowed',
      })

      // Initial tx update
      expect(mockBatchUpdate.mock.calls[1][1]).toMatchObject({
        type: 'income',
        categoryId: 'cat-borrowed-inc',
        title: 'اقتراض من: سامي',
      })
    })

    it('throws error when newAmountFils is less than currentPaidFils', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ personName: 'سامي', type: 'lent', paidFils: 30000, amountFils: 50000 }),
      })

      await expect(
        updateDebt('user-1', 'debt-999', {
          amountFils: 20000,
        })
      ).rejects.toThrow('لا يمكن تعديل إجمالي الدين ليصبح أقل من المبلغ المسدد بالفعل')
      expect(mockBatchUpdate).not.toHaveBeenCalled()
      expect(mockBatchCommit).not.toHaveBeenCalled()
    })

    it('always computes and includes settled = true when paidFils equals amountFils', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ personName: 'سامي', type: 'lent', paidFils: 50000, amountFils: 60000 }),
      })

      await updateDebt('user-1', 'debt-999', {
        amountFils: 50000,
      })

      expect(mockBatchUpdate).toHaveBeenCalled()
      expect(mockBatchUpdate.mock.calls[0][1]).toMatchObject({
        amountFils: 50000,
        settled: true,
      })
    })

    it('includes settled field even when only updating non-amount fields like personName', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ personName: 'علي', type: 'lent', paidFils: 10000, amountFils: 50000 }),
      })

      await updateDebt('user-1', 'debt-999', {
        personName: 'علي الجديد',
      })

      expect(mockBatchUpdate).toHaveBeenCalled()
      expect(mockBatchUpdate.mock.calls[0][1]).toMatchObject({
        personName: 'علي الجديد',
        settled: false,
      })
    })

    it('does not query payment transactions if neither personName nor type changed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          personName: 'علي',
          type: 'lent',
          paidFils: 10000,
          amountFils: 50000,
          payments: [{ id: 'p1' }, { id: 'p2' }],
        }),
      })

      await updateDebt('user-1', 'debt-999', {
        note: 'ملاحظة محدثة',
      })

      // mockGetDoc called only for debt doc and initTx doc, NOT for payments
      expect(mockGetDoc).toHaveBeenCalledTimes(2)
    })

    it('synchronizes payment transactions in parallel when personName changes', async () => {
      mockGetDoc.mockImplementation(async (ref: { path: string }) => {
        if (ref.path.includes('debts')) {
          return {
            exists: () => true,
            data: () => ({
              personName: 'علي',
              type: 'lent',
              paidFils: 10000,
              amountFils: 50000,
              payments: [{ id: 'p1' }, { id: 'p2' }],
            }),
          }
        }
        return {
          exists: () => true,
          data: () => ({}),
        }
      })

      await updateDebt('user-1', 'debt-999', {
        personName: 'علي المعدل',
      })

      // debt + initTx + 2 payment transactions = 4 getDoc calls
      expect(mockGetDoc).toHaveBeenCalledTimes(4)
      // Updates: 1 debt + 1 initTx + 2 payment transactions = 4 update calls
      expect(mockBatchUpdate).toHaveBeenCalledTimes(4)
    })

    it('deletes initial transaction when syncTransaction is false and initTx exists', async () => {
      mockGetDoc.mockImplementation(async (ref: { path: string }) => {
        if (ref.path.includes('debts')) {
          return {
            exists: () => true,
            data: () => ({ personName: 'زيد', type: 'lent', paidFils: 0, amountFils: 50000 }),
          }
        }
        return {
          exists: () => true,
          data: () => ({}),
        }
      })

      await updateDebt('user-1', 'debt-123', {
        personName: 'زيد',
      }, { syncTransaction: false })

      expect(mockBatchDelete).toHaveBeenCalledTimes(1)
      expect(mockBatchCommit).toHaveBeenCalled()
    })

    it('deletes initial transaction AND all payment transactions when syncTransaction is explicitly false', async () => {
      mockGetDoc.mockImplementation(async (ref: { path: string }) => {
        if (ref.path.includes('debts')) {
          return {
            exists: () => true,
            data: () => ({
              personName: 'زيد',
              type: 'lent',
              paidFils: 20000,
              amountFils: 50000,
              payments: [{ id: 'pay-1' }, { id: 'pay-2' }],
            }),
          }
        }
        return {
          exists: () => true,
          data: () => ({}),
        }
      })

      await updateDebt('user-1', 'debt-123', {
        personName: 'زيد',
      }, { syncTransaction: false })

      // 1 initTx + 2 payTx = 3 delete calls
      expect(mockBatchDelete).toHaveBeenCalledTimes(3)
      expect(mockBatchCommit).toHaveBeenCalled()
    })

    it('creates initial transaction when syncTransaction is true and initTx does NOT exist', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-debt', name: 'سداد الديون والأقساط', type: 'expense', archived: false }) },
        ],
      })

      mockGetDoc.mockImplementation(async (ref: { path: string }) => {
        if (ref.path.includes('debts')) {
          return {
            exists: () => true,
            data: () => ({ personName: 'زيد', type: 'lent', paidFils: 0, amountFils: 50000 }),
          }
        }
        // initTx does not exist
        return {
          exists: () => false,
          data: () => ({}),
        }
      })

      await updateDebt('user-1', 'debt-123', {
        personName: 'زيد',
        amountFils: 50000,
      }, { syncTransaction: true })

      expect(mockBatchSet).toHaveBeenCalledTimes(1)
      expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
        type: 'expense',
        amountFils: 50000,
        title: 'إقراض: زيد',
      })
      expect(mockBatchCommit).toHaveBeenCalled()
    })
  })
})
