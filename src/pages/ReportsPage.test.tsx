import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ReportsPage } from './ReportsPage'

let mockIsCurrentMonth = true
const mockGoToCurrentMonth = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

vi.mock('../context/AppDataContext', () => ({
  useAppData: () => ({
    rolloverBalanceFils: 0,
    categories: [],
    categoriesLoading: false,
    settings: { rolloverBalance: false, monthStartDay: 1 },
  }),
}))

vi.mock('../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    range: { start: new Date('2026-10-01'), end: new Date('2026-11-01') },
    monthLabel: 'أكتوبر 2026',
    rangeLabel: '',
    monthStartDay: 1,
    isCurrentMonth: mockIsCurrentMonth,
    goToCurrentMonth: mockGoToCurrentMonth,
    goToPreviousMonth: vi.fn(),
    goToNextMonth: vi.fn(),
  }),
}))

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: { monthStartDay: 1, rolloverBalance: false },
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
  subscribePriorBalance: vi.fn(() => vi.fn()),
}))

describe('ReportsPage month switching and period header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCurrentMonth = true
  })

  it('renders MonthSelector in header when monthly report tab is active', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // MonthSelector group is present
    expect(screen.getByRole('group', { name: 'اختيار الشهر المالي' })).toBeInTheDocument()
    expect(screen.getByText('أكتوبر 2026')).toBeInTheDocument()

    // When isCurrentMonth is true, "الشهر الحالي" button is hidden
    expect(screen.queryByTitle('العودة إلى الشهر الحالي')).not.toBeInTheDocument()
  })

  it('shows quick return button "الشهر الحالي" when not on current month and triggers goToCurrentMonth', () => {
    mockIsCurrentMonth = false

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    const returnBtn = screen.getByTitle('العودة إلى الشهر الحالي')
    expect(returnBtn).toBeInTheDocument()

    fireEvent.click(returnBtn)
    expect(mockGoToCurrentMonth).toHaveBeenCalledTimes(1)
  })

  it('switches to annual report and displays year select instead of MonthSelector', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Switch to yearly report
    const yearlyRadio = screen.getByRole('radio', { name: 'تقرير سنوي' })
    fireEvent.click(yearlyRadio)

    // MonthSelector is gone
    expect(screen.queryByRole('group', { name: 'اختيار الشهر المالي' })).not.toBeInTheDocument()

    // Year select dropdown is present
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})
