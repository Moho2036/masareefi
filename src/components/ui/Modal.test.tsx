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

  it('does not trigger history.back or close when re-rendered with a new onClose reference while open', () => {
    const historyBackSpy = vi.spyOn(window.history, 'back')
    const handleClose1 = vi.fn()
    const { rerender } = render(
      <Modal isOpen={true} onClose={handleClose1} title="نافذة اختبار">
        <input data-testid="test-input" defaultValue="أ" />
      </Modal>
    )

    // Re-render with a fresh inline arrow function reference as parent state changes on typing
    const handleClose2 = vi.fn()
    rerender(
      <Modal isOpen={true} onClose={handleClose2} title="نافذة اختبار">
        <input data-testid="test-input" defaultValue="أحمد" />
      </Modal>
    )

    expect(historyBackSpy).not.toHaveBeenCalled()
    expect(handleClose1).not.toHaveBeenCalled()
    expect(handleClose2).not.toHaveBeenCalled()
  })

  it('in nested modals, only the topmost modal responds to Escape', () => {
    const handleCloseParent = vi.fn()
    const handleCloseChild = vi.fn()

    render(
      <>
        <Modal isOpen={true} onClose={handleCloseParent} title="النافذة الأم">
          <div>محتوى الأم</div>
        </Modal>
        <Modal isOpen={true} onClose={handleCloseChild} title="النافذة الابنة">
          <div>محتوى الابنة</div>
        </Modal>
      </>
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(handleCloseChild).toHaveBeenCalledTimes(1)
    expect(handleCloseParent).not.toHaveBeenCalled()
  })

  it('in nested modals, only the topmost modal responds to popstate', () => {
    const handleCloseParent = vi.fn()
    const handleCloseChild = vi.fn()

    render(
      <>
        <Modal isOpen={true} onClose={handleCloseParent} title="النافذة الأم">
          <div>محتوى الأم</div>
        </Modal>
        <Modal isOpen={true} onClose={handleCloseChild} title="النافذة الابنة">
          <div>محتوى الابنة</div>
        </Modal>
      </>
    )

    fireEvent(window, new PopStateEvent('popstate'))

    expect(handleCloseChild).toHaveBeenCalledTimes(1)
    expect(handleCloseParent).not.toHaveBeenCalled()
  })

  it('dismisses modal on touch swipe-down exceeding 70px', () => {
    const handleClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={handleClose} title="نافذة السحب">
        <div>محتوى السحب</div>
      </Modal>
    )

    const titleEl = screen.getByText('نافذة السحب')
    const dragContainer = titleEl.closest('.touch-none') || titleEl

    // Simulate drag down: start at 100, move to 180 (diff = 80px > 70px), end
    fireEvent.touchStart(dragContainer, {
      touches: [{ clientY: 100 }],
    })
    fireEvent.touchMove(dragContainer, {
      touches: [{ clientY: 180 }],
    })
    fireEvent.touchEnd(dragContainer)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus inside the modal on Tab and Shift+Tab', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="نافذة اختبار التركيز">
        <input data-testid="input-1" aria-label="حقل 1" />
        <button type="button" data-testid="button-2">زر 2</button>
      </Modal>
    )

    const closeBtn = screen.getByRole('button', { name: 'إغلاق' })
    const button2 = screen.getByTestId('button-2')

    // Focus last element; Tab should wrap to first element (closeBtn)
    button2.focus()
    expect(document.activeElement).toBe(button2)

    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(closeBtn)

    // Focus first element; Shift+Tab should wrap to last element (button2)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(button2)
  })
})
