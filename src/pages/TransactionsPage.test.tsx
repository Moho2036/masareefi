import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TransactionsPage } from './TransactionsPage'
import * as exportCsvModule from '../lib/exportCsv'
import type { Transaction, Category } from '../types'

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

const mockCategories: Category[] = [
  { id: 'c-food', name: 'طعام وبقالة', type: 'expense', icon: '🛒', color: '#F59E0B', archived: false, order: 0 },
  { id: 'c-salary', name: 'راتب', type: 'income', icon: '💼', color: '#10B981', archived: false, order: 1 },
]

let mockTransactions: Transaction[] = []
let mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }

vi.mock('../services/transactions', () => ({
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
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
  useTransactions: () => ({
    data: mockTransactions,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    range: mockRange,
    selectedDate: mockRange.start,
    setSelectedDate: vi.fn(),
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
    mockTransactions = []
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
})
