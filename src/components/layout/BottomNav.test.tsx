import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BottomNav } from './BottomNav'

let mockIsCurrentMonth = true
const mockGoToCurrentMonth = vi.fn()

vi.mock('../../hooks/useSelectedMonth', () => ({
  useSelectedMonth: () => ({
    isCurrentMonth: mockIsCurrentMonth,
    goToCurrentMonth: mockGoToCurrentMonth,
  }),
}))

describe('BottomNav smartTools active highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCurrentMonth = true
  })
  it('highlights only circles tool when url is /tools?tool=circles', () => {
    render(
      <MemoryRouter initialEntries={['/tools?tool=circles']}>
        <BottomNav onOpenAddModal={vi.fn()} />
      </MemoryRouter>
    )

    // Open More drawer
    const moreBtn = screen.getByRole('button', { name: /المزيد/i })
    fireEvent.click(moreBtn)

    const circlesLink = screen.getByRole('link', { name: /الجمعيات والصناديق المشتركة/i })
    const workHoursLink = screen.getByRole('link', { name: /تكلفة الشراء بساعات العمل/i })

    expect(circlesLink.className).toContain('bg-emerald-50')
    expect(workHoursLink.className).not.toContain('bg-emerald-50')
  })

  it('highlights only work_hours tool when url is /tools?tool=work_hours', () => {
    render(
      <MemoryRouter initialEntries={['/tools?tool=work_hours']}>
        <BottomNav onOpenAddModal={vi.fn()} />
      </MemoryRouter>
    )

    // Open More drawer
    const moreBtn = screen.getByRole('button', { name: /المزيد/i })
    fireEvent.click(moreBtn)

    const circlesLink = screen.getByRole('link', { name: /الجمعيات والصناديق المشتركة/i })
    const workHoursLink = screen.getByRole('link', { name: /تكلفة الشراء بساعات العمل/i })

    expect(workHoursLink.className).toContain('bg-emerald-50')
    expect(circlesLink.className).not.toContain('bg-emerald-50')
  })

  it('closes More drawer when hardware back button triggers popstate', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav onOpenAddModal={vi.fn()} />
      </MemoryRouter>
    )

    const moreBtn = screen.getByRole('button', { name: /المزيد/i })
    fireEvent.click(moreBtn)

    expect(screen.getByText('جميع الأدوات والميزات')).toBeInTheDocument()

    // Trigger popstate event
    fireEvent(window, new PopStateEvent('popstate'))

    expect(screen.queryByText('جميع الأدوات والميزات')).not.toBeInTheDocument()
  })

  it('dismisses More drawer on touch swipe-down exceeding 70px', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav onOpenAddModal={vi.fn()} />
      </MemoryRouter>
    )

    const moreBtn = screen.getByRole('button', { name: /المزيد/i })
    fireEvent.click(moreBtn)

    expect(screen.getByText('جميع الأدوات والميزات')).toBeInTheDocument()

    const dragHandle = screen.getByText('جميع الأدوات والميزات').closest('.fixed')!
    const touchArea = dragHandle.querySelector('.touch-none')!

    fireEvent.touchStart(touchArea, {
      touches: [{ clientY: 100 }],
    })
    fireEvent.touchMove(touchArea, {
      touches: [{ clientY: 180 }],
    })
    fireEvent.touchEnd(touchArea)

    expect(screen.queryByText('جميع الأدوات والميزات')).not.toBeInTheDocument()
  })

  it('calls goToCurrentMonth when clicking on الرئيسية and not on current month', () => {
    mockIsCurrentMonth = false
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <BottomNav onOpenAddModal={vi.fn()} />
      </MemoryRouter>
    )

    const homeLink = screen.getByRole('link', { name: /الرئيسية/i })
    fireEvent.click(homeLink)

    expect(mockGoToCurrentMonth).toHaveBeenCalledTimes(1)
  })
})
