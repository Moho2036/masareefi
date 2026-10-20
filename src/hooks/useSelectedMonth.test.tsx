import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { SelectedMonthProvider, useSelectedMonth } from './useSelectedMonth'

let mockMonthStartDay = 1

vi.mock('./useUserSettings', () => ({
  useUserSettings: () => ({
    data: { monthStartDay: mockMonthStartDay },
    loading: false,
  }),
}))

describe('useSelectedMonth hook', () => {
  it('formats monthLabel based on range.start when monthStartDay = 25', () => {
    mockMonthStartDay = 25

    const { result } = renderHook(() => useSelectedMonth(), {
      wrapper: SelectedMonthProvider,
    })

    // Set selectedDate to Oct 10, 2026
    act(() => {
      result.current.setSelectedDate(new Date(2026, 9, 10))
    })

    // Cycle starts Sep 25, 2026 and ends Oct 25, 2026
    expect(result.current.range.start.getDate()).toBe(25)
    expect(result.current.range.start.getMonth()).toBe(8) // September
    // Month label should consistently be September 2026 (based on range.start)
    expect(result.current.monthLabel).toBe('سبتمبر 2026')
    expect(result.current.rangeLabel).toBe('25 سبتمبر - 24 أكتوبر')
  })

  it('navigates to next and previous months cleanly without date drift', () => {
    mockMonthStartDay = 25

    const { result } = renderHook(() => useSelectedMonth(), {
      wrapper: SelectedMonthProvider,
    })

    act(() => {
      result.current.setSelectedDate(new Date(2026, 9, 10))
    })

    // Go to next month
    act(() => {
      result.current.goToNextMonth()
    })

    expect(result.current.monthLabel).toBe('أكتوبر 2026')
    expect(result.current.range.start.getDate()).toBe(25)
    expect(result.current.range.start.getMonth()).toBe(9) // October
    expect(result.current.rangeLabel).toBe('25 أكتوبر - 24 نوفمبر')

    // Go to previous month
    act(() => {
      result.current.goToPreviousMonth()
    })

    expect(result.current.monthLabel).toBe('سبتمبر 2026')
    expect(result.current.range.start.getDate()).toBe(25)
    expect(result.current.range.start.getMonth()).toBe(8) // September
  })

  it('handles default monthStartDay = 1 matching calendar month', () => {
    mockMonthStartDay = 1

    const { result } = renderHook(() => useSelectedMonth(), {
      wrapper: SelectedMonthProvider,
    })

    act(() => {
      result.current.setSelectedDate(new Date(2026, 9, 10))
    })

    expect(result.current.monthLabel).toBe('أكتوبر 2026')
    expect(result.current.range.start.getDate()).toBe(1)
  })
})
