import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AppDataProvider, useAppData } from './AppDataContext'
import * as transactionsService from '../services/transactions'
import type { UserSettings } from '../types'
import React from 'react'

const mockUser = { uid: 'user-456' }
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}))

let mockSettingsCb: ((settings: Partial<UserSettings> & { uid?: string }) => void) | null = null
vi.mock('../services/userProfile', () => ({
  subscribeUserSettings: vi.fn((_uid, cb) => {
    mockSettingsCb = cb
    cb({ uid: 'user-456', rolloverBalance: false, monthStartDay: 1 })
    return vi.fn()
  }),
  updateUserSettings: vi.fn(),
}))

vi.mock('../services/categories', () => ({
  subscribeCategories: vi.fn((_uid, cb) => {
    cb([])
    return vi.fn()
  }),
}))

vi.mock('../services/debts', () => ({
  subscribeDebts: vi.fn((_uid, cb) => {
    cb([])
    return vi.fn()
  }),
}))

vi.mock('../services/recurring', () => ({
  subscribeRecurring: vi.fn((_uid, cb) => {
    cb([])
    return vi.fn()
  }),
}))

vi.mock('../services/moneyCircles', () => ({
  subscribeMoneyCircles: vi.fn((_uid, cb) => {
    cb([])
    return vi.fn()
  }),
}))

let mockPriorBalanceCb: ((bal: number) => void) | null = null
const mockUnsubPrior = vi.fn()
vi.mock('../services/transactions', () => ({
  subscribePriorBalance: vi.fn((_uid, _beforeDate, cb) => {
    mockPriorBalanceCb = cb
    return mockUnsubPrior
  }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppDataProvider>{children}</AppDataProvider>
)

describe('AppDataContext rolloverBalanceFils consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsCb = null
    mockPriorBalanceCb = null
  })

  it('keeps rolloverBalanceFils at 0 when rolloverBalance is false', () => {
    const { result } = renderHook(() => useAppData(), { wrapper })

    expect(result.current?.rolloverBalanceFils).toBe(0)
    // Attempting to manually set a non-zero value should be ignored when disabled
    act(() => {
      result.current?.setRolloverBalanceFils(50000)
    })
    expect(result.current?.rolloverBalanceFils).toBe(0)
    expect(transactionsService.subscribePriorBalance).not.toHaveBeenCalled()
  })

  it('subscribes to prior transactions when rolloverBalance is enabled and sets balance', () => {
    const { result } = renderHook(() => useAppData(), { wrapper })

    // Simulate user toggling rolloverBalance on
    act(() => {
      mockSettingsCb?.({ uid: 'user-456', rolloverBalance: true, monthStartDay: 1 })
    })

    expect(transactionsService.subscribePriorBalance).toHaveBeenCalledTimes(1)

    // Simulate prior balance arriving
    act(() => {
      mockPriorBalanceCb?.(75000)
    })

    expect(result.current?.rolloverBalanceFils).toBe(75000)

    // Simulate user toggling rolloverBalance back off
    act(() => {
      mockSettingsCb?.({ uid: 'user-456', rolloverBalance: false, monthStartDay: 1 })
    })

    expect(mockUnsubPrior).toHaveBeenCalled()
    expect(result.current?.rolloverBalanceFils).toBe(0)
  })
})
