import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteCategory, archiveCategory } from './categories'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockDeleteDoc = vi.fn()
const mockUpdateDoc = vi.fn()
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
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
}))

describe('deleteCategory service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ type: 'expense', archived: true }),
    })
  })

  it('throws an Arabic error when the category has associated transactions', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: 'tx-1' }] })
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })

    await expect(deleteCategory('user-123', 'cat-456')).rejects.toThrow(
      'لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات مالية. يمكنك أرشفته بدلاً من ذلك.'
    )
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('throws an Arabic error when the category has associated recurring transactions', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] }) // snapTx
    mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: 'rec-1' }] }) // snapRec
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })

    await expect(deleteCategory('user-123', 'cat-456')).rejects.toThrow(
      'لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات متكررة. يمكنك أرشفته بدلاً من ذلك.'
    )
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('throws an Arabic error when the category is associated with a money circle', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] }) // snapTx
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] }) // snapRec
    mockGetDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: 'circle-1' }] }) // snapCircleExp
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })

    await expect(deleteCategory('user-123', 'cat-456')).rejects.toThrow(
      'لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بجمعية مالية. يمكنك أرشفته أو تغيير تصنيف الجمعية أولاً.'
    )
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('prevents deleting the last active category of a type', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ type: 'expense', archived: false }),
    })
    // active categories count <= 1
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'cat-456' }],
      empty: false,
    })

    await expect(deleteCategory('user-123', 'cat-456')).rejects.toThrow(
      'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.'
    )
    expect(mockDeleteDoc).not.toHaveBeenCalled()
  })

  it('deletes the category document when no associated transactions, recurring items, or circles exist', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
    mockDeleteDoc.mockResolvedValueOnce(undefined)

    await expect(deleteCategory('user-123', 'cat-456')).resolves.toBeUndefined()
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })
})

describe('archiveCategory service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents archiving the last active category of a type', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ type: 'income', archived: false }),
    })
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'cat-inc-1' }],
      empty: false,
    })

    await expect(archiveCategory('user-123', 'cat-inc-1', true)).rejects.toThrow(
      'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.'
    )
    expect(mockUpdateDoc).not.toHaveBeenCalled()
  })

  it('allows archiving when more than one active category of the type exists', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ type: 'income', archived: false }),
    })
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'cat-inc-1' }, { id: 'cat-inc-2' }],
      empty: false,
    })

    await expect(archiveCategory('user-123', 'cat-inc-1', true)).resolves.toBeUndefined()
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1)
  })
})
