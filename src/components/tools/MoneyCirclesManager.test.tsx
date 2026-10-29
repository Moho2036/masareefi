import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MoneyCirclesManager } from './MoneyCirclesManager'
import * as circleServices from '../../services/moneyCircles'
import type { MoneyCircle, Recurring } from '../../types'

vi.mock('../../lib/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...parts) => ({
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  doc: vi.fn((_collOrDb, ...parts) => ({
    id: parts[parts.length - 1] || 'mock-generated-id',
    path: parts.join('/'),
    withConverter: vi.fn().mockReturnThis(),
  })),
  query: vi.fn((c) => c),
  orderBy: vi.fn(),
  where: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn(() => vi.fn()),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  Timestamp: {
    fromDate: (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
  serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
}))

const mockShowToast = vi.fn()
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد' },
  }),
}))

vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: 'KWD',
    config: { code: 'KWD', symbol: 'د.ك', name: 'دينار كويتي', decimals: 3 },
    format: (fils: number) => `${fils / 1000} د.ك`,
    formatWithSign: (fils: number) => `${fils / 1000} د.ك`,
  }),
}))

let mockUserSettings = { monthStartDay: 25 }

vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: mockUserSettings,
    loading: false,
    error: null,
    updateSettings: vi.fn(),
  }),
}))

const sampleCircle: MoneyCircle = {
  id: 'circle-1',
  name: 'جمعية الرواد',
  monthlyAmountFils: 100000,
  membersCount: 5,
  totalAmountFils: 500000,
  myTurnMonth: 3,
  startDate: new Date('2025-01-01'), // in the past
  members: [
    { id: 'mem_1', name: 'عضو 1', turnMonth: 1, paidMonths: [] },
    { id: 'mem_2', name: 'عضو 2', turnMonth: 2, paidMonths: [] },
    { id: 'mem_3', name: 'أنت', turnMonth: 3, paidMonths: [] },
    { id: 'mem_4', name: 'عضو 4', turnMonth: 4, paidMonths: [] },
    { id: 'mem_5', name: 'عضو 5', turnMonth: 5, paidMonths: [] },
  ],
  status: 'active',
  createdAt: new Date('2025-01-01'),
}

const sampleRecurring: Recurring = {
  id: 'rec-circle-1',
  type: 'expense',
  amountFils: 100000,
  categoryId: 'cat-custom-circle',
  title: 'قسط جمعية الرواد',
  note: '',
  frequency: 'monthly',
  startDate: new Date('2025-01-01'),
  nextDate: new Date('2026-10-01'),
  active: true,
  circleId: 'circle-1',
  skipMonth: 3,
}

let mockCircles: MoneyCircle[] = [sampleCircle]
let mockRecurring: Recurring[] = [sampleRecurring]

vi.mock('../../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
    data: mockCircles,
    loading: false,
    error: null,
  }),
}))

vi.mock('../../hooks/useRecurring', () => ({
  useRecurring: () => ({
    data: mockRecurring,
    loading: false,
    error: null,
  }),
}))

let mockCategoriesData = [
  { id: 'cat-default-expense', name: 'مصاريف عامة', type: 'expense', icon: '📁', color: '#10b981', archived: false, order: 0 },
  { id: 'cat-custom-circle', name: 'جمعيات خاصة', type: 'expense', icon: '👥', color: '#3b82f6', archived: false, order: 1 },
  { id: 'cat-income', name: 'دخل', type: 'income', icon: '💵', color: '#10b981', archived: false, order: 2 },
]

vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    data: mockCategoriesData,
    loading: false,
    error: null,
  }),
}))

vi.mock('../../services/moneyCircles', async () => {
  const actual = await vi.importActual<typeof import('../../services/moneyCircles')>('../../services/moneyCircles')
  return {
    ...actual,
    deleteMoneyCircle: vi.fn().mockResolvedValue(undefined),
    updateMoneyCircle: vi.fn().mockResolvedValue(undefined),
    addMoneyCircle: vi.fn().mockResolvedValue('new-circle-id'),
    checkCirclePayoutExists: vi.fn().mockResolvedValue(false),
    checkCircleHasTransactions: vi.fn().mockResolvedValue(false),
    depositCircleNetPayout: vi.fn().mockResolvedValue('payout-tx-id'),
    swapMemberTurns: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../services/recurring', () => ({
  addRecurring: vi.fn().mockResolvedValue('new-rec-id'),
  updateRecurring: vi.fn().mockResolvedValue(undefined),
  deleteRecurring: vi.fn().mockResolvedValue(undefined),
  processDueRecurring: vi.fn().mockResolvedValue(1),
}))

describe('MoneyCirclesManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCircles = [sampleCircle]
    mockRecurring = [sampleRecurring]
    mockCategoriesData = [
      { id: 'cat-default-expense', name: 'مصاريف عامة', type: 'expense', icon: '📁', color: '#10b981', archived: false, order: 0 },
      { id: 'cat-custom-circle', name: 'جمعيات خاصة', type: 'expense', icon: '👥', color: '#3b82f6', archived: false, order: 1 },
      { id: 'cat-income', name: 'دخل', type: 'income', icon: '💵', color: '#10b981', archived: false, order: 2 },
    ]
  })

  it('renders circles and opens delete modal with deleteTransactions toggle', async () => {
    render(<MoneyCirclesManager />)

    expect(screen.getByText('جمعية الرواد')).toBeInTheDocument()

    // Find and click delete button
    const deleteBtn = screen.getByRole('button', { name: /حذف الجمعية/i })
    fireEvent.click(deleteBtn)

    // Verify modal and transaction cleanup checkbox appear
    expect(screen.getByText('تأكيد حذف الجمعية')).toBeInTheDocument()
    const checkbox = screen.getByLabelText(/حذف الأقساط والإيداعات المسجلة/i)
    expect(checkbox).toBeInTheDocument()
    expect((checkbox as HTMLInputElement).checked).toBe(false)

    // Confirm deletion without checking
    const confirmBtn = screen.getByRole('button', { name: 'نعم، حذف الجمعية' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(circleServices.deleteMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        { deleteTransactions: false }
      )
    })
  })

  it('passes deleteTransactions: true when user checks the cleanup option', async () => {
    render(<MoneyCirclesManager />)

    const deleteBtn = screen.getByRole('button', { name: /حذف الجمعية/i })
    fireEvent.click(deleteBtn)

    const checkbox = screen.getByLabelText(/حذف الأقساط والإيداعات المسجلة/i)
    fireEvent.click(checkbox)
    expect((checkbox as HTMLInputElement).checked).toBe(true)

    const confirmBtn = screen.getByRole('button', { name: 'نعم، حذف الجمعية' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(circleServices.deleteMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        { deleteTransactions: true }
      )
    })
  })

  it('preserves existing recurring categoryId when editing a circle', async () => {
    mockCircles = [{ ...sampleCircle, recurringId: 'rec-circle-1' }]
    render(<MoneyCirclesManager />)

    // Click edit button
    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    expect(screen.getByText('تعديل الجمعية المالية')).toBeInTheDocument()

    // Save changes
    const saveBtn = screen.getByRole('button', { name: 'حفظ التعديلات' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          recurringId: 'rec-circle-1',
        }),
        expect.objectContaining({
          createRecurringRule: true,
          defaultCategoryId: expect.any(String),
        })
      )
    })
  })

  it('schedules an unscheduled circle without retroactive deductions using calculateNextDateOnEdit', async () => {
    mockRecurring = [] // no recurring scheduled yet
    mockCircles = [{ ...sampleCircle, recurringId: undefined }]

    render(<MoneyCirclesManager />)

    const scheduleBtn = screen.getByRole('button', { name: /جدولة القسط تلقائياً/i })
    fireEvent.click(scheduleBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        {},
        expect.objectContaining({
          createRecurringRule: true,
          defaultCategoryId: expect.any(String),
        })
      )
    })
  })

  it('shows error toast when scheduling a circle without an expense category', async () => {
    mockCategoriesData = [
      { id: 'cat-income', name: 'دخل', type: 'income', icon: '💵', color: '#10b981', archived: false, order: 0 },
    ]
    mockRecurring = []
    mockCircles = [{ ...sampleCircle, recurringId: undefined }]

    render(<MoneyCirclesManager />)

    const scheduleBtn = screen.getByRole('button', { name: /جدولة القسط تلقائياً/i })
    fireEvent.click(scheduleBtn)

    expect(mockShowToast).toHaveBeenCalledWith('يرجى إنشاء تصنيف مصاريف أولاً', 'error')
    expect(circleServices.updateMoneyCircle).not.toHaveBeenCalled()
  })

  it('deletes recurring rule and unlinks recurringId when autoSchedule is toggled off during edit', async () => {
    mockCircles = [{ ...sampleCircle, recurringId: 'rec-circle-1' }]
    mockRecurring = [{ ...sampleRecurring, id: 'rec-circle-1', circleId: 'circle-1' }]

    render(<MoneyCirclesManager />)

    // Open edit modal
    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // Toggle off autoSchedule
    const autoScheduleToggle = screen.getByRole('switch', { name: /جدولة القسط في المعاملات المتكررة/i })
    expect(autoScheduleToggle).toBeChecked()
    fireEvent.click(autoScheduleToggle)
    expect(autoScheduleToggle).not.toBeChecked()

    // Save
    const saveBtn = screen.getByRole('button', { name: 'حفظ التعديلات' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      // Must pass recurringId: '' and createRecurringRule: false to updateMoneyCircle
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          recurringId: '',
        }),
        expect.objectContaining({
          createRecurringRule: false,
          monthStartDay: expect.any(Number),
        })
      )
    })
  })

  it('updates recurring rule with new amount, title, and skipMonth when autoSchedule remains enabled', async () => {
    mockCircles = [{ ...sampleCircle, recurringId: 'rec-circle-1' }]
    mockRecurring = [{ ...sampleRecurring, id: 'rec-circle-1', circleId: 'circle-1' }]

    render(<MoneyCirclesManager />)

    // Open edit modal
    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // Update name
    const nameInput = screen.getByLabelText(/اسم الجمعية/i)
    fireEvent.change(nameInput, { target: { value: 'جمعية الرواد المحدثة' } })

    // Update amount to 150
    const amountInput = screen.getByLabelText(/القسط الشهري/i)
    fireEvent.change(amountInput, { target: { value: '150' } })

    // Update turn month to 4
    const turnInput = screen.getByLabelText(/دورك في الاستلام/i)
    fireEvent.change(turnInput, { target: { value: '4' } })

    // Save
    const saveBtn = screen.getByRole('button', { name: 'حفظ التعديلات' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          name: 'جمعية الرواد المحدثة',
          monthlyAmountFils: 150000,
          myTurnMonth: 4,
          recurringId: 'rec-circle-1',
        }),
        expect.objectContaining({
          createRecurringRule: true,
        })
      )
    })
  })

  it('preserves member names when decreasing then increasing membersCount and replaces empty names with default', async () => {
    mockCircles = []

    render(<MoneyCirclesManager />)

    // Open Add modal
    const addBtn = screen.getAllByRole('button', { name: /إنشاء جمعية جديدة/i })[0]
    fireEvent.click(addBtn)

    // Enter circle name
    const nameInput = screen.getByLabelText(/اسم الجمعية/i)
    fireEvent.change(nameInput, { target: { value: 'جمعية الأصدقاء' } })

    // Enable manager mode
    const managerToggle = screen.getByRole('switch', { name: /أنا مدير الجمعية/i })
    fireEvent.click(managerToggle)

    // Set count to 4
    const countInput = screen.getByLabelText(/عدد الأعضاء/i)
    fireEvent.change(countInput, { target: { value: '4' } })

    // Member 4 custom name
    const member4Input = screen.getByPlaceholderText(/اسم العضو رقم 4/i)
    fireEvent.change(member4Input, { target: { value: 'أبو أحمد' } })

    // Member 2 set to empty spaces
    const member2Input = screen.getByPlaceholderText(/اسم العضو رقم 2/i)
    fireEvent.change(member2Input, { target: { value: '   ' } })

    // Decrease members count to 3
    fireEvent.change(countInput, { target: { value: '3' } })

    // Increase members count back to 4
    fireEvent.change(countInput, { target: { value: '4' } })

    // Check that member 4 name is still 'أبو أحمد'
    const member4InputAfter = screen.getByPlaceholderText(/اسم العضو رقم 4/i) as HTMLInputElement
    expect(member4InputAfter.value).toBe('أبو أحمد')

    // Save
    const submitBtn = screen.getByRole('button', { name: 'إنشاء الجمعية' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.addMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          members: expect.arrayContaining([
            expect.objectContaining({ turnMonth: 2, name: 'عضو 2' }), // replaced empty name
            expect.objectContaining({ turnMonth: 4, name: 'أبو أحمد' }), // preserved name
          ]),
        })
      )
    })
  })

  it('displays warning when modifying monthly amount for a circle with recorded payments', async () => {
    // Circle with recorded payments
    mockCircles = [
      {
        ...sampleCircle,
        members: [
          { id: 'mem_1', name: 'عضو 1', turnMonth: 1, paidMonths: [1] },
          { id: 'mem_2', name: 'عضو 2', turnMonth: 2, paidMonths: [] },
        ],
      },
    ]

    render(<MoneyCirclesManager />)

    // Open edit modal
    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // Warning not shown initially
    expect(screen.queryByText(/تنبيه بشأن تعديل/i)).not.toBeInTheDocument()

    // Change monthly amount
    const amountInput = screen.getByLabelText(/القسط الشهري/i)
    fireEvent.change(amountInput, { target: { value: '120' } })

    // Warning should now appear
    await waitFor(() => {
      expect(screen.getByText(/تنبيه بشأن تعديل/i)).toBeInTheDocument()
      expect(
        screen.getByText(/تحتوي هذه الجمعية على أقساط أو دفعات مسجلة مسبقاً/i)
      ).toBeInTheDocument()
    })
  })

  it('defaults new circle start date to monthStartDay', async () => {
    mockUserSettings = { monthStartDay: 25 }
    mockCircles = []

    render(<MoneyCirclesManager />)

    const addBtn = screen.getAllByRole('button', { name: /إنشاء جمعية جديدة/i })[0]
    fireEvent.click(addBtn)

    const startDateInput = screen.getByLabelText(/تاريخ البدء/i) as HTMLInputElement
    expect(startDateInput.value.endsWith('-25')).toBe(true)
  })

  it('renders "مستلم الدورة (معفى)" badge for this month receiver and keeps paid count bounded', async () => {
    // Circle where member 1 has turnMonth 1 and viewingMonth is 1
    mockCircles = [
      {
        ...sampleCircle,
        isManager: true,
        members: [
          { id: 'mem_1', name: 'عضو 1', turnMonth: 1, paidMonths: [] },
          { id: 'mem_2', name: 'عضو 2', turnMonth: 2, paidMonths: [1] },
          { id: 'mem_3', name: 'عضو 3', turnMonth: 3, paidMonths: [1] },
          { id: 'mem_4', name: 'عضو 4', turnMonth: 4, paidMonths: [1] },
          { id: 'mem_5', name: 'عضو 5', turnMonth: 5, paidMonths: [1] },
        ],
      },
    ]

    render(<MoneyCirclesManager />)

    // Open members tracking table
    const expandBtn = screen.getByRole('button', { name: /تتبع دفعات الأعضاء/i })
    fireEvent.click(expandBtn)

    // Select month 1
    const month1Btn = screen.getByRole('button', { name: 'شهر 1' })
    fireEvent.click(month1Btn)

    // Payer count should be 5 of 5 (4 non-receivers + 1 exempt receiver)
    expect(screen.getByText(/5 من 5 دفعوا/i)).toBeInTheDocument()

    // Member 1 is the receiver for month 1: should show static "مستلم الدورة (معفى)" badge
    expect(screen.getByText('مستلم الدورة (معفى)')).toBeInTheDocument()
  })

  it('strips member payout turn month from paidMonths when saving updated turns', async () => {
    // Member had paidMonths containing month 2, but their new turn is set to 2
    mockCircles = [
      {
        ...sampleCircle,
        isManager: true,
        members: [
          { id: 'mem_1', name: 'عضو 1', turnMonth: 1, paidMonths: [2] },
          { id: 'mem_2', name: 'عضو 2', turnMonth: 2, paidMonths: [1, 2] },
        ],
      },
    ]

    render(<MoneyCirclesManager />)

    // Open edit modal
    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // Save circle
    const submitBtn = screen.getByRole('button', { name: /حفظ التعديلات/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          members: expect.arrayContaining([
            // Turn 2 member should NOT have 2 in their paidMonths
            expect.objectContaining({
              turnMonth: 2,
              paidMonths: expect.not.arrayContaining([2]),
            }),
          ]),
        }),
        expect.objectContaining({
          monthStartDay: expect.any(Number),
        })
      )
    })
  })

  it('updates startDate and recalculates nextDate in recurring transaction when circle start date changes', async () => {
    mockCircles = [
      {
        ...sampleCircle,
        startDate: new Date('2026-01-01'),
        recurringId: 'rec-circle-1',
      },
    ]
    mockRecurring = [
      {
        ...sampleRecurring,
        startDate: new Date('2026-01-01'),
        nextDate: new Date('2026-02-01'),
      },
    ]

    render(<MoneyCirclesManager />)

    // Open edit modal
    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // Change start date to 2026-11-15 (future date)
    const startDateInput = screen.getByLabelText(/تاريخ البدء/i)
    fireEvent.change(startDateInput, { target: { value: '2026-11-15' } })

    // Save
    const submitBtn = screen.getByRole('button', { name: /حفظ التعديلات/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          startDate: expect.any(Date),
        }),
        expect.objectContaining({
          createRecurringRule: true,
        })
      )
    })
  })

  it('shows amount change warning if depositedMonths has previous entries', async () => {
    mockCircles = [
      {
        ...sampleCircle,
        depositedMonths: [1],
      } as unknown as MoneyCircle,
    ]

    render(<MoneyCirclesManager />)

    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    const amountInput = screen.getByLabelText(/القسط الشهري/i)
    fireEvent.change(amountInput, { target: { value: '250' } })

    await waitFor(() => {
      expect(screen.getByText(/تنبيه بشأن تعديل/i)).toBeInTheDocument()
    })
  })

  it('displays emerald completion banner when active circle has all obligations fulfilled and allows completing it', async () => {
    vi.spyOn(circleServices, 'checkCirclePayoutExists').mockResolvedValue(true)
    mockCircles = [
      {
        ...sampleCircle,
        membersCount: 2,
        myTurnMonth: 1,
        startDate: new Date('2025-01-01'),
        members: [
          { id: 'mem_1', name: 'أنت', turnMonth: 1, paidMonths: [2] },
          { id: 'mem_2', name: 'عضو 2', turnMonth: 2, paidMonths: [1] },
        ],
        status: 'active',
      },
    ]

    render(<MoneyCirclesManager />)

    await waitFor(() => {
      expect(
        screen.getByText(/اكتملت جميع التزامات وأدوار هذه الجمعية! يمكنك الآن نقلها إلى الأرشيف \(مكتملة\)\./i)
      ).toBeInTheDocument()
    })

    const completeBtn = screen.getAllByRole('button', { name: /إنهاء الجمعية/i })[0]
    fireEvent.click(completeBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        { status: 'completed' },
        expect.any(Object)
      )
    })
  })

  it('cleans paymentsByMonth beyond new membersCount when editing circle', async () => {
    mockCircles = [
      {
        ...sampleCircle,
        membersCount: 5,
        members: [
          {
            id: 'mem_1',
            name: 'عضو 1',
            turnMonth: 1,
            paidMonths: [2, 3, 4, 5],
            paymentsByMonth: { '2': true, '3': true, '4': true, '5': true },
          },
          { id: 'mem_2', name: 'عضو 2', turnMonth: 2, paidMonths: [1, 3] },
          { id: 'mem_3', name: 'أنت', turnMonth: 3, paidMonths: [1, 2] },
          { id: 'mem_4', name: 'عضو 4', turnMonth: 4, paidMonths: [1, 2] },
          { id: 'mem_5', name: 'عضو 5', turnMonth: 5, paidMonths: [1, 2] },
        ],
      },
    ]

    render(<MoneyCirclesManager />)

    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    const membersSelect = screen.getByLabelText(/عدد الأعضاء/i)
    fireEvent.change(membersSelect, { target: { value: '3' } })

    const submitBtn = screen.getByRole('button', { name: /حفظ التعديلات/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          membersCount: 3,
          members: expect.arrayContaining([
            expect.objectContaining({
              id: 'mem_1',
              paidMonths: [2, 3],
              paymentsByMonth: { '2': true, '3': true },
            }),
          ]),
        }),
        expect.any(Object)
      )
    })
  })

  it('shows deposit net payout button when circle has elapsed duration if user has not deposited yet', async () => {
    vi.spyOn(circleServices, 'checkCirclePayoutExists').mockResolvedValue(false)
    mockCircles = [
      {
        ...sampleCircle,
        membersCount: 2,
        myTurnMonth: 1,
        startDate: new Date('2024-01-01'), // Long elapsed
        status: 'active',
      },
    ]

    render(<MoneyCirclesManager />)

    // Button should be visible despite diffMonths >= membersCount!
    expect(screen.getByRole('button', { name: /إيداع صافي الجمعية في الرصيد/i })).toBeInTheDocument()
  })

  it('swaps user and member data cleanly when myTurnMonth is changed on edit', async () => {
    mockCircles = [
      {
        ...sampleCircle,
        isManager: true,
        membersCount: 3,
        myTurnMonth: 1,
        startDate: new Date('2026-01-01'),
        members: [
          { id: 'mem_user', name: 'أنت', turnMonth: 1, paidMonths: [2, 3] },
          { id: 'mem_ali', name: 'علي', turnMonth: 2, paidMonths: [1, 3] },
          { id: 'mem_omar', name: 'عمر', turnMonth: 3, paidMonths: [1, 2] },
        ],
      },
    ]

    render(<MoneyCirclesManager />)

    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // Change my turn from 1 to 2
    const turnSelect = screen.getByLabelText(/دورك في الاستلام/i)
    fireEvent.change(turnSelect, { target: { value: '2' } })

    const submitBtn = screen.getByRole('button', { name: /حفظ التعديلات/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          myTurnMonth: 2,
          members: expect.arrayContaining([
            // Seat 2 (user's new turn): took user member data, stripped month 2 (turn)
            expect.objectContaining({
              id: 'mem_user',
              name: 'أنت',
              turnMonth: 2,
              paidMonths: [3],
            }),
            // Seat 1 (swapped with Ali): took Ali's data, stripped month 1 (seat 1 turn)
            expect.objectContaining({
              id: 'mem_ali',
              turnMonth: 1,
              paidMonths: [3],
            }),
            // Seat 3 (Omar): preserved
            expect.objectContaining({
              id: 'mem_omar',
              name: 'عمر',
              turnMonth: 3,
              paidMonths: [1, 2],
            }),
          ]),
        }),
        expect.any(Object)
      )
    })
  })

  it('displays paused recurring status and allows resuming when recurring rule active is false', async () => {
    mockCircles = [
      {
        ...sampleCircle,
        recurringId: 'rec-paused-1',
      },
    ]
    mockRecurring = [
      {
        ...sampleRecurring,
        id: 'rec-paused-1',
        circleId: 'circle-1',
        active: false,
      },
    ]

    render(<MoneyCirclesManager />)

    expect(screen.getByText(/الجدولة التلقائية متوقفة مؤقتاً/i)).toBeInTheDocument()
    const resumeBtn = screen.getByRole('button', { name: /تفعيل الجدولة/i })
    expect(resumeBtn).toBeInTheDocument()
  })

  it('preserves paused recurring rule and does not send recurringId: "" when editing circle without touching autoSchedule toggle', async () => {
    mockCircles = [
      {
        ...sampleCircle,
        id: 'circle-1',
        recurringId: 'rec-paused-1',
      },
    ]
    mockRecurring = [
      {
        ...sampleRecurring,
        id: 'rec-paused-1',
        circleId: 'circle-1',
        active: false,
      },
    ]

    render(<MoneyCirclesManager />)

    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // User edits the name only, without touching the autoSchedule toggle
    const nameInput = screen.getByLabelText(/اسم الجمعية/i)
    fireEvent.change(nameInput, { target: { value: 'جمعية الرواد المعدلة' } })

    const submitBtn = screen.getByRole('button', { name: /حفظ التعديلات/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          name: 'جمعية الرواد المعدلة',
          recurringId: 'rec-paused-1',
        }),
        expect.objectContaining({
          createRecurringRule: false,
        })
      )
    })
  })

  it('calls toggleCircleMemberPayment when toggling user payment in manager view', async () => {
    vi.spyOn(circleServices, 'toggleCircleMemberPayment').mockResolvedValue({
      isUser: true,
      paid: true,
    })
    mockCircles = [
      {
        ...sampleCircle,
        isManager: true,
        membersCount: 3,
        myTurnMonth: 2,
        members: [
          { id: 'mem_1', name: 'عضو 1', turnMonth: 1, paidMonths: [] },
          { id: 'mem_user', name: 'أنت', turnMonth: 2, paidMonths: [] },
          { id: 'mem_3', name: 'عضو 3', turnMonth: 3, paidMonths: [] },
        ],
      },
    ]

    render(<MoneyCirclesManager />)

    // Expand manager table
    const expandBtn = screen.getByRole('button', { name: /تتبع دفعات الأعضاء/i })
    fireEvent.click(expandBtn)

    // Find the toggle button for user (seat 2, viewing month 1)
    // Month 1 receiver is mem_1. mem_user is not receiver in month 1, so button is active.
    const unpaidButtons = screen.getAllByRole('button', { name: /لم يدفع|دفع/i })
    fireEvent.click(unpaidButtons[0])

    await waitFor(() => {
      expect(circleServices.toggleCircleMemberPayment).toHaveBeenCalled()
    })
  })

  it('does not display false warning when editing a new circle whose turn is in month 1', async () => {
    const turn1Circle: MoneyCircle = {
      ...sampleCircle,
      id: 'circle-turn1',
      myTurnMonth: 1,
      startDate: new Date('2026-05-01'),
      membersCount: 5,
      members: [
        { id: 'mem_1', name: 'أنت', turnMonth: 1, paidMonths: [] },
        { id: 'mem_2', name: 'عضو 2', turnMonth: 2, paidMonths: [] },
        { id: 'mem_3', name: 'عضو 3', turnMonth: 3, paidMonths: [] },
        { id: 'mem_4', name: 'عضو 4', turnMonth: 4, paidMonths: [] },
        { id: 'mem_5', name: 'عضو 5', turnMonth: 5, paidMonths: [] },
      ],
      recurringId: 'rec-turn1',
    }
    mockCircles = [turn1Circle]
    // Month 1 turn means initial dueDate is month 2 (2026-06-01)
    mockRecurring = [
      {
        ...sampleRecurring,
        id: 'rec-turn1',
        circleId: 'circle-turn1',
        startDate: new Date('2026-05-01'),
        nextDate: new Date('2026-06-01'),
      },
    ]

    render(<MoneyCirclesManager />)

    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    // Change monthly amount
    const amountInput = screen.getByLabelText(/القسط الشهري/i)
    fireEvent.change(amountInput, { target: { value: '150' } })

    // Ensure the warning about previously recorded payments is NOT shown
    expect(screen.queryByText(/تحتوي هذه الجمعية على أقساط أو دفعات مسجلة مسبقاً/i)).toBeNull()
  })

  it('renders celebratory completion banner with finish button for non-manager circle when time is completed and payout is deposited', async () => {
    vi.mocked(circleServices.checkCirclePayoutExists).mockResolvedValueOnce(true)
    const completedNonManagerCircle: MoneyCircle = {
      ...sampleCircle,
      id: 'circle-completed-non-manager',
      isManager: false,
      status: 'active',
      startDate: new Date('2024-01-01'), // Long past
      membersCount: 5,
    }
    mockCircles = [completedNonManagerCircle]

    render(<MoneyCirclesManager />)

    await waitFor(() => {
      expect(
        screen.getByText(/اكتملت جميع التزامات وأدوار هذه الجمعية! يمكنك الآن نقلها إلى الأرشيف/i)
      ).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /إنهاء الجمعية/i }).length).toBeGreaterThan(0)
    })
  })

  it('sorts circles: active circles first, completed last; newest startDate first within groups', () => {
    const c1: MoneyCircle = {
      ...sampleCircle,
      id: 'circle-completed-old',
      name: 'جمعية مكتملة قديمة',
      status: 'completed',
      startDate: new Date('2025-01-01'),
    }
    const c2: MoneyCircle = {
      ...sampleCircle,
      id: 'circle-active-older',
      name: 'جمعية نشطة أقدم',
      status: 'active',
      startDate: new Date('2026-01-01'),
    }
    const c3: MoneyCircle = {
      ...sampleCircle,
      id: 'circle-active-newer',
      name: 'جمعية نشطة أحدث',
      status: 'active',
      startDate: new Date('2026-06-01'),
    }
    const c4: MoneyCircle = {
      ...sampleCircle,
      id: 'circle-completed-newer',
      name: 'جمعية مكتملة أحدث',
      status: 'completed',
      startDate: new Date('2025-06-01'),
    }

    mockCircles = [c1, c2, c3, c4]
    render(<MoneyCirclesManager />)

    const titles = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    // Expected order:
    // 1. circle-active-newer ('جمعية نشطة أحدث')
    // 2. circle-active-older ('جمعية نشطة أقدم')
    // 3. circle-completed-newer ('جمعية مكتملة أحدث')
    // 4. circle-completed-old ('جمعية مكتملة قديمة')
    expect(titles[0]).toContain('جمعية نشطة أحدث')
    expect(titles[1]).toContain('جمعية نشطة أقدم')
    expect(titles[2]).toContain('جمعية مكتملة أحدث')
    expect(titles[3]).toContain('جمعية مكتملة قديمة')
  })

  it('allows membersCount and myTurnMonth inputs to be cleared with backspace while typing', () => {
    mockCircles = []
    render(<MoneyCirclesManager />)

    const addBtn = screen.getAllByRole('button', { name: /إنشاء جمعية جديدة/i })[0]
    fireEvent.click(addBtn)

    const countInput = screen.getByLabelText(/عدد الأعضاء/i) as HTMLInputElement
    const turnInput = screen.getByLabelText(/دورك في الاستلام/i) as HTMLInputElement

    // Clear count input to empty string (Backspace)
    fireEvent.change(countInput, { target: { value: '' } })
    expect(countInput.value).toBe('')

    // Type 6
    fireEvent.change(countInput, { target: { value: '6' } })
    expect(countInput.value).toBe('6')

    // Blur count input: should remain 6
    fireEvent.blur(countInput)
    expect(countInput.value).toBe('6')

    // Clear turn input to empty string
    fireEvent.change(turnInput, { target: { value: '' } })
    expect(turnInput.value).toBe('')

    // Blur turn input: should safely clamp to 1
    fireEvent.blur(turnInput)
    expect(turnInput.value).toBe('1')
  })

  it('supports selecting double share size and second turn month in add modal', async () => {
    mockCircles = []
    render(<MoneyCirclesManager />)

    const addBtn = screen.getAllByRole('button', { name: /إنشاء جمعية جديدة/i })[0]
    fireEvent.click(addBtn)

    const nameInput = screen.getByLabelText(/اسم الجمعية/i)
    fireEvent.change(nameInput, { target: { value: 'جمعية الاستثمار' } })

    // Click double share button
    const doubleShareBtn = screen.getByRole('button', { name: /سهمان \(دورين\)/i })
    fireEvent.click(doubleShareBtn)

    // Second turn month select appears
    const secondTurnSelect = screen.getByLabelText(/الدور الثاني للاستلام/i) as HTMLSelectElement
    expect(secondTurnSelect).toBeInTheDocument()
    fireEvent.change(secondTurnSelect, { target: { value: '4' } })

    const submitBtn = screen.getByRole('button', { name: /^إنشاء الجمعية$/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(circleServices.addMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          name: 'جمعية الاستثمار',
          shareType: 'double',
          secondTurnMonth: 4,
        })
      )
    })
  })

  it('allows manager to swap member turns and calls swapMemberTurns', async () => {
    mockCircles = [
      {
        ...sampleCircle,
        isManager: true,
      },
    ]

    render(<MoneyCirclesManager />)

    // Expand member tracking
    const expandBtn = screen.getByRole('button', { name: /تتبع دفعات الأعضاء/i })
    fireEvent.click(expandBtn)

    // Member row swap button
    const swapBtns = screen.getAllByTitle(/تبديل الدور ⇄/i)
    expect(swapBtns.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(swapBtns[0]) // click swap for member 1

    expect(screen.getByText(/تبديل الدور بين الأعضاء/i)).toBeInTheDocument()

    const confirmSwapBtn = screen.getByRole('button', { name: /تأكيد تبديل الدور ⇄/i })
    fireEvent.click(confirmSwapBtn)

    await waitFor(() => {
      expect(circleServices.swapMemberTurns).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ monthStartDay: expect.any(Number) })
      )
    })
  })

  it('prevents duplicate "أنت" when changing turn before toggling manager mode', async () => {
    mockCircles = []

    render(<MoneyCirclesManager />)

    // Open add circle modal
    const addBtn = screen.getAllByRole('button', { name: /إنشاء جمعية جديدة/i })[0]
    fireEvent.click(addBtn)

    expect(screen.getByText(/إنشاء جمعية مالية جديدة/i)).toBeInTheDocument()

    // Change turn month to 4 before enabling manager
    const turnInput = screen.getByLabelText(/دورك في الاستلام/i)
    fireEvent.change(turnInput, { target: { value: '4' } })
    fireEvent.blur(turnInput)

    // Enable manager toggle
    const managerToggle = screen.getByLabelText(/أنا مدير الجمعية/i)
    fireEvent.click(managerToggle)

    // Verify member 1 is "عضو 1" and member 4 is "أنت"
    const member1Input = screen.getByPlaceholderText('اسم العضو رقم 1') as HTMLInputElement
    const member4Input = screen.getByPlaceholderText('اسم العضو رقم 4') as HTMLInputElement

    expect(member1Input.value).toBe('عضو 1')
    expect(member4Input.value).toBe('أنت')

    // Verify "أنت" appears exactly once in the custom members list
    const youInputs = screen.getAllByDisplayValue('أنت')
    expect(youInputs).toHaveLength(1)
  })
})
