import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from 'firebase/auth'
import {
  updateUserSettings,
  ensureUserProfile,
  hasExistingUserData,
  resetUserData,
  deleteUserFirestoreData,
  DEFAULT_SETTINGS,
} from './userProfile'

vi.mock('../lib/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}))

const mockGetDoc = vi.fn()
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined)
const mockSetDoc = vi.fn().mockResolvedValue(undefined)
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined)
const mockBatchSet = vi.fn()
const mockBatchDelete = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)

const mockGetDocs = vi.fn().mockResolvedValue({ empty: true, docs: [] })

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  collection: vi.fn((_db, ...parts) => ({ path: parts.join('/') })),
  query: vi.fn((...args: unknown[]) => args),
  limit: vi.fn((n: number) => ({ limit: n })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: () => ({
    set: mockBatchSet,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  }),
  onSnapshot: vi.fn(),
  deleteField: () => ({ _method: 'deleteField' }),
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

    it('updates onboardingCompleted and openingBalanceFils correctly', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ displayName: 'سعيد' }),
      })

      await updateUserSettings('uid-onboard', {
        onboardingCompleted: true,
        openingBalanceFils: 250000,
      })

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          onboardingCompleted: true,
          openingBalanceFils: 250000,
        })
      )
    })

    it('calls updateDoc with deleteField() when rolloverStartDate is null and customCurrencyDecimals is undefined', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ displayName: 'سعيد' }),
      })

      await updateUserSettings('uid-del', {
        rolloverStartDate: null,
        customCurrencyDecimals: undefined,
      })

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          rolloverStartDate: { _method: 'deleteField' },
          customCurrencyDecimals: { _method: 'deleteField' },
        })
      )
    })

    it('omits deleted fields when user document does not exist and setDoc is called', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })

      await updateUserSettings('uid-new-del', {
        rolloverStartDate: null,
        customCurrencyDecimals: undefined,
      })

      expect(mockSetDoc).toHaveBeenCalledTimes(1)
      const fullPayload = mockSetDoc.mock.calls[0][1]
      expect(fullPayload.rolloverStartDate).toBeUndefined()
      expect(fullPayload.customCurrencyDecimals).toBeUndefined()
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

    it('handles race condition when doc was created concurrently before batch commit', async () => {
      // First getDoc returns false (doc does not exist initially)
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      })
      // Second getDoc (reCheckSnap before batch commit) finds document was created concurrently
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'u-race',
          displayName: 'سارة',
          currency: 'JOD',
          monthStartDay: 1,
          theme: 'system',
          rolloverBalance: true,
        }),
      })

      const mockUser = {
        uid: 'u-race',
        displayName: 'سارة',
      } as User

      const result = await ensureUserProfile(mockUser)

      expect(mockBatchCommit).not.toHaveBeenCalled()
      expect(result.displayName).toBe('سارة')
    })
  })

  describe('hasExistingUserData', () => {
    it('returns false when all collections are empty', async () => {
      mockGetDocs.mockResolvedValue({ empty: true })
      const hasData = await hasExistingUserData('u-new')
      expect(hasData).toBe(false)
    })

    it('returns true when at least one collection has documents', async () => {
      mockGetDocs
        .mockResolvedValueOnce({ empty: false }) // transactions has doc
        .mockResolvedValue({ empty: true })

      const hasData = await hasExistingUserData('u-existing')
      expect(hasData).toBe(true)
    })
  })

  describe('resetUserData and deleteUserFirestoreData', () => {
    it('resetUserData deletes docs from 4 subcollections and sets openingBalanceFils to 0', async () => {
      const mockDocRef = { id: 'd1', ref: { path: 'doc/1' } }
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [mockDocRef],
      })
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'سارة' }),
      })

      await resetUserData('u-reset')

      expect(mockBatchDelete).toHaveBeenCalled()
      expect(mockBatchCommit).toHaveBeenCalled()
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ openingBalanceFils: 0 })
      )
    })

    it('deleteUserFirestoreData deletes docs from 5 subcollections and user document', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      })

      await deleteUserFirestoreData('u-delete')

      expect(mockDeleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/u-delete' })
      )
    })
  })
})
