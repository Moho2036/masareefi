import { describe, it, expect } from 'vitest'
import {
  pruneNotificationIds,
  MAX_STORED_NOTIFICATION_IDS,
} from './useNotifications'

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
