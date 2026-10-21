import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DebtsPage } from './DebtsPage'
import type { Debt } from '../types'

vi.mock('../lib/firebase', () => ({
  db: {},
}))

const mockDebts: Debt[] = [
  {
    id: 'debt-1',
    personName: 'أحمد محمود',
    type: 'lent',
    amountFils: 100000,
    paidFils: 40000,
    startDate: new Date('2026-09-01'),
    dueDate: new Date('2026-11-01'),
    note: 'قرض مؤقت للمكتب',
    settled: false,
    payments: [],
    createdAt: new Date('2026-09-01'),
  },
  {
    id: 'debt-2',
    personName: 'خالد عبد الله',
    type: 'borrowed',
    amountFils: 50000,
    paidFils: 50000,
    startDate: new Date('2026-08-01'),
    dueDate: null,
    note: 'شراء حاسوب',
    settled: true,
    payments: [],
    createdAt: new Date('2026-08-01'),
  },
]

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

vi.mock('../hooks/useDebts', () => ({
  useDebts: () => ({
    data: mockDebts,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'JOD',
    config: { code: 'JOD', symbol: 'د.أ', decimals: 3 },
    format: (fils: number) => `${fils / 1000} د.أ`,
    formatWithSign: (fils: number) => `${fils / 1000} د.أ`,
  }),
}))

const mockShowToast = vi.fn()
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

vi.mock('../services/debts', () => ({
  deleteDebt: vi.fn().mockResolvedValue(undefined),
  addDebt: vi.fn().mockResolvedValue('new-debt-id'),
  updateDebt: vi.fn().mockResolvedValue(undefined),
  recordDebtPayment: vi.fn().mockResolvedValue('pay-id'),
  deleteDebtPayment: vi.fn().mockResolvedValue(undefined),
}))

describe('DebtsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input and debt cards', () => {
    render(<DebtsPage />)
    expect(screen.getByPlaceholderText(/ابحث باسم الشخص أو الملاحظة/i)).toBeInTheDocument()
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.getByText('خالد عبد الله')).toBeInTheDocument()
  })

  it('filters debts when typing a person name or note in search input', () => {
    render(<DebtsPage />)
    const searchInput = screen.getByPlaceholderText(/ابحث باسم الشخص أو الملاحظة/i) as HTMLInputElement

    fireEvent.change(searchInput, { target: { value: 'أحمد' } })
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.queryByText('خالد عبد الله')).not.toBeInTheDocument()

    // Search by note
    fireEvent.change(searchInput, { target: { value: 'حاسوب' } })
    expect(screen.queryByText('أحمد محمود')).not.toBeInTheDocument()
    expect(screen.getByText('خالد عبد الله')).toBeInTheDocument()
  })

  it('shows clear button (X) when search is active and clears search when clicked', () => {
    render(<DebtsPage />)
    const searchInput = screen.getByPlaceholderText(/ابحث باسم الشخص أو الملاحظة/i) as HTMLInputElement

    fireEvent.change(searchInput, { target: { value: 'أحمد' } })
    const clearBtn = screen.getByRole('button', { name: /مسح البحث/i })
    expect(clearBtn).toBeInTheDocument()

    fireEvent.click(clearBtn)
    expect(searchInput.value).toBe('')
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.getByText('خالد عبد الله')).toBeInTheDocument()
  })

  it('shows empty state with "مسح البحث" action when no results match and resets search', () => {
    render(<DebtsPage />)
    const searchInput = screen.getByPlaceholderText(/ابحث باسم الشخص أو الملاحظة/i) as HTMLInputElement

    fireEvent.change(searchInput, { target: { value: 'اسم_غير_موجود' } })
    expect(screen.getByText('لا توجد نتائج مطابقة لبحثك')).toBeInTheDocument()

    const resetButtons = screen.getAllByRole('button', { name: /مسح البحث/i })
    expect(resetButtons.length).toBeGreaterThanOrEqual(2)

    // Click the empty state action button
    fireEvent.click(resetButtons[1])
    expect(searchInput.value).toBe('')
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.getByText('خالد عبد الله')).toBeInTheDocument()
  })
})
