import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PaymentHistoryModal } from './PaymentHistoryModal'
import type { Debt } from '../../types'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (fils: number) => `${fils / 1000} د.أ`,
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
})
