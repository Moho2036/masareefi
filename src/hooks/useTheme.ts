import { useState, useEffect, useCallback, useMemo } from 'react'
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

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(getInitialTheme)
  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemIsDark)

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'dark') return 'dark'
    if (theme === 'light') return 'light'
    return systemIsDark ? 'dark' : 'light'
  }, [theme, systemIsDark])

  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemeState(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newTheme)
    }
  }, [])

  // Sync DOM with resolved theme
  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolvedTheme])

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
