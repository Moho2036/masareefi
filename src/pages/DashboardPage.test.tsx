import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DashboardPage } from './DashboardPage'
import { subscribePriorBalance } from '../services/transactions'
import type { Transaction, Category } from '../types'

let mockMonthStartDay = 1
let mockRangeStart = new Date(2026, 9, 1) // Oct 1, 2026
let mockRangeEnd = new Date(2026, 10, 1) // Nov 1, 2026
let mockRolloverBalanceFils = 50000
const mockGoToCurrentMonth = vi.fn()
const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockShowToast = vi.fn()

let mockTransactionsData: Transaction[] = []
let mockCategoriesData: Category[] = []

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

let mockUserSettingsData: {
  monthStartDay: number
  rolloverBalance: boolean
  openingBalanceFils: number
  rolloverStartDate?: string
  createdAt?: unknown
} = {
  monthStartDay: 1,
  rolloverBalance: true,
  openingBalanceFils: 0,
}

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

vi.mock('../context/AppDataContext', () => ({
  useAppData: () => ({
    rolloverBalanceFils: mockRolloverBalanceFils,
    categories: mockCategoriesData,
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
    goToCurrentMonth: mockGoToCurrentMonth,
    goToPreviousMonth: vi.fn(),
    goToNextMonth: vi.fn(),
  }),
}))

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: mockUserSettingsData,
    loading: false,
    updateSettings: mockUpdateSettings,
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

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
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
    data: mockTransactionsData,
    loading: false,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: mockCategoriesData,
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
    mockUserSettingsData = {
      monthStartDay: 1,
      rolloverBalance: true,
      openingBalanceFils: 0,
    }
    mockTransactionsData = []
    mockCategoriesData = []
  })

  it('renders dashboard with single month displayBalance when monthStartDay is 1', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('لوحة التحكم')).toBeInTheDocument()
    expect(screen.getByText('الرصيد المتاح')).toBeInTheDocument()
    expect(screen.getByText('صافي هذا الشهر:')).toBeInTheDocument()
    expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1)
    const heroCard = screen.getByText('الرصيد المتاح').closest('div[class*="rounded"]')!
    expect(heroCard).toHaveTextContent('50')
    expect(screen.queryByText(/الرصيد المرحّل/)).toBeNull()
    expect(screen.queryByText(/الرصيد التراكمي \/ الافتتاحي:/)).toBeNull()
  })

  it('formats dual-month displayBalance correctly when monthStartDay is 25', () => {
    mockMonthStartDay = 25
    // Cycle is September 25 to October 25
    mockRangeStart = new Date(2026, 8, 25)
    mockRangeEnd = new Date(2026, 9, 25)
    mockRolloverBalanceFils = 75000
    mockUserSettingsData.monthStartDay = 25

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('الرصيد المتاح')).toBeInTheDocument()
    expect(screen.getByText('صافي هذا الشهر:')).toBeInTheDocument()
    expect(screen.getAllByText('75').length).toBeGreaterThanOrEqual(1)
    const heroCard = screen.getByText('الرصيد المتاح').closest('div[class*="rounded"]')!
    expect(heroCard).toHaveTextContent('75')
    expect(screen.queryByText(/الرصيد المرحّل/)).toBeNull()
    expect(screen.queryByText(/الرصيد التراكمي \/ الافتتاحي:/)).toBeNull()
  })

  it('calculates displayBalance correctly when openingBalanceFils is present without showing badge', () => {
    mockRolloverBalanceFils = 0
    mockUserSettingsData.openingBalanceFils = 20000
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('الرصيد المتاح')).toBeInTheDocument()
    expect(screen.getByText('صافي هذا الشهر:')).toBeInTheDocument()
    expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(1)
    const heroCard = screen.getByText('الرصيد المتاح').closest('div[class*="rounded"]')!
    expect(heroCard).toHaveTextContent('20')
    expect(screen.queryByText(/الرصيد المرحّل/)).toBeNull()
    expect(screen.queryByText(/الرصيد التراكمي \/ الافتتاحي:/)).toBeNull()
  })

  it('greets user personally by name in header', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/أهلاً بك، محمد/)).toBeInTheDocument()
    expect(screen.getByText('ملخص الديون والالتزامات')).toBeInTheDocument()
  })

  it('shows warning banner when browsing a different month', () => {
    mockRangeStart = new Date(2025, 0, 1)
    mockRangeEnd = new Date(2025, 1, 1)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/أنت تستعرض حالياً بيانات شهر/)).toBeInTheDocument()
    const returnBtn = screen.getByRole('button', { name: /العودة إلى الشهر الحالي/ })
    expect(returnBtn).toBeInTheDocument()
    returnBtn.click()
    expect(mockGoToCurrentMonth).toHaveBeenCalled()
  })

  it('renders clickable income and expense links to /transactions?type=income and /transactions?type=expense', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const incomeLink = screen.getByTitle('عرض كافة معاملات الدخل')
    expect(incomeLink).toHaveAttribute('href', '/transactions?type=income')

    const expenseLink = screen.getByTitle('عرض كافة معاملات المصاريف')
    expect(expenseLink).toHaveAttribute('href', '/transactions?type=expense')
  })

  it('conditionally renders top expense categories card only when expense transactions exist', () => {
    // 1) When no expense transactions exist
    mockTransactionsData = []
    mockCategoriesData = []

    const { rerender } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.queryByText('أعلى مصاريف الشهر')).toBeNull()

    // 2) When expense transactions exist
    mockCategoriesData = [
      {
        id: 'cat-food',
        name: 'طعام ومشروبات',
        type: 'expense',
        icon: 'utensils',
        color: '#EF4444',
        archived: false,
        order: 1,
      },
    ]

    mockTransactionsData = [
      {
        id: 'tx-1',
        type: 'expense',
        amountFils: 30000,
        categoryId: 'cat-food',
        date: new Date(2026, 9, 5),
        note: 'مطعم',
        createdAt: new Date(2026, 9, 5),
      },
    ]

    rerender(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('أعلى مصاريف الشهر')).toBeInTheDocument()
    const topCard = screen.getByText('أعلى مصاريف الشهر').closest('div[class*="rounded"]')!
    expect(topCard).toHaveTextContent('طعام ومشروبات')
    expect(topCard).toHaveTextContent('30')
    expect(topCard).toHaveTextContent('100%')
  })

  it('does not leak openingBalanceFils into an empty historical month preceding createdAt', () => {
    mockRolloverBalanceFils = 0
    mockUserSettingsData = {
      monthStartDay: 1,
      rolloverBalance: true,
      openingBalanceFils: 50000,
      createdAt: new Date(2026, 9, 1), // Oct 2026
    }
    mockRangeStart = new Date(2025, 0, 1) // Jan 2025 (precedes createdAt)
    mockRangeEnd = new Date(2025, 1, 1)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // In Jan 2025 with no transactions, displayBalance should be 0, not 50.000 د.أ
    expect(screen.queryByText('50.000 د.أ')).toBeNull()
    expect(screen.queryByText(/الرصيد التراكمي \/ الافتتاحي:/)).toBeNull()
  })

  it('does not leak openingBalanceFils into a historical month when rollover is disabled', () => {
    mockUserSettingsData = {
      monthStartDay: 1,
      rolloverBalance: false,
      openingBalanceFils: 50000,
    }
    mockRangeStart = new Date(2025, 0, 1)
    mockRangeEnd = new Date(2025, 1, 1)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.queryByText('50.000 د.أ')).toBeNull()
    expect(screen.queryByText(/الرصيد التراكمي \/ الافتتاحي:/)).toBeNull()
  })

  it('does not leak openingBalanceFils into a historical month preceding rolloverStartDate and skips subscribePriorBalance', () => {
    mockUserSettingsData = {
      monthStartDay: 1,
      rolloverBalance: true,
      openingBalanceFils: 50000,
      rolloverStartDate: '2026-06-01',
    }
    mockRangeStart = new Date(2026, 0, 1) // Jan 2026 (precedes 2026-06-01)
    mockRangeEnd = new Date(2026, 1, 1)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.queryByText('50.000 د.أ')).toBeNull()
    expect(screen.queryByText(/الرصيد التراكمي \/ الافتتاحي:/)).toBeNull()
    // subscribePriorBalance should not be called when range.start <= parsedRolloverStartDate
    expect(subscribePriorBalance).not.toHaveBeenCalled()
  })
})
