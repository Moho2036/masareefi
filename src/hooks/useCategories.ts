import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { subscribeCategories } from '../services/categories'
import type { Category } from '../types'

export interface UseCategoriesResult {
  data: Category[]
  loading: boolean
  error: Error | null
}

export function useCategories(): UseCategoriesResult {
  const { user } = useAuth()
  const [data, setData] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) {
      return
    }

    const unsubscribe = subscribeCategories(
      user.uid,
      (categories) => {
        setData(categories)
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
