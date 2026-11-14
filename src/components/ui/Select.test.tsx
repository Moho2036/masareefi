import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from './Select'
import * as haptics from '../../lib/haptics'

describe('Select Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const options = [
    { value: 'opt1', label: 'الخيار الأول' },
    { value: 'opt2', label: 'الخيار الثاني' },
  ]

  it('renders trigger button with label and selected option', () => {
    render(
      <Select
        label="التصنيف"
        options={options}
        value="opt1"
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('التصنيف')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /الخيار الأول/i })).toBeInTheDocument()
  })

  it('toggles dropdown and selects option triggering haptic and onChange', () => {
    const triggerHapticSpy = vi.spyOn(haptics, 'triggerHaptic')
    const onChange = vi.fn()

    render(
      <Select
        options={options}
        value="opt1"
        onChange={onChange}
      />
    )

    const triggerBtn = screen.getByRole('button', { name: /الخيار الأول/i })
    fireEvent.click(triggerBtn)

    expect(triggerHapticSpy).toHaveBeenCalledWith('tick')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    const option2Btn = screen.getByRole('button', { name: /الخيار الثاني/i })
    fireEvent.click(option2Btn)

    expect(triggerHapticSpy).toHaveBeenCalledWith('impact')
    expect(onChange).toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
