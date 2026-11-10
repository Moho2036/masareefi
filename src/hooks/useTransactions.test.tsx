import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTransactions, _clearSubscriptionPoolForTest } from './useTransactions'
import type { Transaction } from '../types'

let mockUser: { uid: string } | null = { uid: 'user-123' }

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}))

type TxCallback = (txs: Transaction[]) => void
type ErrCallback = (err: Error) => void

let onNextCallback: TxCallback | null = null
let onErrorCallback: ErrCallback | null = null
let unsubscribeMock = vi.fn()
let subscribeCallCount = 0

vi.mock('../services/transactions', () => ({
  subscribeAllTransactions: vi.fn((_uid: string, onNext: TxCallback, onError: ErrCallback) => {
    subscribeCallCount++
    onNextCallback = onNext
    onErrorCallback = onError
    return unsubscribeMock
  }),
  subscribeTransactions: vi.fn((_uid: string, _range: unknown, onNext: TxCallback, onError: ErrCallback) => {
    subscribeCallCount++
    onNextCallback = onNext
    onErrorCallback = onError
    return unsubscribeMock
  }),
}))

describe('useTransactions hook', () => {
  beforeEach(() => {
    _clearSubscriptionPoolForTest()
    mockUser = { uid: 'user-123' }
    subscribeCallCount = 0
    onNextCallback = null
    onErrorCallback = null
    unsubscribeMock = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    _clearSubscriptionPoolForTest()
  })

  it('subscribes and receives transaction data', () => {
    const { result } = renderHook(() => useTransactions())

    expect(result.current.loading).toBe(true)
    expect(subscribeCallCount).toBe(1)

    const mockTxs: Transaction[] = [
      {
        id: 'tx-1',
        type: 'expense',
        amountFils: 15000,
        categoryId: 'cat-food',
        date: new Date(),
        note: 'غداء',
        createdAt: new Date(),
      },
    ]

    act(() => {
      onNextCallback!(mockTxs)
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('re-establishes subscription when a new listener subscribes to an errored pool entry', () => {
    const { result: firstHook } = renderHook(() => useTransactions())

    expect(subscribeCallCount).toBe(1)

    // Trigger an error on the pool entry
    const testError = new Error('Permission denied')
    act(() => {
      onErrorCallback!(testError)
    })

    expect(firstHook.current.error).toBe(testError)
    expect(firstHook.current.loading).toBe(false)

    // A second component subscribes to the same key while it is in an error state
    const { result: secondHook } = renderHook(() => useTransactions())

    // It should have re-triggered the subscription (subscribeCallCount becomes 2)
    expect(subscribeCallCount).toBe(2)
    expect(secondHook.current.loading).toBe(true)

    // Now subscription succeeds
    act(() => {
      onNextCallback!([])
    })

    expect(secondHook.current.error).toBeNull()
    expect(secondHook.current.loading).toBe(false)
    expect(firstHook.current.error).toBeNull()
  })

  it('allows refresh() to re-trigger the pool subscription when in error state', () => {
    const { result } = renderHook(() => useTransactions())

    expect(subscribeCallCount).toBe(1)

    // Trigger error
    act(() => {
      onErrorCallback!(new Error('Network error'))
    })

    expect(result.current.error).toBeTruthy()
    expect(result.current.loading).toBe(false)

    // Call refresh()
    act(() => {
      result.current.refresh()
    })

    // It should have re-triggered subscription
    expect(subscribeCallCount).toBe(2)
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()

    // Resolve successfully
    act(() => {
      onNextCallback!([])
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
