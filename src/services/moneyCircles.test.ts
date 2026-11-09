import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCurrentCircleMonth,
  getCircleCycleIndex,
  isUserTurnMonth,
  isCircleFullyPaid,
  circleConverter,
  deleteMoneyCircle,
  updateMoneyCircle,
  checkCircleHasTransactions,
  toggleCircleMemberPayment,
  removeCircleInstallmentPayment,
  swapMemberTurns,
} from './moneyCircles'
import type { MoneyCircle } from '../types'

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
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined)

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  doc: vi.fn((_collOrDb, ...parts) => ({
    id: parts[parts.length - 1] || 'mock-id',
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  query: vi.fn((c) => c),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  setDoc: vi.fn(),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  deleteField: () => ({ _method: 'deleteField' }),
  writeBatch: () => mockBatch,
  Timestamp: {
    fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
  serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
}))

describe('moneyCircles service', () => {
  const sampleCircle: MoneyCircle = {
    id: 'circle-1',
    name: 'جمعية العائلة',
    monthlyAmountFils: 100000, // 100 JOD
    membersCount: 10,
    totalAmountFils: 1000000, // 1000 JOD
    myTurnMonth: 4,
    startDate: new Date(2026, 0, 1), // Jan 1, 2026
    members: [
      { id: 'm-1', name: 'أحمد', turnMonth: 1, paidMonths: [1, 2] },
      { id: 'm-2', name: 'محمد', turnMonth: 2, paidMonths: [1] },
      { id: 'm-4', name: 'أنت', turnMonth: 4, paidMonths: [1, 2] },
    ],
    status: 'active',
    createdAt: new Date(),
  }

  describe('getCurrentCircleMonth', () => {
    it('calculates the current month index based on elapsed months', () => {
      // Month 1: Jan 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 0, 15))).toBe(1)
      // Month 3: March 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 2, 10))).toBe(3)
      // Month 4: April 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 3, 5))).toBe(4)
      // Month 10: Oct 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 9, 20))).toBe(10)
    })

    it('clamps to membersCount if beyond duration', () => {
      // Nov 2026 (month 11) should clamp to 10
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 10, 1))).toBe(10)
    })

    it('clamps to 1 if before start date', () => {
      expect(getCurrentCircleMonth(sampleCircle, new Date(2025, 11, 20))).toBe(1)
    })

    it('calculates correctly based on actual monthly cycles when circle starts on a day other than the 1st (e.g. 15th)', () => {
      const midMonthCircle: MoneyCircle = {
        ...sampleCircle,
        startDate: new Date(2026, 0, 15), // Jan 15, 2026
      }
      // Jan 20, 2026 -> Still in cycle 1 (Jan 15 - Feb 14)
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 0, 20))).toBe(1)
      // Feb 5, 2026 -> Still in cycle 1 (before Feb 15)
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 1, 5))).toBe(1)
      // Feb 15, 2026 -> Entered cycle 2 (Feb 15 - Mar 14)
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 1, 15))).toBe(2)
      // Mar 1, 2026 -> Still in cycle 2 (before Mar 15)
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 2, 1))).toBe(2)
      // Mar 15, 2026 -> Entered cycle 3
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 2, 15))).toBe(3)
    })

    it('respects user monthStartDay when circle was created on the 1st of the month', () => {
      // sampleCircle started Jan 1, 2026. With monthStartDay = 25:
      // Cycle 1 starts Jan 25, 2026
      // Feb 20, 2026 is still before Feb 25 -> month 1
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 1, 20), 25)).toBe(1)
      // Feb 25, 2026 -> enters month 2
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 1, 25), 25)).toBe(2)

      // On Jan 10, 2026: since circle started Jan 1, 2026, it must NOT be postponed to future Jan 25
      // It must be in month 1 and cycle index 0, not -1
      expect(getCircleCycleIndex(sampleCircle.startDate, new Date(2026, 0, 10), 25)).toBe(0)
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 0, 10), 25)).toBe(1)
      expect(getCircleCycleIndex(sampleCircle.startDate, new Date(2026, 0, 1), 25)).toBe(0)
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 0, 1), 25)).toBe(1)
    })
  })

  describe('isUserTurnMonth', () => {
    it('returns true when current month equals myTurnMonth', () => {
      // April 2026 is month 4
      expect(isUserTurnMonth(sampleCircle, new Date(2026, 3, 10))).toBe(true)
    })

    it('returns false when current month is not myTurnMonth', () => {
      // March 2026 is month 3
      expect(isUserTurnMonth(sampleCircle, new Date(2026, 2, 10))).toBe(false)
      // May 2026 is month 5
      expect(isUserTurnMonth(sampleCircle, new Date(2026, 4, 10))).toBe(false)
    })

    it('respects circle cycle day for user turn month', () => {
      const midMonthCircle: MoneyCircle = {
        ...sampleCircle,
        myTurnMonth: 2,
        startDate: new Date(2026, 0, 15), // Jan 15, 2026 -> Turn 2 is Feb 15 to Mar 14
      }
      // Feb 5 -> month 1 (not turn 2 yet)
      expect(isUserTurnMonth(midMonthCircle, new Date(2026, 1, 5))).toBe(false)
      // Feb 15 -> month 2 (user's turn!)
      expect(isUserTurnMonth(midMonthCircle, new Date(2026, 1, 15))).toBe(true)
      // Mar 1 -> still in month 2 (user's turn!)
      expect(isUserTurnMonth(midMonthCircle, new Date(2026, 2, 1))).toBe(true)
      // Mar 15 -> entered month 3 (past turn 2)
      expect(isUserTurnMonth(midMonthCircle, new Date(2026, 2, 15))).toBe(false)
    })

    it('returns false when circle start date is in the future even if myTurnMonth is 1', () => {
      const futureCircle: MoneyCircle = {
        ...sampleCircle,
        myTurnMonth: 1,
        startDate: new Date(2026, 5, 1), // June 2026
      }
      // In April 2026 (2 months before start)
      expect(isUserTurnMonth(futureCircle, new Date(2026, 3, 10))).toBe(false)
    })

    it('returns false when reference date is past the circle duration even if myTurnMonth equals membersCount', () => {
      const endCircle: MoneyCircle = {
        ...sampleCircle,
        myTurnMonth: 10,
        membersCount: 10,
        startDate: new Date(2026, 0, 1), // Jan - Oct 2026
      }
      // In December 2026 (month 12, after end)
      expect(isUserTurnMonth(endCircle, new Date(2026, 11, 10))).toBe(false)
    })
  })

  describe('circleConverter', () => {
    it('converts circle to firestore document format', () => {
      const doc = circleConverter.toFirestore(sampleCircle)
      expect(doc.name).toBe('جمعية العائلة')
      expect(doc.monthlyAmountFils).toBe(100000)
      expect(doc.totalAmountFils).toBe(1000000)
      expect(doc.myTurnMonth).toBe(4)
      expect(doc.members).toHaveLength(3)
      expect(doc.members[0].paidMonths).toEqual([1, 2])
    })

    it('preserves isManager when defined as boolean or truthy', () => {
      const circleWithManager: MoneyCircle = {
        ...sampleCircle,
        isManager: true,
      }
      const doc = circleConverter.toFirestore(circleWithManager)
      expect(doc.isManager).toBe(true)

      const circleWithoutManager: MoneyCircle = {
        ...sampleCircle,
        isManager: false,
      }
      const docFalse = circleConverter.toFirestore(circleWithoutManager)
      expect(docFalse.isManager).toBe(false)
    })
  })

  describe('deleteMoneyCircle', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('deletes circle doc, linked recurring rules, payout doc, and installment transactions when deleteTransactions is true', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ recurringId: 'rec-assoc-1' }),
      })

      // Query recurring linked via circleId
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'rec-query-1', ref: { path: 'users/uid-1/recurring/rec-query-1' } },
        ],
      })
      // Query transactions linked via rec-assoc-1
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { ref: { path: 'users/uid-1/transactions/tx-rec-1' } },
        ],
      })
      // Query transactions linked via rec-query-1
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { ref: { path: 'users/uid-1/transactions/tx-rec-2' } },
        ],
      })

      await deleteMoneyCircle('uid-1', 'circle-1', { deleteTransactions: true })

      expect(mockBatchDelete).toHaveBeenCalledTimes(6)
      const deletedPaths = mockBatchDelete.mock.calls.map((c) => c[0].path)
      expect(deletedPaths).toContain('users/uid-1/circles/circle-1')
      expect(deletedPaths).toContain('users/uid-1/recurring/rec-assoc-1')
      expect(deletedPaths).toContain('users/uid-1/recurring/rec-query-1')
      expect(deletedPaths).toContain('users/uid-1/transactions/circle_payout_circle-1')
      expect(deletedPaths).toContain('users/uid-1/transactions/tx-rec-1')
      expect(deletedPaths).toContain('users/uid-1/transactions/tx-rec-2')

      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('preserves payout and installment transactions when deleteTransactions is false or omitted', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ recurringId: 'rec-assoc-1' }),
      })

      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      })

      await deleteMoneyCircle('uid-1', 'circle-2')

      expect(mockBatchDelete).toHaveBeenCalledTimes(2)
      const deletedPaths = mockBatchDelete.mock.calls.map((c) => c[0].path)
      expect(deletedPaths).toContain('users/uid-1/circles/circle-2')
      expect(deletedPaths).toContain('users/uid-1/recurring/rec-assoc-1')
      expect(deletedPaths).not.toContain('users/uid-1/transactions/circle_payout_circle-2')
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('deletes manual installment transactions circle_{id}_m1 through m{membersCount} when deleteTransactions is true', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ recurringId: 'rec-1', membersCount: 3 }),
      })
      mockGetDocs.mockResolvedValueOnce({ docs: [] }) // query recurring
      mockGetDocs.mockResolvedValueOnce({ docs: [] }) // query txs for rec-1

      await deleteMoneyCircle('uid-1', 'circle-10', { deleteTransactions: true })

      const deletedPaths = mockBatchDelete.mock.calls.map((c) => c[0].path)
      expect(deletedPaths).toContain('users/uid-1/transactions/circle_circle-10_m1')
      expect(deletedPaths).toContain('users/uid-1/transactions/circle_circle-10_m2')
      expect(deletedPaths).toContain('users/uid-1/transactions/circle_circle-10_m3')
    })

    it('chunks delete operations into batches of at most 400 operations when deleting many items', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ recurringId: 'rec-1', membersCount: 450 }),
      })
      mockGetDocs.mockResolvedValueOnce({ docs: [] }) // query recurring
      mockGetDocs.mockResolvedValueOnce({ docs: [] }) // query txs for rec-1

      await deleteMoneyCircle('uid-1', 'circle-large', { deleteTransactions: true })

      // Total items: 1 (doc) + 1 (rec-1) + 1 (payout) + 450 (manual txs) = 453 items
      // Chunks: 400 + 53 -> 2 commits
      expect(mockBatchCommit).toHaveBeenCalledTimes(2)
      expect(mockBatchDelete).toHaveBeenCalledTimes(453)
    })
  })

  describe('updateMoneyCircle payout sync', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('updates payout transaction when amount or name changes for current/past turn', async () => {
      // 1. circle doc exists with turn in past or current (startDate 2026-01-01, turnMonth 1)
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية قديمة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. payout doc exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          name: 'جمعية جديدة',
          monthlyAmountFils: 150000,
          totalAmountFils: 1500000,
        },
        { monthStartDay: 1 }
      )

      // batch.update called for circle and for payout
      expect(mockBatchUpdate).toHaveBeenCalledTimes(2)
      const payoutUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circle_payout_circle-1')
      )
      expect(payoutUpdateCall).toBeDefined()
      expect(payoutUpdateCall![1].amountFils).toBe(1350000) // (150000 * 10) - 150000
      expect(payoutUpdateCall![1].title).toContain('جمعية جديدة')
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('preserves and updates payout transaction date instead of silently deleting it if user moves turnMonth', async () => {
      // 1. circle doc exists with turn in future (turnMonth 10 while circle started recently)
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 9, 1) }, // Oct 2026
          members: [],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. payout doc exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          myTurnMonth: 10,
        },
        { monthStartDay: 1 }
      )

      expect(mockBatchDelete).not.toHaveBeenCalled()
      const payoutUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circle_payout_circle-1')
      )
      expect(payoutUpdateCall).toBeDefined()
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('updates payout transaction date when startDate or myTurnMonth changes', async () => {
      // 1. circle doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. payout doc exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          myTurnMonth: 2,
        },
        { monthStartDay: 1 }
      )

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2)
      const payoutCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circle_payout_circle-1')
      )
      expect(payoutCall).toBeDefined()
      const payoutUpdatePayload = payoutCall![1]
      expect(payoutUpdatePayload.date).toBeDefined()
      const expectedSeconds = Math.floor(new Date(2026, 1, 1).getTime() / 1000)
      expect(payoutUpdatePayload.date.seconds).toBe(expectedSeconds)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('depositCircleNetPayout sets payout transaction without adding myTurnMonth to member paidMonths', async () => {
      const { depositCircleNetPayout } = await import('./moneyCircles')

      // Payout does not exist yet
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      const testCircle: MoneyCircle = {
        id: 'c-test-1',
        name: 'جمعية العائلة',
        monthlyAmountFils: 100000,
        membersCount: 5,
        totalAmountFils: 500000,
        myTurnMonth: 2,
        startDate: new Date(2026, 8, 1),
        members: [
          { id: 'm1', name: 'أحمد', turnMonth: 1, paidMonths: [1] },
          { id: 'm2', name: 'أنا', turnMonth: 2, paidMonths: [] },
          { id: 'm3', name: 'سعيد', turnMonth: 3, paidMonths: [] },
        ],
        status: 'active',
        createdAt: new Date(),
      }

      await depositCircleNetPayout('uid-1', testCircle, 'cat-income')

      expect(mockBatchSet).toHaveBeenCalledTimes(1)
      expect(mockBatchSet.mock.calls[0][1].amountFils).toBe(400000) // 500,000 - 100,000

      // Does not mutate member paidMonths since turn month is exempt by definition
      expect(mockBatchUpdate).not.toHaveBeenCalled()
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('sets transaction date to expected turn month when depositing for a past turn', async () => {
      const { depositCircleNetPayout } = await import('./moneyCircles')

      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      const pastCircle: MoneyCircle = {
        id: 'c-past-1',
        name: 'جمعية قديمة',
        monthlyAmountFils: 50000,
        membersCount: 4,
        totalAmountFils: 200000,
        myTurnMonth: 1, // Turn 1 was in Jan 2025
        startDate: new Date(2025, 0, 1),
        members: [
          { id: 'm1', name: 'أنت', turnMonth: 1, paidMonths: [] },
        ],
        status: 'active',
        createdAt: new Date(),
      }

      await depositCircleNetPayout('uid-1', pastCircle, 'cat-income')

      expect(mockBatchSet).toHaveBeenCalledTimes(1)
      const txData = mockBatchSet.mock.calls[0][1]
      const expectedSeconds = Math.floor(new Date(2025, 0, 1).getTime() / 1000)
      expect(txData.date.seconds).toBe(expectedSeconds)
    })

    it('deposits second turn payout with ID circle_payout_${id}_t2 when isSecondTurn is true', async () => {
      const { depositCircleNetPayout } = await import('./moneyCircles')

      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      const doubleCircle: MoneyCircle = {
        id: 'c-double-1',
        name: 'جمعية بسهمين',
        monthlyAmountFils: 50000,
        membersCount: 5,
        totalAmountFils: 250000,
        myTurnMonth: 1,
        shareType: 'double',
        secondTurnMonth: 4,
        startDate: new Date(2026, 0, 1),
        members: [
          { id: 'm1', name: 'أنت', turnMonth: 1, paidMonths: [] },
          { id: 'm2', name: 'أنت (سهم 2)', turnMonth: 4, paidMonths: [] },
        ],
        status: 'active',
        createdAt: new Date(),
      }

      const txId = await depositCircleNetPayout('uid-1', doubleCircle, 'cat-income', true)
      expect(txId).toBe('circle_payout_c-double-1_t2')

      expect(mockBatchSet).toHaveBeenCalledTimes(1)
      const call = mockBatchSet.mock.calls[0]
      expect(call[0].path).toBe('users/uid-1/transactions/circle_payout_c-double-1_t2')
      expect(call[1].amountFils).toBe(150000)
    })
  })

  describe('checkCircleHasTransactions', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('returns true if circle payout transaction exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })

      const hasTx = await checkCircleHasTransactions('uid-1', 'circle-1', 'rec-1')
      expect(hasTx).toBe(true)
    })

    it('returns true if recurring installment transactions exist', async () => {
      // Payout 1 does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // Payout 2 does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // Recurring transactions found
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'tx-1' }],
      })

      const hasTx = await checkCircleHasTransactions('uid-1', 'circle-1', 'rec-1')
      expect(hasTx).toBe(true)
    })

    it('returns true if second turn payout transaction exists', async () => {
      // Payout 1 does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // Payout 2 exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })

      const hasTx = await checkCircleHasTransactions('uid-1', 'circle-1', 'rec-1')
      expect(hasTx).toBe(true)
    })

    it('returns false if neither payout nor recurring transactions exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      })

      const hasTx = await checkCircleHasTransactions('uid-1', 'circle-1', 'rec-1')
      expect(hasTx).toBe(false)
    })
  })

  describe('isCircleFullyPaid', () => {
    it('returns false if circle has no members or membersCount is 0', () => {
      expect(isCircleFullyPaid({ ...sampleCircle, members: [] })).toBe(false)
      expect(isCircleFullyPaid({ ...sampleCircle, membersCount: 0 })).toBe(false)
    })

    it('returns false if any non-exempt member has not paid for any month', () => {
      const circle: MoneyCircle = {
        ...sampleCircle,
        membersCount: 2,
        members: [
          { id: 'm-1', name: 'عضو 1', turnMonth: 1, paidMonths: [2] }, // Paid month 2, exempt in 1
          { id: 'm-2', name: 'عضو 2', turnMonth: 2, paidMonths: [] }, // Needs to pay month 1, hasn't paid!
        ],
      }
      expect(isCircleFullyPaid(circle)).toBe(false)
    })

    it('returns true when all non-exempt members have paid across all months', () => {
      const circle: MoneyCircle = {
        ...sampleCircle,
        membersCount: 3,
        members: [
          { id: 'm-1', name: 'عضو 1', turnMonth: 1, paidMonths: [2, 3] }, // Exempt in 1, paid 2 & 3
          { id: 'm-2', name: 'عضو 2', turnMonth: 2, paidMonths: [1, 3] }, // Exempt in 2, paid 1 & 3
          { id: 'm-3', name: 'عضو 3', turnMonth: 3, paidMonths: [1, 2] }, // Exempt in 3, paid 1 & 2
        ],
      }
      expect(isCircleFullyPaid(circle)).toBe(true)
    })

    it('supports paymentsByMonth record as well', () => {
      const circle: MoneyCircle = {
        ...sampleCircle,
        membersCount: 2,
        members: [
          { id: 'm-1', name: 'عضو 1', turnMonth: 1, paidMonths: [], paymentsByMonth: { '2': true } },
          { id: 'm-2', name: 'عضو 2', turnMonth: 2, paidMonths: [1] },
        ],
      }
      expect(isCircleFullyPaid(circle)).toBe(true)
    })
  })

  describe('updateMoneyCircle recurring sync', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('updates recurring rule nextDate, startDate, endDate when circle startDate changes', async () => {
      // 1. circle doc exists with existing recurringId
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring rule doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط جمعية الأسرة',
          amountFils: 100000,
          startDate: { toDate: () => new Date(2026, 0, 1) },
        }),
      })
      // 3. payout doc does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      const newStart = new Date(2026, 5, 1) // June 1, 2026
      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          startDate: newStart,
        },
        { monthStartDay: 1 }
      )

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2) // circle doc and rec doc
      const recCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(recCall).toBeDefined()
      const recPayload = recCall![1]
      expect(recPayload.startDate).toBeDefined()
      expect(recPayload.nextDate).toBeDefined()
      expect(recPayload.endDate).toBeDefined()
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('updates recurring rule nextDate when myTurnMonth changes without changing startDate', async () => {
      // 1. circle doc exists with existing recurringId
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1, // initially turn 1, so nextDate was month 2
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm1', name: 'أنت', turnMonth: 1, paidMonths: [] },
          ],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring rule doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط جمعية الأسرة',
          amountFils: 100000,
          startDate: { toDate: () => new Date(2026, 0, 1) },
        }),
      })
      // 3. payout doc does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      // Change myTurnMonth from 1 to 4 without changing startDate
      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          myTurnMonth: 4,
          members: [
            { id: 'm1', name: 'أنت', turnMonth: 4, paidMonths: [] },
          ],
        },
        { monthStartDay: 1 }
      )

      const recCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(recCall).toBeDefined()
      const recPayload = recCall![1]
      expect(recPayload.nextDate).toBeDefined()
      expect(recPayload.skipMonth).toBe(4)
    })

    it('recreates recurring rule via batch.set when rule document was deleted but createRecurringRule is true', async () => {
      // 1. circle doc exists with recurringId pointing to deleted doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 2,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'deleted-rec-id',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring rule doc does NOT exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // 3. payout doc does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {},
        {
          monthStartDay: 1,
          createRecurringRule: true,
          defaultCategoryId: 'cat-expense-1',
        }
      )

      expect(mockBatchSet).toHaveBeenCalledTimes(1)
      const setPayload = mockBatchSet.mock.calls[0][1]
      expect(setPayload.amountFils).toBe(100000)
      expect(setPayload.categoryId).toBe('cat-expense-1')
      expect(setPayload.active).toBe(true)
      expect(setPayload.circleId).toBe('circle-1')

      // circle doc is updated with new recurringId
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('unlinks recurringId with deleteField when rule does not exist and createRecurringRule is false', async () => {
      // 1. circle doc exists with recurringId pointing to deleted doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 2,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'deleted-rec-id',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring rule doc does NOT exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // 3. payout doc does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {},
        {
          monthStartDay: 1,
          createRecurringRule: false,
        }
      )

      expect(mockBatchSet).not.toHaveBeenCalled()
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      const circleUpdates = mockBatchUpdate.mock.calls[0][1]
      expect(circleUpdates.recurringId).toEqual({ _method: 'deleteField' })
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('updates associated recurring installment transactions when monthlyAmountFils changes', async () => {
      // 1. circle doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring rule doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط جمعية الأسرة',
          amountFils: 100000,
        }),
      })
      // 3. payout doc does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // 4. getDocs for recurring rules linked via circleId
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      })
      // 5. getDocs for transactions linked via recurringId == 'rec-1'
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'tx-inst-1',
            ref: { path: 'users/uid-1/transactions/tx-inst-1' },
          },
        ],
      })
      // 6. getDoc for verifiedTx
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          monthlyAmountFils: 120000,
        },
        { monthStartDay: 1 }
      )

      const txCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('transactions/tx-inst-1')
      )
      expect(txCall).toBeDefined()
      expect(txCall![1].amountFils).toBe(120000)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('updates associated installment transactions to half amount when circle has shareType half and monthlyAmount changes', async () => {
      // 1. circle doc exists with shareType: 'half'
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          shareType: 'half',
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring rule doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط جمعية الأسرة',
          amountFils: 50000,
        }),
      })
      // 3. payout doc does not exist
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // 4. getDocs for recurring rules linked via circleId
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      })
      // 5. getDocs for transactions linked via recurringId == 'rec-1'
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'tx-inst-1',
            ref: { path: 'users/uid-1/transactions/tx-inst-1' },
          },
        ],
      })
      // 6. getDoc for verifiedTx
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          monthlyAmountFils: 120000,
        },
        { monthStartDay: 1 }
      )

      const txCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('transactions/tx-inst-1')
      )
      expect(txCall).toBeDefined()
      // 120,000 / 2 = 60,000
      expect(txCall![1].amountFils).toBe(60000)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('uses deleteField() when expenseCategoryId is passed as empty or whitespace string', async () => {
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          expenseCategoryId: 'old-cat-1',
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        {
          expenseCategoryId: '   ',
        },
        { monthStartDay: 1 }
      )

      const circleCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circles/circle-1')
      )
      expect(circleCall).toBeDefined()
      expect(circleCall![1].expenseCategoryId).toEqual({ _method: 'deleteField' })
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('does NOT overwrite custom recurring title and note when circle name is not changed', async () => {
      // 1. circle doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring doc with custom title and note
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'عنوان مخصص بواسطة المستخدم',
          note: 'ملاحظة خاصة لا تحذف',
          amountFils: 100000,
        }),
      })
      // 3. payout doc
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })

      // Update something other than circle name (e.g. members or status)
      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        { status: 'active' },
        { monthStartDay: 1 }
      )

      const recUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(recUpdateCall).toBeDefined()
      // Title and note should NOT be in recUpdateCall updates!
      expect(recUpdateCall![1].title).toBeUndefined()
      expect(recUpdateCall![1].note).toBeUndefined()
      expect(recUpdateCall![1].amountFils).toBe(100000)
    })

    it('deactivates linked recurring rule and other rules with circleId == id when circle status is updated to completed', async () => {
      // 1. circle doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 5,
          totalAmountFils: 500000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط جمعية الأسرة',
          active: true,
        }),
      })
      // 3. query for recurring rules with circleId == id
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'rec-2',
            ref: { id: 'rec-2', path: 'users/uid-1/recurring/rec-2' },
          },
        ],
      })
      // 4. payout doc does not exist
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        { status: 'completed' }
      )

      // rec-1 deactivated
      const rec1Update = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(rec1Update).toBeDefined()
      expect(rec1Update![1].active).toBe(false)

      // rec-2 deactivated via circleId query
      const rec2Update = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-2')
      )
      expect(rec2Update).toBeDefined()
      expect(rec2Update![1].active).toBe(false)
    })

    it('unlinks recurring rule and deletes any rules matching circleId == id when recurringId is set to empty string', async () => {
      // 1. circle doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأسرة',
          monthlyAmountFils: 100000,
          membersCount: 5,
          totalAmountFils: 500000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. old recurring doc exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({}),
      })
      // 3. query for recurring rules with circleId == id finds rec-2
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'rec-2',
            ref: { id: 'rec-2', path: 'users/uid-1/recurring/rec-2' },
          },
        ],
      })
      // 4. payout doc
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        { recurringId: '' }
      )

      // Both rec-1 and rec-2 deleted
      const deletedPaths = mockBatchDelete.mock.calls.map((c) => c[0].path)
      expect(deletedPaths).toContain('users/uid-1/recurring/rec-1')
      expect(deletedPaths).toContain('users/uid-1/recurring/rec-2')
    })

    it('updates title on linked installment transactions when circle name is updated', async () => {
      // 1. circle doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية قديمة',
          monthlyAmountFils: 100000,
          membersCount: 5,
          totalAmountFils: 500000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recurring doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط جمعية قديمة',
        }),
      })
      // 3. payout doc
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })
      // 4. query recurring for circleId == id
      mockGetDocs.mockResolvedValueOnce({ docs: [] })
      // 5. query transactions for recurringId == rec-1
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            ref: { id: 'tx-1', path: 'users/uid-1/transactions/tx-1' },
          },
        ],
      })
      // 6. verifiedTx getDoc
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ title: 'قسط جمعية قديمة' }),
      })

      await updateMoneyCircle(
        'uid-1',
        'circle-1',
        { name: 'جمعية الأصدقاء الجديدة' }
      )

      const txUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('transactions/tx-1')
      )
      expect(txUpdateCall).toBeDefined()
      expect(txUpdateCall![1].title).toBe('قسط جمعية الأصدقاء الجديدة')
    })
  })

  describe('toggleCircleMemberPayment', () => {
    beforeEach(() => {
      mockBatchSet.mockClear()
      mockBatchUpdate.mockClear()
      mockBatchDelete.mockClear()
      mockBatchCommit.mockClear()
      mockGetDoc.mockReset()
    })

    it('creates deterministic transaction and advances recurring rule when user member is toggled to paid', async () => {
      // 1. circle doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأصدقاء',
          monthlyAmountFils: 50000,
          membersCount: 5,
          totalAmountFils: 250000,
          myTurnMonth: 3,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-user', name: 'أنت', turnMonth: 3, paidMonths: [] },
            { id: 'm-1', name: 'عضو 1', turnMonth: 1, paidMonths: [] },
          ],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. txRef check for deterministic ID circle_circle-1_m1 -> does not exist
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })
      // 2b. recurring tx check -> does not exist
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })
      // 3. recRef check -> exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط جمعية الأصدقاء',
          nextDate: { toDate: () => new Date(2026, 0, 1) },
        }),
      })

      const res = await toggleCircleMemberPayment('uid-1', 'circle-1', 'm-user', 1)
      expect(res.isUser).toBe(true)
      expect(res.paid).toBe(true)

      // Tx created without invalid fields like circleId
      expect(mockBatchSet).toHaveBeenCalledTimes(1)
      const txCall = mockBatchSet.mock.calls[0]
      expect(txCall[0].id).toBe('circle_circle-1_m1')
      expect(txCall[1].amountFils).toBe(50000)
      expect(txCall[1].circleId).toBeUndefined()

      // Recurring nextDate updated to month 2 (Feb 2026) since month 1 is now paid and month 3 is exempt turn
      const recUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(recUpdateCall).toBeDefined()
      expect(recUpdateCall![1].nextDate).toBeDefined()

      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('deletes deterministic transaction and rewinds recurring rule when user member is toggled to unpaid', async () => {
      // 1. circle doc: user has paid month 1
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الأصدقاء',
          monthlyAmountFils: 50000,
          membersCount: 5,
          totalAmountFils: 250000,
          myTurnMonth: 3,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-user', name: 'أنت', turnMonth: 3, paidMonths: [1] },
          ],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. txRef check -> exists
      mockGetDoc.mockResolvedValueOnce({ exists: () => true })
      // 3. recTxRef check -> exists
      mockGetDoc.mockResolvedValueOnce({ exists: () => true })
      // 4. recRef check -> exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({ title: 'قسط' }),
      })

      const res = await toggleCircleMemberPayment('uid-1', 'circle-1', 'm-user', 1)
      expect(res.isUser).toBe(true)
      expect(res.paid).toBe(false)

      // Deletes transaction
      expect(mockBatchDelete).toHaveBeenCalled()
      // Circle update call records paymentsByMonth with '1': false
      const circleUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circles/circle-1')
      )
      expect(circleUpdateCall).toBeDefined()
      expect(circleUpdateCall![1].members[0].paymentsByMonth).toEqual({ '1': false })

      // Rewinds nextDate to month 1 (Jan 2026)
      const recUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(recUpdateCall).toBeDefined()
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeCircleInstallmentPayment', () => {
    beforeEach(() => {
      mockBatchSet.mockClear()
      mockBatchUpdate.mockClear()
      mockBatchDelete.mockClear()
      mockBatchCommit.mockClear()
      mockGetDoc.mockReset()
    })

    it('removes month payment from circle member and deletes deterministic and recurring tx', async () => {
      // 1. circle doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية تجريبية',
          monthlyAmountFils: 50000,
          membersCount: 4,
          totalAmountFils: 200000,
          myTurnMonth: 2,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-1', name: 'أنت', turnMonth: 2, paidMonths: [1, 3], paymentsByMonth: { '1': true, '3': true } },
          ],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recRef check -> exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({ title: 'قسط' }),
      })

      await removeCircleInstallmentPayment('uid-1', 'circle-1', 1)

      expect(mockBatchUpdate).toHaveBeenCalled()
      const circleUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circles/circle-1')
      )
      expect(circleUpdateCall).toBeDefined()
      expect(circleUpdateCall![1].members[0].paidMonths).toEqual([3])
      expect(circleUpdateCall![1].members[0].paymentsByMonth).toEqual({ '1': false, '3': true })

      // Batch delete called for manual and recurring tx
      const deletedPaths = mockBatchDelete.mock.calls.map((c) => c[0].path)
      expect(deletedPaths).toContain('users/uid-1/transactions/circle_circle-1_m1')
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })
  })

  describe('shareType and secondTurnMonth handling', () => {
    it('updates recurring rule installment to 50% for half share', async () => {
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية تجريبية',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 3,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [{ id: 'm-1', name: 'أنت', turnMonth: 3, paidMonths: [] }],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط',
          amountFils: 100000,
          skipMonth: 3,
        }),
      })

      await updateMoneyCircle('uid-1', 'circle-1', {
        shareType: 'half',
      })

      expect(mockBatchUpdate).toHaveBeenCalled()
      const recUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(recUpdateCall).toBeDefined()
      expect(recUpdateCall![1].amountFils).toBe(50000)
    })

    it('updates recurring rule installment to 2x and sets skipMonths for double share', async () => {
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية تجريبية',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 2,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [{ id: 'm-1', name: 'أنت', turnMonth: 2, paidMonths: [] }],
          status: 'active',
          recurringId: 'rec-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-1',
        exists: () => true,
        data: () => ({
          title: 'قسط',
          amountFils: 100000,
          skipMonth: 2,
        }),
      })

      await updateMoneyCircle('uid-1', 'circle-1', {
        shareType: 'double',
        secondTurnMonth: 7,
      })

      expect(mockBatchUpdate).toHaveBeenCalled()
      const recUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-1')
      )
      expect(recUpdateCall).toBeDefined()
      expect(recUpdateCall![1].amountFils).toBe(200000)
      expect(recUpdateCall![1].skipMonths).toEqual([2, 7])
    })
  })

  describe('swapMemberTurns', () => {
    it('swaps turnMonth between two members and updates circle.myTurnMonth when user is involved', async () => {
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الرواد',
          monthlyAmountFils: 100000,
          membersCount: 4,
          totalAmountFils: 400000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-1', name: 'أنت', turnMonth: 1, paidMonths: [] },
            { id: 'm-2', name: 'خالد', turnMonth: 3, paidMonths: [] },
          ],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // updateMoneyCircle gets circle document again
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الرواد',
          monthlyAmountFils: 100000,
          membersCount: 4,
          totalAmountFils: 400000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-1', name: 'أنت', turnMonth: 1, paidMonths: [] },
            { id: 'm-2', name: 'خالد', turnMonth: 3, paidMonths: [] },
          ],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })

      await swapMemberTurns('uid-1', 'circle-1', 'm-1', 'm-2')

      expect(mockBatchUpdate).toHaveBeenCalled()
      const circleUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circles/circle-1')
      )
      expect(circleUpdateCall).toBeDefined()
      expect(circleUpdateCall![1].myTurnMonth).toBe(3)
      expect(circleUpdateCall![1].members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'm-1', turnMonth: 3 }),
          expect.objectContaining({ id: 'm-2', turnMonth: 1 }),
        ])
      )
    })

    it('cleans paidMonths and paymentsByMonth for swapped members to remove newly assigned turn', async () => {
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الرواد',
          monthlyAmountFils: 100000,
          membersCount: 4,
          totalAmountFils: 400000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-1', name: 'أنت', turnMonth: 1, paidMonths: [2, 3], paymentsByMonth: { '2': true, '3': true } },
            { id: 'm-2', name: 'خالد', turnMonth: 3, paidMonths: [1, 2], paymentsByMonth: { '1': true, '2': true } },
          ],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })
      mockGetDoc.mockResolvedValueOnce({
        id: 'circle-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الرواد',
          monthlyAmountFils: 100000,
          membersCount: 4,
          totalAmountFils: 400000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-1', name: 'أنت', turnMonth: 1, paidMonths: [2, 3], paymentsByMonth: { '2': true, '3': true } },
            { id: 'm-2', name: 'خالد', turnMonth: 3, paidMonths: [1, 2], paymentsByMonth: { '1': true, '2': true } },
          ],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })

      await swapMemberTurns('uid-1', 'circle-1', 'm-1', 'm-2')

      const circleUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('circles/circle-1')
      )
      expect(circleUpdateCall).toBeDefined()
      const members = circleUpdateCall![1].members
      const updatedM1 = members.find((m: { id: string }) => m.id === 'm-1')
      const updatedM2 = members.find((m: { id: string }) => m.id === 'm-2')

      // m-1 moved to turn 3: its paidMonths must NOT contain 3
      expect(updatedM1.turnMonth).toBe(3)
      expect(updatedM1.paidMonths).not.toContain(3)
      expect(updatedM1.paidMonths).toEqual([2])
      expect(updatedM1.paymentsByMonth?.['3']).toBeUndefined()

      // m-2 moved to turn 1: its paidMonths must NOT contain 1
      expect(updatedM2.turnMonth).toBe(1)
      expect(updatedM2.paidMonths).not.toContain(1)
      expect(updatedM2.paidMonths).toEqual([2])
      expect(updatedM2.paymentsByMonth?.['1']).toBeUndefined()
    })
  })

  describe('toggleCircleMemberPayment & removeCircleInstallmentPayment double-share & duplicate prevention', () => {
    it('does not create duplicate manual installment transaction if recurring transaction already exists', async () => {
      const { toggleCircleMemberPayment } = await import('./moneyCircles')

      // 1. circle doc
      mockGetDoc.mockResolvedValueOnce({
        id: 'c-dup-1',
        exists: () => true,
        data: () => ({
          name: 'جمعية الدوبلكس',
          monthlyAmountFils: 50000,
          membersCount: 5,
          totalAmountFils: 250000,
          myTurnMonth: 3,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-user', name: 'أنت', turnMonth: 3, paidMonths: [] },
            { id: 'm-other', name: 'عضو', turnMonth: 1, paidMonths: [] },
          ],
          status: 'active',
          recurringId: 'rec-dup-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. manual txRef check: circle_c-dup-1_m1 -> does not exist
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })
      // 3. recurring tx check: rec-dup-1_2026-01-01 -> EXISTS!
      mockGetDoc.mockResolvedValueOnce({ exists: () => true })
      // 4. recRef check -> exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-dup-1',
        exists: () => true,
        data: () => ({ title: 'قسط' }),
      })

      const res = await toggleCircleMemberPayment('uid-1', 'c-dup-1', 'm-user', 1)
      expect(res.isUser).toBe(true)
      expect(res.paid).toBe(true)

      // Must NOT set manual transaction because recurring transaction already exists
      expect(mockBatchSet).not.toHaveBeenCalled()
      expect(mockBatchUpdate).toHaveBeenCalled()
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('correctly matches user member and combines paid months for double-share circle in toggleCircleMemberPayment and removeCircleInstallmentPayment', async () => {
      const { toggleCircleMemberPayment, removeCircleInstallmentPayment } = await import('./moneyCircles')

      // 1. circle doc for toggle
      mockGetDoc.mockResolvedValueOnce({
        id: 'c-double-user',
        exists: () => true,
        data: () => ({
          name: 'جمعية سهمين',
          monthlyAmountFils: 50000,
          membersCount: 6,
          totalAmountFils: 300000,
          myTurnMonth: 2,
          shareType: 'double',
          secondTurnMonth: 5,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-user-1', name: 'أنت (سهم 1)', turnMonth: 2, paidMonths: [1] },
            { id: 'm-user-2', name: 'أنت (سهم 2)', turnMonth: 5, paidMonths: [] },
            { id: 'm-other', name: 'عضو', turnMonth: 1, paidMonths: [] },
          ],
          status: 'active',
          recurringId: 'rec-double-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. manual txRef check -> does not exist
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })
      // 3. recurring tx check -> does not exist
      mockGetDoc.mockResolvedValueOnce({ exists: () => false })
      // 4. recRef check -> exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-double-1',
        exists: () => true,
        data: () => ({ title: 'قسط سهمين' }),
      })

      // Toggle user-2 (second turn member) for month 3
      const res = await toggleCircleMemberPayment('uid-1', 'c-double-user', 'm-user-2', 3)
      expect(res.isUser).toBe(true)
      expect(res.paid).toBe(true)

      // Check recurring rule update used combined paid months [1, 3]
      const recUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
        call[0].path?.includes('recurring/rec-double-1')
      )
      expect(recUpdateCall).toBeDefined()
      expect(recUpdateCall![1].nextDate).toBeDefined()

      // Reset mocks for removeCircleInstallmentPayment
      mockBatchUpdate.mockClear()
      mockBatchDelete.mockClear()
      mockBatchCommit.mockClear()

      // 1. circle doc for remove
      mockGetDoc.mockResolvedValueOnce({
        id: 'c-double-user',
        exists: () => true,
        data: () => ({
          name: 'جمعية سهمين',
          monthlyAmountFils: 50000,
          membersCount: 6,
          totalAmountFils: 300000,
          myTurnMonth: 2,
          shareType: 'double',
          secondTurnMonth: 5,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [
            { id: 'm-user-1', name: 'أنت (سهم 1)', turnMonth: 2, paidMonths: [1, 3] },
            { id: 'm-user-2', name: 'أنت (سهم 2)', turnMonth: 5, paidMonths: [3] },
          ],
          status: 'active',
          recurringId: 'rec-double-1',
          createdAt: { toDate: () => new Date() },
        }),
      })
      // 2. recRef check -> exists
      mockGetDoc.mockResolvedValueOnce({
        id: 'rec-double-1',
        exists: () => true,
        data: () => ({ title: 'قسط سهمين' }),
      })

      await removeCircleInstallmentPayment('uid-1', 'c-double-user', 3)

      expect(mockBatchDelete).toHaveBeenCalled()
      expect(mockBatchUpdate).toHaveBeenCalled()
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })
  })
})
