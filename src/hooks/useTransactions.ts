import { useState, useEffect, useCallback, useContext } from 'react'
import { useAuth } from './useAuth'
import { SelectedMonthContext } from './useSelectedMonth'
import { subscribeTransactions } from '../services/transactions'
import type { Transaction } from '../types'

export interface UseTransactionsResult {
  data: Transaction[]
  loading: boolean
  error: Error | null
  refresh: () => void
}

export function useTransactions(range: { start: Date; end: Date }): UseTransactionsResult {
  const { user } = useAuth()
  const monthContext = useContext(SelectedMonthContext)
  const refreshKey = monthContext?.refreshKey ?? 0
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const startTime = range.start.getTime()
  const endTime = range.end.getTime()

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1)
  }, [])

  // Auto-refresh when user switches back to tab or unlocks phone
  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setRefreshTick((t) => t + 1)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    const unsubscribe = subscribeTransactions(
      user.uid,
      { start: new Date(startTime), end: new Date(endTime) },
      (transactions) => {
        setData(transactions)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user, startTime, endTime, refreshTick, refreshKey])

  if (!user) {
    return { data: [], loading: false, error: null, refresh }
  }

  return { data, loading, error, refresh }
}

