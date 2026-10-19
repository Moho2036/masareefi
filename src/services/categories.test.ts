import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteCategory } from './categories'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockGetDocs = vi.fn()
const mockDeleteDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

describe('deleteCategory service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws an Arabic error when the category has associated transactions', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: false })
    mockGetDocs.mockResolvedValueOnce({ empty: true })

    await expect(deleteCategory('user-123', 'cat-456')).rejects.toThrow(
      'لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات مالية. يمكنك أرشفته بدلاً من ذلك.'
    )
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('throws an Arabic error when the category has associated recurring transactions', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true })
    mockGetDocs.mockResolvedValueOnce({ empty: false })

    await expect(deleteCategory('user-123', 'cat-456')).rejects.toThrow(
      'لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات متكررة. يمكنك أرشفته بدلاً من ذلك.'
    )
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('deletes the category document when no associated transactions or recurring items exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: true })
    mockDeleteDoc.mockResolvedValueOnce(undefined)

    await expect(deleteCategory('user-123', 'cat-456')).resolves.toBeUndefined()
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })
})
