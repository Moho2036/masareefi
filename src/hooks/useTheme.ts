import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUserSettings } from './useUserSettings'
import type { ThemePreference } from '../types'

function getInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const saved = (
    localStorage.getItem('baseer_theme') ||
    localStorage.getItem('baseer-theme') ||
    localStorage.getItem('masareefi_theme') ||
    localStorage.getItem('masareefi-theme')
  ) as ThemePreference | null
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved
  }
  return 'system'
}

function saveThemeToStorage(theme: ThemePreference): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('baseer_theme', theme)
  localStorage.setItem('baseer-theme', theme)
  localStorage.setItem('masareefi_theme', theme)
  localStorage.setItem('masareefi-theme', theme)
}

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Apply initial theme immediately to prevent flashing
if (typeof window !== 'undefined') {
  const initial = getInitialTheme()
  const isDark =
    initial === 'dark' ||
    (initial === 'system' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const { data: settings, loading } = useUserSettings()
  const [localTheme, setLocalTheme] = useState<ThemePreference>(getInitialTheme)
  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemIsDark)

  // Use Firestore user settings if available and finished loading, otherwise local theme preference
  const theme: ThemePreference = useMemo(() => {
    if (
      !loading &&
      settings?.theme &&
      (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system')
    ) {
      return settings.theme
    }
    return localTheme
  }, [loading, settings?.theme, localTheme])

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'dark') return 'dark'
    if (theme === 'light') return 'light'
    return systemIsDark ? 'dark' : 'light'
  }, [theme, systemIsDark])

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setLocalTheme(newTheme)
    saveThemeToStorage(newTheme)
  }, [])

  // Sync DOM and localStorage with current resolved theme (only write to localStorage when not loading)
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!loading) {
      saveThemeToStorage(theme)
    }
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? '#09090B' : '#F4F4F5')
    }
  }, [theme, resolvedTheme, loading])

  // Listen to system prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches)
    }

    mediaQuery.addEventListener?.('change', handleChange)
    return () => mediaQuery.removeEventListener?.('change', handleChange)
  }, [])

  return { theme, setTheme, resolvedTheme }
}
