import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { subscribeUserSettings, updateUserSettings } from '../services/userProfile'
import type { UserSettings } from '../types'

export interface UseUserSettingsResult {
  data: UserSettings | null
  loading: boolean
  error: Error | null
  updateSettings: (partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>) => Promise<void>
}

export function useUserSettings(): UseUserSettingsResult {
  const { user } = useAuth()
  const [data, setData] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) {
      return
    }

    const unsubscribe = subscribeUserSettings(
      user.uid,
      (settings) => {
        setData(settings)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  const updateSettings = useCallback(
    async (partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>): Promise<void> => {
      if (!user) throw new Error('No authenticated user')
      await updateUserSettings(user.uid, partial)
    },
    [user]
  )

  if (!user) {
    return { data: null, loading: false, error: null, updateSettings }
  }

  return { data, loading, error, updateSettings }
}
