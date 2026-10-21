import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CategoriesPage } from './CategoriesPage'
import * as categoriesService from '../services/categories'

vi.mock('../services/categories', () => ({
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  archiveCategory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

const mockCategories = [
  { id: 'cat-used-tx', name: 'طعام وبقالة', type: 'expense', icon: '🛒', color: '#10B981', archived: false, order: 0 },
  { id: 'cat-used-rec', name: 'اشتراك نت', type: 'expense', icon: '🌐', color: '#3B82F6', archived: false, order: 1 },
  { id: 'cat-unused', name: 'تصنيف فارغ', type: 'expense', icon: '📁', color: '#94A3B8', archived: false, order: 2 },
]

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: mockCategories,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    range: { start: new Date('2026-10-01'), end: new Date('2026-11-01') },
  }),
}))

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({
    data: [
      { id: 'tx-1', categoryId: 'cat-used-tx', type: 'expense', amountFils: 5000, date: new Date('2026-10-05') },
    ],
    loading: false,
  }),
}))

vi.mock('../context/AppDataContext', () => ({
  useAppData: () => ({
    recurring: [
      { id: 'rec-1', categoryId: 'cat-used-rec', type: 'expense', amountFils: 25000 },
    ],
    settings: { rolloverBalance: false, monthStartDay: 1 },
  }),
}))

const mockShowToast = vi.fn()
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

describe('CategoriesPage component category protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders usage labels and prevents final deletion for categories in use', async () => {
    render(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText(/معاملة واحدة هذا الشهر/i)).toBeDefined()
    })

    // cat-used-rec has recurring item
    expect(screen.getByText(/معاملة متكررة مرتبطة/i)).toBeDefined()

    // cat-unused has 0 usage
    expect(screen.getByText(/لا توجد معاملات مسجلة \(غير مستخدم\)/i)).toBeDefined()

    // Delete button should only be available for the unused category
    expect(screen.getByLabelText('حذف تصنيف تصنيف فارغ نهائياً')).toBeDefined()

    // Used categories should show "مستخدم" tag instead of trash button
    expect(screen.queryByLabelText('حذف تصنيف طعام وبقالة نهائياً')).toBeNull()
    expect(screen.queryByLabelText('حذف تصنيف اشتراك نت نهائياً')).toBeNull()
  })

  it('allows deleting an unused category through confirmation modal', async () => {
    render(<CategoriesPage />)

    const deleteBtn = await screen.findByLabelText('حذف تصنيف تصنيف فارغ نهائياً')
    fireEvent.click(deleteBtn)

    // Modal appears
    expect(screen.getByText(/هل أنت متأكد من حذف تصنيف "تصنيف فارغ" نهائياً؟/i)).toBeDefined()

    const confirmBtn = screen.getByRole('button', { name: 'حذف نهائي' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(categoriesService.deleteCategory).toHaveBeenCalledWith('user-123', 'cat-unused')
    })
  })

  it('allows hard deletion of category when transactions are empty even if old localStorage cache had counts', async () => {
    // cat-unused has 0 transactions in Firestore, but had old stale count in localStorage
    localStorage.setItem('masareefi_category_usage', JSON.stringify({ 'cat-unused': 2 }))

    render(<CategoriesPage />)

    // With Firestore as single source of truth, the stale count in localStorage does not block deletion
    const deleteBtn = await screen.findByLabelText('حذف تصنيف تصنيف فارغ نهائياً')
    expect(deleteBtn).toBeInTheDocument()
  })

  it('displays error toast when backend rejects deleteCategory due to existing records in Firestore', async () => {
    vi.mocked(categoriesService.deleteCategory).mockRejectedValueOnce(
      new Error('لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات مالية. يمكنك أرشفته بدلاً من ذلك.')
    )

    render(<CategoriesPage />)

    const deleteBtn = await screen.findByLabelText('حذف تصنيف تصنيف فارغ نهائياً')
    fireEvent.click(deleteBtn)

    const confirmBtn = screen.getByRole('button', { name: 'حذف نهائي' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات مالية'),
        'error'
      )
    })
  })

  it('shows warning toast when archiving a category used in active recurring transactions', async () => {
    render(<CategoriesPage />)

    // Archive button for cat-used-rec ("اشتراك نت")
    const archiveBtn = await screen.findByLabelText('أرشفة تصنيف اشتراك نت')
    fireEvent.click(archiveBtn)

    await waitFor(() => {
      expect(categoriesService.archiveCategory).toHaveBeenCalledWith('user-123', 'cat-used-rec', true)
      expect(mockShowToast).toHaveBeenCalledWith(
        'تمت الأرشفة، مع العلم أن هذا التصنيف مستخدم في معاملات متكررة نشطة',
        'info'
      )
    })
  })

  it('shows standard info toast when archiving an unused category', async () => {
    render(<CategoriesPage />)

    // Archive button for cat-unused ("تصنيف فارغ")
    const archiveBtn = await screen.findByLabelText('أرشفة تصنيف تصنيف فارغ')
    fireEvent.click(archiveBtn)

    await waitFor(() => {
      expect(categoriesService.archiveCategory).toHaveBeenCalledWith('user-123', 'cat-unused', true)
      expect(mockShowToast).toHaveBeenCalledWith(
        'تمت أرشفة التصنيف بنجاح',
        'info'
      )
    })
  })
})
