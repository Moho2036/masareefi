import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DashboardPage } from './DashboardPage'

let mockMonthStartDay = 1
let mockRangeStart = new Date(2026, 9, 1) // Oct 1, 2026
let mockRangeEnd = new Date(2026, 10, 1) // Nov 1, 2026
let mockRolloverBalanceFils = 50000
const mockGoToCurrentMonth = vi.fn()
const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockShowToast = vi.fn()

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

let mockUserSettingsData = {
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
    mockUserSettingsData = {
      monthStartDay: 1,
      rolloverBalance: true,
      openingBalanceFils: 0,
    }
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
    mockUserSettingsData.monthStartDay = 25

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // For Sep 25 - Oct 25 cycle, the previous cycle started Aug 25 and ended Sep 25
    // formatFinancialMonthLabel produces "أغسطس / سبتمبر 2026"
    expect(screen.getByText(/الرصيد المرحّل \(من شهر أغسطس \/ سبتمبر 2026\):/)).toBeInTheDocument()
  })

  it('displays "الرصيد التراكمي / الافتتاحي:" badge when openingBalanceFils is present', () => {
    mockUserSettingsData.openingBalanceFils = 20000
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/الرصيد التراكمي \/ الافتتاحي:/)).toBeInTheDocument()
  })

  it('greets user personally by name in header and renders settlement button', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/أهلاً بك، محمد/)).toBeInTheDocument()
    expect(screen.getByText('تسوية الرصيد')).toBeInTheDocument()
    expect(screen.getByText('ملخص الديون والالتزامات')).toBeInTheDocument()
  })

  it('shows warning banner when browsing a different month', () => {
    // Set range to January 2025 (in the past relative to 2026)
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

  it('opens reconciliation modal on clicking "تسوية الرصيد" and updates opening balance on confirm', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const reconcileBtn = screen.getByText('تسوية الرصيد')
    fireEvent.click(reconcileBtn)

    expect(screen.getByText('تسوية وتعديل الرصيد الفعلي')).toBeInTheDocument()
    expect(screen.getByText(/الرصيد المحسوب حالياً في التطبيق:/)).toBeInTheDocument()

    // Enter a new actual balance e.g. 70
    const input = screen.getByPlaceholderText('0.000')
    fireEvent.change(input, { target: { value: '70' } })

    const confirmBtn = screen.getByRole('button', { name: 'اعتماد التسوية' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      // 70 JOD = 70000 fils. Current display balance was 50000 fils. Difference is +20000.
      expect(mockUpdateSettings).toHaveBeenCalledWith({ openingBalanceFils: 20000 })
    })
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

  it('toggles pie chart type between expenses and income', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('المصاريف حسب التصنيف')).toBeInTheDocument()

    const incomeToggleBtn = screen.getByRole('button', { name: 'المداخيل' })
    fireEvent.click(incomeToggleBtn)

    expect(screen.getByText('المداخيل حسب التصنيف')).toBeInTheDocument()
  })

  it('displays "مسار مالي آمن" when transactions are 0 but rollover is positive', () => {
    mockRolloverBalanceFils = 50000
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText('مسار مالي آمن')).toBeInTheDocument()
  })
})
