import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkHoursCalculator } from './WorkHoursCalculator'

describe('WorkHoursCalculator component', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders default values and calculates work hours', () => {
    render(<WorkHoursCalculator />)

    // Defaults: salary 500, daily 8, days 22 -> 176 hours total
    // Item: phone 250 -> half of salary -> 88 hours
    expect(screen.getByText('88')).toBeDefined()
    expect(screen.getAllByText(/ساعة/).length).toBeGreaterThan(0)
  })

  it('supports Eastern Arabic numerals when entering salary and price', () => {
    render(<WorkHoursCalculator />)

    const salaryInput = screen.getByLabelText(/صافي راتبك الشهري/)
    fireEvent.change(salaryInput, { target: { value: '١٠٠٠' } }) // 1000

    const priceInput = screen.getByLabelText(/سعر السلعة/)
    fireEvent.change(priceInput, { target: { value: '٥٠٠' } }) // 500

    // Item 500 out of 1000 salary with 8h/day and 22 days (176h) -> 88 hours
    expect(screen.getByText('88')).toBeDefined()
  })

  it('rounds minutes correctly without showing 60 minutes', () => {
    render(<WorkHoursCalculator />)

    const salaryInput = screen.getByLabelText(/صافي راتبك الشهري/)
    fireEvent.change(salaryInput, { target: { value: '600' } })

    const hoursInput = screen.getByLabelText('ساعات الدوام / يوم')
    fireEvent.change(hoursInput, { target: { value: '8' } })

    const daysInput = screen.getByLabelText('أيام العمل / شهر')
    fireEvent.change(daysInput, { target: { value: '25' } }) // total = 200h, hourly wage = 3 JOD

    const priceInput = screen.getByLabelText(/سعر السلعة/)
    // 5.999 * 3 = 17.997 JOD -> requiredHours is 5.999 hours -> 359.94 minutes -> 360 min = 6 hours 0 minutes
    fireEvent.change(priceInput, { target: { value: '17.997' } })

    expect(screen.queryByText(/60 دقيقة/)).toBeNull()
  })
})
