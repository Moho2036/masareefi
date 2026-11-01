import { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react'
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
import { useTransactions } from './useTransactions'

export function useNotifications() {
  const { user } = useAuth()
  const uid = user?.uid
  const { data: debts } = useDebts()
  const { data: moneyCircles } = useMoneyCircles()
  const { data: recurring } = useRecurring()
  const { data: settings } = useUserSettings()
  const appData = useContext(AppDataContext)
  const rolloverBalanceFils = appData?.rolloverBalanceFils ?? 0

  const currentMonthRange = useMemo(
    () => getFinancialMonthRange(new Date(), settings?.monthStartDay ?? 1),
    [settings?.monthStartDay]
  )
  const { data: currentMonthTransactions } = useTransactions(currentMonthRange, {
    enabled: Boolean(uid),
  })

  // Storage keys
  const storageKey = uid ? `baseer_notifications_read_${uid}` : null
  const legacyStorageKey = uid ? `masareefi_notifications_read_${uid}` : null

  const dismissedStorageKey = uid ? `baseer_notifications_dismissed_${uid}` : null
  const legacyDismissedStorageKey = uid ? `masareefi_notifications_dismissed_${uid}` : null

  const historyStorageKey = uid ? `baseer_notifications_history_${uid}` : null
  const permanentlyDeletedKey = uid ? `baseer_notifications_deleted_${uid}` : null

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

  const getStoredDismissedIds = useCallback((): Set<string> => {
    if (!dismissedStorageKey || typeof window === 'undefined' || !window.localStorage) {
      return new Set<string>()
    }
    try {
      const raw =
        window.localStorage.getItem(dismissedStorageKey) ||
        (legacyDismissedStorageKey ? window.localStorage.getItem(legacyDismissedStorageKey) : null)
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
  }, [dismissedStorageKey, legacyDismissedStorageKey])

  const getStoredDeletedIds = useCallback((): Set<string> => {
    if (!permanentlyDeletedKey || typeof window === 'undefined' || !window.localStorage) {
      return new Set<string>()
    }
    try {
      const raw = window.localStorage.getItem(permanentlyDeletedKey)
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
  }, [permanentlyDeletedKey])

  const getStoredHistory = useCallback((): NotificationItem[] => {
    if (!historyStorageKey || typeof window === 'undefined' || !window.localStorage) {
      return []
    }
    try {
      const raw = window.localStorage.getItem(historyStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
          return parsed
            .map((item: { id: string; title: string; message: string; category: NotificationItem['category']; isUrgent: boolean; createdAt: string | Date; actionPath?: string; actionLabel?: string }) => ({
              ...item,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            }))
            .filter((item: NotificationItem) => item.createdAt.getTime() >= sixtyDaysAgo)
            .slice(0, 100)
        }
      }
    } catch {
      // ignore
    }
    return []
  }, [historyStorageKey])

  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds())
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getStoredDismissedIds())
  const [permanentlyDeletedIds, setPermanentlyDeletedIds] = useState<Set<string>>(() => getStoredDeletedIds())
  const [storedHistory, setStoredHistory] = useState<NotificationItem[]>(() => getStoredHistory())
  const lastSavedHistoryRef = useRef<string>('')

  // Adjust state during render when uid changes
  const [prevUid, setPrevUid] = useState(uid)
  if (prevUid !== uid) {
    setPrevUid(uid)
    setReadIds(getStoredReadIds())
    setDismissedIds(getStoredDismissedIds())
    setPermanentlyDeletedIds(getStoredDeletedIds())
    setStoredHistory(getStoredHistory())
  }

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

  // Save dismissedIds helper (archivedIds)
  const persistDismissedIds = useCallback(
    (nextSet: Set<string>) => {
      setDismissedIds(nextSet)
      if (dismissedStorageKey && typeof window !== 'undefined' && window.localStorage) {
        try {
          const payload = JSON.stringify(Array.from(nextSet))
          window.localStorage.setItem(dismissedStorageKey, payload)
          if (legacyDismissedStorageKey) {
            window.localStorage.setItem(legacyDismissedStorageKey, payload)
          }
          window.dispatchEvent(new CustomEvent('baseer-notifications-sync'))
        } catch {
          // ignore
        }
      }
    },
    [dismissedStorageKey, legacyDismissedStorageKey]
  )

  // Save permanently deleted IDs helper
  const persistDeletedIds = useCallback(
    (nextSet: Set<string>) => {
      setPermanentlyDeletedIds(nextSet)
      if (permanentlyDeletedKey && typeof window !== 'undefined' && window.localStorage) {
        try {
          const payload = JSON.stringify(Array.from(nextSet))
          window.localStorage.setItem(permanentlyDeletedKey, payload)
          window.dispatchEvent(new CustomEvent('baseer-notifications-sync'))
        } catch {
          // ignore
        }
      }
    },
    [permanentlyDeletedKey]
  )

  // Sync state across tabs / mounted hook instances
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleSync = () => {
      setReadIds(getStoredReadIds())
      setDismissedIds(getStoredDismissedIds())
      setPermanentlyDeletedIds(getStoredDeletedIds())
      setStoredHistory(getStoredHistory())
    }
    window.addEventListener('baseer-notifications-sync', handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('baseer-notifications-sync', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [getStoredReadIds, getStoredDismissedIds, getStoredDeletedIds, getStoredHistory])

  // Raw active notifications generated by current state
  const rawActive = useMemo(() => {
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
  }, [
    debts,
    moneyCircles,
    recurring,
    settings,
    currentMonthTransactions,
    incomeFils,
    spendingFils,
    rolloverBalanceFils,
  ])

  // Combined history of notifications (stored from localStorage + current active ones)
  const combinedHistory = useMemo(() => {
    const map = new Map<string, NotificationItem>()
    for (const item of storedHistory) {
      map.set(item.id, item)
    }
    for (const item of rawActive) {
      if (!permanentlyDeletedIds.has(item.id)) {
        map.set(item.id, item)
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100)
  }, [storedHistory, rawActive, permanentlyDeletedIds])

  // Sync combined history to localStorage (external system synchronization)
  useEffect(() => {
    if (!uid || combinedHistory.length === 0 || !historyStorageKey || typeof window === 'undefined' || !window.localStorage) {
      return
    }
    try {
      const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
      const serializable = combinedHistory
        .filter((i) => i.createdAt.getTime() >= sixtyDaysAgo)
        .map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
        }))
      const payload = JSON.stringify(serializable)
      if (payload !== lastSavedHistoryRef.current) {
        lastSavedHistoryRef.current = payload
        window.localStorage.setItem(historyStorageKey, payload)
      }
    } catch {
      // ignore
    }
  }, [uid, combinedHistory, historyStorageKey])

  // Active notifications (not archived and not permanently deleted)
  const activeNotifications = useMemo(() => {
    return rawActive.filter(
      (item) => !dismissedIds.has(item.id) && !permanentlyDeletedIds.has(item.id)
    )
  }, [rawActive, dismissedIds, permanentlyDeletedIds])

  // Archived notifications (archived by user OR historical expired items)
  const archivedNotifications = useMemo(() => {
    const rawActiveMap = new Map(rawActive.map((i) => [i.id, i]))
    const archived: NotificationItem[] = []

    for (const item of combinedHistory) {
      if (permanentlyDeletedIds.has(item.id)) continue

      const isExplicitlyArchived = dismissedIds.has(item.id)
      const isHistoricalExpired = !rawActiveMap.has(item.id)

      if (isExplicitlyArchived || isHistoricalExpired) {
        archived.push(item)
      }
    }

    return archived.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [rawActive, combinedHistory, dismissedIds, permanentlyDeletedIds])

  // Count unread in active notifications
  const unreadCount = useMemo(() => {
    return activeNotifications.filter((item) => !readIds.has(item.id)).length
  }, [activeNotifications, readIds])

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
    const allIds = new Set(readIds)
    for (const n of activeNotifications) {
      allIds.add(n.id)
    }
    persistReadIds(allIds)
  }, [activeNotifications, readIds, persistReadIds])

  const clearRead = useCallback(() => {
    if (readIds.size === 0) return
    const nextDismissed = new Set(dismissedIds)
    for (const id of readIds) {
      nextDismissed.add(id)
    }
    persistDismissedIds(nextDismissed)
  }, [readIds, dismissedIds, persistDismissedIds])

  const archiveNotification = useCallback(
    (id: string) => {
      // Mark as read
      setReadIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        persistReadIds(next)
        return next
      })
      // Add to archived
      setDismissedIds((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        persistDismissedIds(next)
        return next
      })
    },
    [persistReadIds, persistDismissedIds]
  )

  const restoreFromArchive = useCallback(
    (id: string) => {
      if (!dismissedIds.has(id)) return
      const next = new Set(dismissedIds)
      next.delete(id)
      persistDismissedIds(next)
    },
    [dismissedIds, persistDismissedIds]
  )

  const deleteFromArchive = useCallback(
    (id: string) => {
      const nextDeleted = new Set(permanentlyDeletedIds)
      nextDeleted.add(id)
      persistDeletedIds(nextDeleted)

      setStoredHistory((prev) => prev.filter((item) => item.id !== id))
    },
    [permanentlyDeletedIds, persistDeletedIds]
  )

  const clearArchive = useCallback(() => {
    const nextDeleted = new Set(permanentlyDeletedIds)
    for (const item of archivedNotifications) {
      nextDeleted.add(item.id)
    }
    persistDeletedIds(nextDeleted)

    setStoredHistory([])
  }, [archivedNotifications, permanentlyDeletedIds, persistDeletedIds])

  const filterNotifications = useCallback(
    (filter: NotificationFilter): NotificationItem[] => {
      switch (filter) {
        case 'archived':
          return archivedNotifications
        case 'urgent':
          return activeNotifications.filter((n) => n.isUrgent)
        case 'recurring':
          return activeNotifications.filter((n) => n.category === 'recurring')
        case 'debt_circle':
          return activeNotifications.filter((n) => n.category === 'debt' || n.category === 'circle')
        case 'unread':
          return activeNotifications.filter((n) => !readIds.has(n.id))
        case 'all':
        default:
          return activeNotifications
      }
    },
    [activeNotifications, archivedNotifications, readIds]
  )

  const isRead = useCallback((id: string) => readIds.has(id), [readIds])

  return useMemo(
    () => ({
      notifications: activeNotifications,
      archivedNotifications,
      unreadCount,
      archivedCount: archivedNotifications.length,
      readIds,
      dismissedIds,
      archivedIds: dismissedIds,
      markAsRead,
      markAllAsRead,
      clearRead,
      archiveRead: clearRead,
      archiveNotification,
      restoreFromArchive,
      deleteFromArchive,
      clearArchive,
      filterNotifications,
      isRead,
    }),
    [
      activeNotifications,
      archivedNotifications,
      unreadCount,
      readIds,
      dismissedIds,
      markAsRead,
      markAllAsRead,
      clearRead,
      archiveNotification,
      restoreFromArchive,
      deleteFromArchive,
      clearArchive,
      filterNotifications,
      isRead,
    ]
  )
}
