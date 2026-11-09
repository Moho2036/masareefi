import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppShell } from './AppShell'

const mockUseUserSettings = vi.fn()
const mockUseAuth = vi.fn()
const mockHasExistingUserData = vi.fn().mockResolvedValue(true)
const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockGoToCurrentMonth = vi.fn()
let mockIsCurrentMonth = true

vi.mock('../../services/userProfile', () => ({
  hasExistingUserData: (...args: unknown[]) => mockHasExistingUserData(...args),
}))

vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: () => mockUseUserSettings(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    selectedDate: new Date('2026-10-15T00:00:00Z'),
    goToCurrentMonth: mockGoToCurrentMonth,
    isCurrentMonth: mockIsCurrentMonth,
  }),
}))

vi.mock('../../hooks/useTransactionModal', () => ({
  useTransactionModal: () => ({
    openAdd: vi.fn(),
  }),
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}))

describe('AppShell displayName resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCurrentMonth = true
  })
  it('prioritizes settings.displayName over user.displayName', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'Auth Name', photoURL: null },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: 'إعدادات الاسم', monthStartDay: 1 },
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    expect(screen.getByText('إعدادات الاسم')).toBeDefined()
    expect(screen.queryByText('Auth Name')).toBeNull()
  })

  it('falls back to user.displayName when settings.displayName is empty', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'محمد علي', photoURL: null },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: '', monthStartDay: 1 },
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    expect(screen.getByText('محمد علي')).toBeDefined()
  })

  it('falls back to default "مستخدم بَصير" when neither is provided', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: null, photoURL: null },
    })
    mockUseUserSettings.mockReturnValue({
      data: null,
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    expect(screen.getByText('مستخدم بَصير')).toBeDefined()
  })

  it('silently completes onboarding for existing user with prior data', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u-existing', displayName: 'مستخدم قديم' },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: 'مستخدم قديم', onboardingCompleted: false },
      updateSettings: mockUpdateSettings,
      loading: false,
    })
    mockHasExistingUserData.mockResolvedValueOnce(true)

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    // Onboarding wizard modal should not be shown
    expect(screen.queryByText(/تجهيز حسابك في بَصير/i)).toBeNull()
  })

  it('opens onboarding wizard for brand new user with no prior data', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u-new', displayName: 'مستخدم جديد' },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: 'مستخدم جديد', onboardingCompleted: false },
      updateSettings: mockUpdateSettings,
      loading: false,
    })
    mockHasExistingUserData.mockResolvedValueOnce(false)

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    // Onboarding wizard modal should appear
    expect(await screen.findByText(/تجهيز حسابك في بَصير/i)).toBeDefined()
  })

  it('calls goToCurrentMonth when clicking on dashboard link and not on current month', () => {
    mockIsCurrentMonth = false
    mockUseAuth.mockReturnValue({
      user: { displayName: 'محمد', photoURL: null },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: 'محمد', monthStartDay: 1 },
    })

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <AppShell />
      </MemoryRouter>
    )

    const dashboardLink = screen.getByRole('link', { name: /لوحة التحكم/i })
    fireEvent.click(dashboardLink)

    expect(mockGoToCurrentMonth).toHaveBeenCalledTimes(1)
  })

  it('renders MonthSelector in header when navigating to /reports', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'محمد', photoURL: null },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: 'محمد', hideBalances: false },
    })

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <AppShell />
      </MemoryRouter>
    )

    expect(screen.getByRole('group', { name: 'اختيار الشهر المالي' })).toBeInTheDocument()
  })

  it('toggles privacy mode (hideBalances) when clicking the privacy button in header', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'محمد', photoURL: null },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: 'محمد', hideBalances: false },
      updateSettings: mockUpdateSettings,
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    const privacyBtn = screen.getByRole('button', { name: 'إخفاء الأرصدة' })
    expect(privacyBtn).toBeInTheDocument()

    fireEvent.click(privacyBtn)
    expect(mockUpdateSettings).toHaveBeenCalledWith({ hideBalances: true })
  })

  it('shows "إظهار الأرصدة" when hideBalances is true and toggles to false on click', () => {
    mockUseAuth.mockReturnValue({
      user: { displayName: 'محمد', photoURL: null },
    })
    mockUseUserSettings.mockReturnValue({
      data: { displayName: 'محمد', hideBalances: true },
      updateSettings: mockUpdateSettings,
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    const privacyBtn = screen.getByRole('button', { name: 'إظهار الأرصدة' })
    expect(privacyBtn).toBeInTheDocument()

    fireEvent.click(privacyBtn)
    expect(mockUpdateSettings).toHaveBeenCalledWith({ hideBalances: false })
  })
})
