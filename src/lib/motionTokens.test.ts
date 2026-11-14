import { describe, it, expect } from 'vitest'
import {
  springSnappy,
  springSheet,
  springBounce,
  springGentle,
  pageVariants,
  bottomSheetVariants,
  backdropVariants,
} from './motionTokens'

describe('Swiss Motion Tokens (motionTokens.ts)', () => {
  it('defines valid physics spring tokens', () => {
    expect(springSnappy.stiffness).toBeGreaterThan(0)
    expect(springSnappy.damping).toBeGreaterThan(0)

    expect(springSheet.stiffness).toBeGreaterThan(0)
    expect(springSheet.mass).toBe(0.9)

    expect(springBounce.damping).toBeLessThan(springSnappy.damping)
    expect(springGentle.stiffness).toBeLessThan(springSnappy.stiffness)
  })

  it('defines RTL-aware page transition variants', () => {
    expect(pageVariants.initial.x).toBe(-8)
    expect(pageVariants.exit.x).toBe(8)
  })

  it('defines bottom sheet entry and exit coordinates', () => {
    expect(bottomSheetVariants.initial.y).toBe('100%')
    expect(bottomSheetVariants.animate.y).toBe(0)
    expect(bottomSheetVariants.exit.y).toBe('100%')
  })

  it('defines backdrop opacity variants', () => {
    expect(backdropVariants.initial.opacity).toBe(0)
    expect(backdropVariants.animate.opacity).toBe(1)
    expect(backdropVariants.exit.opacity).toBe(0)
  })
})
