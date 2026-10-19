import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TransactionForm } from './TransactionForm'
import * as txServices from '../services/transactions'
import * as recurringServices from '../services/recurring'
import type { Transaction } from '../types'

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

vi.mock('../services/transactions', () => ({
  addTransaction: vi.fn().mockResolvedValue('mock-id'),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  getRecentTransactions: vi.fn().mockResolvedValue([]),
}))

vi.mock('../services/recurring', () => ({
  addRecurring: vi.fn().mockResolvedValue('mock-rec-id'),
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
    ],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    toasts: [],
    dismissToast: vi.fn(),
  }),
}))

let mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }

vi.mock('../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    selectedDate: new Date('2026-10-01'),
    setSelectedDate: vi.fn(),
    range: mockRange,
  }),
}))

describe('TransactionForm Component', () => {
  beforeEach(() => {
    mockRange = { start: new Date('2026-10-01'), end: new Date('2026-11-01') }
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
    expect(screen.getByRole('button', { name: 'حذف المعاملة' })).toBeInTheDocument()
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
      expect(txServices.addTransaction).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          recurringId: 'mock-rec-id',
        })
      )
      expect(onClose).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
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
    expect(screen.getByRole('button', { name: 'حفظ وإضافة أخرى' })).toBeInTheDocument()
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

    expect(screen.getByText('معاملة متزامنة مع سجل الديون')).toBeInTheDocument()
    expect(screen.getByText(/هذه المعاملة مرتبطة بسجل الديون/)).toBeInTheDocument()
    expect(screen.getByText('الانتقال إلى سجل الديون لتعديل أو حذف الدفعة')).toBeInTheDocument()
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
})
