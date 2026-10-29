import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CategoriesPage } from './CategoriesPage'
import * as categoriesService from '../services/categories'

vi.mock('../services/categories', () => ({
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  archiveCategory: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  reassignAndDeleteCategory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
let mockUserSettings = {
  currency: 'JOD',
  categorySortMode: 'usage' as 'usage' | 'manual',
  monthStartDay: 1,
}

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: mockUserSettings,
    loading: false,
    error: null,
    updateSettings: mockUpdateSettings,
  }),
}))

let mockCategories = [
  { id: 'cat-used-tx', name: 'طعام وبقالة', type: 'expense' as const, icon: '🛒', color: '#10B981', archived: false, order: 0 },
  { id: 'cat-used-rec', name: 'اشتراك نت', type: 'expense' as const, icon: '🌐', color: '#3B82F6', archived: false, order: 1 },
  { id: 'cat-unused', name: 'تصنيف فارغ', type: 'expense' as const, icon: '📁', color: '#94A3B8', archived: false, order: 2 },
]

let mockRecurring = [
  { id: 'rec-1', categoryId: 'cat-used-rec', type: 'expense' as const, amountFils: 25000, active: true },
]

let mockTransactions = [
  { id: 'tx-1', categoryId: 'cat-used-tx', type: 'expense' as const, amountFils: 5000, date: new Date('2026-10-05') },
]

let mockCircles: Array<{
  id: string
  name: string
  status: 'active' | 'completed' | 'archived'
  expenseCategoryId?: string
  incomeCategoryId?: string
  categoryId?: string
}> = []

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
    data: mockTransactions,
    loading: false,
  }),
}))

vi.mock('../context/AppDataContext', () => ({
  useAppData: () => ({
    recurring: mockRecurring,
    moneyCircles: mockCircles,
    settings: { rolloverBalance: false, monthStartDay: 1 },
  }),
}))

const mockShowToast = vi.fn()
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

describe('CategoriesPage component category management & protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUserSettings = {
      currency: 'JOD',
      categorySortMode: 'usage',
      monthStartDay: 1,
    }
    mockCategories = [
      { id: 'cat-used-tx', name: 'طعام وبقالة', type: 'expense', icon: '🛒', color: '#10B981', archived: false, order: 0 },
      { id: 'cat-used-rec', name: 'اشتراك نت', type: 'expense', icon: '🌐', color: '#3B82F6', archived: false, order: 1 },
      { id: 'cat-unused', name: 'تصنيف فارغ', type: 'expense', icon: '📁', color: '#94A3B8', archived: false, order: 2 },
    ]
    mockRecurring = [
      { id: 'rec-1', categoryId: 'cat-used-rec', type: 'expense', amountFils: 25000, active: true },
    ]
    mockTransactions = [
      { id: 'tx-1', categoryId: 'cat-used-tx', type: 'expense', amountFils: 5000, date: new Date('2026-10-05') },
    ]
    mockCircles = []
  })

  it('renders monthly spend stats and usage details on category cards', async () => {
    render(<CategoriesPage />)

    // cat-used-tx has 1 transaction of 5000 fils (5 د.أ) in October 2026
    await waitFor(() => {
      expect(screen.getAllByText((_, el) => Boolean(el?.textContent?.includes('5د.أ') || el?.textContent?.includes('5 د.أ') || el?.textContent?.includes('5.000') || (el?.textContent?.includes('5') && el?.textContent?.includes('د.أ')))).length).toBeGreaterThan(0)
      expect(screen.getByText(/معاملة واحدة هذا الشهر/i)).toBeInTheDocument()
    })

    // cat-used-rec has recurring item
    expect(screen.getByText(/معاملة متكررة مرتبطة/i)).toBeInTheDocument()

    // cat-unused has 0 usage
    expect(screen.getByText('غير مستخدم')).toBeInTheDocument()

    // All categories have action buttons (reorder, edit, archive, delete)
    expect(screen.getByLabelText('حذف تصنيف طعام وبقالة')).toBeInTheDocument()
    expect(screen.getByLabelText('حذف تصنيف اشتراك نت')).toBeInTheDocument()
    expect(screen.getByLabelText('حذف تصنيف تصنيف فارغ')).toBeInTheDocument()
  })

  it('allows deleting an unused category directly through simple confirmation modal', async () => {
    render(<CategoriesPage />)

    const deleteBtn = await screen.findByLabelText('حذف تصنيف تصنيف فارغ')
    fireEvent.click(deleteBtn)

    // Modal appears with simple warning
    expect(screen.getByText(/هل أنت متأكد من حذف تصنيف "تصنيف فارغ" نهائياً؟/i)).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'حذف نهائي' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(categoriesService.deleteCategory).toHaveBeenCalledWith('user-123', 'cat-unused')
    })
  })

  it('opens smart delete modal for category in use, offering archive or reassign & delete', async () => {
    render(<CategoriesPage />)

    const deleteBtn = await screen.findByLabelText('حذف تصنيف طعام وبقالة')
    fireEvent.click(deleteBtn)

    // Smart modal text
    expect(screen.getByText(/هذا التصنيف مرتبط بسجلات مالية حالية/i)).toBeInTheDocument()
    expect(screen.getByText(/أرشفة التصنيف \(مستحسن\)/i)).toBeInTheDocument()
    expect(screen.getByText(/نقل كافة السجلات إلى تصنيف آخر وحذفه نهائياً/i)).toBeInTheDocument()

    // Select "نقل كافة السجلات إلى تصنيف آخر وحذفه نهائياً"
    const reassignOption = screen.getByText(/نقل كافة السجلات إلى تصنيف آخر وحذفه نهائياً/i)
    fireEvent.click(reassignOption)

    // Target category dropdown appears
    expect(screen.getByText(/التصنيف البديل لنقل السجلات إليه:/i)).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'نقل السجلات وحذف التصنيف' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(categoriesService.reassignAndDeleteCategory).toHaveBeenCalledWith(
        'user-123',
        'cat-used-tx',
        expect.any(String)
      )
    })
  })

  it('allows hard deletion of category when transactions are empty even if old localStorage cache had counts', async () => {
    localStorage.setItem('masareefi_category_usage', JSON.stringify({ 'cat-unused': 2 }))

    render(<CategoriesPage />)

    const deleteBtn = await screen.findByLabelText('حذف تصنيف تصنيف فارغ')
    expect(deleteBtn).toBeInTheDocument()
  })

  it('displays error toast when backend rejects deleteCategory due to existing records in Firestore', async () => {
    vi.mocked(categoriesService.deleteCategory).mockRejectedValueOnce(
      new Error('لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بمعاملات مالية. يمكنك أرشفته بدلاً من ذلك.')
    )

    render(<CategoriesPage />)

    const deleteBtn = await screen.findByLabelText('حذف تصنيف تصنيف فارغ')
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

  it('blocks archiving the last active category of a type and shows error toast', async () => {
    mockCategories = [
      { id: 'cat-single', name: 'تصنيف وحيد', type: 'expense', icon: '🛒', color: '#10B981', archived: false, order: 0 },
    ]

    render(<CategoriesPage />)

    const archiveBtn = await screen.findByLabelText('أرشفة تصنيف تصنيف وحيد')
    fireEvent.click(archiveBtn)

    expect(categoriesService.archiveCategory).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(
      'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.',
      'error'
    )
  })

  it('blocks deleting the last active category of a type and shows error toast', async () => {
    mockCategories = [
      { id: 'cat-single-unused', name: 'تصنيف وحيد غير مستخدم', type: 'expense', icon: '📁', color: '#94A3B8', archived: false, order: 0 },
    ]

    render(<CategoriesPage />)

    const deleteBtn = await screen.findByLabelText('حذف تصنيف تصنيف وحيد غير مستخدم')
    fireEvent.click(deleteBtn)

    const confirmBtn = screen.getByRole('button', { name: 'حذف نهائي' })
    fireEvent.click(confirmBtn)

    expect(categoriesService.deleteCategory).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(
      'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.',
      'error'
    )
  })

  it('swaps category orders and automatically switches sort mode to manual', async () => {
    render(<CategoriesPage />)

    // First category cannot move up
    const firstUpBtn = screen.getByLabelText('تحريك تصنيف طعام وبقالة للأعلى') as HTMLButtonElement
    expect(firstUpBtn.disabled).toBe(true)

    // Last category cannot move down
    const lastDownBtn = screen.getByLabelText('تحريك تصنيف تصنيف فارغ للأسفل') as HTMLButtonElement
    expect(lastDownBtn.disabled).toBe(true)

    // Move second category up
    const secondUpBtn = screen.getByLabelText('تحريك تصنيف اشتراك نت للأعلى')
    fireEvent.click(secondUpBtn)

    await waitFor(() => {
      // Switched sort mode to manual
      expect(mockUpdateSettings).toHaveBeenCalledWith({ categorySortMode: 'manual' })
      expect(categoriesService.updateCategory).toHaveBeenCalledWith('user-123', 'cat-used-rec', { order: 0 })
      expect(categoriesService.updateCategory).toHaveBeenCalledWith('user-123', 'cat-used-tx', { order: 1 })
    })
  })

  it('allows toggling between usage and manual sort mode via UI toggle button', async () => {
    render(<CategoriesPage />)

    // Look for manual sort button in segmented control
    const manualSortBtn = screen.getByRole('radio', { name: /يدوي/i })
    fireEvent.click(manualSortBtn)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ categorySortMode: 'manual' })
    })
  })

  it('recognizes circle linkage and opens smart delete modal on delete click', async () => {
    mockCategories = [
      { id: 'cat-circle-only', name: 'تصنيف جمعية', type: 'expense', icon: '👥', color: '#10B981', archived: false, order: 0 },
      { id: 'cat-unused', name: 'تصنيف فارغ', type: 'expense', icon: '📁', color: '#94A3B8', archived: false, order: 1 },
    ]
    mockTransactions = []
    mockRecurring = []
    mockCircles = [
      {
        id: 'circle-1',
        name: 'جمعية الأسرة',
        status: 'active',
        expenseCategoryId: 'cat-circle-only',
      },
    ]

    render(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText(/جمعية مالية مرتبطة/i)).toBeInTheDocument()
    })

    const deleteBtn = screen.getByLabelText('حذف تصنيف تصنيف جمعية')
    fireEvent.click(deleteBtn)

    // Should open smart modal
    expect(screen.getByText(/هذا التصنيف مرتبط بسجلات مالية حالية/i)).toBeInTheDocument()
  })

  it('displays order badges (#1, #2, ...) when sort mode is manual and renders single column grid', () => {
    mockUserSettings = {
      currency: 'JOD',
      categorySortMode: 'manual',
      monthStartDay: 1,
    }

    render(<CategoriesPage />)

    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('normalizes sparse category orders when reordering from usage mode to prevent erratic jumping', async () => {
    // Categories with sparse orders: 0, 15, 9
    mockCategories = [
      { id: 'cat-1', name: 'تصنيف أ', type: 'expense', icon: '🛒', color: '#10B981', archived: false, order: 0 },
      { id: 'cat-2', name: 'تصنيف ب', type: 'expense', icon: '🌐', color: '#3B82F6', archived: false, order: 15 },
      { id: 'cat-3', name: 'تصنيف ج', type: 'expense', icon: '📁', color: '#94A3B8', archived: false, order: 9 },
    ]
    mockTransactions = []

    render(<CategoriesPage />)

    // In usage mode with 0 txs, sorted by order: cat-1 (order 0), cat-3 (order 9), cat-2 (order 15)
    // Moving cat-3 (at index 1) up to index 0:
    const moveUpCat3 = screen.getByLabelText('تحريك تصنيف تصنيف ج للأعلى')
    fireEvent.click(moveUpCat3)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ categorySortMode: 'manual' })
      expect(categoriesService.updateCategory).toHaveBeenCalledWith('user-123', 'cat-3', { order: 0 })
      expect(categoriesService.updateCategory).toHaveBeenCalledWith('user-123', 'cat-1', { order: 1 })
      expect(categoriesService.updateCategory).toHaveBeenCalledWith('user-123', 'cat-2', { order: 2 })
    })
  })
})
