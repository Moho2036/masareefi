import { useState, useEffect, useContext } from 'react'
import { useAuth } from './useAuth'
import { subscribeMoneyCircles } from '../services/moneyCircles'
import { AppDataContext } from '../context/AppDataContext'
import type { MoneyCircle } from '../types'

export interface UseMoneyCirclesResult {
  data: MoneyCircle[]
  loading: boolean
  error: Error | null
}

export function useMoneyCircles(): UseMoneyCirclesResult {
  const appData = useContext(AppDataContext)
  const { user } = useAuth()

  // Local fallback states if used outside AppDataProvider
  const [localData, setLocalData] = useState<MoneyCircle[]>([])
  const [localLoading, setLocalLoading] = useState(true)
  const [localError, setLocalError] = useState<Error | null>(null)

  useEffect(() => {
    // If context is provided, AppDataProvider manages the single deduplicated subscription
    if (appData || !user) {
      return
    }

    const unsubscribe = subscribeMoneyCircles(
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
      data: appData.moneyCircles,
      loading: appData.moneyCirclesLoading,
      error: appData.moneyCirclesError,
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
