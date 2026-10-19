import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'
import * as useUserSettingsModule from './useUserSettings'

describe('useTheme hook', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.clearAllMocks()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  it('reads initial theme from masareefi_theme and does NOT overwrite with DEFAULT_SETTINGS while loading', () => {
    localStorage.setItem('masareefi_theme', 'dark')

    // Mock useUserSettings returning loading: true with DEFAULT_SETTINGS (theme: 'system')
    vi.spyOn(useUserSettingsModule, 'useUserSettings').mockReturnValue({
      data: { theme: 'system' } as any,
      loading: true,
      error: null,
      updateSettings: vi.fn(),
    })

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    // localStorage must NOT be overwritten with 'system' while loading
    expect(localStorage.getItem('masareefi_theme')).toBe('dark')
  })

  it('syncs theme from Firestore settings once loading completes', () => {
    localStorage.setItem('masareefi_theme', 'light')

    // Mock useUserSettings returning loading: false with Firestore preference 'dark'
    vi.spyOn(useUserSettingsModule, 'useUserSettings').mockReturnValue({
      data: { theme: 'dark' } as any,
      loading: false,
      error: null,
      updateSettings: vi.fn(),
    })

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(localStorage.getItem('masareefi_theme')).toBe('dark')
    expect(localStorage.getItem('masareefi-theme')).toBe('dark')
  })

  it('allows manual theme switching via setTheme', () => {
    vi.spyOn(useUserSettingsModule, 'useUserSettings').mockReturnValue({
      data: null,
      loading: false,
      error: null,
      updateSettings: vi.fn(),
    })

    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(localStorage.getItem('masareefi_theme')).toBe('dark')
  })
})
