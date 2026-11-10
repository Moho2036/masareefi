import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useNotifications,
  pruneNotificationIds,
  MAX_STORED_NOTIFICATION_IDS,
} from './useNotifications'

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-user-1' } }),
}))
vi.mock('./useDebts', () => ({
  useDebts: () => ({ debts: [] }),
}))
vi.mock('./useRecurring', () => ({
  useRecurring: () => ({ recurring: [] }),
}))
vi.mock('./useMoneyCircles', () => ({
  useMoneyCircles: () => ({ moneyCircles: [] }),
}))
vi.mock('./useUserSettings', () => ({
  useUserSettings: () => ({
    data: {
      displayName: 'مستخدم',
      currency: 'JOD',
      monthStartDay: 1,
      notificationPrefs: {},
    },
  }),
}))
vi.mock('./useTransactions', () => ({
  useTransactions: () => ({ data: [] }),
}))

describe('useNotifications - pruneNotificationIds', () => {
  it('exports MAX_STORED_NOTIFICATION_IDS equal to 400', () => {
    expect(MAX_STORED_NOTIFICATION_IDS).toBe(400)
  })

  it('returns all items when count is less than or equal to MAX_STORED_NOTIFICATION_IDS', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `notif-${i}`)
    const result = pruneNotificationIds(ids)

    expect(result.size).toBe(50)
    for (let i = 0; i < 50; i++) {
      expect(result.has(`notif-${i}`)).toBe(true)
    }
  })

  it('deduplicates redundant IDs before checking length', () => {
    const ids = ['notif-1', 'notif-2', 'notif-1', 'notif-3', 'notif-2']
    const result = pruneNotificationIds(ids)

    expect(result.size).toBe(3)
    expect(Array.from(result)).toEqual(['notif-1', 'notif-2', 'notif-3'])
  })

  it('prunes oldest IDs when length exceeds 400 (FIFO) preserving newest 400 items', () => {
    // 500 IDs: notif-0 (oldest) to notif-499 (newest)
    const ids = Array.from({ length: 500 }, (_, i) => `notif-${i}`)
    const result = pruneNotificationIds(ids)

    expect(result.size).toBe(MAX_STORED_NOTIFICATION_IDS)
    // The oldest 100 items (notif-0 to notif-99) should be pruned
    expect(result.has('notif-0')).toBe(false)
    expect(result.has('notif-99')).toBe(false)

    // The newest 400 items (notif-100 to notif-499) should all be present
    expect(result.has('notif-100')).toBe(true)
    expect(result.has('notif-499')).toBe(true)
  })

  it('preserves keepPriorityIds even if they are among the oldest entries', () => {
    // 500 IDs: notif-0 to notif-499
    const ids = Array.from({ length: 500 }, (_, i) => `notif-${i}`)
    // Priority IDs from the very beginning that would normally be pruned
    const priority = new Set(['notif-0', 'notif-1', 'notif-2'])

    const result = pruneNotificationIds(ids, priority)

    expect(result.size).toBe(MAX_STORED_NOTIFICATION_IDS)
    // Priority items must be preserved!
    expect(result.has('notif-0')).toBe(true)
    expect(result.has('notif-1')).toBe(true)
    expect(result.has('notif-2')).toBe(true)

    // Newest items must still be preserved
    expect(result.has('notif-499')).toBe(true)
    expect(result.has('notif-498')).toBe(true)

    // A non-priority old item should be pruned
    expect(result.has('notif-3')).toBe(false)
  })

  it('caps at MAX_STORED_NOTIFICATION_IDS when priority set itself exceeds 400', () => {
    const ids = Array.from({ length: 600 }, (_, i) => `notif-${i}`)
    const priority = new Set(Array.from({ length: 450 }, (_, i) => `notif-${i}`))

    const result = pruneNotificationIds(ids, priority)

    expect(result.size).toBe(MAX_STORED_NOTIFICATION_IDS)
  })

  it('handles empty iterable cleanly', () => {
    const result = pruneNotificationIds([])
    expect(result.size).toBe(0)
  })
})

describe('useNotifications hook archive persistence', () => {
  const historyKey = 'baseer_notifications_history_test-user-1'

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('persists empty array to localStorage on clearArchive and prevents resurrection on sync event', () => {
    const historicalItems = [
      {
        id: 'hist-1',
        title: 'تنبيه قديم',
        message: 'رسالة سابقة',
        category: 'system' as const,
        isUrgent: false,
        createdAt: new Date().toISOString(),
      },
    ]
    localStorage.setItem(historyKey, JSON.stringify(historicalItems))

    const { result } = renderHook(() => useNotifications())

    expect(result.current.archivedNotifications.some((n) => n.id === 'hist-1')).toBe(true)

    // Clear archive
    act(() => {
      result.current.clearArchive()
    })

    expect(result.current.archivedNotifications).toHaveLength(0)
    expect(localStorage.getItem(historyKey)).toBe('[]')

    // Simulate cross-tab or synchronous sync event
    act(() => {
      window.dispatchEvent(new CustomEvent('baseer-notifications-sync'))
    })

    // Must NOT resurrect!
    expect(result.current.archivedNotifications).toHaveLength(0)
    expect(localStorage.getItem(historyKey)).toBe('[]')
  })

  it('updates localStorage before dispatching sync in deleteFromArchive', () => {
    const historicalItems = [
      {
        id: 'hist-a',
        title: 'تنبيه أ',
        message: 'رسالة أ',
        category: 'system' as const,
        isUrgent: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'hist-b',
        title: 'تنبيه ب',
        message: 'رسالة ب',
        category: 'system' as const,
        isUrgent: false,
        createdAt: new Date().toISOString(),
      },
    ]
    localStorage.setItem(historyKey, JSON.stringify(historicalItems))

    const { result } = renderHook(() => useNotifications())
    expect(result.current.archivedNotifications).toHaveLength(2)

    act(() => {
      result.current.deleteFromArchive('hist-a')
    })

    expect(result.current.archivedNotifications.some((n) => n.id === 'hist-a')).toBe(false)
    const stored = JSON.parse(localStorage.getItem(historyKey) || '[]')
    expect(stored.some((item: { id: string }) => item.id === 'hist-a')).toBe(false)
    expect(stored.some((item: { id: string }) => item.id === 'hist-b')).toBe(true)

    // Trigger sync event - hist-a must not resurrect
    act(() => {
      window.dispatchEvent(new CustomEvent('baseer-notifications-sync'))
    })
    expect(result.current.archivedNotifications.some((n) => n.id === 'hist-a')).toBe(false)
  })
})
