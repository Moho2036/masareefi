import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecurringDetailsModal } from './RecurringDetailsModal'
import type { Recurring, Category, Transaction } from '../../types'

describe('RecurringDetailsModal Component', () => {
  const mockCategory: Category = {
    id: 'cat-housing',
    name: 'سكن وإيجار',
    type: 'expense',
    color: '#3B82F6',
    icon: '🏠',
    archived: false,
    order: 0,
  }

  const categoryMap = new Map<string, Category>([['cat-housing', mockCategory]])

  const mockRecurring: Recurring = {
    id: 'rec-rent-1',
    type: 'expense',
    amountFils: 350000,
    categoryId: 'cat-housing',
    frequency: 'monthly',
    startDate: new Date('2026-01-01'),
    nextDate: new Date('2026-12-01'),
    active: true,
    title: 'إيجار شقة عمان',
    note: 'شامل المياه والخدمات',
    requireConfirmation: false,
    createdAt: new Date('2026-01-01'),
  }

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      recurringId: 'rec-rent-1',
      amountFils: 350000,
      type: 'expense',
      categoryId: 'cat-housing',
      date: new Date('2026-10-01'),
      title: 'دفعة إيجار شهر 10',
      note: '',
      createdAt: new Date('2026-10-01'),
    },
    {
      id: 'tx-2',
      recurringId: 'rec-rent-1',
      amountFils: 350000,
      type: 'expense',
      categoryId: 'cat-housing',
      date: new Date('2026-11-01'),
      title: 'دفعة إيجار شهر 11',
      note: '',
      createdAt: new Date('2026-11-01'),
    },
  ]

  it('renders recurring details modal correctly with cumulative statistics', () => {
    render(
      <RecurringDetailsModal
        item={mockRecurring}
        onClose={vi.fn()}
        categoryMap={categoryMap}
        allTransactions={mockTransactions}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
        onOpenConfirm={vi.fn()}
        onSkipOccurrence={vi.fn()}
      />
    )

    expect(screen.getByText('تفاصيل وكشف المعاملة المتكررة')).toBeInTheDocument()
    expect(screen.getByText('إيجار شقة عمان')).toBeInTheDocument()
    expect(screen.getByText('سكن وإيجار')).toBeInTheDocument()
    expect(screen.getByText('شهري')).toBeInTheDocument()
    expect(screen.getByText('2 دفعات')).toBeInTheDocument()
    expect(screen.getByText('دفعة إيجار شهر 10')).toBeInTheDocument()
    expect(screen.getByText('دفعة إيجار شهر 11')).toBeInTheDocument()
  })

  it('triggers onEdit callback and closes modal', () => {
    const handleClose = vi.fn()
    const handleEdit = vi.fn()

    render(
      <RecurringDetailsModal
        item={mockRecurring}
        onClose={handleClose}
        categoryMap={categoryMap}
        allTransactions={mockTransactions}
        onEdit={handleEdit}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
        onOpenConfirm={vi.fn()}
        onSkipOccurrence={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /تعديل/i }))
    expect(handleClose).toHaveBeenCalled()
    expect(handleEdit).toHaveBeenCalledWith(mockRecurring)
  })

  it('triggers onToggleActive when pause/play button is clicked', () => {
    const handleToggle = vi.fn()

    render(
      <RecurringDetailsModal
        item={mockRecurring}
        onClose={vi.fn()}
        categoryMap={categoryMap}
        allTransactions={mockTransactions}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={handleToggle}
        onOpenConfirm={vi.fn()}
        onSkipOccurrence={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /إيقاف مؤقت/i }))
    expect(handleToggle).toHaveBeenCalledWith(mockRecurring)
  })

  it('triggers onDelete when delete button is clicked', () => {
    const handleClose = vi.fn()
    const handleDelete = vi.fn()

    render(
      <RecurringDetailsModal
        item={mockRecurring}
        onClose={handleClose}
        categoryMap={categoryMap}
        allTransactions={mockTransactions}
        onEdit={vi.fn()}
        onDelete={handleDelete}
        onToggleActive={vi.fn()}
        onOpenConfirm={vi.fn()}
        onSkipOccurrence={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /حذف/i }))
    expect(handleClose).toHaveBeenCalled()
    expect(handleDelete).toHaveBeenCalledWith(mockRecurring)
  })

  it('displays empty state when no prior transactions exist', () => {
    render(
      <RecurringDetailsModal
        item={mockRecurring}
        onClose={vi.fn()}
        categoryMap={categoryMap}
        allTransactions={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleActive={vi.fn()}
        onOpenConfirm={vi.fn()}
        onSkipOccurrence={vi.fn()}
      />
    )

    expect(
      screen.getByText('لم يتم تسجيل أي دفعات سابقة لهذه المعاملة المتكررة حتى الآن.')
    ).toBeInTheDocument()
  })
})
