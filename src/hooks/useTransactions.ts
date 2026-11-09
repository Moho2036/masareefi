import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { subscribeTransactions, subscribeAllTransactions } from '../services/transactions'
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

type SubscriptionListener = (data: Transaction[], loading: boolean, error: Error | null) => void

interface SharedSubscription {
  data: Transaction[]
  loading: boolean
  error: Error | null
  initialized: boolean
  unsubscribe: () => void
  subscribers: Set<SubscriptionListener>
  cleanupTimer?: ReturnType<typeof setTimeout> | null
}

// Module-level Shared Subscription Pool keyed by: `${uid}_${hasRange ? `${startTime}_${endTime}` : 'all'}`
const subscriptionPool = new Map<string, SharedSubscription>()

function subscribeToPool(
  key: string,
  uid: string,
  range: { start: Date; end: Date } | undefined,
  listener: SubscriptionListener
): () => void {
  let entry = subscriptionPool.get(key)

  if (!entry) {
    const subscribers = new Set<SubscriptionListener>()
    let unsubscribeFirestore: (() => void) | null = null

    entry = {
      data: [],
      loading: true,
      error: null,
      initialized: false,
      unsubscribe: () => {
        if (unsubscribeFirestore) {
          unsubscribeFirestore()
          unsubscribeFirestore = null
        }
      },
      subscribers,
    }

    subscriptionPool.set(key, entry)

    const onNext = (transactions: Transaction[]) => {
      const currentEntry = subscriptionPool.get(key)
      if (!currentEntry) return
      currentEntry.data = transactions
      currentEntry.loading = false
      currentEntry.error = null
      currentEntry.initialized = true
      currentEntry.subscribers.forEach((notify) => {
        notify(transactions, false, null)
      })
    }

    const onError = (err: Error) => {
      const currentEntry = subscriptionPool.get(key)
      if (!currentEntry) return
      currentEntry.loading = false
      currentEntry.error = err
      currentEntry.initialized = true
      currentEntry.subscribers.forEach((notify) => {
        notify(currentEntry.data, false, err)
      })
    }

    entry.subscribers.add(listener)

    if (range) {
      unsubscribeFirestore = subscribeTransactions(uid, range, onNext, onError)
    } else {
      unsubscribeFirestore = subscribeAllTransactions(uid, onNext, onError)
    }
  } else {
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer)
      entry.cleanupTimer = null
    }
    entry.subscribers.add(listener)
    if (entry.initialized) {
      listener(entry.data, false, entry.error)
    }
  }

  return () => {
    const currentEntry = subscriptionPool.get(key)
    if (!currentEntry) return

    currentEntry.subscribers.delete(listener)

    if (currentEntry.subscribers.size === 0) {
      if (currentEntry.cleanupTimer) {
        clearTimeout(currentEntry.cleanupTimer)
      }
      currentEntry.cleanupTimer = setTimeout(() => {
        if (currentEntry.subscribers.size === 0) {
          currentEntry.unsubscribe()
          subscriptionPool.delete(key)
        }
      }, 5000)
    }
  }
}

export function useTransactions(
  range?: { start: Date; end: Date },
  options?: UseTransactionsOptions
): UseTransactionsResult {
  const enabled = options?.enabled ?? true
  const { user } = useAuth()

  const startTime = range ? range.start.getTime() : undefined
  const endTime = range ? range.end.getTime() : undefined
  const hasRange = Boolean(range)

  const isRangeValid =
    !hasRange ||
    (startTime !== undefined &&
      endTime !== undefined &&
      !Number.isNaN(startTime) &&
      !Number.isNaN(endTime) &&
      startTime < endTime)

  const isEnabled = Boolean(user && enabled && isRangeValid)
  const key = isEnabled && user ? `${user.uid}_${hasRange ? `${startTime}_${endTime}` : 'all'}` : null

  const getInitialState = () => {
    if (!key) {
      return { data: [] as Transaction[], loading: false, error: null as Error | null }
    }
    const pooled = subscriptionPool.get(key)
    if (pooled && pooled.initialized) {
      return { data: pooled.data, loading: false, error: pooled.error }
    }
    return { data: [] as Transaction[], loading: true, error: null as Error | null }
  }

  const [initial] = useState(getInitialState)
  const [data, setData] = useState<Transaction[]>(initial.data)
  const [loading, setLoading] = useState<boolean>(initial.loading)
  const [error, setError] = useState<Error | null>(initial.error)

  const [prevKey, setPrevKey] = useState<string | null>(key)
  if (prevKey !== key) {
    setPrevKey(key)
    if (!key) {
      setData([])
      setLoading(false)
      setError(null)
    } else {
      const pooled = subscriptionPool.get(key)
      if (pooled && pooled.initialized) {
        setData(pooled.data)
        setLoading(false)
        setError(pooled.error)
      } else {
        setData([])
        setLoading(true)
        setError(null)
      }
    }
  }

  const refresh = useCallback(() => {
    // Real-time onSnapshot maintains instant synchronization
  }, [])

  useEffect(() => {
    if (!isEnabled || !user || !key) {
      return
    }

    const rangeObj =
      hasRange && startTime !== undefined && endTime !== undefined
        ? { start: new Date(startTime), end: new Date(endTime) }
        : undefined

    const unsub = subscribeToPool(key, user.uid, rangeObj, (txs, isLoading, err) => {
      setData(txs)
      setLoading(isLoading)
      setError(err)
    })

    return () => {
      unsub()
    }
  }, [isEnabled, user, key, hasRange, startTime, endTime])

  if (!isEnabled) {
    return { data: [], loading: false, error: null, refresh }
  }

  return { data, loading, error, refresh }
}
