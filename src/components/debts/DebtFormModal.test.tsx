import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DebtFormModal } from './DebtFormModal'
import * as debtsService from '../../services/debts'
import type { Debt } from '../../types'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-123' } }),
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (fils: number) => `${fils / 1000} د.أ`,
    config: { symbol: 'د.أ', decimals: 3 },
  }),
}))

vi.mock('../../services/debts', () => ({
  addDebt: vi.fn().mockResolvedValue('debt-123'),
  updateDebt: vi.fn().mockResolvedValue(undefined),
  checkDebtInitialTransactionExists: vi.fn().mockResolvedValue(true),
}))

describe('DebtFormModal syncTransaction on edit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleDebt: Debt = {
    id: 'debt-456',
    personName: 'خالد',
    type: 'lent',
    amountFils: 50000,
    paidFils: 0,
    startDate: new Date('2026-10-01'),
    settled: false,
    note: '',
    payments: [],
    createdAt: new Date(),
  }

  it('checks and preselects syncTransaction as true when initial transaction exists', async () => {
    vi.mocked(debtsService.checkDebtInitialTransactionExists).mockResolvedValueOnce(true)

    render(
      <DebtFormModal
        isOpen={true}
        onClose={vi.fn()}
        initialDebt={sampleDebt}
      />
    )

    await waitFor(() => {
      expect(debtsService.checkDebtInitialTransactionExists).toHaveBeenCalledWith('user-123', 'debt-456')
    })

    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })

  it('checks and preselects syncTransaction as false when initial transaction does not exist', async () => {
    vi.mocked(debtsService.checkDebtInitialTransactionExists).mockResolvedValueOnce(false)

    render(
      <DebtFormModal
        isOpen={true}
        onClose={vi.fn()}
        initialDebt={sampleDebt}
      />
    )

    await waitFor(() => {
      expect(debtsService.checkDebtInitialTransactionExists).toHaveBeenCalledWith('user-123', 'debt-456')
    })

    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('passes syncTransaction boolean to updateDebt on submit', async () => {
    vi.mocked(debtsService.checkDebtInitialTransactionExists).mockResolvedValueOnce(true)

    render(
      <DebtFormModal
        isOpen={true}
        onClose={vi.fn()}
        initialDebt={sampleDebt}
      />
    )

    await waitFor(() => {
      expect(debtsService.checkDebtInitialTransactionExists).toHaveBeenCalled()
    })

    // Toggle off
    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الدين' }))

    await waitFor(() => {
      expect(debtsService.updateDebt).toHaveBeenCalledWith(
        'user-123',
        'debt-456',
        expect.any(Object),
        { syncTransaction: false }
      )
    })
  })

  it('prevents submission and shows Arabic error when editing amount to less than paidFils', async () => {
    const partiallyPaidDebt: Debt = {
      ...sampleDebt,
      amountFils: 100000,
      paidFils: 70000,
    }

    render(
      <DebtFormModal
        isOpen={true}
        onClose={vi.fn()}
        initialDebt={partiallyPaidDebt}
      />
    )

    const amountInput = screen.getByDisplayValue('100')
    fireEvent.change(amountInput, { target: { value: '50' } })

    // Verify inline error appears
    expect(
      screen.getByText('لا يمكن أن يكون إجمالي الدين أقل من المبلغ المسدد بالفعل (70 د.أ)')
    ).toBeInTheDocument()

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الدين' }))

    expect(debtsService.updateDebt).not.toHaveBeenCalled()
  })

  it('updates debt with settled = true when amount is edited to equal paidFils', async () => {
    const partiallyPaidDebt: Debt = {
      ...sampleDebt,
      amountFils: 100000,
      paidFils: 70000,
    }

    render(
      <DebtFormModal
        isOpen={true}
        onClose={vi.fn()}
        initialDebt={partiallyPaidDebt}
      />
    )

    const amountInput = screen.getByDisplayValue('100')
    fireEvent.change(amountInput, { target: { value: '70' } })

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الدين' }))

    await waitFor(() => {
      expect(debtsService.updateDebt).toHaveBeenCalledWith(
        'user-123',
        'debt-456',
        expect.objectContaining({
          amountFils: 70000,
          paidFils: 70000,
          settled: true,
        }),
        expect.any(Object)
      )
    })
  })

  it('updates debt with settled = false when settled debt amount is increased', async () => {
    const fullySettledDebt: Debt = {
      ...sampleDebt,
      amountFils: 100000,
      paidFils: 100000,
      settled: true,
    }

    render(
      <DebtFormModal
        isOpen={true}
        onClose={vi.fn()}
        initialDebt={fullySettledDebt}
      />
    )

    const amountInput = screen.getByDisplayValue('100')
    fireEvent.change(amountInput, { target: { value: '150' } })

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الدين' }))

    await waitFor(() => {
      expect(debtsService.updateDebt).toHaveBeenCalledWith(
        'user-123',
        'debt-456',
        expect.objectContaining({
          amountFils: 150000,
          paidFils: 100000,
          settled: false,
        }),
        expect.any(Object)
      )
    })
  })
})
