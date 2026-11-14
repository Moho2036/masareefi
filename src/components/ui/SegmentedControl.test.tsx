import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from './SegmentedControl'
import * as haptics from '../../lib/haptics'

describe('SegmentedControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const options = [
    { value: 'monthly', label: 'شهري' },
    { value: 'yearly', label: 'سنوي' },
  ]

  it('renders all options and indicates selected one', () => {
    render(<SegmentedControl options={options} value="monthly" onChange={vi.fn()} />)

    const monthlyRadio = screen.getByRole('radio', { name: 'شهري' })
    const yearlyRadio = screen.getByRole('radio', { name: 'سنوي' })

    expect(monthlyRadio).toBeInTheDocument()
    expect(yearlyRadio).toBeInTheDocument()
    expect(monthlyRadio).toHaveAttribute('aria-checked', 'true')
    expect(yearlyRadio).toHaveAttribute('aria-checked', 'false')
  })

  it('triggers haptic and calls onChange when selecting an unselected option', () => {
    const triggerHapticSpy = vi.spyOn(haptics, 'triggerHaptic')
    const onChange = vi.fn()

    render(<SegmentedControl options={options} value="monthly" onChange={onChange} />)

    const yearlyRadio = screen.getByRole('radio', { name: 'سنوي' })
    fireEvent.click(yearlyRadio)

    expect(triggerHapticSpy).toHaveBeenCalledWith('tick')
    expect(onChange).toHaveBeenCalledWith('yearly')
  })

  it('does not trigger haptic if clicking the already selected option', () => {
    const triggerHapticSpy = vi.spyOn(haptics, 'triggerHaptic')
    const onChange = vi.fn()

    render(<SegmentedControl options={options} value="monthly" onChange={onChange} />)

    const monthlyRadio = screen.getByRole('radio', { name: 'شهري' })
    fireEvent.click(monthlyRadio)

    expect(triggerHapticSpy).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('monthly')
  })

  it('does not trigger onChange or haptic when disabled', () => {
    const triggerHapticSpy = vi.spyOn(haptics, 'triggerHaptic')
    const onChange = vi.fn()

    render(<SegmentedControl options={options} value="monthly" onChange={onChange} disabled />)

    const yearlyRadio = screen.getByRole('radio', { name: 'سنوي' })
    fireEvent.click(yearlyRadio)

    expect(triggerHapticSpy).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})
