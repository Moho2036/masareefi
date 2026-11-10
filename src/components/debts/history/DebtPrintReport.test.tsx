import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DebtPrintReport } from './DebtPrintReport'
import type { Debt, DebtEntry, DebtPayment } from '../../../types'

describe('DebtPrintReport Component', () => {
  const mockDebt: Debt = {
    id: 'debt-test',
    personName: 'أحمد محمود',
    type: 'lent',
    amountFils: 150000,
    paidFils: 50000,
    settled: false,
    startDate: new Date('2026-01-15'),
    dueDate: new Date('2026-06-30'),
    note: 'سلفة لشراء أجهزة',
    payments: [],
    createdAt: new Date('2026-01-15'),
  }

  const mockEntries: DebtEntry[] = [
    {
      id: 'entry-1',
      amountFils: 100000,
      date: new Date('2026-01-15'),
      title: 'الدفعة الأولى من السلفة',
      note: 'تحويل بنكي',
      createdAt: new Date('2026-01-15'),
    },
    {
      id: 'entry-2',
      amountFils: 50000,
      date: new Date('2026-02-01'),
      title: 'الدفعة الثانية',
      note: 'نقدي',
      createdAt: new Date('2026-02-01'),
    },
  ]

  const mockPayments: DebtPayment[] = [
    {
      id: 'pmt-1',
      amountFils: 50000,
      date: new Date('2026-03-01'),
      note: 'سداد جزئي أول',
      createdAt: new Date('2026-03-01'),
    },
  ]

  it('renders formal report header, party details, and KPI summary', () => {
    render(
      <DebtPrintReport
        debt={mockDebt}
        entries={mockEntries}
        payments={mockPayments}
        remainingFils={100000}
        isLent={true}
        currencySymbol="د.أ"
      />
    )

    expect(screen.getAllByText(/كشف حساب مالي تفصيلي/)[0]).toBeInTheDocument()
    expect(screen.getByText('أحمد محمود')).toBeInTheDocument()
    expect(screen.getByText(/مستحقات لك/)).toBeInTheDocument()
    expect(screen.getByText('سلفة لشراء أجهزة')).toBeInTheDocument()
    expect(screen.getByText('قيد السداد')).toBeInTheDocument()
    expect(screen.getByText('إجمالي المبلغ')).toBeInTheDocument()
    expect(screen.getByText('إجمالي المسدد')).toBeInTheDocument()
    expect(screen.getByText('المتبقي الفعلي')).toBeInTheDocument()
  })

  it('renders entries table and payments table with correct data and sum', () => {
    render(
      <DebtPrintReport
        debt={mockDebt}
        entries={mockEntries}
        payments={mockPayments}
        remainingFils={100000}
        isLent={true}
        currencySymbol="د.أ"
      />
    )

    expect(screen.getByText('الدفعة الأولى من السلفة')).toBeInTheDocument()
    expect(screen.getByText('تحويل بنكي')).toBeInTheDocument()
    expect(screen.getByText('الدفعة الثانية')).toBeInTheDocument()
    expect(screen.getByText('مجموع أصل الدين والسلف')).toBeInTheDocument()
    expect(screen.getByText('سداد جزئي أول')).toBeInTheDocument()
    expect(screen.getByText('إجمالي المبالغ المسددة')).toBeInTheDocument()
  })

  it('displays empty state when no payments have been registered', () => {
    render(
      <DebtPrintReport
        debt={{ ...mockDebt, paidFils: 0 }}
        entries={mockEntries}
        payments={[]}
        remainingFils={150000}
        isLent={true}
        currencySymbol="د.أ"
      />
    )

    expect(
      screen.getByText('لا توجد دفعات مسددة مسجلة على هذا الحساب بعد.')
    ).toBeInTheDocument()
  })
})
