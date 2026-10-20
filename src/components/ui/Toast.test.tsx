import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastContainer } from './Toast'
import * as toastHook from '../../hooks/useToast'

describe('ToastContainer Component', () => {
  it('renders nothing when there are no toasts', () => {
    vi.spyOn(toastHook, 'useToast').mockReturnValue({
      toasts: [],
      showToast: vi.fn(),
      dismissToast: vi.fn(),
    })

    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders toasts with correct message and handles dismiss action', () => {
    const mockDismiss = vi.fn()
    vi.spyOn(toastHook, 'useToast').mockReturnValue({
      toasts: [
        { id: '1', message: 'تم حفظ المعاملة بنجاح', type: 'success' },
        { id: '2', message: 'حدث خطأ في الاتصال', type: 'error' },
      ],
      showToast: vi.fn(),
      dismissToast: mockDismiss,
    })

    render(<ToastContainer />)

    expect(screen.getByText('تم حفظ المعاملة بنجاح')).toBeInTheDocument()
    expect(screen.getByText('حدث خطأ في الاتصال')).toBeInTheDocument()

    const closeButtons = screen.getAllByRole('button', { name: 'إغلاق الإشعار' })
    expect(closeButtons).toHaveLength(2)

    fireEvent.click(closeButtons[0])
    expect(mockDismiss).toHaveBeenCalledWith('1')
  })

  it('includes safe-area bottom elevation classes for mobile layout', () => {
    vi.spyOn(toastHook, 'useToast').mockReturnValue({
      toasts: [{ id: '1', message: 'إشعار تجريبي', type: 'info' }],
      showToast: vi.fn(),
      dismissToast: vi.fn(),
    })

    render(<ToastContainer />)

    const region = screen.getByRole('region', { name: 'الإشعارات' })
    expect(region.className).toContain('bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))]')
    expect(region.className).toContain('lg:bottom-6')
  })
})
