import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TransactionsPage } from './TransactionsPage'
import * as exportCsvModule from '../lib/exportCsv'
import * as debtsServices from '../services/debts'
import * as circleServices from '../services/moneyCircles'
import type { Transaction, Category, Debt, MoneyCircle } from '../types'

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const mockCategories: Category[] = [
  { id: 'c-food', name: 'طعام وبقالة', type: 'expense', icon: '🛒', color: '#F59E0B', archived: false, order: 0 },
  { id: 'c-salary', name: 'راتب', type: 'income', icon: '💼', color: '#10B981', archived: false, order: 1 },
]

let mockTransactions: Transaction[] = []
let mockAllTransactions: Transaction[] = []
let mockDebts: Debt[] = []
let mockCircles: MoneyCircle[] = []
let mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }
let mockManualNavKey = 0

vi.mock('../services/transactions', () => ({
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/debts', () => ({
  removeDebtPayment: vi.fn().mockResolvedValue(undefined),
  deleteDebtPayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/moneyCircles', () => ({
  removeCircleInstallmentPayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: mockCategories,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: (range?: unknown) => ({
    data: range !== undefined ? mockTransactions : (mockAllTransactions.length > 0 ? mockAllTransactions : mockTransactions),
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useDebts', () => ({
  useDebts: () => ({
    data: mockDebts,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
    data: mockCircles,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    range: mockRange,
    selectedDate: mockRange.start,
    setSelectedDate: vi.fn(),
    manualNavKey: mockManualNavKey,
  }),
}))

vi.mock('../hooks/useTransactionModal', () => ({
  useTransactionModal: () => ({
    openAdd: vi.fn(),
    openEdit: vi.fn(),
    openDuplicate: vi.fn(),
  }),
}))

const mockShowToast = vi.fn()
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (val: number) => `${val / 1000} د.أ`,
    formatWithSign: (val: number, type: string) => `${type === 'expense' ? '-' : '+'}${val / 1000} د.أ`,
    config: { code: 'JOD', symbol: 'د.أ', decimals: 3 },
  }),
}))

vi.mock('../lib/exportCsv', async () => {
  const actual = await vi.importActual<typeof import('../lib/exportCsv')>('../lib/exportCsv')
  return {
    ...actual,
    exportTransactionsToCsv: vi.fn(),
  }
})

describe('TransactionsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }
    mockManualNavKey = 0
    mockTransactions = []
    mockAllTransactions = []
    mockDebts = []
    mockCircles = []
  })

  it('paginates transactions at 30 items per page and allows navigating between pages', () => {
    // Generate 45 transactions
    mockTransactions = Array.from({ length: 45 }, (_, i) => ({
      id: `tx-${i + 1}`,
      type: 'expense',
      amountFils: (i + 1) * 1000,
      categoryId: 'c-food',
      date: new Date('2026-10-15'),
      title: `معاملة رقم ${i + 1}`,
      note: '',
      createdAt: new Date('2026-10-15'),
    }))

    renderWithRouter(<TransactionsPage />)

    // First page should show transactions 1 to 30
    expect(screen.getByText('معاملة رقم 1')).toBeInTheDocument()
    expect(screen.getByText('معاملة رقم 30')).toBeInTheDocument()
    expect(screen.queryByText('معاملة رقم 31')).not.toBeInTheDocument()

    // Pagination controls indicate page 1 of 2
    expect(screen.getByText(/صفحة/i)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    // Click "التالي"
    const nextBtn = screen.getByRole('button', { name: 'التالي' })
    fireEvent.click(nextBtn)

    // Now page 2 items appear
    expect(screen.getByText('معاملة رقم 31')).toBeInTheDocument()
    expect(screen.getByText('معاملة رقم 45')).toBeInTheDocument()
    expect(screen.queryByText('معاملة رقم 1')).not.toBeInTheDocument()
  })

  it('resets page to 1 when month changes', () => {
    mockTransactions = Array.from({ length: 45 }, (_, i) => ({
      id: `tx-${i + 1}`,
      type: 'expense',
      amountFils: 1000,
      categoryId: 'c-food',
      date: new Date('2026-10-15'),
      title: `معاملة رقم ${i + 1}`,
      note: '',
      createdAt: new Date('2026-10-15'),
    }))

    const { rerender } = renderWithRouter(<TransactionsPage />)

    // Go to page 2
    const nextBtn = screen.getByRole('button', { name: 'التالي' })
    fireEvent.click(nextBtn)
    expect(screen.getByText('معاملة رقم 31')).toBeInTheDocument()

    // Change month
    mockRange = { start: new Date('2026-11-01'), end: new Date('2026-12-01') }
    rerender(<MemoryRouter><TransactionsPage /></MemoryRouter>)

    // Should be back on page 1
    expect(screen.getByText('معاملة رقم 1')).toBeInTheDocument()
  })

  it('exports filteredTransactions to CSV instead of all raw transactions', () => {
    mockTransactions = [
      {
        id: 'tx-food',
        type: 'expense',
        amountFils: 5000,
        categoryId: 'c-food',
        date: new Date('2026-10-05'),
        title: 'وجبة غداء',
        note: '',
        createdAt: new Date('2026-10-05'),
      },
      {
        id: 'tx-salary',
        type: 'income',
        amountFils: 1000000,
        categoryId: 'c-salary',
        date: new Date('2026-10-01'),
        title: 'راتب شهري',
        note: '',
        createdAt: new Date('2026-10-01'),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    // Filter by type: مصاريف
    const expenseRadio = screen.getByRole('radio', { name: 'مصاريف' })
    fireEvent.click(expenseRadio)

    // Click "تصدير CSV"
    const exportBtn = screen.getByRole('button', { name: /تصدير CSV/i })
    fireEvent.click(exportBtn)

    // Verify exportTransactionsToCsv was called with only the filtered transactions (only expense)
    expect(exportCsvModule.exportTransactionsToCsv).toHaveBeenCalledTimes(1)
    const exportedList = vi.mocked(exportCsvModule.exportTransactionsToCsv).mock.calls[0][0]
    expect(exportedList).toHaveLength(1)
    expect(exportedList[0].id).toBe('tx-food')
    expect(mockShowToast).toHaveBeenCalledWith('تم تصدير المعاملات المحددة بنجاح', 'success')
  })

  it('triggers window.print when clicking on "طباعة / PDF" button', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    mockTransactions = [
      {
        id: 'tx-print-1',
        type: 'expense',
        amountFils: 20000,
        date: new Date('2026-10-05'),
        categoryId: 'c-food',
        note: 'وجبة سريعة',
        createdAt: new Date(),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    const printBtn = screen.getByRole('button', { name: /طباعة \/ PDF/i })
    expect(printBtn).toBeInTheDocument()
    expect(printBtn).not.toBeDisabled()

    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalledTimes(1)
    printSpy.mockRestore()
  })

  it('shows linked debt payment alert in modal and calls removeDebtPayment when deleting', async () => {
    const debtId = 'debt-100'
    const payId = 'pay-200'
    const txId = 'debt_pay_pay-200'
    const mockDebt: Debt = {
      id: debtId,
      personName: 'خالد السعيد',
      type: 'borrowed',
      amountFils: 100000,
      paidFils: 40000,
      settled: false,
      dueDate: null,
      note: '',
      startDate: new Date('2026-10-01'),
      createdAt: new Date('2026-10-01'),
      payments: [
        {
          id: payId,
          amountFils: 40000,
          date: new Date('2026-10-10'),
          transactionId: txId,
          createdAt: new Date('2026-10-10'),
        },
      ],
    }
    mockDebts = [mockDebt]
    mockTransactions = [
      {
        id: txId,
        type: 'expense',
        amountFils: 40000,
        categoryId: 'c-food',
        date: new Date('2026-10-10'),
        title: 'سداد دين: خالد السعيد',
        note: '',
        createdAt: new Date('2026-10-10'),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    const deleteBtn = screen.getByLabelText('حذف المعاملة')
    fireEvent.click(deleteBtn)

    // Verify modal warning shows the debtor's name
    expect(screen.getByText('تنبيه: هذه المعاملة مرتبطة بدفعة سداد دين')).toBeInTheDocument()
    expect(screen.getByText('خالد السعيد')).toBeInTheDocument()
    expect(
      screen.getByText(/عند تأكيد الحذف، سيتم أيضاً حذف دفعة السداد وإعادة فتح المبلغ المستحق في سجل الديون/)
    ).toBeInTheDocument()

    // Confirm deletion
    const confirmButtons = screen.getAllByRole('button', { name: 'حذف المعاملة' })
    expect(confirmButtons.length).toBe(2)
    fireEvent.click(confirmButtons[1])

    await waitFor(() => {
      expect(debtsServices.removeDebtPayment).toHaveBeenCalledWith('user-123', mockDebt, payId)
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('تم حذف دفعة السداد لـ (خالد السعيد)'),
        'info'
      )
    })
  })

  it('switches to all-months mode, displays indicator banner, searches across history, and exports all months to CSV', async () => {
    const octTx: Transaction = {
      id: 'tx-oct',
      type: 'expense',
      amountFils: 5000,
      categoryId: 'c-food',
      date: new Date('2026-10-15'),
      title: 'بقالة أكتوبر',
      note: '',
      createdAt: new Date('2026-10-15'),
    }

    const febTx: Transaction = {
      id: 'tx-feb',
      type: 'expense',
      amountFils: 12000,
      categoryId: 'c-food',
      date: new Date('2026-02-10'),
      title: 'فاتورة قديمة فبراير',
      note: '',
      createdAt: new Date('2026-02-10'),
    }

    mockTransactions = [octTx]
    mockAllTransactions = [octTx, febTx]

    renderWithRouter(<TransactionsPage />)

    // Initially in monthly mode: only October transaction is shown
    expect(screen.getByText('بقالة أكتوبر')).toBeInTheDocument()
    expect(screen.queryByText('فاتورة قديمة فبراير')).not.toBeInTheDocument()

    // Click "كل الأشهر" toggle button
    const allMonthsBtn = screen.getByRole('button', { name: /كل الأشهر/i })
    fireEvent.click(allMonthsBtn)

    // Now both October and February transactions appear
    expect(screen.getByText('بقالة أكتوبر')).toBeInTheDocument()
    expect(screen.getByText('فاتورة قديمة فبراير')).toBeInTheDocument()

    // Informative banner is visible
    expect(
      screen.getByText(/البحث في كامل السجل \(كل الأشهر\)/i)
    ).toBeInTheDocument()

    // Search for the old February transaction
    const searchInput = screen.getByPlaceholderText(/ابحث في العنوان، الملاحظات، الفئة، أو المبلغ/i)
    fireEvent.change(searchInput, { target: { value: 'فبراير' } })

    // Only the February transaction matches
    expect(screen.getByText('فاتورة قديمة فبراير')).toBeInTheDocument()
    expect(screen.queryByText('بقالة أكتوبر')).not.toBeInTheDocument()

    // Export CSV exports the matching results and toasts all-months message
    const exportBtn = screen.getByRole('button', { name: /تصدير CSV/i })
    fireEvent.click(exportBtn)

    expect(exportCsvModule.exportTransactionsToCsv).toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(
      'تم تصدير المعاملات المحددة لكافة الأشهر بنجاح',
      'success'
    )
  })

  it('keeps allMonths mode when selectedDate changes programmatically, and exits when manualNavKey changes', () => {
    const { rerender } = renderWithRouter(<TransactionsPage />)

    // Turn on allMonths
    const allMonthsBtn = screen.getByRole('button', { name: /كل الأشهر/i })
    fireEvent.click(allMonthsBtn)

    expect(screen.getByText(/البحث في كامل السجل \(كل الأشهر\)/i)).toBeInTheDocument()

    // Change selectedDate / range programmatically (e.g. from adding transaction)
    mockRange = { start: new Date('2026-11-01'), end: new Date('2026-12-01') }
    rerender(<MemoryRouter><TransactionsPage /></MemoryRouter>)

    // allMonths banner should STILL be in the document!
    expect(screen.getByText(/البحث في كامل السجل \(كل الأشهر\)/i)).toBeInTheDocument()

    // Simulate manual month navigation in top bar
    mockManualNavKey = 1
    rerender(<MemoryRouter><TransactionsPage /></MemoryRouter>)

    // Now allMonths banner should be gone because manual navigation occurred
    expect(screen.queryByText(/البحث في كامل السجل \(كل الأشهر\)/i)).not.toBeInTheDocument()
  })

  it('allows deleting orphaned debt_init_ transaction when debt has been deleted', async () => {
    // Transaction exists, but mockDebts is empty
    mockTransactions = [
      {
        id: 'debt_init_deleted123',
        type: 'expense',
        amountFils: 50000,
        categoryId: 'c-food',
        date: new Date('2026-10-15T00:00:00Z'),
        title: 'سلفة قديمة',
        note: '',
        createdAt: new Date('2026-10-15T00:00:00Z'),
      },
    ]
    mockDebts = []

    renderWithRouter(<TransactionsPage />)

    // Should NOT show external link to debts, should show delete button
    expect(screen.queryByTitle(/مرتبط بسجل الديون/)).not.toBeInTheDocument()
    const deleteBtn = screen.getByTitle('حذف المعاملة')
    expect(deleteBtn).toBeInTheDocument()

    // Clicking delete opens modal
    fireEvent.click(deleteBtn)
    expect(screen.getByText('تأكيد حذف المعاملة')).toBeInTheDocument()

    const allDeleteBtns = screen.getAllByRole('button', { name: 'حذف المعاملة' })
    const confirmBtn = allDeleteBtns[allDeleteBtns.length - 1]
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('تم حذف المعاملة بنجاح', 'info')
    })
  })

  it('allows deleting orphaned circle_payout_ transaction when circle has been deleted', async () => {
    mockTransactions = [
      {
        id: 'circle_payout_deletedCircle123',
        type: 'income',
        amountFils: 300000,
        categoryId: 'c-salary',
        date: new Date('2026-10-15T00:00:00Z'),
        title: 'استلام جمعية محذوفة',
        note: '',
        createdAt: new Date('2026-10-15T00:00:00Z'),
      },
    ]
    mockCircles = []

    renderWithRouter(<TransactionsPage />)

    expect(screen.queryByTitle(/مرتبط بنظام الجمعيات/)).not.toBeInTheDocument()
    const deleteBtn = screen.getByTitle('حذف المعاملة')
    expect(deleteBtn).toBeInTheDocument()

    fireEvent.click(deleteBtn)
    expect(screen.getByText('تأكيد حذف المعاملة')).toBeInTheDocument()

    const allDeleteBtns = screen.getAllByRole('button', { name: 'حذف المعاملة' })
    const confirmBtn = allDeleteBtns[allDeleteBtns.length - 1]
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('تم حذف المعاملة بنجاح', 'info')
    })
  })

  it('renders circle badge for circle installment transactions and calls removeCircleInstallmentPayment when deleted', async () => {
    mockTransactions = [
      {
        id: 'circle_circle999_m3',
        type: 'expense',
        amountFils: 50000,
        categoryId: 'c-food',
        date: new Date('2026-10-15T00:00:00Z'),
        title: 'قسط جمعية الأسرة (شهر 3)',
        note: '',
        createdAt: new Date('2026-10-15T00:00:00Z'),
      },
    ]
    mockCircles = [
      {
        id: 'circle999',
        name: 'جمعية الأسرة',
        monthlyAmountFils: 50000,
        membersCount: 5,
        totalAmountFils: 250000,
        myTurnMonth: 1,
        startDate: new Date('2026-08-01'),
        members: [],
        status: 'active',
        createdAt: new Date('2026-08-01'),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    // Verify "جمعية" badge is displayed
    expect(screen.getByText('جمعية')).toBeInTheDocument()

    const deleteBtn = screen.getByTitle('حذف المعاملة')
    fireEvent.click(deleteBtn)

    expect(screen.getByText('تأكيد حذف المعاملة')).toBeInTheDocument()

    const allDeleteBtns = screen.getAllByRole('button', { name: 'حذف المعاملة' })
    const confirmBtn = allDeleteBtns[allDeleteBtns.length - 1]
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(circleServices.removeCircleInstallmentPayment).toHaveBeenCalledWith(
        'user-123',
        'circle999',
        3
      )
      expect(mockShowToast).toHaveBeenCalledWith('تم حذف قسط الجمعية وتحديث السجل بنجاح', 'info')
    })
  })

  it('renders link to debts page instead of delete button for merged debt payment transactions', () => {
    mockTransactions = [
      {
        id: 'debt_pay_merged_xyz',
        type: 'income',
        amountFils: 60000,
        categoryId: 'c-salary',
        date: new Date('2026-10-10T00:00:00Z'),
        title: 'رصيد دفعات سابقة مدمجة',
        note: '',
        createdAt: new Date('2026-10-10T00:00:00Z'),
      },
    ]
    mockDebts = [
      {
        id: 'debt_merged_test',
        personName: 'خالد',
        type: 'lent' as const,
        amountFils: 100000,
        paidFils: 60000,
        settled: false,
        startDate: new Date('2026-08-01'),
        note: '',
        payments: [
          {
            id: 'compacted_123',
            amountFils: 60000,
            date: new Date('2026-10-10T00:00:00Z'),
            isMerged: true,
            mergedTransactionIds: ['debt_pay_merged_xyz'],
            createdAt: new Date('2026-10-10T00:00:00Z'),
          },
        ],
        createdAt: new Date('2026-08-01'),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    // Delete button should NOT be available
    expect(screen.queryByTitle('حذف المعاملة')).not.toBeInTheDocument()

    // External link to debts page should be displayed
    const debtLink = screen.getByTitle('مرتبط بدفعة دين مدمجة - افتح صفحة الديون للإدارة')
    expect(debtLink).toBeInTheDocument()
    expect(debtLink.closest('a')).toHaveAttribute('href', '/debts')
  })

  it('keeps allMonths active when selectedDate changes programmatically, and disables it when manualNavKey changes', () => {
    const { rerender } = renderWithRouter(<TransactionsPage />)

    // Initially allMonths is false
    const allMonthsBtn = screen.getByRole('button', { name: /كل الأشهر/ })
    expect(allMonthsBtn).toHaveAttribute('aria-pressed', 'false')

    // Click "كل الأشهر" to activate
    fireEvent.click(allMonthsBtn)
    expect(allMonthsBtn).toHaveAttribute('aria-pressed', 'true')

    // Simulate programmatic change of selectedDate (e.g. from adding transaction in different month)
    mockRange = { start: new Date('2026-09-01'), end: new Date('2026-10-01') }
    rerender(<MemoryRouter><TransactionsPage /></MemoryRouter>)

    // allMonths should STILL be true!
    expect(screen.getByRole('button', { name: /كل الأشهر/ })).toHaveAttribute('aria-pressed', 'true')

    // Simulate manual month navigation in top bar (increments mockManualNavKey)
    mockManualNavKey = 1
    rerender(<MemoryRouter><TransactionsPage /></MemoryRouter>)

    // Now allMonths should be reset to false!
    expect(screen.getByRole('button', { name: /كل الأشهر/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('syncs category usage cache when allMonths is active, but does not overwrite with Math.max in monthly mode', async () => {
    mockAllTransactions = [
      {
        id: 'tx-1',
        type: 'expense',
        amountFils: 10000,
        categoryId: 'c-food',
        date: new Date('2026-08-01'),
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-2',
        type: 'expense',
        amountFils: 20000,
        categoryId: 'c-food',
        date: new Date('2026-09-01'),
        note: '',
        createdAt: new Date(),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    // In monthly mode, category usage is not overwritten
    expect(localStorage.getItem('masareefi_category_usage')).toBeNull()

    // Activate allMonths
    const allMonthsBtn = screen.getByRole('button', { name: /كل الأشهر/ })
    fireEvent.click(allMonthsBtn)

    await waitFor(() => {
      const stored = localStorage.getItem('masareefi_category_usage')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed['c-food']).toBe(2)
    })
  })

  it('reads categoryId from search params on mount and filters transactions', () => {
    mockTransactions = [
      {
        id: 'tx-food',
        type: 'expense',
        amountFils: 5000,
        categoryId: 'c-food',
        date: new Date('2026-10-05'),
        title: 'غداء عمل',
        note: '',
        createdAt: new Date('2026-10-05'),
      },
      {
        id: 'tx-salary',
        type: 'income',
        amountFils: 500000,
        categoryId: 'c-salary',
        date: new Date('2026-10-01'),
        title: 'راتب شهر 10',
        note: '',
        createdAt: new Date('2026-10-01'),
      },
    ]

    render(
      <MemoryRouter initialEntries={['/transactions?categoryId=c-food']}>
        <TransactionsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('غداء عمل')).toBeInTheDocument()
    expect(screen.queryByText('راتب شهر 10')).not.toBeInTheDocument()
  })

  it('filters by source chip (e.g. debt)', () => {
    mockTransactions = [
      {
        id: 'manual-tx',
        type: 'expense',
        amountFils: 4000,
        categoryId: 'c-food',
        date: new Date('2026-10-02'),
        title: 'شراء يدوي',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'debt_init_99',
        type: 'expense',
        amountFils: 30000,
        categoryId: 'c-food',
        date: new Date('2026-10-04'),
        title: 'دين مستحق',
        note: '',
        createdAt: new Date(),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    // Initially both transactions are shown
    expect(screen.getByText('شراء يدوي')).toBeInTheDocument()
    expect(screen.getByText('دين مستحق')).toBeInTheDocument()

    // Click source filter chip "ديون"
    const debtChip = screen.getByRole('button', { name: 'ديون' })
    fireEvent.click(debtChip)

    expect(screen.queryByText('شراء يدوي')).not.toBeInTheDocument()
    expect(screen.getByText('دين مستحق')).toBeInTheDocument()
  })

  it('renders a flat list when sorted by highest amount', () => {
    mockTransactions = [
      {
        id: 'tx-low',
        type: 'expense',
        amountFils: 2000,
        categoryId: 'c-food',
        date: new Date('2026-10-10'),
        title: 'معاملة صغيرة',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-high',
        type: 'expense',
        amountFils: 90000,
        categoryId: 'c-food',
        date: new Date('2026-10-01'),
        title: 'معاملة كبيرة',
        note: '',
        createdAt: new Date(),
      },
    ]

    renderWithRouter(<TransactionsPage />)

    const sortSelect = screen.getByRole('combobox')
    fireEvent.change(sortSelect, { target: { value: 'highest' } })

    // When sorted by highest, both items are in document in sorted order
    const titles = screen.getAllByText(/معاملة (كبيرة|صغيرة)/)
    expect(titles[0]).toHaveTextContent('معاملة كبيرة')
    expect(titles[1]).toHaveTextContent('معاملة صغيرة')
  })

  it('initializes filterType to income when type=income is in search params', () => {
    mockTransactions = [
      {
        id: 'tx-inc',
        type: 'income',
        amountFils: 500000,
        categoryId: 'c-salary',
        date: new Date('2026-10-01'),
        title: 'راتب شهري',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-exp',
        type: 'expense',
        amountFils: 15000,
        categoryId: 'c-food',
        date: new Date('2026-10-02'),
        title: 'مشتريات بقالة',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter initialEntries={['/transactions?type=income']}>
        <TransactionsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('راتب شهري')).toBeInTheDocument()
    expect(screen.queryByText('مشتريات بقالة')).not.toBeInTheDocument()
  })
})

