import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppShell } from './AppShell'

const mockUseUserSettings = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: () => mockUseUserSettings(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    selectedDate: new Date('2026-10-15T00:00:00Z'),
    goToCurrentMonth: vi.fn(),
    isCurrentMonth: true,
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

  it('falls back to default "مستخدم مصاريفي" when neither is provided', () => {
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

    expect(screen.getByText('مستخدم مصاريفي')).toBeDefined()
  })
})
