import { useState, useEffect, useCallback, useContext } from 'react'
import { useAuth } from './useAuth'
import { subscribeUserSettings, updateUserSettings } from '../services/userProfile'
import { AppDataContext } from '../context/AppDataContext'
import type { UserSettings } from '../types'

export interface UseUserSettingsResult {
  data: UserSettings | null
  loading: boolean
  error: Error | null
  updateSettings: (partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>) => Promise<void>
}

export function useUserSettings(): UseUserSettingsResult {
  const appData = useContext(AppDataContext)
  const { user } = useAuth()

  // Local fallback states if used outside AppDataProvider
  const [localData, setLocalData] = useState<UserSettings | null>(null)
  const [localLoading, setLocalLoading] = useState(true)
  const [localError, setLocalError] = useState<Error | null>(null)

  useEffect(() => {
    // If context is provided, AppDataProvider manages the subscription
    if (appData || !user) {
      return
    }

    const unsubscribe = subscribeUserSettings(
      user.uid,
      (settings) => {
        setLocalData(settings)
        setLocalLoading(false)
      },
      (err) => {
        setLocalError(err)
        setLocalLoading(false)
      }
    )

    return () => unsubscribe()
  }, [appData, user])

  const handleUpdateSettings = useCallback(
    async (partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>): Promise<void> => {
      if (appData) {
        return appData.updateSettings(partial)
      }
      if (!user) throw new Error('No authenticated user')
      await updateUserSettings(user.uid, partial)
    },
    [appData, user]
  )

  if (appData) {
    return {
      data: appData.settings,
      loading: appData.settingsLoading,
      error: appData.settingsError,
      updateSettings: appData.updateSettings,
    }
  }

  if (!user) {
    return { data: null, loading: false, error: null, updateSettings: handleUpdateSettings }
  }

  return {
    data: localData,
    loading: localLoading,
    error: localError,
    updateSettings: handleUpdateSettings,
  }
}
