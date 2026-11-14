import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerHaptic } from './haptics'

describe('Baseer Haptic Bank (haptics.ts)', () => {
  const originalVibrate = navigator.vibrate
  let mockVibrate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockVibrate = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      value: originalVibrate,
      writable: true,
      configurable: true,
    })
  })

  it('triggers tick / light haptic with 10ms pulse', () => {
    triggerHaptic('tick')
    expect(mockVibrate).toHaveBeenCalledWith(10)

    triggerHaptic('light')
    expect(mockVibrate).toHaveBeenCalledWith(10)
  })

  it('triggers impact / medium haptic with 20ms pulse', () => {
    triggerHaptic('impact')
    expect(mockVibrate).toHaveBeenCalledWith(20)

    triggerHaptic('medium')
    expect(mockVibrate).toHaveBeenCalledWith(20)
  })

  it('triggers success delight double pulse', () => {
    triggerHaptic('success')
    expect(mockVibrate).toHaveBeenCalledWith([15, 40, 25])
  })

  it('triggers warning snap pulse with 35ms', () => {
    triggerHaptic('warning')
    expect(mockVibrate).toHaveBeenCalledWith(35)
  })

  it('triggers destructive triple pulse', () => {
    triggerHaptic('destructive')
    expect(mockVibrate).toHaveBeenCalledWith([25, 35, 25])
  })

  it('gracefully handles missing vibrate support without throwing', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    expect(() => triggerHaptic('tick')).not.toThrow()
  })
})
