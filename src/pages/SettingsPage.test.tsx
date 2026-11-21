import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'
import { SelectedMonthContext } from '../hooks/useSelectedMonth'
import { getFinancialMonthRange } from '../lib/dates'

const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockSetTheme = vi.fn()
const mockShowToast = vi.fn()
const mockRestoreBackup = vi.fn().mockResolvedValue(undefined)
const mockProcessDueRecurring = vi.fn().mockResolvedValue(0)
const mockGetAllTransactions = vi.fn().mockResolvedValue([])
const mockAddTransaction = vi.fn().mockResolvedValue('new-tx-id')
const mockDeleteTransaction = vi.fn().mockResolvedValue(undefined)

vi.mock('../services/recurring', () => ({
  processDueRecurring: (...args: unknown[]) => mockProcessDueRecurring(...args),
}))

vi.mock('../services/transactions', () => ({
  getAllTransactions: (...args: unknown[]) => mockGetAllTransactions(...args),
  addTransaction: (...args: unknown[]) => mockAddTransaction(...args),
  deleteTransaction: (...args: unknown[]) => mockDeleteTransaction(...args),
}))

vi.mock('../lib/backupRestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/backupRestore')>()
  return {
    ...actual,
    restoreBackup: (...args: unknown[]) => mockRestoreBackup(...args),
  }
})

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-123', displayName: 'محمد', email: 'user@example.com' },
  }),
}))

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: mockSetTheme,
    resolvedTheme: 'dark',
  }),
}))

let mockSettingsData = {
  displayName: 'محمد',
  currency: 'JOD',
  monthStartDay: 1,
  theme: 'dark',
  rolloverBalance: true,
  rolloverStartDate: null as Date | null,
  openingBalanceFils: 0,
}

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: mockSettingsData,
    updateSettings: mockUpdateSettings,
  }),
}))

let mockCategoriesData: Array<{ id: string; name: string; type: string; archived: boolean }> = []

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: mockCategoriesData,
  }),
}))

vi.mock('../hooks/useRecurring', () => ({
  useRecurring: () => ({
    data: [],
  }),
}))

vi.mock('../hooks/useMoneyCircles', () => ({
  useMoneyCircles: () => ({
    data: [],
  }),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

let mockPWAInstallState = {
  isInstallable: false,
  isInstalled: false,
  isIOS: false,
  promptInstall: vi.fn(),
}

vi.mock('../hooks/usePWAInstall', () => ({
  usePWAInstall: () => mockPWAInstallState,
}))

describe('SettingsPage Component redundant update prevention', () => {
  beforeEach(() => {
    mockSettingsData = {
      displayName: 'محمد',
      currency: 'JOD',
      monthStartDay: 1,
      theme: 'dark',
      rolloverBalance: true,
      rolloverStartDate: null,
      openingBalanceFils: 0,
    }
    mockCategoriesData = []
    mockGetAllTransactions.mockReset().mockResolvedValue([])
    mockAddTransaction.mockReset().mockResolvedValue('new-tx-id')
    mockDeleteTransaction.mockReset().mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  it('does NOT trigger updateSettings or show toast when selecting already active preset currency', async () => {
    render(<SettingsPage />)

    // JOD is active in mockUserSettings
    const jodBtn = screen.getByRole('button', { name: /دينار أردني/i })
    fireEvent.click(jodBtn)

    expect(mockUpdateSettings).not.toHaveBeenCalled()
    expect(mockShowToast).not.toHaveBeenCalled()
  })

  it('triggers updateSettings when selecting a different preset currency', async () => {
    render(<SettingsPage />)

    const usdBtn = screen.getByRole('button', { name: /دولار أمريكي/i })
    fireEvent.click(usdBtn)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ currency: 'USD' })
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('تم تغيير العملة'),
        'success'
      )
    })
  })

  it('does NOT trigger updateSettings when selecting already active theme', async () => {
    render(<SettingsPage />)

    // 'dark' is active in mock
    const darkBtn = screen.getByRole('radio', { name: /داكن/i })
    fireEvent.click(darkBtn)

    expect(mockUpdateSettings).not.toHaveBeenCalled()
    expect(mockSetTheme).not.toHaveBeenCalled()
  })

  it('does NOT trigger updateSettings when selecting already active month start day', async () => {
    render(<SettingsPage />)

    const daySelect = screen.getByLabelText(/يوم بداية الدورة المالية/i)
    fireEvent.change(daySelect, { target: { value: '1' } })

    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('does NOT trigger updateSettings or make network calls when saving display name identical to current effectiveDisplayName', async () => {
    render(<SettingsPage />)

    const editBtn = screen.getByRole('button', { name: 'تعديل الاسم' })
    fireEvent.click(editBtn)

    const nameInput = screen.getByPlaceholderText('أدخل اسمك') as HTMLInputElement
    expect(nameInput.value).toBe('محمد')

    const saveBtn = screen.getByRole('button', { name: 'حفظ' })
    fireEvent.click(saveBtn)

    expect(mockUpdateSettings).not.toHaveBeenCalled()
    expect(mockShowToast).not.toHaveBeenCalled()
    // Edit mode should close
    expect(screen.queryByPlaceholderText('أدخل اسمك')).toBeNull()
  })

  it('resolves custom currency to preset if entered alias/symbol matches preset, e.g. "ر.س" -> "SAR"', async () => {
    render(<SettingsPage />)

    const customBtn = screen.getByRole('button', { name: /عملة أخرى/i })
    fireEvent.click(customBtn)

    const customInput = screen.getByPlaceholderText(/مثال: ج\.م أو د\.ك أو QAR أو ليرة/)
    fireEvent.change(customInput, { target: { value: 'ر.س' } })

    const applyBtn = screen.getByRole('button', { name: 'تطبيق العملة' })
    fireEvent.click(applyBtn)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ currency: 'SAR' })
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('تم تغيير العملة إلى ريال سعودي'),
        'success'
      )
    })
  })

  it('does NOT trigger updateSettings if resolved preset currency is already the active currency', async () => {
    render(<SettingsPage />)

    const customBtn = screen.getByRole('button', { name: /عملة أخرى/i })
    fireEvent.click(customBtn)

    // Active currency in mock is JOD, symbol is 'د.أ'
    const customInput = screen.getByPlaceholderText(/مثال: ج\.م أو د\.ك أو QAR أو ليرة/)
    fireEvent.change(customInput, { target: { value: 'د.أ' } })

    const applyBtn = screen.getByRole('button', { name: 'تطبيق العملة' })
    fireEvent.click(applyBtn)

    expect(mockUpdateSettings).not.toHaveBeenCalled()
    expect(mockShowToast).not.toHaveBeenCalled()
    // Switches away from custom currency view
    expect(screen.queryByPlaceholderText(/مثال: ج\.م أو د\.ك أو QAR أو ليرة/)).toBeNull()
  })
})

describe('SettingsPage Backup and Restore modal', () => {
  beforeEach(() => {
    mockSettingsData = {
      displayName: 'محمد',
      currency: 'JOD',
      monthStartDay: 1,
      theme: 'dark',
      rolloverBalance: true,
      rolloverStartDate: null,
      openingBalanceFils: 0,
    }
    mockCategoriesData = []
    mockGetAllTransactions.mockReset().mockResolvedValue([])
    mockAddTransaction.mockReset().mockResolvedValue('new-tx-id')
    mockDeleteTransaction.mockReset().mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  it('allows restoring backup in merge mode (default)', async () => {
    render(<SettingsPage />)

    const fileInput = screen.getByLabelText(/اختيار ملف النسخة الاحتياطية/i)
    const validJson = JSON.stringify({
      version: 1,
      app: 'masareefi',
      exportedAt: '2026-10-15T12:00:00Z',
      data: {
        categories: [{ id: 'c1', name: 'طعام', type: 'expense' }],
        transactions: [{ id: 't1', amountFils: 5000, type: 'expense', date: '2026-10-10' }],
      },
    })
    const file = new File([validJson], 'backup.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/تأكيد استعادة النسخة الاحتياطية/i)).toBeDefined()
    })

    // Default mode is merge
    const confirmBtn = screen.getByRole('button', { name: 'تأكيد ودمج البيانات' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockRestoreBackup).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ app: 'masareefi' }),
        'merge'
      )
      expect(mockProcessDueRecurring).toHaveBeenCalledWith('user-123')
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('تم دمج النسخة الاحتياطية'),
        'success'
      )
    })
  })

  it('runs due recurring and notifies user when recurring items are processed after restore', async () => {
    mockProcessDueRecurring.mockResolvedValueOnce(2)
    render(<SettingsPage />)

    const fileInput = screen.getByLabelText(/اختيار ملف النسخة الاحتياطية/i)
    const validJson = JSON.stringify({
      version: 1,
      app: 'masareefi',
      exportedAt: '2026-10-15T12:00:00Z',
      data: {
        categories: [{ id: 'c1', name: 'طعام', type: 'expense' }],
        transactions: [],
      },
    })
    const file = new File([validJson], 'backup.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/تأكيد استعادة النسخة الاحتياطية/i)).toBeDefined()
    })

    const confirmBtn = screen.getByRole('button', { name: 'تأكيد ودمج البيانات' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockProcessDueRecurring).toHaveBeenCalledWith('user-123')
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('تم تنفيذ 2 معاملة متكررة مستحقة تلقائياً بعد الاستعادة!'),
        'info'
      )
    })
  })

  it('allows switching to replace mode with warning and restoring in replace mode', async () => {
    render(<SettingsPage />)

    const fileInput = screen.getByLabelText(/اختيار ملف النسخة الاحتياطية/i)
    const validJson = JSON.stringify({
      version: 1,
      app: 'masareefi',
      exportedAt: '2026-10-15T12:00:00Z',
      data: {
        categories: [{ id: 'c1', name: 'طعام', type: 'expense' }],
        transactions: [{ id: 't1', amountFils: 5000, type: 'expense', date: '2026-10-10' }],
      },
    })
    const file = new File([validJson], 'backup.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/تأكيد استعادة النسخة الاحتياطية/i)).toBeDefined()
    })

    // Click "استبدال كامل للبيانات" button
    const replaceModeOption = screen.getByRole('button', { name: /استبدال كامل للبيانات/i })
    fireEvent.click(replaceModeOption)

    // Red warning should be displayed
    expect(screen.getByText(/تحذير هام \(استبدال كامل\):/i)).toBeDefined()

    // Confirm button changes to 'استبدال كافة البيانات'
    const replaceConfirmBtn = screen.getByRole('button', { name: 'استبدال كافة البيانات' })
    fireEvent.click(replaceConfirmBtn)

    await waitFor(() => {
      expect(mockRestoreBackup).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ app: 'masareefi' }),
        'replace'
      )
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('استبدال البيانات بنجاح'),
        'success'
      )
    })
  })

  it('updates displayNameInput immediately when restored backup contains settings.displayName', async () => {
    render(<SettingsPage />)

    const fileInput = screen.getByLabelText(/اختيار ملف النسخة الاحتياطية/i)
    const validJsonWithDisplayName = JSON.stringify({
      version: 1,
      app: 'masareefi',
      exportedAt: '2026-10-15T12:00:00Z',
      data: {
        settings: {
          displayName: 'اسم مستعاد من النسخة',
          currency: 'JOD',
          monthStartDay: 1,
          theme: 'system',
          rolloverBalance: true,
        },
        categories: [],
        transactions: [],
      },
    })
    const file = new File([validJsonWithDisplayName], 'backup.json', { type: 'application/json' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/تأكيد استعادة النسخة الاحتياطية/i)).toBeDefined()
    })

    const confirmBtn = screen.getByRole('button', { name: 'تأكيد ودمج البيانات' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockRestoreBackup).toHaveBeenCalled()
    })

    // Open edit name mode to see displayNameInput
    const editBtn = screen.getByRole('button', { name: 'تعديل الاسم' })
    fireEvent.click(editBtn)
    const nameInput = screen.getByPlaceholderText('أدخل اسمك') as HTMLInputElement
    expect(nameInput.value).toBe('اسم مستعاد من النسخة')
  })

  it('renders iOS Safari installation instructions when isIOS is true and not installed', () => {
    mockPWAInstallState = {
      isInstallable: false,
      isInstalled: false,
      isIOS: true,
      promptInstall: vi.fn(),
    }

    render(<SettingsPage />)

    expect(screen.getByText('أجهزة آبل iOS')).toBeDefined()
    expect(screen.getByText('خطوات تثبيت التطبيق على الآيفون والآيباد (iOS Safari):')).toBeDefined()
    expect(screen.getByText(/المشاركة \(Share/)).toBeDefined()
    expect(screen.getByText(/إضافة إلى الشاشة الرئيسية/)).toBeDefined()
  })
})

describe('SettingsPage Extended Features', () => {
  beforeEach(() => {
    mockSettingsData = {
      displayName: 'محمد',
      currency: 'JOD',
      monthStartDay: 1,
      theme: 'dark',
      rolloverBalance: true,
      rolloverStartDate: null,
      openingBalanceFils: 0,
    }
    mockCategoriesData = []
    mockGetAllTransactions.mockReset().mockResolvedValue([])
    mockAddTransaction.mockReset().mockResolvedValue('new-tx-id')
    mockDeleteTransaction.mockReset().mockResolvedValue(undefined)
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('toggles privacy mode (hideBalances) and calls updateSettings', async () => {
    render(<SettingsPage />)
    const toggle = screen.getByLabelText(/وضع الخصوصية وإخفاء الأرقام/i)
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ hideBalances: true })
      )
    })
  })

  it('toggles hideZeroDecimals and calls updateSettings', async () => {
    render(<SettingsPage />)
    const toggle = screen.getByLabelText(/إخفاء الكسور الصفرية/i)
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ hideZeroDecimals: false })
      )
    })
  })

  it('updates notification preferences on toggle click', async () => {
    render(<SettingsPage />)
    const toggle = screen.getByLabelText(/تنبيهات المعاملات الدورية والتسديد التلقائي/i)
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationPrefs: expect.objectContaining({ autoPayments: false }),
        })
      )
    })
  })

  it('cancels custom currency selection when clicking إلغاء', () => {
    render(<SettingsPage />)
    const customBtn = screen.getByRole('button', { name: /عملة أخرى/i })
    fireEvent.click(customBtn)

    expect(screen.getByPlaceholderText(/مثال: ج\.م أو د\.ك أو QAR أو ليرة/)).toBeDefined()

    const cancelBtn = screen.getByRole('button', { name: 'إلغاء' })
    fireEvent.click(cancelBtn)

    expect(screen.queryByPlaceholderText(/مثال: ج\.م أو د\.ك أو QAR أو ليرة/)).toBeNull()
  })

  it('toggles manual PWA install instructions on non-iOS non-installable devices', () => {
    mockPWAInstallState = {
      isInstallable: false,
      isInstalled: false,
      isIOS: false,
      promptInstall: vi.fn(),
    }

    render(<SettingsPage />)

    const guideBtn = screen.getByRole('button', { name: 'طريقة التثبيت اليدوي' })
    fireEvent.click(guideBtn)

    expect(screen.getByText(/خطوات التثبيت اليدوي عبر متصفح Chrome أو Edge أو أندرويد:/)).toBeDefined()
  })

  it('provides a shortcut button to download backup inside reset modal', () => {
    render(<SettingsPage />)

    const resetModalBtn = screen.getByRole('button', { name: 'تصفير البيانات' })
    fireEvent.click(resetModalBtn)

    expect(screen.getByRole('button', { name: 'تنزيل نسخة احتياطية أولاً' })).toBeDefined()
  })

  it('uses current financial cycle start of today for rolloverStartDate even if SelectedMonthContext points to past month', async () => {
    const pastMonthRange = {
      start: new Date(2026, 4, 1),
      end: new Date(2026, 5, 1),
    }
    const mockSelectedMonthValue = {
      selectedDate: new Date(2026, 4, 15),
      setSelectedDate: vi.fn(),
      goToPreviousMonth: vi.fn(),
      goToNextMonth: vi.fn(),
      goToCurrentMonth: vi.fn(),
      refreshData: vi.fn(),
      refreshKey: 0,
      monthLabel: 'مايو 2026',
      range: pastMonthRange,
      monthStartDay: 1,
      rangeLabel: '1 مايو - 31 مايو',
      isCurrentMonth: false,
    }

    render(
      <SelectedMonthContext.Provider value={mockSelectedMonthValue}>
        <SettingsPage />
      </SelectedMonthContext.Provider>
    )

    const toggle = screen.getByLabelText(/بدء احتساب الترحيل من هذا الشهر فقط/i)
    fireEvent.click(toggle)

    const expectedCurrentCycleStart = getFinancialMonthRange(new Date(), 1).start

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          rolloverStartDate: expectedCurrentCycleStart,
        })
      )
    })
  })

  it('synchronizes rolloverStartDate when changing monthStartDay if rolloverStartDate is active', async () => {
    mockSettingsData.rolloverStartDate = new Date(2026, 9, 1)

    render(<SettingsPage />)

    const startDaySelect = screen.getByLabelText(/يوم بداية الدورة المالية/i)
    fireEvent.change(startDaySelect, { target: { value: '25' } })

    const expectedNewCycleStart = getFinancialMonthRange(new Date(), 25).start

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          monthStartDay: 25,
          rolloverStartDate: expectedNewCycleStart,
        })
      )
    })
  })

  it('resets openingBalanceFils to 0 when enabling rolloverStartDate', async () => {
    mockSettingsData.rolloverStartDate = null
    mockSettingsData.openingBalanceFils = 30000

    render(<SettingsPage />)

    const toggle = screen.getByLabelText(/بدء احتساب الترحيل من هذا الشهر فقط/i)
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        rolloverStartDate: expect.any(Date),
        openingBalanceFils: 0,
      })
    })
  })

  it('excludes future-dated transactions and deletes previous automated reconciliation transaction upon re-reconciling', async () => {
    const currentCycle = getFinancialMonthRange(new Date(), 1)
    const midCycleDate = new Date(currentCycle.start.getTime() + 5 * 86400000)
    const futureDate = new Date(currentCycle.end.getTime() + 5 * 86400000)

    const oldReconcileTx = {
      id: 'tx-old-reconcile',
      type: 'expense',
      amountFils: 15000,
      title: 'تسوية رصيد (فرق جرد)',
      note: 'معاملة تسوية مسجلة آلياً لمطابقة الرصيد الفعلي',
      date: midCycleDate,
    }

    const futureTx = {
      id: 'tx-future',
      type: 'expense',
      amountFils: 50000,
      title: 'شراء قادم',
      note: '',
      date: futureDate,
    }

    const currentIncomeTx = {
      id: 'tx-current-income',
      type: 'income',
      amountFils: 100000,
      title: 'راتب',
      note: '',
      date: midCycleDate,
    }

    mockGetAllTransactions.mockResolvedValue([oldReconcileTx, futureTx, currentIncomeTx])

    render(<SettingsPage />)

    // Open reconciliation modal
    const openBtn = screen.getByRole('button', { name: 'تسوية وتعديل الرصيد' })
    fireEvent.click(openBtn)

    // Input target balance: 140.000 JOD (= 140000 fils)
    const amountInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(amountInput, { target: { value: '140' } })

    // Save reconciliation
    const saveBtn = screen.getByRole('button', { name: 'حفظ وتسوية الرصيد' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      // 1. Previous automated reconciliation transaction must be deleted
      expect(mockDeleteTransaction).toHaveBeenCalledWith('user-123', 'tx-old-reconcile')
      // 2. Net transactions: only currentIncomeTx (+100000 fils). Future tx (-50000) & old reconcile (-15000) excluded!
      // Target (140000) - Net (100000) = Required opening (40000 fils)
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        openingBalanceFils: 40000,
      })
    })
  })

  it('deletes previous automated reconciliation transaction and selects active expense category when required opening is negative', async () => {
    const currentCycle = getFinancialMonthRange(new Date(), 1)
    const midCycleDate = new Date(currentCycle.start.getTime() + 5 * 86400000)

    const oldReconcileTx = {
      id: 'tx-old-reconcile-2',
      type: 'expense',
      amountFils: 10000,
      title: 'تسوية رصيد (فرق جرد)',
      note: 'معاملة تسوية مسجلة آلياً لمطابقة الرصيد الفعلي',
      date: midCycleDate,
    }

    const currentIncomeTx = {
      id: 'tx-current-income-2',
      type: 'income',
      amountFils: 100000,
      title: 'راتب',
      note: '',
      date: midCycleDate,
    }

    mockGetAllTransactions.mockResolvedValue([oldReconcileTx, currentIncomeTx])
    mockCategoriesData = [
      { id: 'cat-archived', name: 'أخرى', type: 'expense', archived: true },
      { id: 'cat-active', name: 'عام', type: 'expense', archived: false },
    ]

    render(<SettingsPage />)

    const openBtn = screen.getByRole('button', { name: 'تسوية وتعديل الرصيد' })
    fireEvent.click(openBtn)

    // Target balance: 70.000 JOD (= 70000 fils)
    // Net: 100000 fils. Required opening: 70000 - 100000 = -30000 fils
    const amountInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(amountInput, { target: { value: '70' } })

    const saveBtn = screen.getByRole('button', { name: 'حفظ وتسوية الرصيد' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockDeleteTransaction).toHaveBeenCalledWith('user-123', 'tx-old-reconcile-2')
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        openingBalanceFils: 0,
      })
      expect(mockAddTransaction).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'expense',
          amountFils: 30000,
          categoryId: 'cat-active', // Must choose active category, skipping archived 'أخرى'
          title: 'تسوية رصيد (فرق جرد)',
          note: 'معاملة تسوية مسجلة آلياً لمطابقة الرصيد الفعلي',
        })
      )
    })
  })

  it('rejects reconciliation if the target amount exceeds MAX_AMOUNT_FILS', async () => {
    render(<SettingsPage />)

    const openBtn = screen.getByRole('button', { name: 'تسوية وتعديل الرصيد' })
    fireEvent.click(openBtn)

    const amountInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(amountInput, { target: { value: '1000000001' } })

    const saveBtn = screen.getByRole('button', { name: 'حفظ وتسوية الرصيد' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'المبلغ يتجاوز الحد الأقصى المسموح به',
        'error'
      )
    })
    expect(mockUpdateSettings).not.toHaveBeenCalled()
    expect(mockAddTransaction).not.toHaveBeenCalled()
  })

  it('normalizes Eastern Arabic digits to Western digits when setting up PIN', async () => {
    render(<SettingsPage />)

    const setPinBtn = screen.getByRole('button', { name: 'تعيين رمز PIN (4 أرقام)' })
    fireEvent.click(setPinBtn)

    const inputs = screen.getAllByPlaceholderText('••••')
    expect(inputs).toHaveLength(2)

    // Type Eastern Arabic digits: ١٢٣٤
    fireEvent.change(inputs[0], { target: { value: '١٢٣٤' } })
    fireEvent.change(inputs[1], { target: { value: '١٢٣٤' } })

    expect(inputs[0]).toHaveValue('1234')
    expect(inputs[1]).toHaveValue('1234')
  })

  it('requires confirmation modal before removing application PIN', async () => {
    localStorage.setItem('baseer_pin_hash_user-123', 'fake-hash')
    render(<SettingsPage />)

    const removeBtn = screen.getByRole('button', { name: 'إلغاء القفل' })
    fireEvent.click(removeBtn)

    // Modal should appear
    expect(screen.getByText('تأكيد إلغاء قفل التطبيق')).toBeInTheDocument()
    expect(
      screen.getByText(/هل أنت متأكد من رغبتك في إلغاء قفل التطبيق؟/i)
    ).toBeInTheDocument()

    // PIN should not be removed yet
    expect(localStorage.getItem('baseer_pin_hash_user-123')).toBe('fake-hash')

    // Confirm removal inside modal
    const confirmBtn = screen.getByRole('button', { name: 'تأكيد إلغاء القفل' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(localStorage.getItem('baseer_pin_hash_user-123')).toBeNull()
      expect(mockShowToast).toHaveBeenCalledWith('تم إلغاء قفل التطبيق', 'info')
    })
  })

  it('guards full JSON backup when device is offline', async () => {
    const originalOnLine = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    render(<SettingsPage />)

    const backupBtn = screen.getByRole('button', { name: /تنزيل نسخة احتياطية شاملة \(JSON\)/i })
    fireEvent.click(backupBtn)

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'يجب الاتصال بالإنترنت لإتمام تنزيل النسخة الاحتياطية',
        'error'
      )
    })

    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
  })

  it('excludes future-dated transactions from wallet reconciliation calculations', async () => {
    const today = new Date()
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)

    mockGetAllTransactions.mockResolvedValueOnce([
      {
        id: 'tx-past',
        date: yesterday,
        type: 'expense',
        amountFils: 20000,
        title: 'مصروف أمس',
      },
      {
        id: 'tx-future',
        date: tomorrow,
        type: 'expense',
        amountFils: 50000,
        title: 'مصروف غداً',
      },
    ])

    render(<SettingsPage />)

    const openBtn = screen.getByRole('button', { name: 'تسوية وتعديل الرصيد' })
    fireEvent.click(openBtn)

    // User counts 100.000 JOD in wallet
    const amountInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(amountInput, { target: { value: '100' } })

    const saveBtn = screen.getByRole('button', { name: 'حفظ وتسوية الرصيد' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      // Net past txs = -20000 fils (tomorrow's -50000 must NOT be included).
      // Required opening = 100000 - (-20000) = 120000 fils.
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        openingBalanceFils: 120000,
      })
    })
  })

  it('restarts tour by clearing storage keys, dispatching baseer-start-tour, and navigating to /', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    localStorage.setItem('baseer_tour_shown_user-123', 'true')
    localStorage.setItem('masareefi_tour_shown_user-123', 'true')

    render(<SettingsPage />)

    const restartBtn = screen.getByRole('button', { name: 'إعادة تشغيل الجولة التعريفية' })
    fireEvent.click(restartBtn)

    expect(localStorage.getItem('baseer_tour_shown_user-123')).toBeNull()
    expect(localStorage.getItem('masareefi_tour_shown_user-123')).toBeNull()
    expect(mockShowToast).toHaveBeenCalledWith('تمت إعادة ضبط الجولة بنجاح، جارٍ بدء الجولة...', 'info')
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'baseer-start-tour' }))

    dispatchSpy.mockRestore()
  })

  it('allows negative balance input for overdraft reconciliation and supports Eastern Arabic digits', async () => {
    mockGetAllTransactions.mockResolvedValue([])
    mockCategoriesData = [
      { id: 'cat-general', name: 'أخرى', type: 'expense', archived: false },
    ]

    render(<SettingsPage />)

    const openBtn = screen.getByRole('button', { name: 'تسوية وتعديل الرصيد' })
    fireEvent.click(openBtn)

    const amountInput = screen.getByPlaceholderText('0.00')
    fireEvent.change(amountInput, { target: { value: '-٥٠' } }) // -50 in Eastern Arabic digits

    const saveBtn = screen.getByRole('button', { name: 'حفظ وتسوية الرصيد' })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      // Net past txs = 0. Target = -50000 fils.
      // Required opening = -50000 - 0 = -50000.
      // Negative required opening sets openingBalanceFils to 0 and adds diff expense transaction of 50000.
      expect(mockAddTransaction).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: 'expense',
          amountFils: 50000,
          categoryId: 'cat-general',
        })
      )
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        openingBalanceFils: 0,
      })
    })
  })

  it('toggles PIN visibility when clicking show/hide PIN in PIN setup modal', () => {
    render(<SettingsPage />)

    const setupBtn = screen.getByRole('button', { name: /تعيين رمز PIN/i })
    fireEvent.click(setupBtn)

    const pinInputs = screen.getAllByPlaceholderText('••••') as HTMLInputElement[]
    expect(pinInputs[0].type).toBe('password')

    const toggleBtn = screen.getByRole('button', { name: /إظهار الرمز/i })
    fireEvent.click(toggleBtn)

    const visibleInputs = screen.getAllByPlaceholderText('1234') as HTMLInputElement[]
    expect(visibleInputs[0].type).toBe('text')
    expect(screen.getByRole('button', { name: /إخفاء الرمز/i })).toBeInTheDocument()
  })
})
