import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
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
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const startTime = range.start.getTime()
  const endTime = range.end.getTime()

  const refresh = useCallback(() => {
    // Real-time onSnapshot maintains instant synchronization
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
  }, [user, enabled, startTime, endTime])

  if (!user || !enabled || startTime >= endTime) {
    return { data: [], loading: false, error: null, refresh }
  }

  return { data, loading, error, refresh }
}


