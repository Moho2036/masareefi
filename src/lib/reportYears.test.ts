import { describe, it, expect } from 'vitest'
import { generateReportYearOptions } from './reportYears'

describe('generateReportYearOptions', () => {
  it('generates options including current and selected year', () => {
    const opts = generateReportYearOptions(2026, 2026)
    expect(opts.length).toBeGreaterThan(0)
    expect(opts.some((o) => o.value === '2026')).toBe(true)
  })

  it('respects account creation year', () => {
    const opts = generateReportYearOptions(2026, 2026, new Date('2024-01-01'))
    expect(opts.some((o) => o.value === '2024')).toBe(true)
  })
})
