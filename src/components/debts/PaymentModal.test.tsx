import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaymentModal } from './PaymentModal'
import * as debtServices from '../../services/debts'
import type { Debt, DebtPayment } from '../../types'

vi.mock('../../services/debts', () => ({
  addDebtPayment: vi.fn().mockResolvedValue('pay-new'),
  compactDebtPayments: vi.fn().mockResolvedValue({ mergedCount: 90, mergedAmountFils: 45000 }),
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

describe('PaymentModal Component', () => {
  const sampleDebt: Debt = {
    id: 'debt-1',
    personName: 'خالد',
    type: 'lent',
    amountFils: 100000,
    paidFils: 20000,
    startDate: new Date('2026-05-01'),
    settled: false,
    note: '',
    payments: [],
    createdAt: new Date(),
  }

  it('renders payment form and registers payment on submit', async () => {
    const handleClose = vi.fn()
    const handleSuccess = vi.fn()

    render(
      <PaymentModal
        isOpen={true}
        onClose={handleClose}
        debt={sampleDebt}
        onSuccess={handleSuccess}
      />
    )

    expect(screen.getByText('تسجيل دفعة استرداد')).toBeInTheDocument()
    expect(screen.getByText('80 د.أ')).toBeInTheDocument() // Remaining: 100 - 20 = 80

    // Fill amount input
    const input = screen.getByPlaceholderText('0.000')
    fireEvent.change(input, { target: { value: '30' } })

    const submitBtn = screen.getByRole('button', { name: 'تأكيد تسجيل الدفعة' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(debtServices.addDebtPayment).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalled()
      expect(handleSuccess).toHaveBeenCalled()
    })
  })

  it('disables submit button and shows warning banner when 100 payments limit is reached', () => {
    const hundredPayments: DebtPayment[] = Array.from({ length: 100 }, (_, i) => ({
      id: `p-${i}`,
      amountFils: 500,
      date: new Date('2026-05-02'),
      note: `دفعة ${i}`,
      createdAt: new Date(),
    }))

    const maxDebt: Debt = {
      ...sampleDebt,
      paidFils: 50000,
      payments: hundredPayments,
    }

    render(
      <PaymentModal
        isOpen={true}
        onClose={vi.fn()}
        debt={maxDebt}
      />
    )

    // Warning banner should be displayed
    expect(screen.getByText(/تم الوصول للحد الأقصى للدفعات \(100 دفعة\)/)).toBeInTheDocument()
    expect(screen.getByText(/تفرض قواعد الأمان حداً أقصى 100 دفعة لكل دين/)).toBeInTheDocument()

    // Compaction button should be available
    const compactBtn = screen.getByRole('button', { name: /دمج الدفعات القديمة لفتح مساحة/i })
    expect(compactBtn).toBeInTheDocument()

    fireEvent.click(compactBtn)
    expect(debtServices.compactDebtPayments).toHaveBeenCalledWith('user-1', maxDebt.id)

    // Submit button should be disabled with descriptive text
    const submitBtn = screen.getByRole('button', { name: 'الحد الأقصى مكتمل (100 دفعة)' })
    expect(submitBtn).toBeDisabled()
  })
})
