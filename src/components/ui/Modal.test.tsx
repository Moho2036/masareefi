import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal Component', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="عنوان تجريبي">
        <div>محتوى النافذة</div>
      </Modal>
    )

    expect(screen.queryByText('عنوان تجريبي')).not.toBeInTheDocument()
    expect(screen.queryByText('محتوى النافذة')).not.toBeInTheDocument()
  })

  it('renders content and locks body scroll when isOpen is true', () => {
    const handleClose = vi.fn()
    const { unmount } = render(
      <Modal isOpen={true} onClose={handleClose} title="نافذة تسجيل">
        <div>محتوى النموذج</div>
      </Modal>
    )

    expect(screen.getByText('نافذة تسجيل')).toBeInTheDocument()
    expect(screen.getByText('محتوى النموذج')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('fixed')

    // On unmount, scroll styles should be restored
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.position).toBe('')
  })

  it('calls onClose when close button (X) is clicked', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={handleClose} title="نافذة اختبار">
        <div>محتوى</div>
      </Modal>
    )

    const closeBtn = screen.getByRole('button', { name: 'إغلاق' })
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape key press', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={handleClose} title="نافذة اختبار">
        <div>محتوى</div>
      </Modal>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on backdrop click when closeOnBackdropClick is true (default)', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={handleClose} title="نافذة اختبار">
        <div>محتوى</div>
      </Modal>
    )

    const backdrop = screen.getByTestId('modal-backdrop')
    fireEvent.mouseDown(backdrop)
    fireEvent.click(backdrop)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose on backdrop click when closeOnBackdropClick is false', () => {
    const handleClose = vi.fn()
    render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="نافذة حماية البيانات"
        closeOnBackdropClick={false}
      >
        <div>محتوى نموذج محمي</div>
      </Modal>
    )

    const backdrop = screen.getByTestId('modal-backdrop')
    fireEvent.mouseDown(backdrop)
    fireEvent.click(backdrop)

    expect(handleClose).not.toHaveBeenCalled()
  })

  it('closes modal when mobile hardware back button triggers popstate', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={handleClose} title="نافذة الرجوع">
        <div>محتوى</div>
      </Modal>
    )

    // Simulate device hardware back button / popstate
    fireEvent(window, new PopStateEvent('popstate'))

    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
