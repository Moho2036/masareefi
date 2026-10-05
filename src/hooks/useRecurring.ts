import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { subscribeRecurring } from '../services/recurring'
import type { Recurring } from '../types'

export interface UseRecurringResult {
  data: Recurring[]
  loading: boolean
  error: Error | null
}

export function useRecurring(): UseRecurringResult {
  const { user } = useAuth()
  const [data, setData] = useState<Recurring[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) {
      return
    }

    const unsubscribe = subscribeRecurring(
      user.uid,
      (items) => {
        setData(items)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  if (!user) {
    return { data: [], loading: false, error: null }
  }

  return { data, loading, error }
}
