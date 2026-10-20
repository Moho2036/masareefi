import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecurringProcessor } from './useRecurringProcessor'
import * as recurringService from '../services/recurring'
import * as authHook from './useAuth'
import * as toastHook from './useToast'
import * as datesLib from '../lib/dates'

vi.mock('../services/recurring', () => ({
  processDueRecurring: vi.fn(),
}))

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('./useToast', () => ({
  useToast: vi.fn(),
}))

describe('useRecurringProcessor', () => {
  const mockShowToast = vi.fn()
  const mockProcessDueRecurring = vi.mocked(recurringService.processDueRecurring)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(toastHook.useToast).mockReturnValue({
      showToast: mockShowToast,
    } as unknown as ReturnType<typeof toastHook.useToast>)
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: { uid: 'user-abc' },
    } as unknown as ReturnType<typeof authHook.useAuth>)
    mockProcessDueRecurring.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs processDueRecurring once on mount for the current date', async () => {
    renderHook(() => useRecurringProcessor())

    expect(mockProcessDueRecurring).toHaveBeenCalledTimes(1)
    expect(mockProcessDueRecurring).toHaveBeenCalledWith('user-abc')
  })

  it('shows toast when due transactions are processed', async () => {
    mockProcessDueRecurring.mockResolvedValueOnce(2)

    renderHook(() => useRecurringProcessor())

    await vi.waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('تم تسجيل معاملتان متكررتان تلقائياً', 'info')
    })
  })

  it('does not re-process on focus or visibility change if same day', async () => {
    renderHook(() => useRecurringProcessor())

    expect(mockProcessDueRecurring).toHaveBeenCalledTimes(1)

    // Trigger focus and visibilitychange on the same day
    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockProcessDueRecurring).toHaveBeenCalledTimes(1)
  })

  it('re-processes when the date changes to a new day upon focus or visibilitychange', async () => {
    let mockDateStr = '2026-10-20'
    vi.spyOn(datesLib, 'formatDateInput').mockImplementation(() => mockDateStr)

    renderHook(() => useRecurringProcessor())

    await vi.waitFor(() => {
      expect(mockProcessDueRecurring).toHaveBeenCalledTimes(1)
    })

    // Advance to next day
    mockDateStr = '2026-10-21'

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await vi.waitFor(() => {
      expect(mockProcessDueRecurring).toHaveBeenCalledTimes(2)
    })

    // Advance another day and trigger visibilitychange
    mockDateStr = '2026-10-22'

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.waitFor(() => {
      expect(mockProcessDueRecurring).toHaveBeenCalledTimes(3)
    })
  })

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const docRemoveEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useRecurringProcessor())
    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function))
    expect(docRemoveEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
