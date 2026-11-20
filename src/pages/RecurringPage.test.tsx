import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecurringPage } from './RecurringPage'
import type { Recurring, Category, MoneyCircle } from '../types'

let mockRecurring: Recurring[] = []
const mockCategories: Category[] = [
  { id: 'cat-1', name: 'اشتراك نت', type: 'expense', icon: '🌐', color: '#3B82F6', archived: false, order: 0 },
  { id: 'cat-2', name: 'راتب', type: 'income', icon: '💼', color: '#10B981', archived: false, order: 1 },
]
const mockCircles: MoneyCircle[] = []

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({ data: { monthStartDay: 1 } }),
}))

vi.mock('../hooks/useRecurring', () => ({
  useRecurring: () => ({ data: mockRecurring, loading: false }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: mockCategories }),
}))

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({ data: mockCircles }),
}))

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'JOD',
    config: { code: 'JOD', symbol: 'د.أ', decimals: 3 },
    format: (f: number) => `${f / 1000} د.أ`,
    formatWithSign: (f: number) => `${f / 1000} د.أ`,
  }),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({ data: [], loading: false, error: null }),
}))

vi.mock('../services/recurring', () => ({
  addRecurring: vi.fn(),
  updateRecurring: vi.fn(),
  deleteRecurring: vi.fn(),
  processDueRecurring: vi.fn(),
  confirmRecurringOccurrence: vi.fn(),
  skipRecurringOccurrence: vi.fn(),
}))

describe('RecurringPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRecurring = []
  })

  it('renders empty state when no recurring items exist', () => {
    render(<RecurringPage />)
    expect(screen.getByText('لا توجد معاملات متكررة')).toBeInTheDocument()
  })

  it('sorts recurring items: active first, paused last; within each group, nextDate ascending (closest first)', () => {
    const rActiveFar: Recurring = {
      id: 'rec-active-far',
      type: 'expense',
      amountFils: 10000,
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: new Date('2026-12-01'),
      active: true,
      title: 'نشط بعيد',
      note: '',
      createdAt: new Date('2026-01-01'),
    }
    const rActiveNear: Recurring = {
      id: 'rec-active-near',
      type: 'expense',
      amountFils: 20000,
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: new Date('2026-03-01'),
      active: true,
      title: 'نشط قريب',
      note: '',
      createdAt: new Date('2026-01-01'),
    }
    const rPausedNear: Recurring = {
      id: 'rec-paused-near',
      type: 'income',
      amountFils: 50000,
      categoryId: 'cat-2',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: new Date('2026-04-01'),
      active: false,
      title: 'متوقف قريب',
      note: '',
      createdAt: new Date('2026-01-01'),
    }
    const rPausedFar: Recurring = {
      id: 'rec-paused-far',
      type: 'income',
      amountFils: 60000,
      categoryId: 'cat-2',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: new Date('2026-11-01'),
      active: false,
      title: 'متوقف بعيد',
      note: '',
      createdAt: new Date('2026-01-01'),
    }

    // Pass in mixed order
    mockRecurring = [rPausedFar, rActiveFar, rPausedNear, rActiveNear]
    render(<RecurringPage />)

    // Expected order:
    // 1. نشط قريب (active, nextDate: March)
    // 2. نشط بعيد (active, nextDate: Dec)
    // 3. متوقف قريب (paused, nextDate: April)
    // 4. متوقف بعيد (paused, nextDate: Nov)
    const el1 = screen.getByText('نشط قريب')
    const el2 = screen.getByText('نشط بعيد')
    const el3 = screen.getByText('متوقف قريب')
    const el4 = screen.getByText('متوقف بعيد')

    expect(el1.compareDocumentPosition(el2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(el2.compareDocumentPosition(el3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(el3.compareDocumentPosition(el4) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('displays pending confirmation badge and action buttons when requireConfirmation is true and due', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const rConfirmDue: Recurring = {
      id: 'rec-due-conf',
      type: 'expense',
      amountFils: 45000,
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: yesterday,
      active: true,
      title: 'فاتورة الكهرباء',
      note: 'متغيرة',
      requireConfirmation: true,
      createdAt: new Date('2026-01-01'),
    }

    mockRecurring = [rConfirmDue]
    render(<RecurringPage />)

    expect(screen.getByText('بانتظار تأكيدك')).toBeInTheDocument()
    expect(screen.getByText('هذه الدفعة مستحقة وبانتظار تأكيدك')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /تأكيد وتسجيل الآن/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /تخطي/i })).toBeInTheDocument()
  })

  it('calculates due within 7 days stats accurately by excluding overdue transactions and skipped circle occurrences', () => {
    const today = new Date()
    const in3Days = new Date(today)
    in3Days.setDate(today.getDate() + 3)

    const overdue20Days = new Date(today)
    overdue20Days.setDate(today.getDate() - 20)

    const rUpcoming: Recurring = {
      id: 'rec-upcoming',
      type: 'expense',
      amountFils: 25000,
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: in3Days,
      active: true,
      title: 'فاتورة قادمة',
      note: '',
      createdAt: new Date('2026-01-01'),
    }

    const rOverdue: Recurring = {
      id: 'rec-overdue',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: overdue20Days,
      active: true,
      title: 'فاتورة متأخرة قديمة',
      note: '',
      createdAt: new Date('2026-01-01'),
    }

    mockRecurring = [rUpcoming, rOverdue]
    render(<RecurringPage />)

    // Only rUpcoming (25.000 د.أ) should be counted in 7 days, rOverdue should be excluded!
    expect(screen.getAllByText('25').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('دفعة واحدة قادمة')).toBeInTheDocument()
  })

  it('instantly updates toggle active button text inside details modal without closing', async () => {
    const item: Recurring = {
      id: 'rec-toggle-test',
      type: 'expense',
      amountFils: 30000,
      categoryId: 'cat-1',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: new Date('2026-12-01'),
      active: true,
      title: 'اشتراك شهري قابل للإيقاف',
      note: '',
      createdAt: new Date('2026-01-01'),
    }

    mockRecurring = [item]
    render(<RecurringPage />)

    // Click on the recurring card to open details modal
    fireEvent.click(screen.getByText('اشتراك شهري قابل للإيقاف'))

    // The modal is open, and toggle button currently says "إيقاف مؤقت"
    const pauseBtn = screen.getByRole('button', { name: /إيقاف مؤقت/i })
    expect(pauseBtn).toBeInTheDocument()

    // Click pause
    fireEvent.click(pauseBtn)

    // The button immediately updates to "تفعيل" without closing the modal
    expect(screen.getByRole('button', { name: /تفعيل/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /إيقاف مؤقت/i })).not.toBeInTheDocument()

    // Click activate
    const activateBtn = screen.getByRole('button', { name: /تفعيل/i })
    fireEvent.click(activateBtn)

    // The button immediately updates back to "إيقاف مؤقت"
    expect(screen.getByRole('button', { name: /إيقاف مؤقت/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /تفعيل/i })).not.toBeInTheDocument()
  })
})
