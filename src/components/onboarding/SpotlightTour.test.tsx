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
    expect(screen.queryByRole('dialog', { name: 'جولة بَصير السريعة' })).toBeNull()
    expect(screen.queryByText('الرصيد المتاح وحد الصرف اليومي')).toBeNull()
  })

  it('renders step 1 and navigates through all 6 steps with proper titles and previous button', () => {
    render(<SpotlightTour isOpen={true} onFinish={vi.fn()} />)

    // Step 1
    expect(screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })).toBeInTheDocument()
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    expect(screen.getByText('الرصيد المتاح وحد الصرف اليومي')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'السابق' })).toBeNull()

    // Step 2
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('2 / 6')).toBeInTheDocument()
    expect(screen.getByText('إضافة معاملة سريعة (+)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'السابق' })).toBeInTheDocument()

    // Step 3
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('3 / 6')).toBeInTheDocument()
    expect(screen.getByText('سجل المعاملات')).toBeInTheDocument()

    // Step 4
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('4 / 6')).toBeInTheDocument()
    expect(screen.getByText('دفتر الديون والالتزامات')).toBeInTheDocument()

    // Step 5
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('5 / 6')).toBeInTheDocument()
    expect(screen.getByText('التقارير والأدوات المالية')).toBeInTheDocument()

    // Step 6
    fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    expect(screen.getByText('6 / 6')).toBeInTheDocument()
    expect(screen.getByText('مركز التنبيهات')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'فهمت، ابدأ الآن' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'التالي' })).toBeNull()

    // Previous button back to Step 5
    fireEvent.click(screen.getByRole('button', { name: 'السابق' }))
    expect(screen.getByText('5 / 6')).toBeInTheDocument()
    expect(screen.getByText('التقارير والأدوات المالية')).toBeInTheDocument()
  })

  it('completes tour on step 6, saves flag in localStorage, and calls onFinish', () => {
    const onFinish = vi.fn()
    render(<SpotlightTour isOpen={true} onFinish={onFinish} />)

    // Advance to step 6 (click next 5 times)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'التالي' }))
    }

    // Step 6 finish button
    const finishBtn = screen.getByRole('button', { name: 'فهمت، ابدأ الآن' })
    expect(finishBtn).toBeInTheDocument()
    fireEvent.click(finishBtn)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('baseer_tour_shown_user-tour-1')).toBe('true')
  })

  it('closes tour and saves flag in localStorage when skip button is clicked', () => {
    const onFinish = vi.fn()
    render(<SpotlightTour isOpen={true} onFinish={onFinish} />)

    const skipBtn = screen.getByRole('button', { name: 'إغلاق الجولة' })
    expect(skipBtn).toBeInTheDocument()
    expect(skipBtn).toHaveTextContent('تخطي')
    fireEvent.click(skipBtn)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('baseer_tour_shown_user-tour-1')).toBe('true')
  })

  it('correctly calculates targetRect and renders spotlight hole when target element is in DOM', () => {
    const targetEl = document.createElement('div')
    targetEl.setAttribute('data-tour', 'hero-balance')
    targetEl.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      left: 50,
      width: 300,
      height: 150,
      bottom: 250,
      right: 350,
    })
    document.body.appendChild(targetEl)

    render(<SpotlightTour isOpen={true} onFinish={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'جولة بَصير السريعة' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveStyle({ width: '340px' })

    document.body.removeChild(targetEl)
  })
})
