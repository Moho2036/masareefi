import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ReportsPage } from './ReportsPage'
import type { Transaction } from '../types'

let mockIsCurrentMonth = true
const mockGoToCurrentMonth = vi.fn()
let mockTransactions: Transaction[] = []
let mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }

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
    data: mockTransactions,
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

  it('colors 0% savings rate in red when month has deficit (income 0, expense > 0)', () => {
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

    // Savings rate is %0, but since balance is -50 JOD, it must be red
    const rateEl = screen.getByText('%0')
    expect(rateEl).toHaveClass('text-red-500')
    expect(rateEl).not.toHaveClass('text-emerald-600')
  })

  it('colors 0% savings rate in gray when both income and expense are 0', () => {
    mockTransactions = []

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    // With 0 income and 0 expense, it should be neutral gray
    const rateEl = screen.getByText('%0')
    expect(rateEl).toHaveClass('text-slate-400')
    expect(rateEl).not.toHaveClass('text-red-500')
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
})
