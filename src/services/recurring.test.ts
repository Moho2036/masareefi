import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateRecurring, deleteRecurring, processDueRecurring } from './recurring'

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
const mockDeleteFieldSentinel = { _method: 'deleteField' }

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  doc: vi.fn((_db, ...parts) => ({
    id: parts[parts.length - 1] || 'mock-id',
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  query: vi.fn((c) => c),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  writeBatch: () => mockBatch,
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: vi.fn(),
  deleteField: () => mockDeleteFieldSentinel,
  Timestamp: {
    fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
  serverTimestamp: () => ({ _method: 'serverTimestamp' }),
}))

describe('recurring service - updateRecurring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes deleteField when optional fields are undefined or null', async () => {
    await updateRecurring('uid-1', 'rec-1', {
      amountFils: 25000,
      endDate: undefined,
      circleId: undefined,
      skipMonth: undefined,
      title: '',
    })

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0][1]

    expect(payload.amountFils).toBe(25000)
    expect(payload.endDate).toBe(mockDeleteFieldSentinel)
    expect(payload.circleId).toBe(mockDeleteFieldSentinel)
    expect(payload.skipMonth).toBe(mockDeleteFieldSentinel)
    expect(payload.title).toBe(mockDeleteFieldSentinel)
  })

  it('preserves fields when values are provided', async () => {
    const end = new Date('2026-12-31')
    await updateRecurring('uid-1', 'rec-1', {
      endDate: end,
      circleId: 'circle-10',
      skipMonth: 3,
      title: 'اشتراك شهري',
    })

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0][1]

    expect(payload.title).toBe('اشتراك شهري')
    expect(payload.circleId).toBe('circle-10')
    expect(payload.skipMonth).toBe(3)
    expect(payload.endDate).toBeDefined()
    expect(payload.endDate).not.toBe(mockDeleteFieldSentinel)
  })

  it('does not include optional keys in update payload when not present in updates object', async () => {
    await updateRecurring('uid-1', 'rec-1', {
      amountFils: 15000,
    })

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
    const payload = mockUpdateDoc.mock.calls[0][1]

    expect(payload.amountFils).toBe(15000)
    expect('endDate' in payload).toBe(false)
    expect('circleId' in payload).toBe(false)
    expect('skipMonth' in payload).toBe(false)
    expect('title' in payload).toBe(false)
  })
})

describe('recurring service - deleteRecurring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes recurring doc and unlinks associated circle with deleteField', async () => {
    // 1. recurring doc exists and has circleId
    mockGetDoc.mockResolvedValueOnce({
      id: 'rec-1',
      exists: () => true,
      data: () => ({
        circleId: 'circle-10',
      }),
    })
    // 2. circles collection query
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'circle-10',
          ref: { path: 'users/uid-1/circles/circle-10' },
        },
      ],
    })

    await deleteRecurring('uid-1', 'rec-1')

    expect(mockBatchDelete).toHaveBeenCalledTimes(1)
    expect(mockBatchDelete.mock.calls[0][0].path).toBe('users/uid-1/recurring/rec-1')

    expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
    const updateCall = mockBatchUpdate.mock.calls[0]
    expect(updateCall[0].path).toBe('users/uid-1/circles/circle-10')
    expect(updateCall[1].recurringId).toBe(mockDeleteFieldSentinel)

    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  it('unlinks circle discovered via recurringId query when recurring doc had no circleId field', async () => {
    // 1. recurring doc has no circleId
    mockGetDoc.mockResolvedValueOnce({
      id: 'rec-1',
      exists: () => true,
      data: () => ({}),
    })
    // 2. circles collection query finds a circle
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'circle-20',
          ref: { path: 'users/uid-1/circles/circle-20' },
        },
      ],
    })

    await deleteRecurring('uid-1', 'rec-1')

    expect(mockBatchDelete).toHaveBeenCalledTimes(1)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1)
    expect(mockBatchUpdate.mock.calls[0][0].path).toBe('users/uid-1/circles/circle-20')
    expect(mockBatchUpdate.mock.calls[0][1].recurringId).toBe(mockDeleteFieldSentinel)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })
})

describe('recurring service - processDueRecurring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes due recurring and automatically marks circle user member as paid for the cycle', async () => {
    const today = new Date(2026, 1, 15) // Feb 15, 2026

    // 1. Query for active due recurring
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          data: () => ({
            id: 'rec-c1',
            type: 'expense',
            amountFils: 100000,
            categoryId: 'cat-1',
            title: 'قسط الجمعية',
            frequency: 'monthly',
            startDate: new Date(2026, 0, 1), // Jan 1, 2026
            nextDate: new Date(2026, 1, 1), // Feb 1, 2026 (due!)
            active: true,
            circleId: 'circle-1',
            skipMonth: 4, // user receives in month 4, so month 2 is not skipped!
          }),
        },
      ],
    })

    // 2. Fetch linked circle doc
    mockGetDoc.mockResolvedValueOnce({
      id: 'circle-1',
      exists: () => true,
      data: () => ({
        id: 'circle-1',
        name: 'جمعية الأسرة',
        monthlyAmountFils: 100000,
        membersCount: 10,
        totalAmountFils: 1000000,
        myTurnMonth: 4,
        startDate: new Date(2026, 0, 1),
        members: [
          { id: 'm1', name: 'عضو 1', turnMonth: 1, paidMonths: [] },
          { id: 'm4', name: 'أنت', turnMonth: 4, paidMonths: [1] }, // User already paid month 1
        ],
      }),
    })

    // 3. Verification doc for transaction idempotency check (txSnap.exists() === false)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    })

    const count = await processDueRecurring('uid-1', today)

    expect(count).toBe(1)
    // 1 tx set in batch
    expect(mockBatchSet).toHaveBeenCalledTimes(1)
    expect(mockBatchSet.mock.calls[0][1].amountFils).toBe(100000)

    // Recurring rule nextDate updated AND Circle updated with user member paid for month 2!
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2)

    const circleUpdateCall = mockBatchUpdate.mock.calls.find((call) =>
      call[0].path?.includes('circles/circle-1')
    )
    expect(circleUpdateCall).toBeDefined()
    const updatedMembers = circleUpdateCall![1].members
    const userMember = updatedMembers.find((m: { turnMonth: number }) => m.turnMonth === 4)
    expect(userMember.paidMonths).toContain(2) // Month 2 was automatically added!

    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })
})
