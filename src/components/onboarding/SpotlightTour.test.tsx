import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpotlightTour } from './SpotlightTour'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user-tour-1' },
  }),
}))

describe('SpotlightTour Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('does not render when isOpen is false', () => {
    render(<SpotlightTour isOpen={false} onFinish={vi.fn()} />)
    expect(screen.queryByText('جولة بَصير السريعة')).toBeNull()
  })

  it('renders step 1 and navigates to step 2 and step 3', () => {
    render(<SpotlightTour isOpen={true} onFinish={vi.fn()} />)

    // Step 1
    expect(screen.getByText('جولة بَصير السريعة')).toBeDefined()
    expect(screen.getByText('تسجيل المعاملات بلمسة سريعة')).toBeDefined()

    // Next -> Step 2
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('كارت الحد اليومي الآمن والصحة المالية')).toBeDefined()

    // Next -> Step 3
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('الأدوات الإضافية والديون والجمعيات')).toBeDefined()
    expect(screen.getByRole('button', { name: /فهمت، ابدأ الآن/i })).toBeDefined()

    // Previous -> Step 2
    fireEvent.click(screen.getByRole('button', { name: 'السابق' }))
    expect(screen.getByText('كارت الحد اليومي الآمن والصحة المالية')).toBeDefined()
  })

  it('completes tour, saves flag in localStorage, and calls onFinish', () => {
    const onFinish = vi.fn()
    render(<SpotlightTour isOpen={true} onFinish={onFinish} />)

    // Advance to step 3
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))

    // Finish
    fireEvent.click(screen.getByRole('button', { name: /فهمت، ابدأ الآن/i }))

    expect(onFinish).toHaveBeenCalled()
    expect(window.localStorage.getItem('baseer_tour_shown_user-tour-1')).toBe('true')
  })

  it('closes tour when close button (X) is clicked', () => {
    const onFinish = vi.fn()
    render(<SpotlightTour isOpen={true} onFinish={onFinish} />)

    const closeBtn = screen.getByRole('button', { name: 'إغلاق الجولة' })
    fireEvent.click(closeBtn)

    expect(onFinish).toHaveBeenCalled()
    expect(window.localStorage.getItem('baseer_tour_shown_user-tour-1')).toBe('true')
  })
})
