import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DatePickerInput } from './DatePickerInput'

describe('DatePickerInput', () => {
  it('renders with label and formatted date display', () => {
    const handleChange = vi.fn()
    render(
      <DatePickerInput
        id="date-input"
        label="تاريخ الاستحقاق"
        value="2026-05-15"
        onChange={handleChange}
      />
    )

    expect(screen.getByText('تاريخ الاستحقاق')).toBeDefined()
    expect(screen.getByText(/15 مايو 2026/)).toBeDefined()
  })

  it('opens calendar popover when clicking the display box', () => {
    const handleChange = vi.fn()
    render(
      <DatePickerInput
        id="date-input"
        value="2026-05-15"
        onChange={handleChange}
      />
    )

    // Calendar popover should not be visible initially
    expect(screen.queryByRole('dialog', { name: 'تقويم اختيار التاريخ' })).toBeNull()

    // Click display box
    fireEvent.click(screen.getByRole('button', { name: /15 مايو 2026/ }))

    // Calendar popover should be open
    const dialog = screen.getByRole('dialog', { name: 'تقويم اختيار التاريخ' })
    expect(dialog).toBeDefined()
  })

  it('selects a date from the calendar and calls onChange', () => {
    const handleChange = vi.fn()
    render(
      <DatePickerInput
        id="date-input"
        value="2026-05-15"
        onChange={handleChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /15 مايو 2026/ }))
    const dialog = screen.getByRole('dialog', { name: 'تقويم اختيار التاريخ' })

    // Click day 20 inside dialog
    const day20 = within(dialog).getByRole('button', { name: /20 مايو 2026/ })
    fireEvent.click(day20)

    expect(handleChange).toHaveBeenCalledWith('2026-05-20')
  })

  it('supports quick buttons (اليوم / أمس) when enabled', () => {
    const handleChange = vi.fn()
    render(
      <DatePickerInput
        id="date-input"
        value="2026-05-15"
        onChange={handleChange}
        showQuickButtons={true}
      />
    )

    const todayBtn = screen.getByRole('button', { name: 'اليوم' })
    fireEvent.click(todayBtn)

    expect(handleChange).toHaveBeenCalled()
  })

  it('closes calendar on Escape key press', () => {
    const handleChange = vi.fn()
    render(
      <DatePickerInput
        id="date-input"
        value="2026-05-15"
        onChange={handleChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /15 مايو 2026/ }))
    expect(screen.getByRole('dialog', { name: 'تقويم اختيار التاريخ' })).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'تقويم اختيار التاريخ' })).toBeNull()
  })

  it('respects min and max date constraints', () => {
    const handleChange = vi.fn()
    render(
      <DatePickerInput
        id="date-input"
        value="2026-05-15"
        min="2026-05-10"
        max="2026-05-20"
        onChange={handleChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /15 مايو 2026/ }))
    const dialog = screen.getByRole('dialog', { name: 'تقويم اختيار التاريخ' })

    // Day 5 should be disabled (before min 2026-05-10)
    const day5 = within(dialog).getByRole('button', { name: /الثلاثاء، 5 مايو 2026/ })
    expect(day5.hasAttribute('disabled')).toBe(true)

    // Day 15 should be enabled
    const day15 = within(dialog).getByRole('button', { name: /الجمعة، 15 مايو 2026/ })
    expect(day15.hasAttribute('disabled')).toBe(false)
  })
})

