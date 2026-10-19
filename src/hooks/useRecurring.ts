import { useState, useEffect, useContext } from 'react'
import { useAuth } from './useAuth'
import { subscribeRecurring } from '../services/recurring'
import { AppDataContext } from '../context/AppDataContext'
import type { Recurring } from '../types'

export interface UseRecurringResult {
  data: Recurring[]
  loading: boolean
  error: Error | null
}

export function useRecurring(): UseRecurringResult {
  const appData = useContext(AppDataContext)
  const { user } = useAuth()

  // Local fallback states if used outside AppDataProvider
  const [localData, setLocalData] = useState<Recurring[]>([])
  const [localLoading, setLocalLoading] = useState(true)
  const [localError, setLocalError] = useState<Error | null>(null)

  useEffect(() => {
    // If context is provided, AppDataProvider manages the single deduplicated subscription
    if (appData || !user) {
      return
    }

    const unsubscribe = subscribeRecurring(
      user.uid,
      (items) => {
        setLocalData(items)
        setLocalLoading(false)
      },
      (err) => {
        setLocalError(err)
        setLocalLoading(false)
      }
    )

    return () => unsubscribe()
  }, [appData, user])

  if (appData) {
    return {
      data: appData.recurring,
      loading: appData.recurringLoading,
      error: appData.recurringError,
    }
  }

  if (!user) {
    return { data: [], loading: false, error: null }
  }

  return {
    data: localData,
    loading: localLoading,
    error: localError,
  }
}
