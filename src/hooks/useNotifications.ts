import { useState, useEffect, useMemo, useCallback, useContext } from 'react'
import { useAuth } from './useAuth'
import { useDebts } from './useDebts'
import { useRecurring } from './useRecurring'
import { useMoneyCircles } from './useMoneyCircles'
import { useUserSettings } from './useUserSettings'
import { AppDataContext } from '../context/AppDataContext'
import {
  generateNotifications,
  type NotificationItem,
  type NotificationFilter,
} from '../lib/notifications'
import { getFinancialMonthRange } from '../lib/dates'
import { subscribeTransactions } from '../services/transactions'
import type { Transaction } from '../types'

export function useNotifications() {
  const { user } = useAuth()
  const uid = user?.uid
  const { data: debts } = useDebts()
  const { data: moneyCircles } = useMoneyCircles()
  const { data: recurring } = useRecurring()
  const { data: settings } = useUserSettings()
  const appData = useContext(AppDataContext)
  const rolloverBalanceFils = appData?.rolloverBalanceFils ?? 0

  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<Transaction[]>([])

  // Read IDs from localStorage
  const storageKey = uid ? `baseer_notifications_read_${uid}` : null
  const legacyStorageKey = uid ? `masareefi_notifications_read_${uid}` : null

  const getStoredReadIds = useCallback((): Set<string> => {
    if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
      return new Set<string>()
    }
    try {
      const raw =
        window.localStorage.getItem(storageKey) ||
        (legacyStorageKey ? window.localStorage.getItem(legacyStorageKey) : null)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return new Set<string>(parsed)
        }
      }
    } catch {
      // ignore
    }
    return new Set<string>()
  }, [storageKey, legacyStorageKey])

  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds())

  // Adjust state during render when uid changes
  const [prevUid, setPrevUid] = useState(uid)
  if (prevUid !== uid) {
    setPrevUid(uid)
    setCurrentMonthTransactions([])
    setReadIds(getStoredReadIds())
  }

  // Subscribe to current financial month transactions for budget warnings
  useEffect(() => {
    if (!uid) {
      return
    }

    const monthStartDay = settings?.monthStartDay ?? 1
    const range = getFinancialMonthRange(new Date(), monthStartDay)

    const unsub = subscribeTransactions(
      uid,
      range,
      (txs) => {
        setCurrentMonthTransactions(txs)
      },
      (err) => {
        console.error('Failed to subscribe transactions for notifications:', err)
      }
    )

    return () => {
      unsub()
    }
  }, [uid, settings?.monthStartDay])

  // Calculate current month income and spending
  const { incomeFils, spendingFils } = useMemo(() => {
    let income = 0
    let expense = 0
    for (const tx of currentMonthTransactions) {
      if (tx.type === 'income') {
        income += tx.amountFils || 0
      } else if (tx.type === 'expense') {
        expense += tx.amountFils || 0
      }
    }
    return { incomeFils: income, spendingFils: expense }
  }, [currentMonthTransactions])

  // Save readIds helper
  const persistReadIds = useCallback(
    (nextSet: Set<string>) => {
      setReadIds(nextSet)
      if (storageKey && typeof window !== 'undefined' && window.localStorage) {
        try {
          const payload = JSON.stringify(Array.from(nextSet))
          window.localStorage.setItem(storageKey, payload)
          if (legacyStorageKey) {
            window.localStorage.setItem(legacyStorageKey, payload)
          }
          window.dispatchEvent(new CustomEvent('baseer-notifications-sync'))
        } catch {
          // ignore
        }
      }
    },
    [storageKey, legacyStorageKey]
  )

  // Sync readIds across all mounted hook instances (e.g. AppShell bell badge & NotificationCenterModal)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleSync = () => {
      setReadIds(getStoredReadIds())
    }
    window.addEventListener('baseer-notifications-sync', handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('baseer-notifications-sync', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [getStoredReadIds])

  // Generate all active notifications
  const allNotifications = useMemo(() => {
    return generateNotifications({
      debts,
      circles: moneyCircles,
      recurring,
      settings,
      transactions: currentMonthTransactions,
      today: new Date(),
      currentMonthIncomeFils: incomeFils,
      currentMonthSpendingFils: spendingFils,
      priorBalanceFils: rolloverBalanceFils,
    })
  }, [debts, moneyCircles, recurring, settings, currentMonthTransactions, incomeFils, spendingFils, rolloverBalanceFils])

  // Count unread
  const unreadCount = useMemo(() => {
    return allNotifications.filter((item) => !readIds.has(item.id)).length
  }, [allNotifications, readIds])

  // Actions
  const markAsRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        persistReadIds(next)
        return next
      })
    },
    [persistReadIds]
  )

  const markAllAsRead = useCallback(() => {
    const allIds = new Set(allNotifications.map((n) => n.id))
    persistReadIds(allIds)
  }, [allNotifications, persistReadIds])

  const clearRead = useCallback(() => {
    persistReadIds(new Set())
  }, [persistReadIds])

  const filterNotifications = useCallback(
    (filter: NotificationFilter): NotificationItem[] => {
      switch (filter) {
        case 'urgent':
          return allNotifications.filter((n) => n.isUrgent)
        case 'recurring':
          return allNotifications.filter((n) => n.category === 'recurring')
        case 'debt_circle':
          return allNotifications.filter((n) => n.category === 'debt' || n.category === 'circle')
        case 'unread':
          return allNotifications.filter((n) => !readIds.has(n.id))
        case 'all':
        default:
          return allNotifications
      }
    },
    [allNotifications, readIds]
  )

  return {
    notifications: allNotifications,
    unreadCount,
    readIds,
    markAsRead,
    markAllAsRead,
    clearRead,
    filterNotifications,
    isRead: (id: string) => readIds.has(id),
  }
}
