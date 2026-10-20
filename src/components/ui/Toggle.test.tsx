import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toggle } from './Toggle'

describe('Toggle Component', () => {
  it('renders switch with proper accessibility attributes', () => {
    const handleChange = vi.fn()
    render(
      <Toggle
        checked={false}
        onChange={handleChange}
        label="ترحيل الرصيد"
        description="وصف ترحيل الرصيد"
        id="test-toggle"
      />
    )

    const switchBtn = screen.getByRole('switch')
    expect(switchBtn).toBeInTheDocument()
    expect(switchBtn).toHaveAttribute('aria-checked', 'false')
    expect(switchBtn).toHaveAttribute('aria-labelledby', 'test-toggle-label')
    expect(switchBtn).toHaveAttribute('aria-describedby', 'test-toggle-desc')
  })

  it('calls onChange exactly once when clicking the label', () => {
    const handleChange = vi.fn()
    render(
      <Toggle
        checked={false}
        onChange={handleChange}
        label="ترحيل الرصيد"
        id="test-toggle"
      />
    )

    const labelElement = screen.getByText('ترحيل الرصيد')
    fireEvent.click(labelElement)

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('calls onChange exactly once when clicking the description', () => {
    const handleChange = vi.fn()
    render(
      <Toggle
        checked={true}
        onChange={handleChange}
        label="تفعيل"
        description="هذا وصف التفعيل"
      />
    )

    const descElement = screen.getByText('هذا وصف التفعيل')
    fireEvent.click(descElement)

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(false)
  })

  it('calls onChange exactly once when clicking the switch button', () => {
    const handleChange = vi.fn()
    render(
      <Toggle
        checked={false}
        onChange={handleChange}
        label="تفعيل"
      />
    )

    const switchBtn = screen.getByRole('switch')
    fireEvent.click(switchBtn)

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('does not call onChange when disabled', () => {
    const handleChange = vi.fn()
    render(
      <Toggle
        checked={false}
        onChange={handleChange}
        label="خيار معطل"
        disabled={true}
      />
    )

    const labelElement = screen.getByText('خيار معطل')
    fireEvent.click(labelElement)
    expect(handleChange).not.toHaveBeenCalled()

    const switchBtn = screen.getByRole('switch')
    fireEvent.click(switchBtn)
    expect(handleChange).not.toHaveBeenCalled()
  })
})
