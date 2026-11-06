import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthSelector } from './MonthSelector'

const mockSetSelectedDate = vi.fn()
const mockGoToPreviousMonth = vi.fn()
const mockGoToNextMonth = vi.fn()
const mockGoToCurrentMonth = vi.fn()

let mockSelectedDate = new Date(2026, 9, 15) // October 15, 2026
let mockMonthStartDay = 1
let mockIsCurrentMonth = false
let mockMonthLabel = 'أكتوبر 2026'
let mockRangeLabel = ''

vi.mock('../../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    selectedDate: mockSelectedDate,
    setSelectedDate: mockSetSelectedDate,
    monthLabel: mockMonthLabel,
    goToPreviousMonth: mockGoToPreviousMonth,
    goToNextMonth: mockGoToNextMonth,
    goToCurrentMonth: mockGoToCurrentMonth,
    monthStartDay: mockMonthStartDay,
    rangeLabel: mockRangeLabel,
    isCurrentMonth: mockIsCurrentMonth,
  }),
}))

describe('MonthSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedDate = new Date(2026, 9, 15)
    mockMonthStartDay = 1
    mockIsCurrentMonth = false
    mockMonthLabel = 'أكتوبر 2026'
    mockRangeLabel = ''
  })

  it('renders month label and navigation buttons', () => {
    render(<MonthSelector />)

    expect(screen.getByText('أكتوبر 2026')).toBeInTheDocument()
    expect(screen.getByLabelText('الشهر السابق')).toBeInTheDocument()
    expect(screen.getByLabelText('الشهر التالي')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls goToPreviousMonth and goToNextMonth on chevron clicks', () => {
    render(<MonthSelector />)

    fireEvent.click(screen.getByLabelText('الشهر السابق'))
    expect(mockGoToPreviousMonth).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('الشهر التالي'))
    expect(mockGoToNextMonth).toHaveBeenCalledTimes(1)
  })

  it('opens popover picker on month title click and displays 12 months with active month', () => {
    render(<MonthSelector />)

    const titleButton = screen.getByLabelText('فتح قائمة اختيار الشهر والسنة')
    fireEvent.click(titleButton)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()

    // October should have the active highlight
    const octoberBtn = screen.getByRole('button', { name: 'أكتوبر' })
    expect(octoberBtn).toHaveClass('bg-blue-600')
    expect(octoberBtn).toHaveClass('text-white')

    // March should also be rendered in the grid
    expect(screen.getByRole('button', { name: 'مارس' })).toBeInTheDocument()
  })

  it('navigates years inside the popover picker', () => {
    render(<MonthSelector />)

    fireEvent.click(screen.getByLabelText('فتح قائمة اختيار الشهر والسنة'))
    expect(screen.getByText('2026')).toBeInTheDocument()

    // Click previous year (ChevronRight in RTL)
    fireEvent.click(screen.getByLabelText('السنة السابقة'))
    expect(screen.getByText('2025')).toBeInTheDocument()

    // Click next year twice
    fireEvent.click(screen.getByLabelText('السنة التالية'))
    fireEvent.click(screen.getByLabelText('السنة التالية'))
    expect(screen.getByText('2027')).toBeInTheDocument()
  })

  it('selects a new month and year, calling setSelectedDate and closing the popover', () => {
    render(<MonthSelector />)

    fireEvent.click(screen.getByLabelText('فتح قائمة اختيار الشهر والسنة'))

    // Go to year 2025
    fireEvent.click(screen.getByLabelText('السنة السابقة'))

    // Click 'مارس' (index 2)
    fireEvent.click(screen.getByRole('button', { name: 'مارس' }))

    expect(mockSetSelectedDate).toHaveBeenCalledWith(
      new Date(2025, 2, 1, 12, 0, 0, 0)
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('displays return to current month button when isCurrentMonth is false and triggers goToCurrentMonth', () => {
    mockIsCurrentMonth = false
    render(<MonthSelector />)

    fireEvent.click(screen.getByLabelText('فتح قائمة اختيار الشهر والسنة'))

    const returnBtn = screen.getByRole('button', { name: 'العودة إلى الشهر الحالي' })
    expect(returnBtn).toBeInTheDocument()

    fireEvent.click(returnBtn)
    expect(mockGoToCurrentMonth).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes popover on Escape key and on clicking outside', () => {
    render(
      <div>
        <div data-testid="outside-element">خارج المكون</div>
        <MonthSelector />
      </div>
    )

    // Open
    fireEvent.click(screen.getByLabelText('فتح قائمة اختيار الشهر والسنة'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Escape key
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Open again
    fireEvent.click(screen.getByLabelText('فتح قائمة اختيار الشهر والسنة'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside-element'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
