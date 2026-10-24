import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DebtCard } from './DebtCard'
import type { Debt } from '../../types'

vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (fils: number) => `${fils / 1000} د.أ`,
    config: { symbol: 'د.أ', code: 'JOD', decimals: 3 },
  }),
}))

describe('DebtCard Component', () => {
  const sampleDebt: Debt = {
    id: 'debt-1',
    personName: 'عمر التميمي',
    type: 'lent',
    amountFils: 100000,
    paidFils: 40000,
    startDate: new Date('2026-05-01'),
    dueDate: new Date('2026-08-01'),
    note: 'مساعدة مؤقتة',
    settled: false,
    payments: [
      {
        id: 'p-1',
        amountFils: 40000,
        date: new Date('2026-05-15'),
        note: 'دفعة أولى',
        createdAt: new Date(),
      },
    ],
    createdAt: new Date(),
  }

  it('renders person name, remaining amount, and progress correctly', () => {
    render(
      <DebtCard
        debt={sampleDebt}
        onOpenPaymentModal={vi.fn()}
        onOpenHistoryModal={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('عمر التميمي')).toBeInTheDocument()
    expect(screen.getByText('60 د.أ')).toBeInTheDocument() // 100 - 40 = 60
    expect(screen.getByText('40% مسدد')).toBeInTheDocument()
    expect(screen.getByText('لي (مستحق)')).toBeInTheDocument()
  })

  it('calls action callbacks when clicking buttons', () => {
    const onOpenPaymentModal = vi.fn()
    const onOpenHistoryModal = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()

    render(
      <DebtCard
        debt={sampleDebt}
        onOpenPaymentModal={onOpenPaymentModal}
        onOpenHistoryModal={onOpenHistoryModal}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /تسجيل دفعة استرداد/i }))
    expect(onOpenPaymentModal).toHaveBeenCalledWith(sampleDebt)

    fireEvent.click(screen.getByTitle('سجل الدفعات'))
    expect(onOpenHistoryModal).toHaveBeenCalledWith(sampleDebt)

    fireEvent.click(screen.getByTitle('تعديل'))
    expect(onEdit).toHaveBeenCalledWith(sampleDebt)

    fireEvent.click(screen.getByTitle('حذف'))
    expect(onDelete).toHaveBeenCalledWith(sampleDebt)
  })

  it('shows amber compaction button when debt has 100 payments', () => {
    const hundredPayments = Array.from({ length: 100 }, (_, i) => ({
      id: `p-${i}`,
      amountFils: 500,
      date: new Date('2026-05-02'),
      note: `دفعة ${i}`,
      createdAt: new Date(),
    }))

    const maxDebt: Debt = {
      ...sampleDebt,
      payments: hundredPayments,
    }

    const onOpenPaymentModal = vi.fn()

    render(
      <DebtCard
        debt={maxDebt}
        onOpenPaymentModal={onOpenPaymentModal}
        onOpenHistoryModal={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const compactBtn = screen.getByRole('button', { name: /دمج الدفعات القديمة \(100\)/i })
    expect(compactBtn).toBeInTheDocument()

    fireEvent.click(compactBtn)
    expect(onOpenPaymentModal).toHaveBeenCalledWith(maxDebt)
  })
})
