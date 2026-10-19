import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUserSettings } from './useUserSettings'
import type { ThemePreference } from '../types'

const STORAGE_KEY = 'masareefi-theme'

function getInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved
  }
  return 'system'
}

function getSystemIsDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Apply initial theme immediately to prevent flashing
if (typeof window !== 'undefined') {
  const initial = getInitialTheme()
  const isDark =
    initial === 'dark' ||
    (initial === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useTheme() {
  const { data: settings } = useUserSettings()
  const [localTheme, setLocalTheme] = useState<ThemePreference>(getInitialTheme)
  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemIsDark)

  // Use Firestore user settings if available, otherwise local theme preference
  const theme: ThemePreference = useMemo(() => {
    if (
      settings?.theme &&
      (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system')
    ) {
      return settings.theme
    }
    return localTheme
  }, [settings?.theme, localTheme])

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'dark') return 'dark'
    if (theme === 'light') return 'light'
    return systemIsDark ? 'dark' : 'light'
  }, [theme, systemIsDark])

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setLocalTheme(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newTheme)
    }
  }, [])

  // Sync DOM and localStorage with current resolved theme
  useEffect(() => {
    if (typeof window === 'undefined') return

    localStorage.setItem(STORAGE_KEY, theme)
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme, resolvedTheme])

  // Listen to system prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return { theme, setTheme, resolvedTheme }
}
