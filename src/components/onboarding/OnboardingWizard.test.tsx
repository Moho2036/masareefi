import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OnboardingWizard } from './OnboardingWizard'
import { detectDefaultCurrency } from '../../lib/money'
import type { Category } from '../../types'

const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockAddRecurring = vi.fn().mockResolvedValue('rec-new-1')
const mockArchiveCategory = vi.fn().mockResolvedValue(undefined)
const mockArchiveCategoriesBatch = vi.fn().mockResolvedValue(undefined)
const mockAddCategory = vi.fn().mockResolvedValue('cat-custom-1')
const mockProcessDueRecurring = vi.fn().mockResolvedValue(0)

const mockCategories: Category[] = [
  { id: 'cat-1', name: 'طعام', type: 'expense', icon: 'utensils', color: '#10b981', archived: false, order: 1 },
  { id: 'cat-2', name: 'مواصلات', type: 'expense', icon: 'car', color: '#3b82f6', archived: false, order: 2 },
  { id: 'cat-3', name: 'راتب', type: 'income', icon: 'briefcase', color: '#10b981', archived: false, order: 1 },
]

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-wiz-1', displayName: 'مهند' },
  }),
}))

vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: { displayName: 'مهند', currency: 'JOD', monthStartDay: 1, rolloverBalance: true },
    updateSettings: mockUpdateSettings,
  }),
}))

vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({
    data: mockCategories,
  }),
}))

vi.mock('../../services/categories', () => ({
  archiveCategory: (...args: unknown[]) => mockArchiveCategory(...args),
  archiveCategoriesBatch: (...args: unknown[]) => mockArchiveCategoriesBatch(...args),
  addCategory: (...args: unknown[]) => mockAddCategory(...args),
}))

vi.mock('../../services/recurring', () => ({
  addRecurring: (...args: unknown[]) => mockAddRecurring(...args),
  processDueRecurring: (...args: unknown[]) => mockProcessDueRecurring(...args),
}))

describe('OnboardingWizard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('detectDefaultCurrency returns a valid currency code', () => {
    const code = detectDefaultCurrency()
    expect(typeof code).toBe('string')
    expect(code.length).toBeGreaterThanOrEqual(3)
  })

  it('renders Step 1 with user displayName and currency options', () => {
    render(<OnboardingWizard isOpen={true} onComplete={vi.fn()} />)

    expect(screen.getByText(/تجهيز حسابك في بَصير/i)).toBeDefined()
    expect(screen.getByLabelText('الاسم الشخصي')).toBeDefined()
    expect((screen.getByLabelText('الاسم الشخصي') as HTMLInputElement).value).toBe('مهند')
    expect(screen.getByText('دينار أردني')).toBeDefined()
    expect(screen.getByText('ريال سعودي')).toBeDefined()
  })

  it('navigates through steps 1 -> 2 -> 3 -> 4 and back', () => {
    render(<OnboardingWizard isOpen={true} onComplete={vi.fn()} />)

    // Step 1 -> Next
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 2: Financial Cycle
    expect(screen.getByText(/يوم بداية الدورة المالية/i)).toBeDefined()
    expect(screen.getByText(/ترحيل الرصيد التلقائي/i)).toBeDefined()

    // Step 2 -> Next
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 3: Opening Balance
    expect(screen.getByLabelText(/الرصيد الافتتاحي الحالي/i)).toBeDefined()
    expect(screen.getByText(/تسجيل الراتب الشهري المتكرر تلقائياً/i)).toBeDefined()

    // Step 3 -> Next
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 4: Categories
    expect(screen.getByText(/اختر التصنيفات التي تهمك/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /إتمام وبدء الاستخدام/i })).toBeDefined()

    // Step 4 -> Previous
    fireEvent.click(screen.getByRole('button', { name: 'السابق' }))
    expect(screen.getByLabelText(/الرصيد الافتتاحي الحالي/i)).toBeDefined()
  })

  it('skips onboarding when "تخطي" is clicked', async () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard isOpen={true} onComplete={onComplete} />)

    const skipBtn = screen.getByRole('button', { name: 'تخطي' })
    fireEvent.click(skipBtn)

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          onboardingCompleted: true,
          openingBalanceFils: 0,
        })
      )
      expect(onComplete).toHaveBeenCalled()
      expect(window.localStorage.getItem('baseer_onboarding_done_user-wiz-1')).toBe('true')
    })
  })

  it('prevents deselecting the last active category of a type in Step 4', () => {
    render(<OnboardingWizard isOpen={true} onComplete={vi.fn()} />)

    // Advance to step 4
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Deselect one expense category (out of 2: طعام ومواصلات)
    const foodCatBtn = screen.getByRole('button', { name: /طعام/i })
    fireEvent.click(foodCatBtn)

    // Try to deselect the remaining expense category (مواصلات)
    const transportCatBtn = screen.getByRole('button', { name: /مواصلات/i })
    fireEvent.click(transportCatBtn)

    // Warning message should be shown
    expect(screen.getByText(/يجب الإبقاء على تصنيف نشط واحد على الأقل في قسم المصاريف/i)).toBeDefined()
  })

  it('submits onboarding with opening balance, salary recurring rule, and archives deselected categories', async () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard isOpen={true} onComplete={onComplete} />)

    // Step 1: Change display name and select SAR
    fireEvent.change(screen.getByLabelText('الاسم الشخصي'), { target: { value: 'مهند المالي' } })
    fireEvent.click(screen.getByRole('button', { name: /ريال سعودي/i }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 2: Set start day to 25 via quick-select button
    fireEvent.click(screen.getByRole('button', { name: 'يوم 25' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 3: Set opening balance to 500 and enable salary with 1000
    fireEvent.change(screen.getByLabelText(/الرصيد الافتتاحي الحالي/i), { target: { value: '500' } })
    fireEvent.click(screen.getByLabelText(/تسجيل الراتب تلقائياً/i))
    fireEvent.change(screen.getByLabelText('قيمة الراتب الشهري'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 4: Deselect one category (طعام)
    fireEvent.click(screen.getByRole('button', { name: /طعام/i }))

    // Finish
    fireEvent.click(screen.getByRole('button', { name: /إتمام وبدء الاستخدام/i }))

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'مهند المالي',
          currency: 'SAR',
          monthStartDay: 25,
          openingBalanceFils: 500000,
          onboardingCompleted: true,
        })
      )
      expect(mockAddRecurring).toHaveBeenCalledWith(
        'user-wiz-1',
        expect.objectContaining({
          type: 'income',
          amountFils: 1000000,
          frequency: 'monthly',
        })
      )
      expect(mockArchiveCategoriesBatch).toHaveBeenCalledWith('user-wiz-1', ['cat-1'], true)
      expect(onComplete).toHaveBeenCalled()
      expect(window.localStorage.getItem('baseer_onboarding_done_user-wiz-1')).toBe('true')
    })
  })

  it('restores draft from sessionStorage when available', () => {
    window.sessionStorage.setItem(
      'baseer_onboarding_draft_user-wiz-1',
      JSON.stringify({
        step: 3,
        displayName: 'مسودة اسم',
        currency: 'USD',
        monthStartDay: 15,
        rolloverBalance: false,
        openingBalance: '250',
      })
    )

    render(<OnboardingWizard isOpen={true} onComplete={vi.fn()} />)

    // Should immediately open on Step 3
    expect(screen.getByLabelText(/الرصيد الافتتاحي الحالي/i)).toBeDefined()
    expect((screen.getByLabelText(/الرصيد الافتتاحي الحالي/i) as HTMLInputElement).value).toBe('250')
  })

  it('allows custom currency selection and decimal configuration', async () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard isOpen={true} onComplete={onComplete} />)

    // Click "+ استخدام عملة مخصصة أخرى"
    fireEvent.click(screen.getByRole('button', { name: /\+ استخدام عملة مخصصة أخرى/i }))

    // Enter custom currency code and select 0 decimals
    const customInput = screen.getByLabelText(/رمز أو اسم العملة المخصصة/i)
    fireEvent.change(customInput, { target: { value: 'IQD' } })
    fireEvent.click(screen.getByRole('button', { name: /0 خانات/i }))

    // Proceed to Step 4 and finish
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: /إتمام وبدء الاستخدام/i }))

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'IQD',
          customCurrencyDecimals: 0,
        })
      )
    })
  })

  it('allows adding a custom category in Step 4', async () => {
    render(<OnboardingWizard isOpen={true} onComplete={vi.fn()} />)

    // Go to step 4
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Click "+ تصنيف مخصص"
    fireEvent.click(screen.getByRole('button', { name: /\+ تصنيف مخصص/i }))

    // Fill form
    const nameInput = screen.getByPlaceholderText(/اسم التصنيف/i)
    fireEvent.change(nameInput, { target: { value: 'اشتراكات نادي' } })

    // Click save
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التصنيف' }))

    await waitFor(() => {
      expect(mockAddCategory).toHaveBeenCalledWith(
        'user-wiz-1',
        expect.objectContaining({
          name: 'اشتراكات نادي',
          type: 'expense',
        })
      )
    })
  })

  it('triggers processDueRecurring immediately if salary start date is today or earlier', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const mockNow = new Date(2026, 9, 25, 14, 0, 0)
    vi.setSystemTime(mockNow)

    render(<OnboardingWizard isOpen={true} onComplete={vi.fn()} />)

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 2: Set start day to 25 (today)
    fireEvent.click(screen.getByRole('button', { name: 'يوم 25' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 3: Enable recurring salary
    fireEvent.click(screen.getByLabelText(/تسجيل الراتب تلقائياً/i))
    fireEvent.change(screen.getByLabelText('قيمة الراتب الشهري'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Step 4: Finish
    fireEvent.click(screen.getByRole('button', { name: /إتمام وبدء الاستخدام/i }))

    await waitFor(() => {
      expect(mockProcessDueRecurring).toHaveBeenCalledWith('user-wiz-1')
    })

    vi.useRealTimers()
  })
})
