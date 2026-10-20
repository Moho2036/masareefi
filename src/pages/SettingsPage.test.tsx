import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsPage } from './SettingsPage'

const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockSetTheme = vi.fn()
const mockShowToast = vi.fn()
const mockRestoreBackup = vi.fn().mockResolvedValue(undefined)

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

describe('SettingsPage Backup and Restore modal', () => {
  beforeEach(() => {
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
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('تم دمج النسخة الاحتياطية'),
        'success'
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
