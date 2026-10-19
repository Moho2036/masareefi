import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateRecurring } from './recurring'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockUpdateDoc = vi.fn().mockResolvedValue(undefined)
const mockDeleteFieldSentinel = { _method: 'deleteField' }

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  writeBatch: vi.fn(),
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
