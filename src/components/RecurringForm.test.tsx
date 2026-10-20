import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecurringForm } from './RecurringForm'
import * as recurringServices from '../services/recurring'
import type { Recurring } from '../types'

vi.mock('../services/recurring', () => ({
  addRecurring: vi.fn().mockResolvedValue('mock-rec-id'),
  updateRecurring: vi.fn().mockResolvedValue(undefined),
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
      { id: 'c-rent', name: 'إيجار وسكن', type: 'expense', icon: '🏠', color: '#6366F1', archived: false, order: 0 },
      { id: 'c-salary', name: 'راتب', type: 'income', icon: '💼', color: '#10B981', archived: false, order: 1 },
    ],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
    data: [],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (val: number) => `${val / 1000} د.أ`,
    config: { code: 'JOD', symbol: 'د.أ', decimals: 3 },
  }),
}))

describe('RecurringForm component nextDate calculation on edit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleRecurring: Recurring = {
    id: 'rec-1',
    type: 'expense',
    amountFils: 150000,
    categoryId: 'c-rent',
    frequency: 'monthly',
    startDate: new Date('2026-01-01T12:00:00'),
    nextDate: new Date('2026-11-01T12:00:00'),
    title: 'إيجار الشقة',
    note: 'ملاحظة',
    active: true,
    createdAt: new Date('2026-01-01'),
  }

  it('does NOT update nextDate when only amount or note is changed', async () => {
    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={sampleRecurring}
      />
    )

    // Change amount from 150 to 200
    const amountInput = screen.getByLabelText(/المبلغ/i)
    fireEvent.change(amountInput, { target: { value: '200' } })

    const submitBtn = screen.getByRole('button', { name: /تعديل المعاملة/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.updateRecurring).toHaveBeenCalledTimes(1)
    })

    const payload = vi.mocked(recurringServices.updateRecurring).mock.calls[0][2]
    expect(payload.amountFils).toBe(200000)
    // nextDate should be undefined so existing schedule is preserved
    expect(payload.nextDate).toBeUndefined()
  })

  it('recalculates nextDate from new startDate when user changes startDate', async () => {
    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={sampleRecurring}
      />
    )

    // Change startDate to a future date
    const startDateInput = screen.getByLabelText(/تاريخ البداية/i)
    fireEvent.change(startDateInput, { target: { value: '2026-12-01' } })

    const submitBtn = screen.getByRole('button', { name: /تعديل المعاملة/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.updateRecurring).toHaveBeenCalledTimes(1)
    })

    const payload = vi.mocked(recurringServices.updateRecurring).mock.calls[0][2]
    expect(payload.nextDate).toBeDefined()
    expect((payload.nextDate as Date).getFullYear()).toBe(2026)
    expect((payload.nextDate as Date).getMonth()).toBe(11) // December
    expect((payload.nextDate as Date).getDate()).toBe(1)
  })

  it('reschedules nextDate from parsedStartDate when frequency changes without skipping upcoming occurrences', async () => {
    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={sampleRecurring}
      />
    )

    // Change frequency to weekly (SegmentedControl renders buttons with role radio)
    const weeklyBtn = screen.getByRole('radio', { name: /أسبوعي/i })
    fireEvent.click(weeklyBtn)

    const submitBtn = screen.getByRole('button', { name: /تعديل المعاملة/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.updateRecurring).toHaveBeenCalledTimes(1)
    })

    const payload = vi.mocked(recurringServices.updateRecurring).mock.calls[0][2]
    expect(payload.nextDate).toBeDefined()
    expect((payload.nextDate as Date).getTime()).toBeGreaterThanOrEqual(
      new Date('2026-10-01').getTime()
    )
  })

  it('advances candidate by one interval if candidate lands on today and today was already processed', async () => {
    const today = new Date()
    const pastStart = new Date(today.getTime())
    pastStart.setMonth(pastStart.getMonth() - 2)
    pastStart.setDate(today.getDate())

    const futureNext = new Date(today.getTime())
    futureNext.setDate(today.getDate() + 30)

    const processedRecurring: Recurring = {
      ...sampleRecurring,
      startDate: pastStart,
      nextDate: futureNext,
      frequency: 'monthly',
    }

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={processedRecurring}
      />
    )

    const weeklyBtn = screen.getByRole('radio', { name: /أسبوعي/i })
    fireEvent.click(weeklyBtn)

    const submitBtn = screen.getByRole('button', { name: /تعديل المعاملة/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.updateRecurring).toHaveBeenCalledTimes(1)
    })

    const payload = vi.mocked(recurringServices.updateRecurring).mock.calls[0][2]
    expect(payload.nextDate).toBeDefined()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    expect((payload.nextDate as Date).getTime()).toBeGreaterThan(startOfToday.getTime())
  })
})
