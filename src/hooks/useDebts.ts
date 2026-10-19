import { useState, useEffect, useContext } from 'react'
import { useAuth } from './useAuth'
import { subscribeDebts } from '../services/debts'
import { AppDataContext } from '../context/AppDataContext'
import type { Debt } from '../types'

export interface UseDebtsResult {
  data: Debt[]
  loading: boolean
  error: Error | null
}

export function useDebts(): UseDebtsResult {
  const appData = useContext(AppDataContext)
  const { user } = useAuth()

  // Local fallback states if used outside AppDataProvider
  const [localData, setLocalData] = useState<Debt[]>([])
  const [localLoading, setLocalLoading] = useState(true)
  const [localError, setLocalError] = useState<Error | null>(null)

  useEffect(() => {
    // If context is provided, AppDataProvider manages the single deduplicated subscription
    if (appData || !user) {
      return
    }

    const unsubscribe = subscribeDebts(
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
      data: appData.debts,
      loading: appData.debtsLoading,
      error: appData.debtsError,
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
