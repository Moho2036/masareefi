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

export interface UseTransactionsOptions {
  enabled?: boolean
}

export function useTransactions(
  range: { start: Date; end: Date },
  options?: UseTransactionsOptions
): UseTransactionsResult {
  const enabled = options?.enabled ?? true
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

  useEffect(() => {
    if (!user || !enabled || startTime >= endTime) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

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
  }, [user, enabled, startTime, endTime, refreshTick, refreshKey])

  if (!user || !enabled || startTime >= endTime) {
    return { data: [], loading: false, error: null, refresh }
  }

  return { data, loading, error, refresh }
}


