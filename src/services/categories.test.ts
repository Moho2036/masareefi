import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deleteCategory,
  archiveCategory,
  archiveCategoriesBatch,
  reassignAndDeleteCategory,
  reorderCategories,
  updateCategory,
} from './categories'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockDeleteDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn((...parts: unknown[]) => ({ path: parts.slice(1).join('/') }))
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockBatchUpdate = vi.fn()
const mockBatchDelete = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)
const mockWriteBatch = vi.fn((..._args: unknown[]) => ({
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
}))

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
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
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

describe('reassignAndDeleteCategory service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBatchCommit.mockResolvedValue(undefined)
  })

  it('throws when source and target are the same', async () => {
    await expect(
      reassignAndDeleteCategory('user-1', 'cat-1', 'cat-1')
    ).rejects.toThrow('لا يمكن نقل المعاملات إلى نفس التصنيف.')
  })

  it('throws when categories have different types', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ type: 'expense', name: 'طعام' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ type: 'income', name: 'راتب' }),
      })

    await expect(
      reassignAndDeleteCategory('user-1', 'cat-food', 'cat-salary')
    ).rejects.toThrow('يجب أن يكون التصنيف البديل من نفس النوع (مصروف أو دخل).')
  })

  it('reassigns transactions, recurring, circles and deletes source in batch', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ type: 'expense', name: 'طعام قديم' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ type: 'expense', name: 'طعام جديد' }),
      })

    // transactions (2 docs)
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'tx-1', ref: { id: 'tx-1' } },
        { id: 'tx-2', ref: { id: 'tx-2' } },
      ],
    })
    // recurring (1 doc)
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'rec-1', ref: { id: 'rec-1' } }],
    })
    // circles expense (1 doc)
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'c-1', ref: { id: 'c-1' } }],
    })
    // circles income (0 docs)
    mockGetDocs.mockResolvedValueOnce({
      docs: [],
    })
    // circles cat (0 docs)
    mockGetDocs.mockResolvedValueOnce({
      docs: [],
    })

    await reassignAndDeleteCategory('user-1', 'cat-old', 'cat-new')

    expect(mockWriteBatch).toHaveBeenCalled()
    // 2 tx updates + 1 rec update + 1 circle update = 4 updates
    expect(mockBatchUpdate).toHaveBeenCalledTimes(4)
    // 1 delete on source category
    expect(mockBatchDelete).toHaveBeenCalledTimes(1)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  describe('archiveCategoriesBatch', () => {
    it('prevents batch archiving all active categories of a type', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'expense', archived: false }),
      })
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'cat-1' }, { id: 'cat-2' }],
        empty: false,
      })

      await expect(archiveCategoriesBatch('user-1', ['cat-1', 'cat-2'], true)).rejects.toThrow(
        'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.'
      )
      expect(mockWriteBatch).not.toHaveBeenCalled()
    })

    it('updates all provided category ids in a single writeBatch and commits', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'expense', archived: true }),
      })
      await archiveCategoriesBatch('user-1', ['cat-1', 'cat-2', ''], true)

      expect(mockWriteBatch).toHaveBeenCalled()
      expect(mockBatchUpdate).toHaveBeenCalledTimes(2)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('returns early if ids array is empty', async () => {
      await archiveCategoriesBatch('user-1', [])
      expect(mockWriteBatch).not.toHaveBeenCalled()
    })
  })

  describe('updateCategory service', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ type: 'expense', archived: false }),
      })
    })

    it('throws error when name is empty or whitespace only', async () => {
      await expect(updateCategory('user-1', 'cat-1', { name: '   ' })).rejects.toThrow(
        'اسم التصنيف لا يمكن أن يكون فارغاً.'
      )
      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })

    it('prevents setting archived = true when it is the last active category', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'cat-1' }],
        empty: false,
      })

      await expect(updateCategory('user-1', 'cat-1', { archived: true })).rejects.toThrow(
        'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.'
      )
      expect(mockUpdateDoc).not.toHaveBeenCalled()
    })

    it('updates category successfully when valid', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'cat-1' }, { id: 'cat-2' }],
        empty: false,
      })

      await updateCategory('user-1', 'cat-1', { name: '  طعام جديد  ', archived: true })
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'طعام جديد', archived: true })
      )
    })
  })

  describe('reorderCategories', () => {
    it('updates order of all category ids atomically via writeBatch', async () => {
      await reorderCategories('user-1', ['cat-1', 'cat-2', 'cat-3'])

      expect(mockWriteBatch).toHaveBeenCalled()
      expect(mockBatchUpdate).toHaveBeenCalledTimes(3)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    it('returns early if categoryIds array is empty', async () => {
      await reorderCategories('user-1', [])
      expect(mockWriteBatch).not.toHaveBeenCalled()
    })
  })
})

