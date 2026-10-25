import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DashboardPage } from './DashboardPage'

let mockMonthStartDay = 1
let mockRangeStart = new Date(2026, 9, 1) // Oct 1, 2026
let mockRangeEnd = new Date(2026, 10, 1) // Nov 1, 2026
let mockRolloverBalanceFils = 50000

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

vi.mock('../context/AppDataContext', () => ({
  useAppData: () => ({
    rolloverBalanceFils: mockRolloverBalanceFils,
    categories: [],
    categoriesLoading: false,
    settings: { rolloverBalance: true, monthStartDay: mockMonthStartDay },
  }),
}))

vi.mock('../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    range: { start: mockRangeStart, end: mockRangeEnd },
    monthLabel: 'أكتوبر 2026',
    rangeLabel: '',
    monthStartDay: mockMonthStartDay,
    isCurrentMonth: true,
    goToCurrentMonth: vi.fn(),
    goToPreviousMonth: vi.fn(),
    goToNextMonth: vi.fn(),
  }),
}))

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: { monthStartDay: mockMonthStartDay, rolloverBalance: true },
    loading: false,
  }),
}))

vi.mock('../hooks/useDebts', () => ({
  useDebts: () => ({
    data: [],
    loading: false,
  }),
}))

vi.mock('../hooks/useRecurring', () => ({
  useRecurring: () => ({
    data: [],
    loading: false,
  }),
}))

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (val: number) => `${val / 1000} د.أ`,
    formatWithSign: (val: number, type: string) => `${type === 'expense' ? '-' : '+'}${val / 1000} د.أ`,
    config: { code: 'JOD', symbol: 'د.أ', decimals: 3 },
  }),
}))

vi.mock('../hooks/useTransactionModal', () => ({
  useTransactionModal: () => ({
    openAdd: vi.fn(),
    openEdit: vi.fn(),
    close: vi.fn(),
  }),
}))

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({
    data: [],
    loading: false,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: [],
    loading: false,
  }),
}))

vi.mock('../services/transactions', () => ({
  subscribePriorBalance: vi.fn((_uid: string, _date: Date, cb: (bal: number) => void) => {
    cb(mockRolloverBalanceFils)
    return vi.fn()
  }),
}))

describe('DashboardPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMonthStartDay = 1
    mockRangeStart = new Date(2026, 9, 1)
    mockRangeEnd = new Date(2026, 10, 1)
    mockRolloverBalanceFils = 50000
  })

  it('renders dashboard with single month prevMonthLabel when monthStartDay is 1', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('لوحة التحكم')).toBeInTheDocument()
    // For October 2026 with monthStartDay = 1, previous month is September 2026
    expect(screen.getByText(/الرصيد المرحّل \(من شهر سبتمبر 2026\):/)).toBeInTheDocument()
  })

  it('formats dual-month prevMonthLabel correctly when monthStartDay is 25', () => {
    mockMonthStartDay = 25
    // Cycle is September 25 to October 25
    mockRangeStart = new Date(2026, 8, 25)
    mockRangeEnd = new Date(2026, 9, 25)
    mockRolloverBalanceFils = 75000

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // For Sep 25 - Oct 25 cycle, the previous cycle started Aug 25 and ended Sep 25
    // formatFinancialMonthLabel produces "أغسطس / سبتمبر 2026"
    expect(screen.getByText(/الرصيد المرحّل \(من شهر أغسطس \/ سبتمبر 2026\):/)).toBeInTheDocument()
  })
})
