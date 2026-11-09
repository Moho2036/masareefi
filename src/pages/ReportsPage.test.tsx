import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ReportsPage } from './ReportsPage'
import type { Transaction } from '../types'
import { subscribePriorBalance } from '../services/transactions'

let mockIsCurrentMonth = true
const mockGoToCurrentMonth = vi.fn()
let mockTransactions: Transaction[] = []
let mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }
let mockCategories: Array<{ id: string; name: string; icon: string; color: string; isArchived: boolean }> = []
let mockUserSettings: {
  monthStartDay: number
  rolloverBalance: boolean
  openingBalanceFils?: number
  rolloverStartDate?: string
  createdAt?: unknown
} = {
  monthStartDay: 1,
  rolloverBalance: false,
  openingBalanceFils: 0,
}

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
    range: mockRange,
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
    data: mockUserSettings,
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

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({
    data: mockTransactions,
    loading: false,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: mockCategories,
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
    mockCategories = []
    mockTransactions = []
    mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }
    mockUserSettings = {
      monthStartDay: 1,
      rolloverBalance: false,
      openingBalanceFils: 0,
    }
  })

  it('renders period switcher in header when monthly report tab is active', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Period switcher is present with monthly active
    expect(screen.getByRole('radio', { name: 'تقرير شهري' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'تقرير سنوي' })).toBeInTheDocument()
    // Year select is not shown in monthly mode
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('switches to annual report and displays year select', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Switch to yearly report
    const yearlyRadio = screen.getByRole('radio', { name: 'تقرير سنوي' })
    fireEvent.click(yearlyRadio)

    // Year select dropdown is present
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('displays descriptive empty state subtext when current month has 0 expense or 0 income', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Subtext for 0 income
    expect(screen.getByText('لا توجد مداخيل مسجلة في هذا الشهر')).toBeInTheDocument()
    // Subtext for 0 expense
    expect(screen.getByText('لا توجد مصاريف مسجلة في هذا الشهر')).toBeInTheDocument()
  })

  it('shows neutral dash for savings rate when income is 0 and month has deficit (income 0, expense > 0)', () => {
    mockTransactions = [
      {
        id: 'tx-1',
        type: 'expense',
        amountFils: 50000,
        date: new Date('2026-10-15'),
        categoryId: 'cat-1',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // When income is 0 and expense > 0, savings rate is neutral dash '—' with explanatory subtext
    const rateEl = screen.getByText('—')
    expect(rateEl).toHaveClass('text-zinc-400')
    expect(screen.getByText('لا يوجد دخل مسجل لحساب النسبة')).toBeInTheDocument()
  })

  it('shows neutral dash for savings rate when both income and expense are 0', () => {
    mockTransactions = []

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // With 0 income and 0 expense, it should be neutral gray dash '—'
    const rateEl = screen.getByText('—')
    expect(rateEl).toHaveClass('text-zinc-400')
    expect(screen.getByText('من إجمالي الدخل المحصل')).toBeInTheDocument()
  })

  it('colors negative savings rate in red when month has deficit and income > 0', () => {
    mockTransactions = [
      {
        id: 'tx-inc',
        type: 'income',
        amountFils: 50000,
        date: new Date('2026-10-05'),
        categoryId: 'cat-sal',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-exp',
        type: 'expense',
        amountFils: 80000,
        date: new Date('2026-10-15'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Income 50k, expense 80k -> balance -30k, savings rate is %-60, colored in red
    const rateEl = screen.getByText('%-60')
    expect(rateEl).toHaveClass('text-red-500')
    expect(rateEl).not.toHaveClass('text-emerald-600')
  })

  it('colors savings rate in green when balance >= 0 and income > 0', () => {
    mockTransactions = [
      {
        id: 'tx-inc',
        type: 'income',
        amountFils: 100000,
        date: new Date('2026-10-05'),
        categoryId: 'cat-sal',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-exp',
        type: 'expense',
        amountFils: 40000,
        date: new Date('2026-10-15'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // 100k income, 40k expense -> savings rate 60%
    const rateEl = screen.getByText('%60')
    expect(rateEl).toHaveClass('text-emerald-600')
    expect(rateEl).not.toHaveClass('text-red-500')
  })

  it('displays neutral "مساوٍ للشهر السابق (0%)" when current and previous month expenses are equal', () => {
    mockTransactions = [
      // Previous month (September 2026) expense: 50 JOD
      {
        id: 'tx-prev',
        type: 'expense',
        amountFils: 50000,
        date: new Date('2026-09-15'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
      // Current month (October 2026) expense: 50 JOD
      {
        id: 'tx-curr',
        type: 'expense',
        amountFils: 50000,
        date: new Date('2026-10-15'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Should display "مساوٍ للشهر السابق (0%)"
    expect(screen.getByText('مساوٍ للشهر السابق (0%)')).toBeInTheDocument()
    expect(screen.queryByText(/أقل بـ 0%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/أكثر بـ 0%/)).not.toBeInTheDocument()
  })

  it('includes older year from range.start in yearOptions when switching to annual report', () => {
    // Browsing a month in 2020
    mockRange = { start: new Date('2020-05-01'), end: new Date('2020-06-01') }

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Switch to yearly report
    const yearlyRadio = screen.getByRole('radio', { name: 'تقرير سنوي' })
    fireEvent.click(yearlyRadio)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('2020')

    const option2020 = screen.getByRole('option', { name: 'سنة 2020' })
    expect(option2020).toBeInTheDocument()
  })

  it('expands yearOptions to cover historical years and includes user account creation year', () => {
    mockUserSettings = {
      ...mockUserSettings,
      createdAt: new Date('2021-03-15'),
    }

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    const yearlyRadio = screen.getByRole('radio', { name: 'تقرير سنوي' })
    fireEvent.click(yearlyRadio)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)

    // Based on user creation in 2021 and current year 2026, includes 2027 down to 2021 (7 years)
    expect(options.length).toBe(7)
    expect(options).toContain('2021')
    expect(options).toContain('2027')
  })

  it('does not generate 10+ arbitrary historical years for newly registered users', () => {
    mockUserSettings = {
      ...mockUserSettings,
      createdAt: new Date('2026-05-10'),
    }

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    const yearlyRadio = screen.getByRole('radio', { name: 'تقرير سنوي' })
    fireEvent.click(yearlyRadio)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)

    // For a user created in 2026, options span only [2027, 2026]
    expect(options.length).toBeLessThan(5)
    expect(options).toContain('2026')
    expect(options).toContain('2027')
  })

  it('renders print button in header', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /طباعة \/ حفظ PDF/ })).toBeInTheDocument()
  })

  it('renders DailyExpenseChart card and zero spend days badge in monthly report', () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('المصروف اليومي خلال الشهر')).toBeInTheDocument()
    expect(screen.getByText(/أيام بدون مصاريف:/)).toBeInTheDocument()
  })

  it('toggles between expenses and income category analysis in monthly report', () => {
    mockCategories = [
      { id: 'cat-food', name: 'طعام ومشروبات', icon: '🍔', color: '#10b981', isArchived: false },
      { id: 'cat-sal', name: 'راتب شهري', icon: '💰', color: '#3b82f6', isArchived: false },
    ]
    mockTransactions = [
      {
        id: 'tx-1',
        type: 'expense',
        amountFils: 25000,
        date: new Date('2026-10-05'),
        categoryId: 'cat-food',
        note: 'غداء عمل',
        createdAt: new Date(),
      },
      {
        id: 'tx-2',
        type: 'income',
        amountFils: 500000,
        date: new Date('2026-10-01'),
        categoryId: 'cat-sal',
        note: 'راتب أكتوبر',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Initially in expense mode
    expect(screen.getByText('أعلى التصنيفات إنفاقاً')).toBeInTheDocument()
    expect(screen.getAllByText('طعام ومشروبات').length).toBeGreaterThan(0)

    // Switch to income mode
    const incomeRadios = screen.getAllByRole('radio', { name: 'المداخيل' })
    fireEvent.click(incomeRadios[0])

    expect(screen.getByText('أعلى التصنيفات دخلاً')).toBeInTheDocument()
    expect(screen.getAllByText('راتب شهري').length).toBeGreaterThan(0)
  })

  it('opens Category Transactions Modal when a category row is clicked', () => {
    mockCategories = [
      { id: 'cat-food', name: 'طعام ومشروبات', icon: '🍔', color: '#10b981', isArchived: false },
    ]
    mockTransactions = [
      {
        id: 'tx-1',
        type: 'expense',
        amountFils: 12500,
        date: new Date('2026-10-10'),
        categoryId: 'cat-food',
        note: 'مطعم السعادة',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    const categoryRow = screen.getByRole('button', { name: /طعام ومشروبات/ })
    fireEvent.click(categoryRow)

    // Modal opens showing category transactions
    expect(screen.getByText('مطعم السعادة')).toBeInTheDocument()
    expect(screen.getAllByText('12.5 د.أ').length).toBeGreaterThan(0)
  })

  it('displays current fiscal month badge and sticky total footer in annual report', () => {
    mockTransactions = [
      {
        id: 'tx-annual-1',
        type: 'expense',
        amountFils: 30000,
        date: new Date('2026-10-05'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-annual-2',
        type: 'income',
        amountFils: 80000,
        date: new Date('2026-10-01'),
        categoryId: 'cat-sal',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Switch to yearly report
    const yearlyRadio = screen.getByRole('radio', { name: 'تقرير سنوي' })
    fireEvent.click(yearlyRadio)

    // Check for "الشهر الحالي" badge in the table
    expect(screen.getByText('الشهر الحالي')).toBeInTheDocument()

    // Check for "الإجمالي السنوي" in tfoot
    expect(screen.getByText('الإجمالي السنوي')).toBeInTheDocument()
  })

  it('does not leak openingBalanceFils into an empty historical month preceding createdAt', () => {
    mockIsCurrentMonth = false
    mockRange = { start: new Date('2025-01-01'), end: new Date('2025-02-01') }
    mockUserSettings = {
      monthStartDay: 1,
      rolloverBalance: true,
      openingBalanceFils: 50000,
      createdAt: new Date('2026-10-01'),
    }

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // The subline "صافي الشهر المستقل (الرصيد المتاح مع المرحّل: ...)" should not appear
    expect(screen.queryByText(/الرصيد المتاح مع المرحّل/)).toBeNull()
    expect(screen.getByText('المبلغ المتبقي من دخل هذا الشهر بعد المصاريف')).toBeInTheDocument()
  })

  it('does not leak openingBalanceFils into a historical month when rollover is disabled', () => {
    mockIsCurrentMonth = false
    mockRange = { start: new Date('2025-01-01'), end: new Date('2025-02-01') }
    mockUserSettings = {
      monthStartDay: 1,
      rolloverBalance: false,
      openingBalanceFils: 50000,
    }

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    expect(screen.queryByText(/الرصيد المتاح مع المرحّل/)).toBeNull()
    expect(screen.getByText('المبلغ المتبقي من دخل هذا الشهر بعد المصاريف')).toBeInTheDocument()
  })

  it('does not leak openingBalanceFils into a historical month preceding rolloverStartDate and skips subscribePriorBalance', () => {
    mockIsCurrentMonth = false
    mockRange = { start: new Date('2026-01-01'), end: new Date('2026-02-01') }
    mockUserSettings = {
      monthStartDay: 1,
      rolloverBalance: true,
      openingBalanceFils: 50000,
      rolloverStartDate: '2026-06-01',
    }

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    expect(screen.queryByText(/الرصيد المتاح مع المرحّل/)).toBeNull()
    expect(screen.getByText('المبلغ المتبقي من دخل هذا الشهر بعد المصاريف')).toBeInTheDocument()
    expect(subscribePriorBalance).not.toHaveBeenCalled()
  })

  it('displays decimal percentage change for slight expense difference and does not show 0%', () => {
    mockTransactions = [
      {
        id: 'tx-prev',
        type: 'expense',
        amountFils: 1000000, // 1000 JOD in September
        date: new Date('2026-09-15'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-curr',
        type: 'expense',
        amountFils: 1004000, // 1004 JOD in October (+0.4%)
        date: new Date('2026-10-15'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // Should display 'أكثر بـ 0.4% عن الشهر السابق'
    expect(screen.getByText(/أكثر بـ 0\.4% عن الشهر السابق/)).toBeInTheDocument()
    expect(screen.queryByText('مساوٍ للشهر السابق (0%)')).toBeNull()
  })

  it('displays "لا يوجد دخل مسجل لحساب النسبة" in savings rate card when income is 0 and expenses > 0', () => {
    mockTransactions = [
      {
        id: 'tx-curr-exp',
        type: 'expense',
        amountFils: 50000,
        date: new Date('2026-10-15'),
        categoryId: 'cat-food',
        note: '',
        createdAt: new Date(),
      },
    ]

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('لا يوجد دخل مسجل لحساب النسبة')).toBeInTheDocument()
    expect(screen.queryByText('من إجمالي الدخل المحصل')).toBeNull()
  })
})
