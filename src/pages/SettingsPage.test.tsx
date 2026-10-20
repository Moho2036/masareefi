import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'

const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockSetTheme = vi.fn()
const mockShowToast = vi.fn()

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

vi.mock('../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: {
      displayName: 'محمد',
      currency: 'JOD',
      monthStartDay: 1,
      theme: 'dark',
      rolloverBalance: true,
    },
    updateSettings: mockUpdateSettings,
  }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({
    data: [],
  }),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}))

vi.mock('../hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({
    isInstallable: false,
    isInstalled: false,
    promptInstall: vi.fn(),
  }),
}))

describe('SettingsPage Component redundant update prevention', () => {
  beforeEach(() => {
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
})
