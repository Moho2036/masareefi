import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaymentHistoryModal } from './PaymentHistoryModal'
import * as debtServices from '../../services/debts'
import type { Debt, DebtEntry } from '../../types'

vi.mock('../../services/debts', () => ({
  deleteDebtPayment: vi.fn().mockResolvedValue(undefined),
  updateDebtPayment: vi.fn().mockResolvedValue(undefined),
  checkDebtPaymentTransactionExists: vi.fn().mockResolvedValue(true),
  compactDebtPayments: vi.fn().mockResolvedValue({ mergedCount: 85, mergedAmountFils: 170000 }),
  compactDebtEntries: vi.fn().mockResolvedValue({ mergedCount: 80, mergedAmountFils: 240000 }),
  addDebtEntry: vi.fn().mockResolvedValue('entry-new'),
  updateDebtEntry: vi.fn().mockResolvedValue(undefined),
  deleteDebtEntry: vi.fn().mockResolvedValue(undefined),
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

  it('renders borrowed debt payment with - sign and red color', () => {
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
    expect(paymentAmount.className).toContain('text-red-600')
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
    const saveBtn = await screen.findByRole('button', { name: 'حفظ التعديل' })
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

    const syncToggle = screen.getByRole('switch', {
      name: /ربط الدفعة بالرصيد \(تأثير مالي في سجل المعاملات\)/i,
    })
    expect(syncToggle).toBeInTheDocument()
    expect(syncToggle.getAttribute('aria-checked')).toBe('true')

    // Uncheck it
    fireEvent.click(syncToggle)
    expect(syncToggle.getAttribute('aria-checked')).toBe('false')

    // Save edit
    const saveBtn = await screen.findByRole('button', { name: 'حفظ التعديل' })
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

    const saveBtn = await screen.findByRole('button', { name: 'حفظ التعديل' })
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
    const toggle = screen.getByRole('switch', {
      name: /حذف المعاملة المالية المرتبطة من سجل المعاملات أيضاً/i,
    })
    expect(toggle).toBeInTheDocument()
    expect(toggle.getAttribute('aria-checked')).toBe('true')

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

    const toggle = screen.getByRole('switch', {
      name: /حذف المعاملة المالية المرتبطة من سجل المعاملات أيضاً/i,
    })
    // Uncheck it
    fireEvent.click(toggle)

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

  it('renders merged payment badge and hides edit button for isMerged payment', () => {
    const debtWithMerged: Debt = {
      id: 'd-merged',
      personName: 'مازن',
      type: 'lent',
      amountFils: 100000,
      paidFils: 70000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      payments: [
        {
          id: 'compacted_123',
          amountFils: 70000,
          date: new Date('2026-01-20'),
          note: 'رصيد دفعات سابقة مدمجة (20 دفعة)',
          createdAt: new Date(),
          isMerged: true,
          mergedTransactionIds: ['tx-1', 'tx-2'],
        },
      ],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={debtWithMerged}
      />
    )

    // Merged badge appears
    expect(screen.getByText('دفعات مدمجة')).toBeInTheDocument()

    // Edit button must NOT be rendered for merged payments
    expect(screen.queryByTitle('تعديل هذه الدفعة')).not.toBeInTheDocument()

    // Delete button IS available
    expect(screen.getByTitle('حذف هذه الدفعة')).toBeInTheDocument()
  })

  it('renders entries section, allows adding new entry and opens share menu', async () => {
    const debtWithEntries: Debt = {
      id: 'd-entries',
      personName: 'عمر',
      type: 'lent',
      amountFils: 60000,
      paidFils: 10000,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: 'ملاحظة',
      payments: [],
      createdAt: new Date(),
      entries: [
        {
          id: 'e1',
          amountFils: 60000,
          date: new Date('2026-01-01'),
          title: 'سلفة أولى',
          note: 'سلفة أولى',
          createdAt: new Date(),
        },
      ],
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={debtWithEntries}
      />
    )

    expect(screen.getByText(/تفاصيل السلف وأصل الديون المسجلة/)).toBeInTheDocument()
    expect(screen.getAllByText('سلفة أولى')[0]).toBeInTheDocument()

    // Open add entry form
    const addEntryBtn = screen.getByText('إضافة سلفة جديدة على هذا الحساب')
    fireEvent.click(addEntryBtn)

    expect(screen.getByPlaceholderText('0.000')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('0.000'), { target: { value: '25' } })
    fireEvent.change(screen.getByPlaceholderText('مثال: سلفة تكاليف السفر...'), {
      target: { value: 'سلفة إضافية' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'حفظ السلفة' }))

    await waitFor(() => {
      expect(debtServices.addDebtEntry).toHaveBeenCalledWith(
        'user-1',
        debtWithEntries,
        expect.objectContaining({
          amountFils: 25000,
          title: 'سلفة إضافية',
        }),
        expect.any(Object)
      )
    })

    expect(screen.getByText('نسخ للحافظة')).toBeInTheDocument()
    expect(screen.getByText('إرسال عبر واتساب')).toBeInTheDocument()
    expect(screen.getByText('طباعة الكشف')).toBeInTheDocument()
  })

  it('renders compaction banner when entries length >= 90 and triggers compactDebtEntries on click', async () => {
    const mockEntries: DebtEntry[] = Array.from({ length: 92 }, (_, i) => ({
      id: `e-${i + 1}`,
      amountFils: 2000,
      date: new Date(2026, 0, i + 1),
      title: `سلفة ${i + 1}`,
      note: '',
      createdAt: new Date(),
    }))

    const debtWithManyEntries: Debt = {
      id: 'd-many-entries',
      personName: 'عمر',
      type: 'lent',
      amountFils: 184000,
      paidFils: 0,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      entries: mockEntries,
      payments: [],
      createdAt: new Date(),
    }

    const mockOnSuccess = vi.fn()

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={debtWithManyEntries}
        onSuccess={mockOnSuccess}
      />
    )

    expect(screen.getByText(/وصل عدد السلف إلى 92/i)).toBeInTheDocument()
    const compactBtn = screen.getByRole('button', { name: /دمج السلف القديمة/i })
    expect(compactBtn).toBeInTheDocument()

    fireEvent.click(compactBtn)

    await waitFor(() => {
      expect(debtServices.compactDebtEntries).toHaveBeenCalledWith('user-1', 'd-many-entries')
      expect(mockOnSuccess).toHaveBeenCalled()
    })
  })

  it('renders merged entry badge and hides edit button for isMerged entry', () => {
    const debtWithMergedEntry: Debt = {
      id: 'd-merged-entry',
      personName: 'كريم',
      type: 'lent',
      amountFils: 50000,
      paidFils: 0,
      startDate: new Date('2026-01-01'),
      settled: false,
      note: '',
      entries: [
        {
          id: 'compacted_entry_123',
          amountFils: 40000,
          date: new Date('2026-01-15'),
          title: 'رصيد سلف سابقة مدمجة (20 سلفة)',
          note: 'سلف قديمة',
          createdAt: new Date(),
          isMerged: true,
          mergedTransactionIds: ['tx-e1', 'tx-e2'],
        },
        {
          id: 'e-active',
          amountFils: 10000,
          date: new Date('2026-01-20'),
          title: 'سلفة حديثة',
          note: '',
          createdAt: new Date(),
        },
      ],
      payments: [],
      createdAt: new Date(),
    }

    render(
      <PaymentHistoryModal
        isOpen={true}
        onClose={vi.fn()}
        debt={debtWithMergedEntry}
      />
    )

    // Merged badge appears for the compacted entry
    expect(screen.getByText('سلف مدمجة')).toBeInTheDocument()

    // Edit button must NOT be rendered for merged entry
    expect(screen.queryByTitle('تعديل السلفة رصيد سلف سابقة مدمجة (20 سلفة)')).not.toBeInTheDocument()

    // Edit button IS available for the active entry
    expect(screen.getByTitle('تعديل السلفة')).toBeInTheDocument()
  })
})
