import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'
import { updateUserSettings, ensureUserProfile, DEFAULT_SETTINGS } from './userProfile'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockGetDoc = vi.fn()
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined)
const mockSetDoc = vi.fn().mockResolvedValue(undefined)
const mockBatchSet = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  writeBatch: () => ({
    set: mockBatchSet,
    commit: mockBatchCommit,
  }),
  onSnapshot: vi.fn(),
  serverTimestamp: () => ({ _method: 'serverTimestamp' }),
}))

describe('userProfile service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateUserSettings', () => {
    it('uses updateDoc without createdAt when user document exists', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ displayName: 'قديم', currency: 'JOD' }),
      })

      await updateUserSettings('uid-123', {
        displayName: 'جديد',
        currency: 'USD',
        theme: 'dark',
      })

      expect(mockGetDoc).toHaveBeenCalledTimes(1)
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
      expect(mockSetDoc).not.toHaveBeenCalled()

      const updatePayload = mockUpdateDoc.mock.calls[0][1]
      expect(updatePayload).toEqual({
        displayName: 'جديد',
        currency: 'USD',
        theme: 'dark',
      })
      expect(updatePayload.createdAt).toBeUndefined()
    })

    it('merges DEFAULT_SETTINGS, cleanUpdates, and adds serverTimestamp when user doc does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      await updateUserSettings('uid-new', {
        currency: 'EUR',
        monthStartDay: 5,
      })

      expect(mockGetDoc).toHaveBeenCalledTimes(1)
      expect(mockUpdateDoc).not.toHaveBeenCalled()
      expect(mockSetDoc).toHaveBeenCalledTimes(1)

      const fullPayload = mockSetDoc.mock.calls[0][1]
      expect(fullPayload).toMatchObject({
        ...DEFAULT_SETTINGS,
        currency: 'EUR',
        monthStartDay: 5,
        createdAt: { _method: 'serverTimestamp' },
      })
      expect(fullPayload.displayName).toBe(DEFAULT_SETTINGS.displayName)
      expect(fullPayload.theme).toBe(DEFAULT_SETTINGS.theme)
    })
  })

  describe('ensureUserProfile', () => {
    it('self-heals and updates Firestore displayName when existing doc has placeholder "مستخدم" and auth user has real name', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'u-123',
          displayName: 'مستخدم',
          currency: 'JOD',
          monthStartDay: 1,
          theme: 'system',
          rolloverBalance: true,
        }),
      })

      const mockUser = {
        uid: 'u-123',
        displayName: 'مهند حداد',
      } as User

      const result = await ensureUserProfile(mockUser)

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u-123' }),
        { displayName: 'مهند حداد' }
      )
      expect(result.displayName).toBe('مهند حداد')
    })

    it('does not overwrite custom displayName when existing doc already has a personalized name', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'u-123',
          displayName: 'أحمد',
          currency: 'JOD',
          monthStartDay: 1,
          theme: 'system',
          rolloverBalance: true,
        }),
      })

      const mockUser = {
        uid: 'u-123',
        displayName: 'مهند',
      } as User

      const result = await ensureUserProfile(mockUser)

      expect(mockUpdateDoc).not.toHaveBeenCalled()
      expect(result.displayName).toBe('أحمد')
    })
  })
})
