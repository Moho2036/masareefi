import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaymentHistoryModal } from './PaymentHistoryModal'
import * as debtServices from '../../services/debts'
import type { Debt } from '../../types'

vi.mock('../../services/debts', () => ({
  deleteDebtPayment: vi.fn().mockResolvedValue(undefined),
  updateDebtPayment: vi.fn().mockResolvedValue(undefined),
  checkDebtPaymentTransactionExists: vi.fn().mockResolvedValue(true),
  compactDebtPayments: vi.fn().mockResolvedValue({ mergedCount: 85, mergedAmountFils: 170000 }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (fils: number) => `${fils / 1000} د.أ`,
    config: { symbol: 'د.أ', code: 'JOD', decimals: 3 },
  }),
}))

describe('PaymentHistoryModal', () => {
  it('renders lent debt payment with + sign and emerald color', () => {
    const lentDebt: Debt = {
      id: 'd1',
      personName: 'خالد',
      type: 'lent',
      amountFils: 100000,
      paidFils: 50000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'p1',
          amountFils: 50000,
          date: new Date('2026-01-10'),
          note: 'استرداد دفعة',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={lentDebt}
      />
    )

    const paymentAmount = screen.getByText('+ 50 د.أ')
    expect(paymentAmount).toBeDefined()
    expect(paymentAmount.className).toContain('text-emerald-600')
  })

  it('renders borrowed debt payment with - sign and amber color', () => {
    const borrowedDebt: Debt = {
      id: 'd2',
      personName: 'سامي',
      type: 'borrowed',
      amountFils: 100000,
      paidFils: 30000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'p2',
          amountFils: 30000,
          date: new Date('2026-01-15'),
          note: 'سداد جزء من الدين',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={borrowedDebt}
      />
    )

    const paymentAmount = screen.getByText('- 30 د.أ')
    expect(paymentAmount).toBeDefined()
    expect(paymentAmount.className).toContain('text-amber-600')
  })

  it('allows editing an existing payment and calls updateDebtPayment', async () => {
    const lentDebt: Debt = {
      id: 'd1',
      personName: 'خالد',
      type: 'lent',
      amountFils: 100000,
      paidFils: 50000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'p1',
          amountFils: 50000,
          date: new Date('2026-01-10'),
          note: 'دفعة قديمة',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={lentDebt}
      />
    )

    // Click edit button
    const editBtn = screen.getByTitle('تعديل هذه الدفعة')
    fireEvent.click(editBtn)

    // The inline inputs should appear
    expect(screen.getByDisplayValue('50')).toBeInTheDocument()
    const amountInput = screen.getByDisplayValue('50')
    fireEvent.change(amountInput, { target: { value: '60' } })

    // Save edit
    const saveBtn = screen.getByRole('button', { name: 'حفظ التعديل' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(debtServices.updateDebtPayment).toHaveBeenCalledWith(
        'user-1',
        lentDebt,
        'p1',
        expect.objectContaining({
          amountFils: 60000,
        })
      )
    })
  })

  it('allows toggling syncTransaction checkbox when editing a payment and passes it to updateDebtPayment', async () => {
    const lentDebt: Debt = {
      id: 'd1',
      personName: 'خالد',
      type: 'lent',
      amountFils: 100000,
      paidFils: 50000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'p1',
          amountFils: 50000,
          date: new Date('2026-01-10'),
          note: 'دفعة',
          transactionId: 'tx-123',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={lentDebt}
      />
    )

    const editBtn = screen.getByTitle('تعديل هذه الدفعة')
    fireEvent.click(editBtn)

    const syncCheckbox = screen.getByRole('checkbox', {
      name: /ربط الدفعة بالرصيد \(تأثير مالي في سجل المعاملات\)/i,
    }) as HTMLInputElement
    expect(syncCheckbox).toBeInTheDocument()
    expect(syncCheckbox.checked).toBe(true)

    // Uncheck it
    fireEvent.click(syncCheckbox)
    expect(syncCheckbox.checked).toBe(false)

    // Save edit
    const saveBtn = screen.getByRole('button', { name: 'حفظ التعديل' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(debtServices.updateDebtPayment).toHaveBeenCalledWith(
        'user-1',
        lentDebt,
        'p1',
        expect.objectContaining({
          amountFils: 50000,
          syncTransaction: false,
        })
      )
    })
  })

  it('validates that edited payment date cannot precede debt start date', async () => {
    const lentDebt: Debt = {
      id: 'd1',
      personName: 'خالد',
      type: 'lent',
      amountFils: 100000,
      paidFils: 50000,
      startDate: new Date('2026-01-05'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'p1',
          amountFils: 50000,
          date: new Date('2026-01-10'),
          note: 'دفعة',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={lentDebt}
      />
    )

    const editBtn = screen.getByTitle('تعديل هذه الدفعة')
    fireEvent.click(editBtn)

    const dateInput = screen.getByDisplayValue('2026-01-10')
    fireEvent.change(dateInput, { target: { value: '2026-01-01' } }) // before 2026-01-05

    const saveBtn = screen.getByRole('button', { name: 'حفظ التعديل' })
    fireEvent.click(saveBtn)

    expect(screen.getByText('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')).toBeInTheDocument()
    expect(debtServices.updateDebtPayment).not.toHaveBeenCalled()
  })

  it('shows delete confirmation with checkbox checked by default and calls deleteDebtPayment with deleteTransaction = true', async () => {
    const lentDebt: Debt = {
      id: 'd1',
      personName: 'خالد',
      type: 'lent',
      amountFils: 100000,
      paidFils: 50000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'p1',
          amountFils: 50000,
          date: new Date('2026-01-10'),
          note: 'دفعة سداد',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={lentDebt}
      />
    )

    // Click delete icon
    const deleteBtn = screen.getByTitle('حذف هذه الدفعة')
    fireEvent.click(deleteBtn)

    // Confirmation UI should appear
    expect(screen.getByText('تأكيد حذف الدفعة؟')).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox', {
      name: /حذف المعاملة المالية المرتبطة من سجل المعاملات أيضاً/i,
    }) as HTMLInputElement
    expect(checkbox).toBeInTheDocument()
    expect(checkbox.checked).toBe(true)

    // Click confirm delete
    const confirmBtn = screen.getByRole('button', { name: 'تأكيد الحذف' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(debtServices.deleteDebtPayment).toHaveBeenCalledWith(
        'user-1',
        lentDebt,
        'p1',
        { deleteTransaction: true }
      )
    })
  })

  it('allows unchecking deleteTransaction checkbox and passes deleteTransaction = false to deleteDebtPayment', async () => {
    const lentDebt: Debt = {
      id: 'd1',
      personName: 'خالد',
      type: 'lent',
      amountFils: 100000,
      paidFils: 50000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'p1',
          amountFils: 50000,
          date: new Date('2026-01-10'),
          note: 'دفعة سداد',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={lentDebt}
      />
    )

    // Click delete icon
    const deleteBtn = screen.getByTitle('حذف هذه الدفعة')
    fireEvent.click(deleteBtn)

    const checkbox = screen.getByRole('checkbox', {
      name: /حذف المعاملة المالية المرتبطة من سجل المعاملات أيضاً/i,
    })
    // Uncheck it
    fireEvent.click(checkbox)

    // Click confirm delete
    const confirmBtn = screen.getByRole('button', { name: 'تأكيد الحذف' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(debtServices.deleteDebtPayment).toHaveBeenCalledWith(
        'user-1',
        lentDebt,
        'p1',
        { deleteTransaction: false }
      )
    })
  })

  it('renders compaction banner when payments length >= 90 and triggers compactDebtPayments on click', async () => {
    const mockPayments = Array.from({ length: 95 }, (_, i) => ({
      id: `p-${i + 1}`,
      amountFils: 1000,
      date: new Date(2026, 0, i + 1),
      note: `دفعة ${i + 1}`,
      createdAt: new Date(),
    }))

    const debtWithManyPayments: Debt = {
      id: 'd-many',
      personName: 'سعيد',
      type: 'borrowed',
      amountFils: 100000,
      paidFils: 95000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: mockPayments,
      createdAt: new Date(),
    }

    const mockOnSuccess = vi.fn()

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={debtWithManyPayments}
        onSuccess={mockOnSuccess}
      />
    )

    expect(screen.getByText(/وصل عدد الدفعات إلى 95/i)).toBeInTheDocument()
    const compactBtn = screen.getByRole('button', { name: /دمج الدفعات القديمة/i })
    expect(compactBtn).toBeInTheDocument()

    fireEvent.click(compactBtn)

    await waitFor(() => {
      expect(debtServices.compactDebtPayments).toHaveBeenCalledWith('user-1', 'd-many')
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })
})
