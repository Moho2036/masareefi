import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  commitFirestoreWrite,
  safeGetDoc,
  safeGetDocs,
} from './firestoreOffline'
import type { DocumentReference, Query } from 'firebase/firestore'

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}))

describe('firestoreOffline library', () => {
  const originalOnLine = navigator.onLine

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    })
  })

  describe('commitFirestoreWrite', () => {
    it('returns the result of writePromise immediately when navigator.onLine === true', async () => {
      const resolvedPromise = Promise.resolve('ok_result')
      const result = await commitFirestoreWrite(resolvedPromise, 'fallback')
      expect(result).toBe('ok_result')
    })

    it('propagates the error immediately when navigator.onLine === true and writePromise rejects', async () => {
      const expectedError = new Error('Firestore write failed')
      const rejectedPromise = Promise.reject(expectedError)

      await expect(
        commitFirestoreWrite(rejectedPromise, 'fallback')
      ).rejects.toThrow('Firestore write failed')
    })

    it('resolves with fallbackValue if offline event is fired while waiting when online', async () => {
      const hangingPromise = new Promise<string>(() => {})

      const writePromise = commitFirestoreWrite(hangingPromise, 'offline_fallback')

      // Trigger offline event on window
      window.dispatchEvent(new Event('offline'))

      const result = await writePromise
      expect(result).toBe('offline_fallback')
    })

    it('resolves within ~50ms when navigator.onLine === false even if original promise is hanging', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      })

      const hangingPromise = new Promise<string>(() => {})
      const start = Date.now()

      const result = await commitFirestoreWrite(hangingPromise, 'cached_offline_id')
      const elapsed = Date.now() - start

      expect(result).toBe('cached_offline_id')
      expect(elapsed).toBeGreaterThanOrEqual(40)
      expect(elapsed).toBeLessThan(500)
    })

    it('resolves with original value if writePromise finishes faster than the timeout while offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      })

      const fastPromise = Promise.resolve('fast_result')
      const result = await commitFirestoreWrite(fastPromise, 'fallback')
      expect(result).toBe('fast_result')
    })
  })

  describe('safeGetDoc', () => {
    it('returns real DocumentSnapshot when getDoc succeeds', async () => {
      const mockDocRef = {
        id: 'doc-123',
      } as unknown as DocumentReference<{ title: string }>

      const fakeSnapshot = {
        id: 'doc-123',
        exists: () => true,
        data: () => ({ title: 'Test Title' }),
      }
      mockGetDoc.mockResolvedValueOnce(fakeSnapshot)

      const snapshot = await safeGetDoc(mockDocRef)
      expect(snapshot).toBeDefined()
      expect(snapshot.id).toBe('doc-123')
      expect(snapshot.exists()).toBe(true)
      expect(snapshot.data()).toEqual({ title: 'Test Title' })
    })

    it('returns a safe non-existing DocumentSnapshot when getDoc throws offline error with message', async () => {
      const mockDocRef = {
        id: 'offline-doc',
      } as unknown as DocumentReference

      mockGetDoc.mockRejectedValueOnce(
        new Error('Failed to get document because the client is offline.')
      )

      const result = await safeGetDoc(mockDocRef)
      expect(result.exists()).toBe(false)
      expect(result.data()).toBeUndefined()
      expect(result.id).toBe('offline-doc')
    })

    it('returns safe non-existing DocumentSnapshot when error code is unavailable', async () => {
      const mockDocRef = {
        id: 'unavailable-doc',
      } as unknown as DocumentReference

      const err = Object.assign(new Error('Network unavailable'), { code: 'unavailable' })
      mockGetDoc.mockRejectedValueOnce(err)

      const result = await safeGetDoc(mockDocRef)
      expect(result.exists()).toBe(false)
      expect(result.data()).toBeUndefined()
      expect(result.id).toBe('unavailable-doc')
    })

    it('returns safe non-existing DocumentSnapshot when navigator.onLine is false and getDoc fails', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      })

      const mockDocRef = {
        id: 'offline-mode-doc',
      } as unknown as DocumentReference

      mockGetDoc.mockRejectedValueOnce(new Error('Any error while offline'))

      const result = await safeGetDoc(mockDocRef)
      expect(result.exists()).toBe(false)
      expect(result.data()).toBeUndefined()
      expect(result.id).toBe('offline-mode-doc')
    })

    it('re-throws non-offline errors when navigator.onLine === true', async () => {
      const mockDocRef = {
        id: 'perm-doc',
      } as unknown as DocumentReference

      const err = Object.assign(new Error('Missing permissions'), { code: 'permission-denied' })
      mockGetDoc.mockRejectedValueOnce(err)

      await expect(safeGetDoc(mockDocRef)).rejects.toThrow('Missing permissions')
    })
  })

  describe('safeGetDocs', () => {
    it('returns real QuerySnapshot when getDocs succeeds', async () => {
      const mockQuery = {} as unknown as Query
      const fakeQuerySnap = {
        empty: false,
        size: 1,
        docs: [{ id: 'doc-1' }],
      }
      mockGetDocs.mockResolvedValueOnce(fakeQuerySnap)

      const result = await safeGetDocs(mockQuery)
      expect(result.empty).toBe(false)
      expect(result.size).toBe(1)
      expect(result.docs.length).toBe(1)
    })

    it('returns a safe empty QuerySnapshot when getDocs throws offline error', async () => {
      const mockQuery = {} as unknown as Query

      mockGetDocs.mockRejectedValueOnce(
        new Error('Failed to get document because the client is offline.')
      )

      const result = await safeGetDocs(mockQuery)
      expect(result.empty).toBe(true)
      expect(result.docs).toEqual([])
      expect(result.size).toBe(0)
    })

    it('returns a safe empty QuerySnapshot when error code is unavailable', async () => {
      const mockQuery = {} as unknown as Query

      const err = Object.assign(new Error('Network unavailable'), { code: 'unavailable' })
      mockGetDocs.mockRejectedValueOnce(err)

      const result = await safeGetDocs(mockQuery)
      expect(result.empty).toBe(true)
      expect(result.docs).toEqual([])
      expect(result.size).toBe(0)
    })

    it('returns a safe empty QuerySnapshot when navigator.onLine is false and getDocs fails', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      })

      const mockQuery = {} as unknown as Query
      mockGetDocs.mockRejectedValueOnce(new Error('Any error while offline'))

      const result = await safeGetDocs(mockQuery)
      expect(result.empty).toBe(true)
      expect(result.docs).toEqual([])
      expect(result.size).toBe(0)
    })

    it('re-throws non-offline errors from getDocs when online', async () => {
      const mockQuery = {} as unknown as Query

      const err = Object.assign(new Error('Quota exceeded'), { code: 'resource-exhausted' })
      mockGetDocs.mockRejectedValueOnce(err)

      await expect(safeGetDocs(mockQuery)).rejects.toThrow('Quota exceeded')
    })
  })
})
