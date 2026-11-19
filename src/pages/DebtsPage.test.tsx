import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { DebtsPage } from './DebtsPage'
import { deleteDebt, checkDebtInitialTransactionExists, mergePersonDebts } from '../services/debts'
import type { Debt } from '../types'

const renderDebtsPage = (initialEntries?: string[]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <DebtsPage />
    </MemoryRouter>
  )

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
    dueDate: new Date('2026-12-01'),
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
  {
    id: 'debt-3',
    personName: 'عمر ياسين',
    type: 'lent',
    amountFils: 30000,
    paidFils: 0,
    startDate: new Date('2026-07-01'),
    dueDate: null,
    note: 'دين بدون دفعات بعد',
    settled: false,
    payments: [],
    createdAt: new Date('2026-07-01'),
  },
]

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

let currentDebts = mockDebts

vi.mock('../hooks/useDebts', () => ({
  useDebts: () => ({
    data: currentDebts,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: { currency: 'JOD', monthStartDay: 1 },
    loading: false,
    updateSettings: vi.fn(),
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
  checkDebtInitialTransactionExists: vi.fn().mockResolvedValue(false),
  mergePersonDebts: vi.fn().mockResolvedValue('merged-debt-id'),
}))

describe('DebtsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentDebts = mockDebts
    vi.mocked(checkDebtInitialTransactionExists).mockResolvedValue(false)
  })

  it('renders search input and debt cards', () => {
    renderDebtsPage()
    expect(screen.getByPlaceholderText(/ابحث باسم الشخص أو الملاحظة/i)).toBeInTheDocument()
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.getByText('خالد عبد الله')).toBeInTheDocument()
  })

  it('filters debts when typing a person name or note in search input', () => {
    renderDebtsPage()
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
    renderDebtsPage()
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
    renderDebtsPage()
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

  it('opens delete confirmation modal with deleteTransactions checked by default to prevent orphaned records', async () => {
    renderDebtsPage()
    // Open debt dossier first
    fireEvent.click(screen.getByText('أحمد محمود'))
    // Click delete inside dossier
    const deleteBtn = screen.getByTitle('حذف هذا الدين')
    fireEvent.click(deleteBtn)

    const deleteDialog = await screen.findByRole('dialog', { name: /تأكيد حذف الدين/i })
    expect(deleteDialog).toBeInTheDocument()

    const toggle = within(deleteDialog).getByRole('switch', {
      name: /حذف المعاملات المالية المرتبطة بهذا الدين \(أصل الدين والدفعات\) من المحفظة أيضاً/i,
    })
    expect(toggle).toBeInTheDocument()
    expect(toggle.getAttribute('aria-checked')).toBe('true')

    // Click confirm delete inside the confirmation dialog
    const confirmBtn = within(deleteDialog).getByRole('button', { name: /^حذف الدين$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteDebt).toHaveBeenCalledWith('user-123', 'debt-1', { deleteTransactions: true })
    })
  })

  it('allows unchecking deleteTransactions and calls deleteDebt with deleteTransactions = false', async () => {
    renderDebtsPage()
    // Open debt dossier first
    fireEvent.click(screen.getByText('أحمد محمود'))
    // Click delete inside dossier
    const deleteBtn = screen.getByTitle('حذف هذا الدين')
    fireEvent.click(deleteBtn)

    const deleteDialog = await screen.findByRole('dialog', { name: /تأكيد حذف الدين/i })
    const toggle = within(deleteDialog).getByRole('switch', {
      name: /حذف المعاملات المالية المرتبطة بهذا الدين \(أصل الدين والدفعات\) من المحفظة أيضاً/i,
    })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    const confirmBtn = within(deleteDialog).getByRole('button', { name: /^حذف الدين$/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteDebt).toHaveBeenCalledWith('user-123', 'debt-1', { deleteTransactions: false })
    })
  })

  it('shows deleteTransactions checkbox for zero-payment debt when checkDebtInitialTransactionExists returns true', async () => {
    vi.mocked(checkDebtInitialTransactionExists).mockResolvedValue(true)

    renderDebtsPage()
    // debt-3 has paidFils: 0 and payments: [] (خالد عبد الله)
    fireEvent.click(screen.getByText('خالد عبد الله'))
    const deleteBtn = screen.getByTitle('حذف هذا الدين')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      const deleteDialog = screen.getByRole('dialog', { name: /تأكيد حذف الدين/i })
      const toggle = within(deleteDialog).getByRole('switch', {
        name: /حذف المعاملات المالية المرتبطة بهذا الدين \(أصل الدين والدفعات\) من المحفظة أيضاً/i,
      })
      expect(toggle).toBeInTheDocument()
    })
  })

  it('renders overdue count pill', () => {
    renderDebtsPage()
    expect(screen.getByRole('button', { name: /المتأخرة عن الموعد \(0\)/i })).toBeInTheDocument()
  })

  it('filters debts when searching by amount in Western or Eastern numerals', () => {
    renderDebtsPage()
    const searchInput = screen.getByPlaceholderText(/ابحث باسم الشخص أو الملاحظة/i) as HTMLInputElement

    // Remaining of debt-1 is 60 JOD (60000 fils)
    fireEvent.change(searchInput, { target: { value: '60' } })
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.queryByText('عمر ياسين')).not.toBeInTheDocument()

    // Search by Eastern Arabic digits for debt-3 (30 JOD = ٣٠)
    fireEvent.change(searchInput, { target: { value: '٣٠' } })
    expect(screen.getByText('عمر ياسين')).toBeInTheDocument()
    expect(screen.queryByText('أحمد محمود')).not.toBeInTheDocument()
  })

  it('allows merging multiple debts of the same person automatically', async () => {
    currentDebts = [
      ...mockDebts,
      {
        id: 'debt-4',
        personName: 'أحمد محمود',
        type: 'lent',
        amountFils: 20000,
        paidFils: 0,
        startDate: new Date('2026-09-15'),
        dueDate: null,
        note: 'سلفة إضافية',
        settled: false,
        payments: [],
        createdAt: new Date('2026-09-15'),
      },
    ]

    renderDebtsPage()

    const mergeBtn = screen.getByRole('button', { name: /دمج ديون.*أحمد محمود/i })
    expect(mergeBtn).toBeInTheDocument()
    fireEvent.click(mergeBtn)

    // Merge modal opens
    expect(screen.getByText(/تأكيد دمج سجلات الديون/i)).toBeInTheDocument()
    const confirmMergeBtn = screen.getByRole('button', { name: /تأكيد الدمج الموحد/i })
    fireEvent.click(confirmMergeBtn)

    await waitFor(() => {
      expect(mergePersonDebts).toHaveBeenCalledWith(
        'user-123',
        expect.arrayContaining([
          expect.objectContaining({ id: 'debt-1' }),
          expect.objectContaining({ id: 'debt-4' }),
        ])
      )
    })
  })

  it('initializes with typeFilter from URL search params (?type=lent) (GAP-03)', () => {
    renderDebtsPage(['/debts?type=lent'])
    // أحمد محمود is lent, خالد عبد الله is borrowed
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.queryByText('خالد عبد الله')).not.toBeInTheDocument()
  })
})
