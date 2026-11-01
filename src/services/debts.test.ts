import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOrCreateDebtCategory,
  addDebt,
  updateDebt,
  deleteDebt,
  addDebtPayment,
  updateDebtPayment,
  deleteDebtPayment,
  compactDebtPayments,
  addDebtEntry,
  updateDebtEntry,
  deleteDebtEntry,
  mergePersonDebts,
} from './debts'
import type { Debt, DebtPayment, DebtEntry } from '../types'

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
  where: vi.fn(),
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

    it('creates "الديون والسلف" category instead of picking random category like "طعام" or "راتب" when "أخرى" does not exist', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-food', name: 'طعام وبقالة', type: 'expense', archived: false }) },
        ],
      })

      const catIdExp = await getOrCreateDebtCategory('user-1', 'expense')
      expect(catIdExp).toBe('mock-generated-id')
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'الديون والسلف', type: 'expense' })
      )

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-salary', name: 'راتب', type: 'income', archived: false }) },
        ],
      })

      const catIdInc = await getOrCreateDebtCategory('user-1', 'income')
      expect(catIdInc).toBe('mock-generated-id')
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'الديون والسلف', type: 'income' })
      )
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

    it('does not delete payment transaction when deleteTransaction option is false', async () => {
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

      await deleteDebtPayment('user-1', sampleDebtWithPayments, 'pay-1', { deleteTransaction: false })

      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      expect(mockBatchDelete).not.toHaveBeenCalled()
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('deletes linked transaction using custom transactionId when present on payment', async () => {
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
            transactionId: 'custom-tx-123',
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(),
      }

      await deleteDebtPayment('user-1', sampleDebtWithPayments, 'pay-1')

      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/custom-tx-123' })
      )
    })

    it('preserves untrackedPaidFils math protection when deleting a payment', async () => {
      const debtWithUntracked: Debt = {
        id: 'debt-100',
        personName: 'محمود',
        type: 'lent',
        amountFils: 100000,
        paidFils: 60000, // untracked: 60000 - 30000 = 30000
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
          {
            id: 'pay-2',
            amountFils: 10000,
            date: new Date(),
            createdAt: new Date(),
          },
        ],
        createdAt: new Date(),
      }

      await deleteDebtPayment('user-1', debtWithUntracked, 'pay-1')

      // newPaidFils = Math.min(100000, untracked(30000) + remainingPayments(10000)) = 40000
      const debtPayload = mockBatchUpdate.mock.calls[0][1]
      expect(debtPayload.paidFils).toBe(40000)
      expect(debtPayload.settled).toBe(false)
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
        title: 'دفعة معدلة بالعنوان',
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
      expect(txPayload.title).toBe('دفعة معدلة بالعنوان')
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

    it('unlinks and deletes linked transaction when syncTransaction is explicitly false', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'debt_pay_pay-1', amountFils: 20000 }),
      })

      await updateDebtPayment(
        'user-1',
        sampleDebtWithPayments,
        'pay-1',
        {
          amountFils: 20000,
          date: new Date('2026-10-05'),
          syncTransaction: false,
        }
      )

      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/debt_pay_pay-1' })
      )
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      const debtPayload = mockBatchUpdate.mock.calls[0][1]
      expect(debtPayload.payments[0].transactionId).toBeUndefined()
    })

    it('creates linked transaction when syncTransaction is true and transaction does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      })
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ id: 'cat-inc', name: 'سداد الديون والأقساط', type: 'income', archived: false }) },
        ],
      })

      await updateDebtPayment(
        'user-1',
        sampleDebtWithPayments,
        'pay-1',
        {
          amountFils: 20000,
          date: new Date('2026-10-05'),
          syncTransaction: true,
        }
      )

      expect(mockBatchSet).toHaveBeenCalledTimes(1)
      expect(mockBatchSet.mock.calls[0][1]).toMatchObject({
        type: 'income',
        amountFils: 20000,
        title: 'استرداد دفعة دين: محمود',
      })
      const debtPayload = mockBatchUpdate.mock.calls[0][1]
      expect(debtPayload.payments[0].transactionId).toBe('debt_pay_pay-1')
    })

    it('preserves untrackedPaidFils math protection when updating a payment', async () => {
      const debtWithUntracked: Debt = {
        ...sampleDebtWithPayments,
        amountFils: 100000,
        paidFils: 50000, // untracked: 50000 - 20000 = 30000
        payments: [
          {
            id: 'pay-1',
            amountFils: 20000,
            date: new Date('2026-10-05'),
            createdAt: new Date('2026-10-05'),
          },
        ],
      }

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'debt_pay_pay-1', amountFils: 20000 }),
      })

      await updateDebtPayment('user-1', debtWithUntracked, 'pay-1', {
        amountFils: 25000,
        date: new Date('2026-10-05'),
      })

      // newPaidFils = Math.min(100000, untracked(30000) + updated(25000)) = 55000
      const debtPayload = mockBatchUpdate.mock.calls[0][1]
      expect(debtPayload.paidFils).toBe(55000)
      expect(debtPayload.settled).toBe(false)
    })

    it('fetches debt document directly when debtId is passed as string', async () => {
      mockGetDoc.mockImplementation(async (ref: { path: string }) => {
        if (ref.path.includes('debts')) {
          return {
            exists: () => true,
            data: () => sampleDebtWithPayments,
          }
        }
        if (ref.path.includes('transactions')) {
          return {
            exists: () => true,
            data: () => ({ id: 'debt_pay_pay-1', amountFils: 20000 }),
          }
        }
        return { exists: () => false, data: () => ({}) }
      })

      await updateDebtPayment('user-1', 'debt-100', 'pay-1', {
        amountFils: 25000,
        date: new Date('2026-10-06'),
      })

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2)
      const debtPayload = mockBatchUpdate.mock.calls[0][1]
      expect(debtPayload.paidFils).toBe(25000)
    })
  })

  describe('deleteDebt with cascade sync', () => {
    it('deletes debt record only by default (deleteTransactions = false)', async () => {
      mockGetDoc.mockResolvedValueOnce({
        data: () => ({
          payments: [{ id: 'p1' }, { id: 'p2' }],
        }),
      })

      await deleteDebt('user-1', 'debt-123')

      // Only 1 delete call for the debt document itself
      expect(mockBatchDelete).toHaveBeenCalledTimes(1)
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/debts/debt-123' })
      )
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('deletes debt, initial transaction, and all payment transactions when deleteTransactions is true (object or boolean)', async () => {
      mockGetDoc.mockResolvedValueOnce({
        data: () => ({
          payments: [{ id: 'p1' }, { id: 'p2' }],
        }),
      })

      await deleteDebt('user-1', 'debt-123', true)

      // 1 debt + 1 initTx + 2 payTx = 4 delete calls
      expect(mockBatchDelete).toHaveBeenCalledTimes(4)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)

      mockBatchDelete.mockClear()
      mockBatchCommit.mockClear()

      mockGetDoc.mockResolvedValueOnce({
        data: () => ({
          payments: [{ id: 'p1', transactionId: 'tx-custom-1' }],
        }),
      })

      await deleteDebt('user-1', 'debt-123', { deleteTransactions: true })
      // 1 debt + 1 initTx + 1 payTx (tx-custom-1) + 1 payTx (debt_pay_p1) = 4 delete calls
      expect(mockBatchDelete).toHaveBeenCalledTimes(4)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('deletes transactions linked to debt entries when deleteTransactions is true', async () => {
      mockBatchDelete.mockClear()
      mockBatchCommit.mockClear()

      mockGetDoc.mockResolvedValueOnce({
        data: () => ({
          payments: [],
          entries: [
            { id: 'e1', transactionId: 'tx-custom-entry' },
            { id: 'e2' },
          ],
        }),
      })

      await deleteDebt('user-1', 'debt-123', { deleteTransactions: true })

      // 1 debt + 1 initTx (debt_init_debt-123) + 1 tx-custom-entry + 1 debt_entry_e2 = 4 delete calls
      expect(mockBatchDelete).toHaveBeenCalledTimes(4)
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-custom-entry' })
      )
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/debt_entry_e2' })
      )
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('deletes legacy init and payment transactions when found during deleteDebt with deleteTransactions: true', async () => {
      mockBatchDelete.mockClear()
      mockBatchCommit.mockClear()

      mockGetDoc.mockResolvedValueOnce({
        data: () => ({
          personName: 'أبو أحمد',
          type: 'lent',
          amountFils: 50000,
          paidFils: 10000,
          startDate: new Date('2026-10-01'),
          payments: [{ id: 'p1', amountFils: 10000, date: new Date('2026-10-05') }],
        }),
      })

      // mockGetDocs for legacyInitId
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'legacy-init-tx-999',
            data: () => ({
              amountFils: 50000,
              date: new Date('2026-10-01'),
              title: 'إقراض أبو أحمد',
            }),
          },
        ],
      })
      // mockGetDocs for legacyPayId
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'legacy-pay-tx-888',
            data: () => ({
              amountFils: 10000,
              date: new Date('2026-10-05'),
              title: 'سداد من أبو أحمد',
            }),
          },
        ],
      })

      await deleteDebt('user-1', 'debt-123', true)

      // Expected deleted paths:
      // 1. users/user-1/debts/debt-123
      // 2. users/user-1/transactions/debt_init_debt-123
      // 3. users/user-1/transactions/debt_pay_p1
      // 4. users/user-1/transactions/legacy-init-tx-999
      // 5. users/user-1/transactions/legacy-pay-tx-888
      expect(mockBatchDelete).toHaveBeenCalledTimes(5)
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/legacy-init-tx-999' })
      )
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/legacy-pay-tx-888' })
      )
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

    it('preserves init transaction note if debt note was not modified', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ personName: 'سامي', type: 'lent', paidFils: 0, note: 'ملاحظة الدين القديمة' }),
      })

      await updateDebt('user-1', 'debt-999', {
        amountFils: 80000,
        note: 'ملاحظة الدين القديمة',
      })

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2)
      const txUpdates = mockBatchUpdate.mock.calls[1][1]
      expect(txUpdates.amountFils).toBe(80000)
      expect(txUpdates.note).toBeUndefined()
    })

    it('updates init transaction note when debt note has changed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ personName: 'سامي', type: 'lent', paidFils: 0, note: 'ملاحظة قديمة' }),
      })

      await updateDebt('user-1', 'debt-999', {
        amountFils: 80000,
        note: 'ملاحظة جديدة تماماً',
      })

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2)
      const txUpdates = mockBatchUpdate.mock.calls[1][1]
      expect(txUpdates.amountFils).toBe(80000)
      expect(txUpdates.note).toBe('ملاحظة جديدة تماماً')
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
      ).rejects.toThrow('لا يمكن أن يكون إجمالي الدين أقل من المبلغ المسدد بالفعل')
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

    it('deletes ONLY initial transaction and preserves payment transactions when syncTransaction is explicitly false', async () => {
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

      // Only initial transaction is deleted (payments are managed independently)
      expect(mockBatchDelete).toHaveBeenCalledTimes(1)
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/debt_init_debt-123' })
      )
      expect(mockBatchCommit).toHaveBeenCalled()
    })

    it('creates initial transaction when syncTransaction is true and initTx does NOT exist', async () => {
      mockGetDocs
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({
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

  describe('compactDebtPayments', () => {
    it('returns zero and does not update when payments count is 10 or fewer', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'debt-compact-1',
          amountFils: 100000,
          paidFils: 50000,
          settled: false,
          payments: Array.from({ length: 8 }, (_, i) => ({
            id: `p-${i}`,
            amountFils: 5000,
            date: new Date(`2026-10-0${i + 1}`),
            createdAt: new Date(),
          })),
        }),
      })

      const result = await compactDebtPayments('user-1', 'debt-compact-1')
      expect(result).toEqual({ mergedCount: 0, mergedAmountFils: 0 })
      expect(mockBatchUpdate).not.toHaveBeenCalled()
    })

    it('merges oldest payments keeping latest 10 and preserves paidFils and settled exactly', async () => {
      const totalPayments = 25
      const mockPayments = Array.from({ length: totalPayments }, (_, i) => ({
        id: `p-${i + 1}`,
        amountFils: 2000, // 25 * 2000 = 50,000 fils
        date: new Date(2026, 9, i + 1),
        createdAt: new Date(2026, 9, i + 1),
      }))

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'debt-compact-2',
          amountFils: 100000,
          paidFils: 50000,
          settled: false,
          payments: mockPayments,
        }),
      })

      const result = await compactDebtPayments('user-1', 'debt-compact-2')

      // toMerge = 25 - 10 = 15 payments
      // mergedAmount = 15 * 2000 = 30,000 fils
      expect(result.mergedCount).toBe(15)
      expect(result.mergedAmountFils).toBe(30000)

      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      const updatedData = mockBatchUpdate.mock.calls[0][1]
      // 1 consolidated payment + 10 kept payments = 11 payments
      expect(updatedData.payments).toHaveLength(11)
      expect(updatedData.payments[0].amountFils).toBe(30000)
      expect(updatedData.payments[0].note).toBe('رصيد دفعات سابقة مدمجة (15 دفعة)')
      expect(updatedData.payments[0].transactionId).toBeUndefined()
      expect(updatedData.payments[0].isMerged).toBe(true)
      expect(updatedData.payments[0].id).toMatch(/^compacted_/)
      // Kept payments remain unchanged
      expect(updatedData.payments[1].id).toBe('p-16')
      expect(updatedData.payments[10].id).toBe('p-25')
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('collects transactionIds into mergedTransactionIds during compaction', async () => {
      const mockPayments = Array.from({ length: 15 }, (_, i) => ({
        id: `p-${i + 1}`,
        amountFils: 2000,
        date: new Date(2026, 9, i + 1),
        createdAt: new Date(2026, 9, i + 1),
        transactionId: i < 5 ? `tx-${i + 1}` : undefined,
      }))

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'debt-compact-3',
          amountFils: 100000,
          paidFils: 30000,
          settled: false,
          payments: mockPayments,
        }),
      })

      const result = await compactDebtPayments('user-1', 'debt-compact-3')
      expect(result.mergedCount).toBe(5)

      const updatedData = mockBatchUpdate.mock.calls[0][1]
      expect(updatedData.payments[0].mergedTransactionIds).toEqual([
        'tx-1',
        'tx-2',
        'tx-3',
        'tx-4',
        'tx-5',
      ])
    })

    it('falls back to debt_pay_${p.id} when unmerged payment lacks transactionId', async () => {
      const mockPayments = Array.from({ length: 15 }, (_, i) => ({
        id: `p-${i + 1}`,
        amountFils: 2000,
        date: new Date(2026, 9, i + 1),
        createdAt: new Date(2026, 9, i + 1),
      }))

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'debt-compact-4',
          amountFils: 100000,
          paidFils: 30000,
          settled: false,
          payments: mockPayments,
        }),
      })

      const result = await compactDebtPayments('user-1', 'debt-compact-4')
      expect(result.mergedCount).toBe(5)

      const updatedData = mockBatchUpdate.mock.calls[0][1]
      expect(updatedData.payments[0].mergedTransactionIds).toEqual([
        'debt_pay_p-1',
        'debt_pay_p-2',
        'debt_pay_p-3',
        'debt_pay_p-4',
        'debt_pay_p-5',
      ])
    })

    it('preserves custom notes of merged payments inside the consolidated payment note', async () => {
      const mockPayments = Array.from({ length: 15 }, (_, i) => ({
        id: `p-${i + 1}`,
        amountFils: 2000,
        date: new Date(2026, 9, i + 1),
        createdAt: new Date(2026, 9, i + 1),
        note:
          i === 0
            ? 'دفعة كاش من المحل'
            : i === 1
              ? 'دفعة سداد' // generic - should be ignored
              : i === 2
                ? 'حوالة بنكية CliQ'
                : undefined,
      }))

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'debt-compact-notes',
          amountFils: 100000,
          paidFils: 30000,
          settled: false,
          payments: mockPayments,
        }),
      })

      const result = await compactDebtPayments('user-1', 'debt-compact-notes')
      expect(result.mergedCount).toBe(5)

      const updatedData = mockBatchUpdate.mock.calls[0][1]
      expect(updatedData.payments[0].note).toBe(
        'رصيد دفعات سابقة مدمجة (5 دفعة): دفعة كاش من المحل ، حوالة بنكية CliQ'
      )
    })

    it('deletes all mergedTransactionIds when deleting a merged payment', async () => {
      const debtWithMergedPayment: Debt = {
        id: 'debt-merged-1',
        personName: 'خالد',
        type: 'lent',
        amountFils: 100000,
        paidFils: 50000,
        startDate: new Date('2026-10-01'),
        note: '',
        settled: false,
        payments: [
          {
            id: 'compacted_123',
            amountFils: 50000,
            date: new Date('2026-10-05'),
            createdAt: new Date('2026-10-05'),
            isMerged: true,
            mergedTransactionIds: ['tx-a', 'tx-b', 'tx-c'],
          },
        ],
        createdAt: new Date('2026-10-01'),
      }

      await deleteDebtPayment('user-1', debtWithMergedPayment, 'compacted_123')

      // Should delete tx-a, tx-b, tx-c
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-a' })
      )
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-b' })
      )
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/tx-c' })
      )
    })

    it('deletes all mergedTransactionIds when deleteDebt is called with deleteTransactions = true', async () => {
      mockGetDoc.mockResolvedValueOnce({
        data: () => ({
          payments: [
            {
              id: 'compacted_999',
              isMerged: true,
              mergedTransactionIds: ['merged-tx-1', 'merged-tx-2'],
            },
            {
              id: 'p-single',
              transactionId: 'single-tx-1',
            },
          ],
        }),
      })

      await deleteDebt('user-1', 'debt-with-compacted', { deleteTransactions: true })

      // initTx + single-tx-1 + merged-tx-1 + merged-tx-2 + debt doc = 5 deletes
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/merged-tx-1' })
      )
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/merged-tx-2' })
      )
      expect(mockBatchDelete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/transactions/single-tx-1' })
      )
    })

    it('updates payment title to matching format and preserves custom note on personName change in updateDebt', async () => {
      mockGetDoc.mockImplementation(async (ref: { path: string }) => {
        if (ref.path.includes('debts')) {
          return {
            exists: () => true,
            data: () => ({
              personName: 'عمر',
              type: 'lent',
              paidFils: 20000,
              amountFils: 50000,
              payments: [
                {
                  id: 'pay-custom-note',
                  amountFils: 20000,
                  transactionId: 'tx-custom-note',
                  note: 'دفعة نقدية مميزة من عمر',
                },
              ],
            }),
          }
        }
        if (ref.path.includes('tx-custom-note')) {
          return {
            exists: () => true,
            data: () => ({
              title: 'استرداد دفعة دين: عمر',
              note: 'دفعة نقدية مميزة من عمر',
            }),
          }
        }
        return {
          exists: () => true,
          data: () => ({}),
        }
      })

      await updateDebt('user-1', 'debt-999', {
        personName: 'عمر الجديد',
      })

      // Check payment tx update call
      const payTxUpdateCall = mockBatchUpdate.mock.calls.find(
        (c) => c[0].path === 'users/user-1/transactions/tx-custom-note'
      )
      expect(payTxUpdateCall).toBeDefined()
      expect(payTxUpdateCall![1].title).toBe('استرداد دفعة دين: عمر الجديد')
      // Custom note must be preserved, not overwritten with generic prefix
      expect(payTxUpdateCall![1].note).toBe('دفعة نقدية مميزة من عمر')
    })

    it('synchronizes debt_entry_ transactions on personName and type change in updateDebt', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ id: 'cat-borrowed-inc', name: 'أخرى', type: 'income', archived: false }) },
        ],
      })
      mockGetDoc.mockImplementation(async (ref: { path: string }) => {
        if (ref.path.includes('debts')) {
          return {
            exists: () => true,
            data: () => ({
              personName: 'خالد',
              type: 'lent',
              paidFils: 0,
              amountFils: 70000,
              entries: [
                {
                  id: 'entry_base_debt-entries-test',
                  amountFils: 50000,
                  transactionId: 'debt_init_debt-entries-test',
                },
                {
                  id: 'e2',
                  amountFils: 20000,
                  transactionId: 'debt_entry_e2',
                },
              ],
            }),
          }
        }
        if (ref.path.includes('debt_entry_e2')) {
          return {
            exists: () => true,
            data: () => ({
              title: 'سلفة إضافية: خالد',
              type: 'expense',
            }),
          }
        }
        return {
          exists: () => true,
          data: () => ({}),
        }
      })

      await updateDebt('user-1', 'debt-entries-test', {
        personName: 'خالد الجديد',
        type: 'borrowed',
      })

      // Check debt_entry_e2 update call
      const entryTxUpdateCall = mockBatchUpdate.mock.calls.find(
        (c) => c[0].path === 'users/user-1/transactions/debt_entry_e2'
      )
      expect(entryTxUpdateCall).toBeDefined()
      expect(entryTxUpdateCall![1].title).toBe('اقتراض إضافي من: خالد الجديد')
      expect(entryTxUpdateCall![1].type).toBe('income')
    })
  })

  describe('debt entries & merging', () => {
    it('supports addDebt with initialPaidFils without creating initial payment transaction', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] })
      await addDebt(
        'user-1',
        {
          personName: 'خالد',
          type: 'lent',
          amountFils: 50000,
          startDate: new Date('2026-01-01'),
          note: 'سلفة قديمة',
        },
        {
          initialPaidFils: 20000,
          initialPaymentNote: 'سداد قديم كاش',
        }
      )

      const setCall = mockBatchSet.mock.calls.find((c) => c[1]?.personName === 'خالد')
      expect(setCall).toBeDefined()
      expect(setCall![1].paidFils).toBe(20000)
      expect(setCall![1].settled).toBe(false)
      expect(setCall![1].payments).toHaveLength(1)
      expect(setCall![1].payments[0].amountFils).toBe(20000)
      expect(setCall![1].payments[0].note).toBe('سداد قديم كاش')
      expect(setCall![1].entries).toHaveLength(1)
    })

    it('adds a debt entry, updates debt amount, and creates sync transaction if requested', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            data: () => ({
              id: 'cat-debt',
              name: 'الديون والسلف',
              type: 'expense',
              archived: false,
            }),
          },
        ],
      })

      const debt: Debt = {
        id: 'debt-entry-1',
        personName: 'سامر',
        type: 'lent',
        amountFils: 40000,
        paidFils: 10000,
        startDate: new Date('2026-05-01'),
        note: 'دين أصلي',
        settled: false,
        payments: [],
        createdAt: new Date('2026-05-01'),
      }

      await addDebtEntry(
        'user-1',
        debt,
        {
          amountFils: 25000,
          date: new Date('2026-06-01'),
          title: 'سلفة ثانية',
          note: 'مبلغ إضافي',
        },
        { syncTransaction: true }
      )

      const updateCall = mockBatchUpdate.mock.calls.find((c) => c[0].path.includes('debts/debt-entry-1'))
      expect(updateCall).toBeDefined()
      expect(updateCall![1].amountFils).toBe(65000)
      expect(updateCall![1].entries).toHaveLength(2)

      const txCall = mockBatchSet.mock.calls.find((c) => c[0].path.includes('transactions/debt_entry_'))
      expect(txCall).toBeDefined()
      expect(txCall![1].amountFils).toBe(25000)
    })

    it('updates a debt entry amount and recalculates debt total amount', async () => {
      const debt: Debt = {
        id: 'debt-entry-upd',
        personName: 'سامر',
        type: 'lent',
        amountFils: 65000,
        paidFils: 10000,
        startDate: new Date('2026-05-01'),
        note: 'دين أصلي',
        settled: false,
        payments: [],
        createdAt: new Date('2026-05-01'),
        entries: [
          {
            id: 'e1',
            amountFils: 40000,
            date: new Date('2026-05-01'),
            title: 'سلفة 1',
            note: '',
            createdAt: new Date('2026-05-01'),
          },
          {
            id: 'e2',
            amountFils: 25000,
            date: new Date('2026-06-01'),
            title: 'سلفة 2',
            note: '',
            createdAt: new Date('2026-06-01'),
          },
        ],
      }

      await updateDebtEntry('user-1', debt, 'e2', {
        amountFils: 30000,
        date: new Date('2026-06-01'),
        title: 'سلفة 2 معدلة',
      })

      const updateCall = mockBatchUpdate.mock.calls.find((c) => c[0].path.includes('debts/debt-entry-upd'))
      expect(updateCall).toBeDefined()
      expect(updateCall![1].amountFils).toBe(70000)
      expect(updateCall![1].entries[1].amountFils).toBe(30000)
    })

    it('deletes a debt entry and adjusts debt total amount', async () => {
      const debt: Debt = {
        id: 'debt-entry-del',
        personName: 'سامر',
        type: 'lent',
        amountFils: 70000,
        paidFils: 10000,
        startDate: new Date('2026-05-01'),
        note: 'دين أصلي',
        settled: false,
        payments: [],
        createdAt: new Date('2026-05-01'),
        entries: [
          {
            id: 'e1',
            amountFils: 40000,
            date: new Date('2026-05-01'),
            title: 'سلفة 1',
            note: '',
            createdAt: new Date('2026-05-01'),
          },
          {
            id: 'e2',
            amountFils: 30000,
            date: new Date('2026-06-01'),
            title: 'سلفة 2',
            note: '',
            transactionId: 'debt_entry_e2',
            createdAt: new Date('2026-06-01'),
          },
        ],
      }

      await deleteDebtEntry('user-1', debt, 'e2')

      const updateCall = mockBatchUpdate.mock.calls.find((c) => c[0].path.includes('debts/debt-entry-del'))
      expect(updateCall).toBeDefined()
      expect(updateCall![1].amountFils).toBe(40000)
      expect(updateCall![1].entries).toHaveLength(1)

      const delCall = mockBatchDelete.mock.calls.find((c) => c[0].path.includes('transactions/debt_entry_e2'))
      expect(delCall).toBeDefined()
    })

    it('merges debts of same person, consolidates entries & payments, and deletes secondary debts', async () => {
      const debt1: Debt = {
        id: 'debt-father-1',
        personName: 'أبوي',
        type: 'lent',
        amountFils: 50000,
        paidFils: 20000,
        startDate: new Date('2026-01-01'),
        note: 'ملاحظة 1',
        settled: false,
        payments: [
          {
            id: 'p1',
            amountFils: 20000,
            date: new Date('2026-01-15'),
            createdAt: new Date('2026-01-15'),
          },
        ],
        createdAt: new Date('2026-01-01'),
      }

      const debt2: Debt = {
        id: 'debt-father-2',
        personName: 'ابوي',
        type: 'lent',
        amountFils: 30000,
        paidFils: 10000,
        startDate: new Date('2026-03-01'),
        note: 'ملاحظة 2',
        settled: false,
        payments: [
          {
            id: 'p2',
            amountFils: 10000,
            date: new Date('2026-03-15'),
            createdAt: new Date('2026-03-15'),
          },
        ],
        createdAt: new Date('2026-03-01'),
      }

      const mergedId = await mergePersonDebts('user-1', [debt1, debt2])
      expect(mergedId).toBe('debt-father-1')

      const primaryUpdateCall = mockBatchUpdate.mock.calls.find((c) =>
        c[0].path.includes('debts/debt-father-1')
      )
      expect(primaryUpdateCall).toBeDefined()
      expect(primaryUpdateCall![1].amountFils).toBe(80000)
      expect(primaryUpdateCall![1].paidFils).toBe(30000)
      expect(primaryUpdateCall![1].settled).toBe(false)
      expect(primaryUpdateCall![1].entries).toHaveLength(2)
      expect(primaryUpdateCall![1].payments).toHaveLength(2)

      const secondaryDeleteCall = mockBatchDelete.mock.calls.find((c) =>
        c[0].path.includes('debts/debt-father-2')
      )
      expect(secondaryDeleteCall).toBeDefined()
    })

    it('does not fail updateDebtEntry if oldEntry.transactionId does not exist in Firestore', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      const debt: Debt = {
        id: 'debt-unlinked-tx',
        personName: 'خالد',
        type: 'lent',
        amountFils: 50000,
        paidFils: 0,
        startDate: new Date('2026-05-01'),
        note: '',
        settled: false,
        payments: [],
        createdAt: new Date('2026-05-01'),
        entries: [
          {
            id: 'e1',
            amountFils: 50000,
            date: new Date('2026-05-01'),
            title: 'أصل الدين',
            note: '',
            transactionId: 'debt_init_debt-unlinked-tx',
            createdAt: new Date('2026-05-01'),
          },
        ],
      }

      await updateDebtEntry('user-1', debt, 'e1', {
        amountFils: 60000,
        date: new Date('2026-05-01'),
        title: 'أصل الدين المعدل',
      })

      const debtUpdateCall = mockBatchUpdate.mock.calls.find((c) =>
        c[0].path.includes('debts/debt-unlinked-tx')
      )
      expect(debtUpdateCall).toBeDefined()
      expect(debtUpdateCall![1].amountFils).toBe(60000)

      const txUpdateCall = mockBatchUpdate.mock.calls.find((c) =>
        c[0].path.includes('transactions/debt_init_debt-unlinked-tx')
      )
      expect(txUpdateCall).toBeUndefined()
    })

    it('inherits dueDate from secondary debt when primary debt lacks dueDate, and compacts payments when total payments exceed 100', async () => {
      const payments1: DebtPayment[] = Array.from({ length: 60 }, (_, i) => ({
        id: `p1_${i}`,
        amountFils: 1000,
        date: new Date(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`),
        note: `دفعة ${i + 1}`,
        createdAt: new Date('2026-01-01'),
      }))

      const debt1: Debt = {
        id: 'debt-p-1',
        personName: 'مازن',
        type: 'borrowed',
        amountFils: 200000,
        paidFils: 60000,
        startDate: new Date('2026-01-01'),
        dueDate: undefined,
        note: '',
        settled: false,
        payments: payments1,
        createdAt: new Date('2026-01-01'),
      }

      const payments2: DebtPayment[] = Array.from({ length: 50 }, (_, i) => ({
        id: `p2_${i}`,
        amountFils: 1000,
        date: new Date(`2026-02-${String((i % 28) + 1).padStart(2, '0')}`),
        note: `دفعة ثانية ${i + 1}`,
        createdAt: new Date('2026-02-01'),
      }))

      const expectedDueDate = new Date('2026-08-15')
      const debt2: Debt = {
        id: 'debt-p-2',
        personName: 'مازن',
        type: 'borrowed',
        amountFils: 100000,
        paidFils: 50000,
        startDate: new Date('2026-02-01'),
        dueDate: expectedDueDate,
        note: '',
        settled: false,
        payments: payments2,
        createdAt: new Date('2026-02-01'),
      }

      const mergedId = await mergePersonDebts('user-1', [debt1, debt2])
      expect(mergedId).toBe('debt-p-1')

      const primaryUpdateCall = mockBatchUpdate.mock.calls.find((c) =>
        c[0].path.includes('debts/debt-p-1')
      )
      expect(primaryUpdateCall).toBeDefined()
      expect(primaryUpdateCall![1].dueDate).toBeDefined()
      expect(primaryUpdateCall![1].dueDate.seconds).toBe(
        Math.floor(expectedDueDate.getTime() / 1000)
      )

      expect(primaryUpdateCall![1].payments).toHaveLength(11)
      const firstPayment = primaryUpdateCall![1].payments[0]
      expect(firstPayment.isMerged).toBe(true)
      expect(firstPayment.amountFils).toBe(100000)
      expect(primaryUpdateCall![1].paidFils).toBe(110000)
    })

    it('compacts entries when merged debts have more than 100 entries, preserving total amount', async () => {
      const entries1: DebtEntry[] = Array.from({ length: 60 }, (_, i) => ({
        id: `e1_${i}`,
        amountFils: 1000,
        date: new Date(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`),
        title: `سلفة ${i + 1}`,
        note: '',
        createdAt: new Date('2026-01-01'),
      }))

      const debt1: Debt = {
        id: 'debt-many-entries-1',
        personName: 'طارق',
        type: 'lent',
        amountFils: 60000,
        paidFils: 0,
        startDate: new Date('2026-01-01'),
        note: '',
        settled: false,
        payments: [],
        entries: entries1,
        createdAt: new Date('2026-01-01'),
      }

      const entries2: DebtEntry[] = Array.from({ length: 50 }, (_, i) => ({
        id: `e2_${i}`,
        amountFils: 2000,
        date: new Date(`2026-02-${String((i % 28) + 1).padStart(2, '0')}`),
        title: `سلفة ثانية ${i + 1}`,
        note: '',
        createdAt: new Date('2026-02-01'),
      }))

      const debt2: Debt = {
        id: 'debt-many-entries-2',
        personName: 'طارق',
        type: 'lent',
        amountFils: 100000,
        paidFils: 0,
        startDate: new Date('2026-02-01'),
        note: '',
        settled: false,
        payments: [],
        entries: entries2,
        createdAt: new Date('2026-02-01'),
      }

      await mergePersonDebts('user-1', [debt1, debt2])

      const primaryUpdateCall = mockBatchUpdate.mock.calls.find((c) =>
        c[0].path.includes('debts/debt-many-entries-1')
      )
      expect(primaryUpdateCall).toBeDefined()
      expect(primaryUpdateCall![1].amountFils).toBe(160000)

      expect(primaryUpdateCall![1].entries).toHaveLength(100)
      const sumCompactedEntries = primaryUpdateCall![1].entries.reduce(
        (sum: number, e: { amountFils: number }) => sum + e.amountFils,
        0
      )
      expect(sumCompactedEntries).toBe(160000)
    })

    it('does not assign transactionId to entry_base if initial transaction does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })
      mockGetDocs.mockResolvedValueOnce({ docs: [] })

      const debt: Debt = {
        id: 'debt-no-tx-sync',
        personName: 'عمر',
        type: 'lent',
        amountFils: 30000,
        paidFils: 0,
        startDate: new Date('2026-05-01'),
        note: '',
        settled: false,
        payments: [],
        createdAt: new Date('2026-05-01'),
      }

      await addDebtEntry('user-1', debt, {
        amountFils: 10000,
        date: new Date('2026-06-01'),
        title: 'دفعة إضافية',
      })

      const updateCall = mockBatchUpdate.mock.calls.find((c) =>
        c[0].path.includes('debts/debt-no-tx-sync')
      )
      expect(updateCall).toBeDefined()
      const baseEntry = updateCall![1].entries[0]
      expect(baseEntry.transactionId).toBeUndefined()
    })

    it('rejects adding entry when maximum of 100 entries is reached in addDebtEntry', async () => {
      const debtWith100Entries: Debt = {
        id: 'debt-100',
        personName: 'طارق',
        type: 'lent',
        amountFils: 100000,
        paidFils: 0,
        settled: false,
        note: '',
        entries: Array.from({ length: 100 }, (_, i) => ({
          id: `entry_${i}`,
          amountFils: 1000,
          date: new Date(),
          note: '',
          createdAt: new Date(),
        })),
        createdAt: new Date(),
        startDate: new Date(),
        payments: [],
      }

      await expect(
        addDebtEntry('user-1', debtWith100Entries, {
          amountFils: 1000,
          date: new Date(),
        })
      ).rejects.toThrow('تم الوصول للحد الأقصى لعدد السلف (100 سلفة) لهذا السجل')
    })
  })
})
