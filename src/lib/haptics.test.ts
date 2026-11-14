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

  it('triggers tick / light haptic with 35ms pulse', () => {
    triggerHaptic('tick')
    expect(mockVibrate).toHaveBeenCalledWith(35)

    triggerHaptic('light')
    expect(mockVibrate).toHaveBeenCalledWith(35)
  })

  it('triggers impact / medium haptic with 55ms pulse', () => {
    triggerHaptic('impact')
    expect(mockVibrate).toHaveBeenCalledWith(55)

    triggerHaptic('medium')
    expect(mockVibrate).toHaveBeenCalledWith(55)
  })

  it('triggers success delight double pulse', () => {
    triggerHaptic('success')
    expect(mockVibrate).toHaveBeenCalledWith([45, 60, 45])
  })

  it('triggers warning snap pulse with [60, 45, 60]', () => {
    triggerHaptic('warning')
    expect(mockVibrate).toHaveBeenCalledWith([60, 45, 60])
  })

  it('triggers destructive triple pulse', () => {
    triggerHaptic('destructive')
    expect(mockVibrate).toHaveBeenCalledWith([75, 45, 90])
  })

  it('gracefully handles missing vibrate support using audio impulse without throwing', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    expect(() => triggerHaptic('tick')).not.toThrow()
    expect(() => triggerHaptic('impact')).not.toThrow()
    expect(() => triggerHaptic('success')).not.toThrow()
    expect(() => triggerHaptic('warning')).not.toThrow()
    expect(() => triggerHaptic('destructive')).not.toThrow()
  })
})
