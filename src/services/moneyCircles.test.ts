import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCurrentCircleMonth,
  isUserTurnMonth,
  circleConverter,
  deleteMoneyCircle,
  deleteCircle,
  updateMoneyCircle,
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

    it('calculates correctly when circle starts on any day other than the 1st (e.g. 15th)', () => {
      const midMonthCircle: MoneyCircle = {
        ...sampleCircle,
        startDate: new Date(2026, 0, 15), // Jan 15, 2026
      }
      // Month 1: Jan 2026
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 0, 20))).toBe(1)
      // Month 2: Feb 2026 (even early Feb like Feb 1 or Feb 5)
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 1, 5))).toBe(2)
      // Month 3: March 2026
      expect(getCurrentCircleMonth(midMonthCircle, new Date(2026, 2, 1))).toBe(3)
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

  describe('deleteMoneyCircle & deleteCircle', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('deletes circle doc, linked recurringId, circleId query results, and payout doc in a single batch', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ recurringId: 'rec-assoc-1' }),
      })

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { ref: { path: 'users/uid-1/recurring/rec-query-1' } },
        ],
      })

      await deleteMoneyCircle('uid-1', 'circle-1')

      expect(mockBatchDelete).toHaveBeenCalledTimes(4)
      const deletedPaths = mockBatchDelete.mock.calls.map((c) => c[0].path)
      expect(deletedPaths).toContain('users/uid-1/circles/circle-1')
      expect(deletedPaths).toContain('users/uid-1/recurring/rec-assoc-1')
      expect(deletedPaths).toContain('users/uid-1/recurring/rec-query-1')
      expect(deletedPaths).toContain('users/uid-1/transactions/circle_payout_circle-1')

      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('works correctly when no recurringId or query docs exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({}),
      })

      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      })

      await deleteCircle('uid-1', 'circle-2')

      expect(mockBatchDelete).toHaveBeenCalledTimes(2)
      const deletedPaths = mockBatchDelete.mock.calls.map((c) => c[0].path)
      expect(deletedPaths).toContain('users/uid-1/circles/circle-2')
      expect(deletedPaths).toContain('users/uid-1/transactions/circle_payout_circle-2')
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateMoneyCircle payout sync', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('updates payout transaction when amount or name changes for current/past turn', async () => {
      // 1. payout doc exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })
      // 2. circle doc exists with turn in past or current (startDate 2026-01-01, turnMonth 1)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'جمعية جديدة',
          monthlyAmountFils: 150000,
          membersCount: 10,
          totalAmountFils: 1500000,
          myTurnMonth: 1,
          startDate: { toDate: () => new Date(2026, 0, 1) },
          members: [],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })

      await updateMoneyCircle('uid-1', 'circle-1', {
        name: 'جمعية جديدة',
        monthlyAmountFils: 150000,
        totalAmountFils: 1500000,
      })

      // First call to updateDoc is for circle, second call is for payout
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2)
      const payoutUpdatePayload = mockUpdateDoc.mock.calls[1][1]
      expect(payoutUpdatePayload.amountFils).toBe(1350000) // 1500000 - 150000
      expect(payoutUpdatePayload.title).toContain('جمعية جديدة')
    })

    it('deletes payout transaction if user moves turnMonth to future', async () => {
      // 1. payout doc exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      })
      // 2. circle doc exists with turn in future (turnMonth 10 while circle started recently)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'جمعية',
          monthlyAmountFils: 100000,
          membersCount: 10,
          totalAmountFils: 1000000,
          myTurnMonth: 10,
          startDate: { toDate: () => new Date(2026, 9, 1) }, // Oct 2026
          members: [],
          status: 'active',
          createdAt: { toDate: () => new Date() },
        }),
      })

      await updateMoneyCircle('uid-1', 'circle-1', {
        myTurnMonth: 10,
      })

      expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
      expect(mockDeleteDoc.mock.calls[0][0].path).toBe('users/uid-1/transactions/circle_payout_circle-1')
    })

    it('depositCircleNetPayout sets payout transaction and adds myTurnMonth to member paidMonths', async () => {
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

      expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
      const updatedMembers = mockBatchUpdate.mock.calls[0][1].members
      expect(updatedMembers[1].paidMonths).toEqual([2])
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })
  })
})
