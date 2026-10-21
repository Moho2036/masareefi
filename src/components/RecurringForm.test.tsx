import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecurringForm } from './RecurringForm'
import * as recurringServices from '../services/recurring'
import * as circleServices from '../services/moneyCircles'
import type { Recurring, MoneyCircle } from '../types'

vi.mock('../services/recurring', () => ({
  addRecurring: vi.fn().mockResolvedValue('mock-rec-id'),
  updateRecurring: vi.fn().mockResolvedValue(undefined),
  processDueRecurring: vi.fn().mockResolvedValue(0),
}))

vi.mock('../services/moneyCircles', () => ({
  updateMoneyCircle: vi.fn().mockResolvedValue(undefined),
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
      { id: 'c-archived', name: 'اشتراك ملغى', type: 'expense', icon: '📦', color: '#94A3B8', archived: true, order: 2 },
    ],
    loading: false,
    error: null,
  }),
}))

let mockCirclesData: MoneyCircle[] = []
let mockRecurringData: Recurring[] = []

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
    data: mockCirclesData,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useRecurring', () => ({
  useRecurring: () => ({
    data: mockRecurringData,
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
    mockCirclesData = []
    mockRecurringData = []
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

  it('filters out money circles that are already linked to other recurring transactions', () => {
    mockCirclesData = [
      {
        id: 'circle-free',
        name: 'جمعية متاحة',
        status: 'active',
        monthlyAmountFils: 100000,
        totalAmountFils: 500000,
        myTurnMonth: 1,
        startDate: new Date('2026-01-01'),
        membersCount: 5,
        members: [],
        createdAt: new Date('2026-01-01'),
        recurringId: undefined,
      },
      {
        id: 'circle-taken',
        name: 'جمعية مرتبطة مسبقاً',
        status: 'active',
        monthlyAmountFils: 100000,
        totalAmountFils: 500000,
        myTurnMonth: 2,
        startDate: new Date('2026-01-01'),
        membersCount: 5,
        members: [],
        createdAt: new Date('2026-01-01'),
        recurringId: 'rec-other',
      },
    ]
    mockRecurringData = [
      {
        id: 'rec-other',
        circleId: 'circle-taken',
        type: 'expense',
        amountFils: 100000,
        categoryId: 'c-rent',
        title: 'قسط',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        nextDate: new Date('2026-11-01'),
        active: true,
      },
    ]

    render(<RecurringForm isOpen={true} onClose={vi.fn()} defaultType="expense" />)

    expect(screen.getByText(/جمعية متاحة/i)).toBeInTheDocument()
    expect(screen.queryByText(/جمعية مرتبطة مسبقاً/i)).not.toBeInTheDocument()
  })

  it('preserves currently linked money circle in select options and shows info banner when editing', () => {
    mockCirclesData = [
      {
        id: 'circle-my-own',
        name: 'جمعيتي الحالية',
        status: 'active',
        monthlyAmountFils: 100000,
        totalAmountFils: 500000,
        myTurnMonth: 3,
        startDate: new Date('2026-01-01'),
        membersCount: 5,
        members: [],
        createdAt: new Date('2026-01-01'),
        recurringId: 'rec-1',
      },
    ]
    mockRecurringData = [
      {
        id: 'rec-1',
        circleId: 'circle-my-own',
        type: 'expense',
        amountFils: 100000,
        categoryId: 'c-rent',
        title: 'قسط',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        nextDate: new Date('2026-11-01'),
        active: true,
      },
    ]

    const editingRecurring: Recurring = {
      ...sampleRecurring,
      id: 'rec-1',
      circleId: 'circle-my-own',
      skipMonth: 3,
    }

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={editingRecurring}
      />
    )

    // Select dropdown option exists
    expect(screen.getByRole('option', { name: /جمعيتي الحالية/i })).toBeInTheDocument()
    // Info banner is displayed
    expect(
      screen.getByText(
        /هذه القاعدة مرتبطة بجمعية مالية — يتم التحكم في تاريخ البدء، التكرار الشهري، وشهر الإعفاء تلقائياً من صفحة الجمعيات/i
      )
    ).toBeInTheDocument()
  })

  it('synchronizes circle amounts when editing recurring transaction amount', async () => {
    mockCirclesData = [
      {
        id: 'circle-my-own',
        name: 'جمعيتي الحالية',
        status: 'active',
        monthlyAmountFils: 100000,
        totalAmountFils: 500000,
        myTurnMonth: 3,
        startDate: new Date('2026-01-01'),
        membersCount: 5,
        members: [],
        createdAt: new Date('2026-01-01'),
        recurringId: 'rec-1',
      },
    ]

    const editingRecurring: Recurring = {
      ...sampleRecurring,
      id: 'rec-1',
      circleId: 'circle-my-own',
      amountFils: 100000,
    }

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={editingRecurring}
      />
    )

    const amountInput = screen.getByLabelText(/المبلغ/i)
    fireEvent.change(amountInput, { target: { value: '150' } })

    const submitBtn = screen.getByRole('button', { name: /تعديل المعاملة/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-my-own',
        {
          monthlyAmountFils: 150000,
          totalAmountFils: 750000,
        }
      )
    })
  })

  it('preserves archived category when editing recurring transaction linked to it and labels it (مؤرشف)', () => {
    const editingRecurring: Recurring = {
      ...sampleRecurring,
      id: 'rec-archived',
      categoryId: 'c-archived',
    }

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={editingRecurring}
      />
    )

    expect(screen.getByText(/اشتراك ملغى \(مؤرشف\)/i)).toBeInTheDocument()
  })

  it('locks type, frequency, startDate, and circle select and shows guidance banner when editing a circle-linked recurring item', () => {
    mockCirclesData = [
      {
        id: 'circle-lock-test',
        name: 'جمعية الرواد',
        status: 'active',
        monthlyAmountFils: 200000,
        totalAmountFils: 2000000,
        myTurnMonth: 5,
        startDate: new Date('2026-01-01'),
        membersCount: 10,
        members: [],
        createdAt: new Date('2026-01-01'),
        recurringId: 'rec-circle-lock',
      },
    ]

    const circleRecurring: Recurring = {
      ...sampleRecurring,
      id: 'rec-circle-lock',
      circleId: 'circle-lock-test',
      frequency: 'monthly',
      type: 'expense',
    }

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={circleRecurring}
      />
    )

    // Banner is visible
    expect(
      screen.getByText(
        /هذه القاعدة مرتبطة بجمعية مالية — يتم التحكم في تاريخ البدء، التكرار الشهري، وشهر الإعفاء تلقائياً من صفحة الجمعيات/i
      )
    ).toBeInTheDocument()

    // Type options are disabled
    const expenseOption = screen.getByRole('radio', { name: /مصروف/i })
    const incomeOption = screen.getByRole('radio', { name: /دخل/i })
    expect(expenseOption).toBeDisabled()
    expect(incomeOption).toBeDisabled()

    // Frequency options are disabled
    const monthlyOption = screen.getByRole('radio', { name: /شهري/i })
    expect(monthlyOption).toBeDisabled()

    // Start date input is disabled
    const startDateInput = screen.getByLabelText(/تاريخ البداية/i)
    expect(startDateInput).toBeDisabled()
  })
})
