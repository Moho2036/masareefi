import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TransactionForm } from './TransactionForm'
import * as txServices from '../services/transactions'
import * as recurringServices from '../services/recurring'

vi.mock('../services/transactions', () => ({
  addTransaction: vi.fn().mockResolvedValue('mock-id'),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
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

describe('TransactionForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Arabic error validation when submitting without entering amount or 0', async () => {
    const onClose = vi.fn()
    render(<TransactionForm onClose={onClose} />)

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

    render(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

    // Enter valid amount (e.g. 15.5 JOD = 15500 fils)
    const amountInput = screen.getByPlaceholderText('0.000')
    fireEvent.change(amountInput, { target: { value: '15.5' } })

    // Select category (طعام وبقالة)
    const foodCatBtn = screen.getByRole('button', { name: /طعام وبقالة/ })
    fireEvent.click(foodCatBtn)

    // Enter optional note
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

    render(<TransactionForm initialTransaction={existingTx} onClose={onClose} />)

    expect(screen.getByDisplayValue('50')).toBeInTheDocument()
    expect(screen.getByDisplayValue('تعبئة بنزين')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تعديل المعاملة' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'حذف المعاملة' })).toBeInTheDocument()
  })

  it('creates recurring transaction when recurring toggle is enabled', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    render(<TransactionForm onClose={onClose} onSuccess={onSuccess} />)

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
})
