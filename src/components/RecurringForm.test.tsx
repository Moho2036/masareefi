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

  it('disables hasEndDate toggle and endDate input and displays guidance banner when selecting a circle from dropdown', async () => {
    mockCirclesData = [
      {
        id: 'circle-dropdown-test',
        name: 'جمعية الدوام',
        status: 'active',
        monthlyAmountFils: 100000,
        totalAmountFils: 500000,
        myTurnMonth: 3,
        startDate: new Date('2026-01-01'),
        membersCount: 5,
        members: [],
        createdAt: new Date('2026-01-01'),
      },
    ]
    mockRecurringData = []

    render(<RecurringForm isOpen={true} onClose={vi.fn()} defaultType="expense" />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'circle-dropdown-test' } })

    // Info banner should appear
    expect(
      screen.getByText(
        /تاريخ البدء، تاريخ الانتهاء، التكرار الشهري، وشهر الإعفاء يتم ضبطها وإدارتها تلقائياً بناءً على إعدادات الجمعية المالية المختارة/i
      )
    ).toBeInTheDocument()

    // hasEndDate toggle should be disabled
    const endDateToggle = screen.getByRole('switch', { name: /تحديد تاريخ انتهاء/i })
    expect(endDateToggle).toBeDisabled()

    // endDate input should be disabled
    const endDateInput = screen.getByLabelText(/تاريخ الانتهاء/i)
    expect(endDateInput).toBeDisabled()
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
        /تاريخ البدء، تاريخ الانتهاء، التكرار الشهري، وشهر الإعفاء يتم ضبطها وإدارتها تلقائياً بناءً على إعدادات الجمعية المالية المختارة/i
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
        /تاريخ البدء، تاريخ الانتهاء، التكرار الشهري، وشهر الإعفاء يتم ضبطها وإدارتها تلقائياً بناءً على إعدادات الجمعية المالية المختارة/i
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

    // End date toggle is disabled
    const endDateToggle = screen.getByRole('switch', { name: /تحديد تاريخ انتهاء/i })
    expect(endDateToggle).toBeDisabled()
  })

  it('resets fields and clears circle title when switching back to unlinked', () => {
    mockCirclesData = [
      {
        id: 'c-test-unlink',
        name: 'جمعية التطوير',
        status: 'active',
        monthlyAmountFils: 150000,
        totalAmountFils: 1500000,
        myTurnMonth: 3,
        startDate: new Date('2026-05-01'),
        membersCount: 10,
        members: [],
        createdAt: new Date('2026-05-01'),
      },
    ]

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    const circleSelect = screen.getByLabelText(/ربط مع جمعية نشطة/i)
    fireEvent.change(circleSelect, { target: { value: 'c-test-unlink' } })

    const titleInput = screen.getByLabelText(/عنوان المعاملة/i) as HTMLInputElement
    expect(titleInput.value).toBe('قسط جمعية التطوير')

    // Now switch back to unlinked
    fireEvent.change(circleSelect, { target: { value: '' } })

    expect(titleInput.value).toBe('')
    const endDateToggle = screen.getByRole('switch', { name: /تحديد تاريخ انتهاء/i })
    expect(endDateToggle).not.toBeChecked()
  })

  it('computes nextDate via getNextCircleDueDate and synchronizes circle amount when creating new linked recurring rule', async () => {
    mockCirclesData = [
      {
        id: 'c-test-create-sync',
        name: 'جمعية التوفير',
        status: 'active',
        monthlyAmountFils: 100000,
        totalAmountFils: 500000,
        myTurnMonth: 1, // User turn is month 1! So nextDate must skip month 1 and point to month 2!
        startDate: new Date('2026-01-01'),
        membersCount: 5,
        members: [
          { id: 'm-1', name: 'أنت', turnMonth: 1, paidMonths: [] },
        ],
        createdAt: new Date('2026-01-01'),
      },
    ]

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    // Select category
    const catBtn = screen.getByRole('button', { name: /إيجار وسكن/ })
    fireEvent.click(catBtn)

    // Select circle
    const circleSelect = screen.getByLabelText(/ربط مع جمعية نشطة/i)
    fireEvent.change(circleSelect, { target: { value: 'c-test-create-sync' } })

    // Change amount to 120 (120000 fils)
    const amountInput = screen.getByLabelText(/المبلغ/i)
    fireEvent.change(amountInput, { target: { value: '120' } })

    const submitBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.addRecurring).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          circleId: 'c-test-create-sync',
          amountFils: 120000,
          nextDate: expect.any(Date),
          skipMonth: 1,
        })
      )
    })

    const callArgs = vi.mocked(recurringServices.addRecurring).mock.calls[0][1]
    // Month 1 is user's turn, so nextDate points to Month 2 (Feb, index 1)
    expect(callArgs.nextDate.getMonth()).toBe(1)

    // Expect circle amount to be synchronized
    expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
      'user-123',
      'c-test-create-sync',
      {
        monthlyAmountFils: 120000,
        totalAmountFils: 120000 * 5,
      }
    )
  })

  it('preserves skipMonths when editing a recurring transaction linked to a double-share circle', async () => {
    const doubleShareCircle: MoneyCircle = {
      id: 'circle-double',
      name: 'جمعية الأسرة',
      monthlyAmountFils: 100000,
      totalAmountFils: 1000000,
      status: 'active',
      startDate: new Date('2026-01-01'),
      membersCount: 10,
      myTurnMonth: 3,
      shareType: 'double',
      secondTurnMonth: 7,
      members: [
        { id: 'm-1', name: 'أنت', turnMonth: 3, paidMonths: [] },
      ],
      createdAt: new Date('2026-01-01'),
    }

    mockCirclesData = [doubleShareCircle]

    const existingRecurring: Recurring = {
      id: 'rec-double-1',
      type: 'expense',
      amountFils: 100000,
      categoryId: 'c-rent',
      frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      nextDate: new Date('2026-01-01'),
      title: 'قسط جمعية الأسرة',
      note: '',
      active: true,
      circleId: 'circle-double',
      skipMonth: 3,
      skipMonths: [3, 7],
      createdAt: new Date('2026-01-01'),
    }

    render(
      <RecurringForm
        isOpen={true}
        onClose={vi.fn()}
        initialRecurring={existingRecurring}
      />
    )

    // Submit without changing circle
    const submitBtn = screen.getByRole('button', { name: /تعديل المعاملة/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(recurringServices.updateRecurring).toHaveBeenCalledWith(
        'user-123',
        'rec-double-1',
        expect.objectContaining({
          circleId: 'circle-double',
          skipMonth: 3,
          skipMonths: [3, 7],
        })
      )
    })
  })
})
