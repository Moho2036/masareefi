import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MoneyCirclesManager } from './MoneyCirclesManager'
import * as circleServices from '../../services/moneyCircles'
import * as recurringServices from '../../services/recurring'
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

vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-default-expense', name: 'مصاريف عامة', type: 'expense', icon: '📁', color: '#10b981', archived: false, order: 0 },
      { id: 'cat-custom-circle', name: 'جمعيات خاصة', type: 'expense', icon: '👥', color: '#3b82f6', archived: false, order: 1 },
      { id: 'cat-income', name: 'دخل', type: 'income', icon: '💵', color: '#10b981', archived: false, order: 2 },
    ],
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
    depositCircleNetPayout: vi.fn().mockResolvedValue('payout-tx-id'),
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
  })

  it('renders circles and opens delete modal with deleteTransactions toggle', async () => {
    render(<MoneyCirclesManager />)

    expect(screen.getByText('جمعية الرواد')).toBeInTheDocument()

    // Find and click delete button
    const deleteBtn = screen.getByRole('button', { name: /حذف الجمعية/i })
    fireEvent.click(deleteBtn)

    // Verify modal and transaction cleanup checkbox appear
    expect(screen.getByText('تأكيد حذف الجمعية')).toBeInTheDocument()
    const checkbox = screen.getByLabelText(/حذف الأقساط والإيداعات المسجلة سابقاً/i)
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

    const checkbox = screen.getByLabelText(/حذف الأقساط والإيداعات المسجلة سابقاً/i)
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
    render(<MoneyCirclesManager />)

    // Click edit button
    const editBtn = screen.getByTitle('تعديل الجمعية')
    fireEvent.click(editBtn)

    expect(screen.getByText('تعديل الجمعية المالية')).toBeInTheDocument()

    // Save changes
    const saveBtn = screen.getByRole('button', { name: 'حفظ التعديلات' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(recurringServices.updateRecurring).toHaveBeenCalledWith(
        'user-123',
        'rec-circle-1',
        expect.objectContaining({
          categoryId: 'cat-custom-circle', // Preserved from sampleRecurring!
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
      expect(recurringServices.addRecurring).toHaveBeenCalled()
    })

    const callArgs = vi.mocked(recurringServices.addRecurring).mock.calls[0]
    expect(callArgs[0]).toBe('user-123')
    expect(callArgs[1].startDate).toEqual(sampleCircle.startDate)
    expect(callArgs[1].nextDate).not.toEqual(sampleCircle.startDate)
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
      // Must delete existing recurring rule
      expect(recurringServices.deleteRecurring).toHaveBeenCalledWith('user-123', 'rec-circle-1')
      // Must clear recurringId
      expect(circleServices.updateMoneyCircle).toHaveBeenCalledWith(
        'user-123',
        'circle-1',
        expect.objectContaining({
          recurringId: '',
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
      expect(recurringServices.updateRecurring).toHaveBeenCalledWith(
        'user-123',
        'rec-circle-1',
        expect.objectContaining({
          title: 'قسط جمعية الرواد المحدثة',
          amountFils: 150000,
          skipMonth: 4,
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
    expect(screen.queryByText(/تنبيه بشأن تعديل القسط الشهري/i)).not.toBeInTheDocument()

    // Change monthly amount
    const amountInput = screen.getByLabelText(/القسط الشهري/i)
    fireEvent.change(amountInput, { target: { value: '120' } })

    // Warning should now appear
    await waitFor(() => {
      expect(screen.getByText(/تنبيه بشأن تعديل القسط الشهري/i)).toBeInTheDocument()
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
})
