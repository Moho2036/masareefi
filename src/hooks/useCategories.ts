import { useState, useEffect, useContext } from 'react'
import { useAuth } from './useAuth'
import { subscribeCategories } from '../services/categories'
import { AppDataContext } from '../context/AppDataContext'
import type { Category } from '../types'

export interface UseCategoriesResult {
  data: Category[]
  loading: boolean
  error: Error | null
}

export function useCategories(): UseCategoriesResult {
  const appData = useContext(AppDataContext)
  const { user } = useAuth()

  // Local fallback states if used outside AppDataProvider
  const [localData, setLocalData] = useState<Category[]>([])
  const [localLoading, setLocalLoading] = useState(true)
  const [localError, setLocalError] = useState<Error | null>(null)

  useEffect(() => {
    // If context is provided, AppDataProvider manages the subscription
    if (appData || !user) {
      return
    }

    const unsubscribe = subscribeCategories(
      user.uid,
      (categories) => {
        setLocalData(categories)
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
      data: appData.categories,
      loading: appData.categoriesLoading,
      error: appData.categoriesError,
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
