import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ToolsPage } from './ToolsPage'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
    loading: false,
  }),
}))

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'JOD',
    config: { code: 'JOD', label: 'دينار أردني', symbol: 'د.أ', decimals: 3 },
    format: (fils: number) => `${(fils / 1000).toFixed(2)} د.أ`,
    formatInput: (fils: number) => `${(fils / 1000).toFixed(2)}`,
    parseInput: (val: string) => Math.round(parseFloat(val || '0') * 1000),
  }),
}))

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
    data: [],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: [],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('../components/tools/MoneyCirclesManager', () => ({
  MoneyCirclesManager: () => <div data-testid="money-circles-manager">محتوى أداة الجمعيات</div>,
}))

vi.mock('../components/tools/WorkHoursCalculator', () => ({
  WorkHoursCalculator: () => (
    <div data-testid="work-hours-calculator">بيانات العمل والراتب</div>
  ),
}))

describe('ToolsPage Component', () => {
  it('renders tools catalog directory when no tool parameter is set', () => {
    render(
      <MemoryRouter initialEntries={['/tools']}>
        <ToolsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('مركز الأدوات المالية')).toBeInTheDocument()
    expect(screen.getByText('الجمعيات والصناديق المشتركة')).toBeInTheDocument()
    expect(screen.getByText('تكلفة الشراء بساعات العمل')).toBeInTheDocument()
    expect(screen.getByText('فتح أداة الجمعيات')).toBeInTheDocument()
    expect(screen.getByText('فتح حاسبة ساعات العمل')).toBeInTheDocument()
  })

  it('renders dedicated Money Circles view when ?tool=circles', () => {
    render(
      <MemoryRouter initialEntries={['/tools?tool=circles']}>
        <ToolsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('العودة إلى قائمة الأدوات')).toBeInTheDocument()
    expect(screen.getByText('أداة الجمعيات والصناديق المشتركة')).toBeInTheDocument()
  })

  it('renders dedicated Work Hours Calculator view when ?tool=work_hours', () => {
    render(
      <MemoryRouter initialEntries={['/tools?tool=work_hours']}>
        <ToolsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('العودة إلى قائمة الأدوات')).toBeInTheDocument()
    expect(screen.getByText('حاسبة الشراء بساعات العمل')).toBeInTheDocument()
    expect(screen.getByText('بيانات العمل والراتب')).toBeInTheDocument()
  })

  it('navigates to tool and can go back to directory', () => {
    render(
      <MemoryRouter initialEntries={['/tools']}>
        <ToolsPage />
      </MemoryRouter>
    )

    // Initially in directory
    expect(screen.getByText('مركز الأدوات المالية')).toBeInTheDocument()

    // Open circles tool
    const openCirclesBtn = screen.getByText('فتح أداة الجمعيات')
    fireEvent.click(openCirclesBtn)

    // Should now show back button and dedicated view
    const backBtn = screen.getByText('العودة إلى قائمة الأدوات')
    expect(backBtn).toBeInTheDocument()

    // Click back button
    fireEvent.click(backBtn)

    // Should return to directory
    expect(screen.getByText('مركز الأدوات المالية')).toBeInTheDocument()
  })
})
