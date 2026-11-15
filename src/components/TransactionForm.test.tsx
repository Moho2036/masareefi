import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TransactionForm } from './TransactionForm'
import * as txServices from '../services/transactions'
import * as recurringServices from '../services/recurring'
import * as debtServices from '../services/debts'
import type { Transaction, Debt, MoneyCircle } from '../types'

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

vi.mock('../services/transactions', () => ({
  addTransaction: vi.fn().mockResolvedValue('mock-id'),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
  subscribeTransactions: vi.fn(() => vi.fn()),
}))

vi.mock('../services/recurring', () => ({
  addRecurring: vi.fn().mockResolvedValue('mock-rec-id'),
  processDueRecurring: vi.fn().mockResolvedValue(1),
  subscribeRecurring: vi.fn(() => vi.fn()),
}))

vi.mock('../services/debts', () => ({
  updateDebtPayment: vi.fn().mockResolvedValue(undefined),
  removeDebtPayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/moneyCircles', () => ({
  removeCircleInstallmentPayment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
    loading: false,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: [
      { id: 'c-food', name: 'طعام وبقالة', type: 'expense', icon: '🛒', color: '#F59E0B', archived: false, order: 0 },
      { id: 'c-fuel', name: 'وقود ومواصلات', type: 'expense', icon: '⛽', color: '#3B82F6', archived: false, order: 1 },
      { id: 'c-salary', name: 'راتب', type: 'income', icon: '💼', color: '#10B981', archived: false, order: 2 },
      { id: 'c-archived-gym', name: 'جيم ورياضة', type: 'expense', icon: '🏋️', color: '#EF4444', archived: true, order: 3 },
    ],
    loading: false,
    error: null,
  }),
}))

const mockShowToast = vi.fn()
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
    toasts: [],
    dismissToast: vi.fn(),
  }),
}))

let mockDebts: Debt[] = [
  {
    id: 'debt123',
    personName: 'أبو أحمد',
    type: 'lent' as const,
    amountFils: 50000,
    paidFils: 0,
    settled: false,
    startDate: new Date('2026-10-10T00:00:00Z'),
    note: '',
    payments: [],
    createdAt: new Date('2026-10-10T00:00:00Z'),
  },
  {
    id: 'debt_with_pay',
    personName: 'سمير',
    type: 'lent' as const,
    amountFils: 60000,
    paidFils: 20000,
    settled: false,
    startDate: new Date('2026-10-01T00:00:00Z'),
    note: '',
    payments: [
      {
        id: 'pay_123',
        amountFils: 20000,
        date: new Date('2026-10-05T00:00:00Z'),
        transactionId: 'debt_pay_pay_123',
        createdAt: new Date('2026-10-05T00:00:00Z'),
      },
    ],
    createdAt: new Date('2026-10-01T00:00:00Z'),
  },
]

let mockCircles: MoneyCircle[] = [
  {
    id: 'circle-789',
    name: 'جمعية الأقارب',
    monthlyAmountFils: 50000,
    membersCount: 10,
    totalAmountFils: 500000,
    myTurnMonth: 1,
    startDate: new Date('2026-10-01T00:00:00Z'),
    members: [],
    status: 'active' as const,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  },
]

vi.mock('../hooks/useDebts', () => ({
  useDebts: () => ({
    data: mockDebts,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
    data: mockCircles,
    loading: false,
    error: null,
  }),
}))

let mockRange = { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) }
const mockSetSelectedDate = vi.fn()

vi.mock('../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    selectedDate: new Date(2026, 9, 1),
    setSelectedDate: mockSetSelectedDate,
    range: mockRange,
  }),
}))

describe('TransactionForm Component', () => {
  beforeEach(() => {
    mockDebts = [
      {
        id: 'debt123',
        personName: 'أبو أحمد',
        type: 'lent' as const,
        amountFils: 50000,
        paidFils: 0,
        settled: false,
        startDate: new Date('2026-10-10T00:00:00Z'),
        note: '',
        payments: [],
        createdAt: new Date('2026-10-10T00:00:00Z'),
      },
      {
        id: 'debt_with_pay',
        personName: 'سمير',
        type: 'lent' as const,
        amountFils: 60000,
        paidFils: 20000,
        settled: false,
        startDate: new Date('2026-10-01T00:00:00Z'),
        note: '',
        payments: [
          {
            id: 'pay_123',
            amountFils: 20000,
            date: new Date('2026-10-05T00:00:00Z'),
            transactionId: 'debt_pay_pay_123',
            createdAt: new Date('2026-10-05T00:00:00Z'),
          },
        ],
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]
    mockCircles = [
      {
        id: 'circle-789',
        name: 'جمعية الأقارب',
        monthlyAmountFils: 50000,
        membersCount: 10,
        totalAmountFils: 500000,
        myTurnMonth: 1,
        startDate: new Date('2026-10-01T00:00:00Z'),
        members: [],
        status: 'active' as const,
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]
    mockRange = { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) }
    vi.clearAllMocks()
  })

  it('shows Arabic error validation when submitting without entering amount or 0', async () => {
    const onClose = vi.fn()
    renderWithRouter(<TransactionForm onClose={onClose} />)

    // Attempt to submit with empty amount
    const submitBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(submitBtn)

    expect(
      await screen.findByText('يرجى إدخال مبلغ صحيح أكبر من الصفر')
    ).toBeInTheDocument()
    expect(txServices.addTransaction).not.toHaveBeenCalled()
  })

  it('successfully submits valid transaction and calls addTransaction', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    renderWithRouter(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

    // Enter valid amount (e.g. 15.5 JOD = 15500 fils)
    const amountInput = screen.getByPlaceholderText('0.000')
    fireEvent.change(amountInput, { target: { value: '15.5' } })

    // Select category (طعام وبقالة)
    const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
    fireEvent.click(foodCatBtn)

    // Enter optional note (expand if collapsed)
    const addNoteBtn = screen.queryByRole('button', { name: /إضافة ملاحظة/ })
    if (addNoteBtn) fireEvent.click(addNoteBtn)
    const noteInput = screen.getByPlaceholderText('مثال: غداء مع الأصدقاء')
    fireEvent.change(noteInput, { target: { value: 'غداء عمل' } })

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(txServices.addTransaction).toHaveBeenCalledTimes(1)
      expect(txServices.addTransaction).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'expense',
          amountFils: 15500,
          categoryId: 'c-food',
          note: 'غداء عمل',
        })
      )
      expect(onClose).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('prefills fields and supports editing existing transaction', async () => {
    const onClose = vi.fn()
    const existingTx = {
      id: 'tx-existing',
      type: 'expense' as const,
      amountFils: 50000,
      categoryId: 'c-fuel',
      date: new Date('2026-10-04T00:00:00Z'),
      note: 'تعبئة بنزين',
      createdAt: new Date('2026-10-04T00:00:00Z'),
    }

    renderWithRouter(<TransactionForm initialTransaction={existingTx} onClose={onClose} />)

    expect(screen.getByDisplayValue('50')).toBeInTheDocument()
    expect(screen.getByDisplayValue('تعبئة بنزين')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تعديل المعاملة' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()
  })

  it('creates recurring transaction when recurring toggle is enabled', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    renderWithRouter(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

    const amountInput = screen.getByPlaceholderText('0.000')
    fireEvent.change(amountInput, { target: { value: '25' } })

    const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
    fireEvent.click(foodCatBtn)

    // Toggle recurring switch
    const recurringSwitch = screen.getByRole('switch')
    fireEvent.click(recurringSwitch)

    // Verify frequency selector appears
    expect(screen.getByText('دورية التكرار')).toBeInTheDocument()

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.addRecurring).toHaveBeenCalledTimes(1)
      expect(recurringServices.addRecurring).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'expense',
          amountFils: 25000,
          categoryId: 'c-food',
          frequency: 'monthly',
          active: true,
        })
      )
      expect(recurringServices.processDueRecurring).toHaveBeenCalledWith('user-123')
      expect(txServices.addTransaction).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('allows selecting extra frequencies (e.g. biweekly) from "أخرى ▾" dropdown when recurring is enabled', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    renderWithRouter(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

    const amountInput = screen.getByPlaceholderText('0.000')
    fireEvent.change(amountInput, { target: { value: '40' } })

    const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
    fireEvent.click(foodCatBtn)

    // Toggle recurring switch
    const recurringSwitch = screen.getByRole('switch')
    fireEvent.click(recurringSwitch)

    // Click "أخرى ▾"
    const otherBtn = screen.getByRole('radio', { name: /أخرى/ })
    fireEvent.click(otherBtn)

    // Select "كل أسبوعين"
    const biweeklyBtn = screen.getByRole('button', { name: /كل أسبوعين/ })
    fireEvent.click(biweeklyBtn)

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.addRecurring).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'expense',
          amountFils: 40000,
          categoryId: 'c-food',
          frequency: 'biweekly',
          active: true,
        })
      )
    })
  })

  it('initializes date to range.start when current time is outside the selected financial range', () => {
    mockRange = { start: new Date('2025-01-25'), end: new Date('2025-02-25') }
    const onClose = vi.fn()
    renderWithRouter(<TransactionForm onClose={onClose} />)

    const dateInput = screen.getByLabelText('التاريخ') as HTMLInputElement
    expect(dateInput.value).toBe('2025-01-25')
  })

  it('handles "حفظ وإضافة أخرى" by saving transaction, calling onSuccess, resetting amount, and keeping modal open', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    renderWithRouter(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

    const amountInput = screen.getByPlaceholderText('0.000') as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '20' } })

    const saveAndAddBtn = screen.getByRole('button', { name: 'حفظ وإضافة أخرى' })
    fireEvent.click(saveAndAddBtn)

    await waitFor(() => {
      expect(txServices.addTransaction).toHaveBeenCalledTimes(1)
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
      expect(amountInput.value).toBe('')
    })
  })

  it('prefills fields from duplicateFrom as a new transaction', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const sourceTx = {
      id: 'tx-src',
      type: 'expense' as const,
      amountFils: 35000,
      categoryId: 'c-fuel',
      date: new Date('2026-09-15T00:00:00Z'),
      title: 'بنزين سفر',
      note: 'طريق المطار',
      createdAt: new Date('2026-09-15T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        duplicateFrom={sourceTx}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    )

    // Verify it is in duplicate/add mode, not edit mode
    expect(screen.getByDisplayValue('35')).toBeInTheDocument()
    expect(screen.getByDisplayValue('بنزين سفر')).toBeInTheDocument()
    expect(screen.getByDisplayValue('طريق المطار')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'حفظ النسخة' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حفظ وإضافة أخرى' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()

    // Submitting it calls addTransaction, not updateTransaction
    fireEvent.click(screen.getByRole('button', { name: 'حفظ النسخة' }))

    await waitFor(() => {
      expect(txServices.addTransaction).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'expense',
          amountFils: 35000,
          categoryId: 'c-fuel',
          title: 'بنزين سفر',
          note: 'طريق المطار',
        })
      )
      expect(txServices.updateTransaction).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('renders "حفظ" (and not "حفظ النسخة") when duplicateFrom has an empty id (new prefilled transaction like work hours calculator)', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const prefilledTx: Transaction = {
      id: '',
      type: 'expense',
      amountFils: 250000,
      categoryId: 'c-food',
      date: new Date('2026-10-15T00:00:00Z'),
      title: 'شراء هاتف ذكي',
      note: 'محسوبة من حاسبة ساعات العمل',
      createdAt: new Date('2026-10-15T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        duplicateFrom={prefilledTx}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    )

    expect(screen.getByRole('button', { name: 'حفظ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حفظ النسخة' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    await waitFor(() => {
      expect(txServices.addTransaction).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'expense',
          amountFils: 250000,
          title: 'شراء هاتف ذكي',
        })
      )
      expect(mockShowToast).toHaveBeenCalledWith(
        'تمت إضافة المعاملة بنجاح',
        'success'
      )
    })
  })

  it('renders linked debt warning banner when editing a transaction generated by debts module', () => {
    const debtLinkedTx: Transaction = {
      id: 'debt_init_debt123',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'c-fuel',
      date: new Date('2026-10-10T00:00:00Z'),
      title: 'سلفة أبو أحمد',
      note: '',
      createdAt: new Date('2026-10-10T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={debtLinkedTx}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByText('معاملة أصل الدين متزامنة مع سجل الديون')).toBeInTheDocument()
    expect(screen.getByText(/هذه المعاملة تمثل نشوء الدين الأصلي/)).toBeInTheDocument()
    expect(screen.getByText('الانتقال إلى سجل الديون')).toBeInTheDocument()

    // Amount and date inputs should be read-only / disabled
    const amountInput = screen.getByPlaceholderText('0.000') as HTMLInputElement
    expect(amountInput.disabled).toBe(true)
    const dateInput = screen.getByLabelText('التاريخ') as HTMLInputElement
    expect(dateInput.disabled).toBe(true)

    // Primary action button should be enabled allowing category/note edit
    const submitBtn = screen.getByRole('button', { name: 'تعديل المعاملة' }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })

  it('allows updating category and note for a debt-linked transaction', async () => {
    const debtLinkedTx: Transaction = {
      id: 'debt_init_debt123',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'c-fuel',
      date: new Date('2026-10-10T00:00:00Z'),
      title: 'سلفة أبو أحمد',
      note: 'ملاحظة أولى',
      createdAt: new Date('2026-10-10T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={debtLinkedTx}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    // Click another category button, e.g. "طعام وبقالة" (c-food)
    const foodCatBtn = screen.getByText('طعام وبقالة').closest('button')!
    fireEvent.click(foodCatBtn)

    // Submit modification
    const submitBtn = screen.getByRole('button', { name: 'تعديل المعاملة' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(txServices.updateTransaction).toHaveBeenCalledWith(
        'user-123',
        'debt_init_debt123',
        expect.objectContaining({
          categoryId: 'c-food',
          type: 'expense',
          amountFils: 50000,
        })
      )
    })
  })

  it('does NOT render linked debt warning banner for regular transactions', () => {
    const regularTx: Transaction = {
      id: 'tx_regular_123',
      type: 'expense',
      amountFils: 20000,
      categoryId: 'c-food',
      date: new Date('2026-10-10T00:00:00Z'),
      title: 'بقالة عادية',
      note: '',
      createdAt: new Date('2026-10-10T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={regularTx}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.queryByText('معاملة متزامنة مع سجل الديون')).not.toBeInTheDocument()
  })

  it('renders linked circle payout warning banner and restricts modification for circle_payout_ transactions', () => {
    const circlePayoutTx: Transaction = {
      id: 'circle_payout_circle-789',
      type: 'income',
      amountFils: 450000,
      categoryId: 'c-salary',
      date: new Date('2026-10-01T00:00:00Z'),
      title: 'استلام صافي جمعية الأقارب',
      note: 'استلام صافي الجمعية',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={circlePayoutTx}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByText('معاملة مرتبطة بإيداع جمعية مالية')).toBeInTheDocument()
    expect(screen.getByText('الانتقال إلى صفحة الجمعيات')).toBeInTheDocument()

    // Inputs should be read-only / disabled
    const amountInput = screen.getByPlaceholderText('0.000') as HTMLInputElement
    expect(amountInput.disabled).toBe(true)

    // Primary action button should be enabled allowing category/note edit
    const submitBtn = screen.getByRole('button', { name: 'تعديل المعاملة' }) as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)

    // Delete button should not be present
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()
  })

  it('renders linked circle installment warning banner and calls removeCircleInstallmentPayment when deleted', async () => {
    const installmentTx: Transaction = {
      id: 'circle_circle-789_m2',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'c-food',
      date: new Date('2026-10-01T00:00:00Z'),
      title: 'قسط جمعية الأقارب (شهر 2)',
      note: 'قسط شهر 2',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={installmentTx}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByText(/معاملة مرتبطة بقسط جمعية \(جمعية الأقارب\) - شهر 2/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()
  })

  it('calls removeCircleInstallmentPayment when deleting an automatic recurring circle installment transaction', async () => {
    const autoInstallmentTx: Transaction = {
      id: 'tx-auto-circle-nov',
      recurringId: 'rec-circle-789',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'c-food',
      date: new Date('2026-11-01T00:00:00Z'), // Month 2 of circle starting 2026-10-01
      title: 'قسط جمعية الأقارب تلقائي',
      note: '',
      createdAt: new Date('2026-11-01T00:00:00Z'),
    }

    mockCircles = [
      {
        id: 'circle-789',
        name: 'جمعية الأقارب',
        monthlyAmountFils: 50000,
        membersCount: 10,
        totalAmountFils: 500000,
        myTurnMonth: 1,
        startDate: new Date('2026-10-01T00:00:00Z'),
        members: [],
        status: 'active' as const,
        recurringId: 'rec-circle-789',
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]

    renderWithRouter(
      <TransactionForm
        initialTransaction={autoInstallmentTx}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByText(/معاملة مرتبطة بقسط جمعية \(جمعية الأقارب\) - شهر 2/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()
  })

  it('shows clear Toast and updates selected month when saving a transaction outside the active month', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    renderWithRouter(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

    const amountInput = screen.getByPlaceholderText('0.000')
    fireEvent.change(amountInput, { target: { value: '30' } })

    const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
    fireEvent.click(foodCatBtn)

    // Set date to September 2026 (range is October 2026)
    const dateInput = screen.getByLabelText('التاريخ')
    fireEvent.change(dateInput, { target: { value: '2026-09-15' } })

    const submitBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(txServices.addTransaction).toHaveBeenCalledTimes(1)
      expect(mockShowToast).toHaveBeenCalledWith(
        'تم حفظ المعاملة والانتقال إلى شهر المعاملة',
        'success'
      )
      expect(mockSetSelectedDate).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('renders duplicate button when editing non-locked transaction and triggers duplication', async () => {
    const onClose = vi.fn()
    const onDuplicate = vi.fn()

    const initialTx: Transaction = {
      id: 'tx-normal',
      type: 'expense',
      amountFils: 25000,
      categoryId: 'c-food',
      date: new Date('2026-10-10'),
      note: 'ملاحظة تجريبية',
      title: 'وجبة عشاء',
      createdAt: new Date('2026-10-10'),
    }

    renderWithRouter(
      <TransactionForm
        onClose={onClose}
        initialTransaction={initialTx}
        onDuplicate={onDuplicate}
      />
    )

    expect(screen.queryByRole('button', { name: /تكرار هذه المعاملة/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تعديل المعاملة' })).toBeInTheDocument()
  })

  it('preserves archived category when editing transaction originally categorized under it and labels it (مؤرشف)', () => {
    const initialTx: Transaction = {
      id: 'tx-archived-cat',
      type: 'expense',
      amountFils: 30000,
      categoryId: 'c-archived-gym',
      date: new Date('2026-10-10'),
      note: 'اشتراك شهري',
      title: 'اشتراك الجيم',
      createdAt: new Date('2026-10-10'),
    }

    renderWithRouter(
      <TransactionForm
        onClose={vi.fn()}
        initialTransaction={initialTx}
      />
    )

    expect(screen.getByText(/جيم ورياضة \(مؤرشف\)/i)).toBeInTheDocument()
  })

  it('sets default date to range.start and displays hint when browsing a past/future month', () => {
    // Set mockRange to a past month (Feb 2026)
    mockRange = { start: new Date('2026-02-01T00:00:00Z'), end: new Date('2026-03-01T00:00:00Z') }

    renderWithRouter(<TransactionForm onClose={vi.fn()} />)

    const dateInput = screen.getByLabelText('التاريخ') as HTMLInputElement
    expect(dateInput.value).toBe('2026-02-01')

    // Hint should be rendered
    expect(
      screen.getByText(/تم ضبط التاريخ تلقائياً على بداية الشهر المالي المتصفح حالياً/)
    ).toBeInTheDocument()
  })

  it('sets default date to today without showing hint when browsing current active month', () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    mockRange = { start: startOfMonth, end: endOfMonth }

    renderWithRouter(<TransactionForm onClose={vi.fn()} />)

    expect(
      screen.queryByText(/تم ضبط التاريخ تلقائياً على بداية الشهر المالي المتصفح حالياً/)
    ).not.toBeInTheDocument()
  })

  it('unlocks debt_init_ transaction and allows editing/deleting when linked debt is deleted', async () => {
    // Empty debts so debt123 does not exist
    mockDebts = []

    const orphanedDebtTx: Transaction = {
      id: 'debt_init_deletedDebt',
      type: 'expense',
      amountFils: 50000,
      categoryId: 'c-fuel',
      date: new Date('2026-10-10T00:00:00Z'),
      title: 'سلفة قديمة محذوفة',
      note: 'ملاحظة',
      createdAt: new Date('2026-10-10T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={orphanedDebtTx}
        onClose={vi.fn()}
      />
    )

    // Should NOT show locked warning or external link to debts
    expect(screen.queryByText('معاملة أصل الدين متزامنة مع سجل الديون')).not.toBeInTheDocument()
    expect(screen.getByText(/تم فك قفل هذه المعاملة/)).toBeInTheDocument()

    // Amount input should now be enabled
    const amountInput = screen.getByPlaceholderText('0.000') as HTMLInputElement
    expect(amountInput.disabled).toBe(false)

    expect(screen.getByRole('button', { name: 'تعديل المعاملة' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()
  })

  it('unlocks circle_payout_ transaction and enables editing when linked circle is deleted', async () => {
    // Empty circles so circle-789 does not exist
    mockCircles = []

    const orphanedCircleTx: Transaction = {
      id: 'circle_payout_deletedCircle',
      type: 'income',
      amountFils: 450000,
      categoryId: 'c-salary',
      date: new Date('2026-10-01T00:00:00Z'),
      title: 'استلام جمعية محذوفة',
      note: '',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={orphanedCircleTx}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('معاملة مرتبطة بإيداع جمعية مالية')).not.toBeInTheDocument()
    expect(screen.getByText(/تم فك قفل هذه المعاملة/)).toBeInTheDocument()

    const amountInput = screen.getByPlaceholderText('0.000') as HTMLInputElement
    expect(amountInput.disabled).toBe(false)
  })

  it('passes empty title to updateTransaction when user clears title input', async () => {
    const existingTxWithTitle: Transaction = {
      id: 'tx-with-title',
      type: 'expense',
      amountFils: 15000,
      categoryId: 'c-food',
      date: new Date('2026-10-10T00:00:00Z'),
      title: 'عنوان قديم للتجربة',
      note: 'ملاحظة',
      createdAt: new Date('2026-10-10T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={existingTxWithTitle}
        onClose={vi.fn()}
      />
    )

    // Title input has the old title
    const titleInput = screen.getByPlaceholderText(/فاتورة كهرباء/) as HTMLInputElement
    expect(titleInput.value).toBe('عنوان قديم للتجربة')

    // User clears the title
    fireEvent.change(titleInput, { target: { value: '' } })
    expect(titleInput.value).toBe('')

    // Save
    const submitBtn = screen.getByRole('button', { name: 'تعديل المعاملة' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(txServices.updateTransaction).toHaveBeenCalledWith(
        'user-123',
        'tx-with-title',
        expect.objectContaining({
          title: '',
        })
      )
    })
  })

  it('hides duplicate button and passes title to updateDebtPayment when editing a debt payment transaction', async () => {
    const debtPaymentTx: Transaction = {
      id: 'debt_pay_pay_123',
      type: 'income',
      amountFils: 20000,
      categoryId: 'c-salary',
      date: new Date('2026-10-05T00:00:00Z'),
      title: 'دفعة سداد قديمة',
      note: 'ملاحظة السداد',
      createdAt: new Date('2026-10-05T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={debtPaymentTx}
        onClose={vi.fn()}
      />
    )

    // 1. Duplicate button should NOT be visible for debt payment transactions
    expect(screen.queryByText(/تكرار هذه المعاملة/)).not.toBeInTheDocument()

    // 2. Title input should be editable and hold existing title
    const titleInput = screen.getByDisplayValue('دفعة سداد قديمة') as HTMLInputElement
    expect(titleInput).toBeInTheDocument()

    // Change title
    fireEvent.change(titleInput, { target: { value: 'دفعة سداد معدلة ومحسوبة' } })
    expect(titleInput.value).toBe('دفعة سداد معدلة ومحسوبة')

    // Save
    const submitBtn = screen.getByRole('button', { name: 'تعديل المعاملة' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(debtServices.updateDebtPayment).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ id: 'debt_with_pay' }),
        'pay_123',
        expect.objectContaining({
          title: 'دفعة سداد معدلة ومحسوبة',
        })
      )
    })
  })

  it('validates that debt payment date cannot precede debt start date', async () => {
    const debtPaymentTx: Transaction = {
      id: 'debt_pay_pay_123',
      type: 'income',
      amountFils: 20000,
      categoryId: 'c-salary',
      date: new Date('2026-10-05T00:00:00Z'),
      title: 'دفعة سداد',
      note: '',
      createdAt: new Date('2026-10-05T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={debtPaymentTx}
        onClose={vi.fn()}
      />
    )

    // Change date to before debt start date (2026-10-01)
    const dateInput = screen.getByLabelText(/^التاريخ/) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-09-25' } })

    const submitBtn = screen.getByRole('button', { name: 'تعديل المعاملة' })
    fireEvent.click(submitBtn)

    expect(await screen.findByText('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')).toBeInTheDocument()
    expect(debtServices.updateDebtPayment).not.toHaveBeenCalled()
  })

  it('locks amount and date, displays banner, and prevents deletion for merged debt payment transactions', async () => {
    mockDebts = [
      {
        id: 'debt_with_merged',
        personName: 'سمير',
        type: 'lent' as const,
        amountFils: 100000,
        paidFils: 40000,
        settled: false,
        startDate: new Date('2026-10-01T00:00:00Z'),
        note: '',
        payments: [
          {
            id: 'compacted_999',
            amountFils: 40000,
            date: new Date('2026-10-03T00:00:00Z'),
            isMerged: true,
            mergedTransactionIds: ['debt_pay_merged_999'],
            createdAt: new Date('2026-10-03T00:00:00Z'),
          },
        ],
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
    ]

    const mergedTx: Transaction = {
      id: 'debt_pay_merged_999',
      type: 'income',
      amountFils: 40000,
      categoryId: 'c-salary',
      date: new Date('2026-10-03T00:00:00Z'),
      title: 'رصيد دفعات سابقة مدمجة',
      note: '',
      createdAt: new Date('2026-10-03T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={mergedTx}
        onClose={vi.fn()}
      />
    )

    // Warning banner should be displayed
    expect(screen.getByText(/معاملة مرتبطة بدفعة دين مدمجة لـ \(سمير\)/)).toBeInTheDocument()
    expect(screen.getByText('الانتقال إلى سجل الديون')).toBeInTheDocument()

    // Amount input is locked/disabled
    const amountInput = screen.getByPlaceholderText('0.000') as HTMLInputElement
    expect(amountInput.disabled).toBe(true)

    // Date input is locked/disabled
    const dateInput = screen.getByLabelText(/^التاريخ/) as HTMLInputElement
    expect(dateInput.disabled).toBe(true)

    // Delete button is completely hidden for locked merged transactions
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()

    // Submitting also blocks
    const submitBtn = screen.getByRole('button', { name: 'تعديل المعاملة' })
    fireEvent.click(submitBtn)

    expect(await screen.findByText('لا يمكن تعديل دفعة مدمجة من هنا، يرجى إدارتها من سجل الديون.')).toBeInTheDocument()
    expect(txServices.updateTransaction).not.toHaveBeenCalled()
    expect(debtServices.updateDebtPayment).not.toHaveBeenCalled()
  })

  it('does NOT render duplicate, delete, or cancel button in edit mode, keeping the focus strictly on editing', () => {
    const existingTx: Transaction = {
      id: 'tx-orig',
      type: 'expense',
      amountFils: 20000, // 20 JOD
      categoryId: 'c-fuel',
      date: new Date('2026-10-02T00:00:00Z'),
      title: 'بنزين قديم',
      note: 'ملاحظة قديمة',
      createdAt: new Date('2026-10-02T00:00:00Z'),
    }

    renderWithRouter(
      <TransactionForm
        initialTransaction={existingTx}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'تكرار هذه المعاملة' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'حذف المعاملة' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'إلغاء' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تعديل المعاملة' })).toBeInTheDocument()
  })

  it('displays count of retroactively processed recurring transactions in toast message when count > 1', async () => {
    vi.mocked(recurringServices.processDueRecurring).mockResolvedValueOnce(3)

    const onClose = vi.fn()
    const onSuccess = vi.fn()

    renderWithRouter(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

    const amountInput = screen.getByPlaceholderText('0.000')
    fireEvent.change(amountInput, { target: { value: '50' } })

    // Toggle recurring switch
    const recurringSwitch = screen.getByRole('switch')
    fireEvent.click(recurringSwitch)

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'تمت إضافة 3 معاملات متكررة مستحقة وتفعيل التكرار بنجاح',
        'success'
      )
    })
  })

  describe('Calculator, Math Evaluation & Amount Limit Edge Cases', () => {
    it('saves decimal amounts entered with comma like 12,5 as 12500 fils without multiplying to 125000', async () => {
      const onClose = vi.fn()
      renderWithRouter(<TransactionForm onClose={onClose} />)

      const amountInput = screen.getByPlaceholderText('0.000')
      fireEvent.change(amountInput, { target: { value: '12,5' } })

      const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
      fireEvent.click(foodCatBtn)

      const submitBtn = screen.getByRole('button', { name: 'حفظ' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(txServices.addTransaction).toHaveBeenCalledTimes(1)
        expect(txServices.addTransaction).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            amountFils: 12500,
            categoryId: 'c-food',
          })
        )
      })
    })

    it('evaluates math expression containing Eastern Arabic digits like ١٠٠+50 into 150000 fils', async () => {
      const onClose = vi.fn()
      renderWithRouter(<TransactionForm onClose={onClose} />)

      const amountInput = screen.getByPlaceholderText('0.000')
      fireEvent.change(amountInput, { target: { value: '١٠٠+50' } })

      const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
      fireEvent.click(foodCatBtn)

      const submitBtn = screen.getByRole('button', { name: 'حفظ' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(txServices.addTransaction).toHaveBeenCalledTimes(1)
        expect(txServices.addTransaction).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            amountFils: 150000,
            categoryId: 'c-food',
          })
        )
      })
    })

    it('prevents submission and displays error when entering malformed math expression like 12..5 + 3', async () => {
      const onClose = vi.fn()
      renderWithRouter(<TransactionForm onClose={onClose} />)

      const amountInput = screen.getByPlaceholderText('0.000')
      fireEvent.change(amountInput, { target: { value: '12..5 + 3' } })

      const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
      fireEvent.click(foodCatBtn)

      const submitBtn = screen.getByRole('button', { name: 'حفظ' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('يرجى إدخال مبلغ أو عملية حسابية صحيحة')).toBeInTheDocument()
      })
      expect(txServices.addTransaction).not.toHaveBeenCalled()
    })

    it('prevents submission and displays error when amount exceeds MAX_AMOUNT_FILS', async () => {
      const onClose = vi.fn()
      renderWithRouter(<TransactionForm onClose={onClose} />)

      const amountInput = screen.getByPlaceholderText('0.000')
      fireEvent.change(amountInput, { target: { value: '1000000001' } })

      const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
      fireEvent.click(foodCatBtn)

      const submitBtn = screen.getByRole('button', { name: 'حفظ' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('المبلغ يتجاوز الحد الأقصى المسموح به')).toBeInTheDocument()
      })
      expect(txServices.addTransaction).not.toHaveBeenCalled()
    })
  })
})
