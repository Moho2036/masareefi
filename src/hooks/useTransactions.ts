import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { subscribeTransactions } from '../services/transactions'
import type { Transaction } from '../types'

export interface UseTransactionsResult {
  data: Transaction[]
  loading: boolean
  error: Error | null
}

export function useTransactions(range: { start: Date; end: Date }): UseTransactionsResult {
  const { user } = useAuth()
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const startTime = range.start.getTime()
  const endTime = range.end.getTime()

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
  }, [user, startTime, endTime])

  if (!user) {
    return { data: [], loading: false, error: null }
  }

  return { data, loading, error }
}
