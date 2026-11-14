import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { YearSelector } from './YearSelector'

describe('YearSelector Component', () => {
  it('renders selected year label correctly', () => {
    render(<YearSelector selectedYear={2026} onSelectYear={vi.fn()} />)

    expect(screen.getByText('سنة 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'اختيار السنة' })).toBeInTheDocument()
  })

  it('steps to next year when next button is clicked', () => {
    const handleSelectYear = vi.fn()
    render(<YearSelector selectedYear={2026} onSelectYear={handleSelectYear} />)

    const nextBtn = screen.getByRole('button', { name: 'السنة التالية' })
    fireEvent.click(nextBtn)

    expect(handleSelectYear).toHaveBeenCalledWith(2027)
  })

  it('steps to previous year when previous button is clicked', () => {
    const handleSelectYear = vi.fn()
    render(<YearSelector selectedYear={2026} onSelectYear={handleSelectYear} />)

    const prevBtn = screen.getByRole('button', { name: 'السنة السابقة' })
    fireEvent.click(prevBtn)

    expect(handleSelectYear).toHaveBeenCalledWith(2025)
  })

  it('opens popover when year button is clicked and allows selecting a year', () => {
    const handleSelectYear = vi.fn()
    render(<YearSelector selectedYear={2026} onSelectYear={handleSelectYear} />)

    const triggerBtn = screen.getByRole('button', { name: 'اختيار السنة' })
    fireEvent.click(triggerBtn)

    expect(screen.getByRole('dialog', { name: 'قائمة السنوات' })).toBeInTheDocument()

    const year2027Option = screen.getByRole('button', { name: /سنة 2027/i })
    fireEvent.click(year2027Option)

    expect(handleSelectYear).toHaveBeenCalledWith(2027)
    expect(screen.queryByRole('dialog', { name: 'قائمة السنوات' })).not.toBeInTheDocument()
  })

  it('closes popover on Escape key press', () => {
    render(<YearSelector selectedYear={2026} onSelectYear={vi.fn()} />)

    const triggerBtn = screen.getByRole('button', { name: 'اختيار السنة' })
    fireEvent.click(triggerBtn)

    expect(screen.getByRole('dialog', { name: 'قائمة السنوات' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'قائمة السنوات' })).not.toBeInTheDocument()
  })
})
