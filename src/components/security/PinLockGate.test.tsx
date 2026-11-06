import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { PinLockGate, AUTO_LOCK_TIMEOUT_MS } from './PinLockGate'

const mockUser = { uid: 'user-test-123', displayName: 'مستخدم تجريبي', email: 'test@example.com' }

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}))

vi.mock('../../services/auth', () => ({
  signOutUser: vi.fn().mockResolvedValue(undefined),
}))

// SHA-256 for '1234'
const PIN_1234_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
const PIN_KEY = `baseer_pin_hash_${mockUser.uid}`
const SESSION_KEY = `baseer_session_unlocked_${mockUser.uid}`

describe('PinLockGate Component', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders children directly when no PIN is set', () => {
    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByText('تطبيق بَصير مقفل')).not.toBeInTheDocument()
  })

  it('renders lock screen when PIN is set and session is locked', () => {
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    expect(screen.getByText('تطبيق بَصير مقفل')).toBeInTheDocument()
    expect(screen.getByText('أدخل رمز الدخول المكون من 4 أرقام للمتابعة')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders children when session is already unlocked', () => {
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)
    sessionStorage.setItem(SESSION_KEY, 'true')

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByText('تطبيق بَصير مقفل')).not.toBeInTheDocument()
  })

  it('unlocks successfully when entering correct PIN via keypad clicks', async () => {
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '4' }))

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('true')
  })

  it('shows error message on incorrect PIN and keeps app locked', async () => {
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))

    await waitFor(() => {
      expect(screen.getByText('رمز الدخول غير صحيح، يرجى المحاولة مرة أخرى')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('triggers brute-force lockout after 5 consecutive failed attempts and re-enables after timer', async () => {
    vi.useFakeTimers()
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    // Fail 4 times
    for (let attempt = 0; attempt < 4; attempt++) {
      fireEvent.click(screen.getByRole('button', { name: '9' }))
      fireEvent.click(screen.getByRole('button', { name: '9' }))
      fireEvent.click(screen.getByRole('button', { name: '9' }))
      fireEvent.click(screen.getByRole('button', { name: '9' }))
      await act(async () => {
        await Promise.resolve()
      })
    }

    expect(screen.getByText('رمز الدخول غير صحيح، يرجى المحاولة مرة أخرى')).toBeInTheDocument()
    const buttonOne = screen.getByRole('button', { name: '1' })
    expect(buttonOne).not.toBeDisabled()

    // 5th failed attempt triggers lockout
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    fireEvent.click(screen.getByRole('button', { name: '9' }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(
      screen.getByText('تم إيقاف المحاولات مؤقتاً لمدة 30 ثانية بسبب تكرار الخطأ')
    ).toBeInTheDocument()
    expect(buttonOne).toBeDisabled()

    // Trying to click while locked out should not enter digits
    fireEvent.click(buttonOne)
    await act(async () => {
      await Promise.resolve()
    })

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000)
    })

    expect(buttonOne).not.toBeDisabled()
  })

  it('supports physical keyboard input (Latin digits, Eastern Arabic digits, Backspace)', async () => {
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    // Test Eastern Arabic digits and backspace
    // Type '١', '٩', Backspace, '٢', '٣', '٤' => becomes '1234'
    fireEvent.keyDown(window, { key: '١' })
    fireEvent.keyDown(window, { key: '٩' })
    fireEvent.keyDown(window, { key: 'Backspace' })
    fireEvent.keyDown(window, { key: '٢' })
    fireEvent.keyDown(window, { key: '٣' })
    fireEvent.keyDown(window, { key: '٤' })

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('true')
  })

  it('synchronizes immediately when baseer-pin-changed or storage event is dispatched', async () => {
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    expect(screen.getByText('تطبيق بَصير مقفل')).toBeInTheDocument()

    // Simulate removing PIN in settings
    localStorage.removeItem(PIN_KEY)
    act(() => {
      window.dispatchEvent(new CustomEvent('baseer-pin-changed'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })
    expect(screen.queryByText('تطبيق بَصير مقفل')).not.toBeInTheDocument()
  })

  it('auto-locks when the app is in the background for >= 2 minutes', async () => {
    vi.useFakeTimers()
    localStorage.setItem(PIN_KEY, PIN_1234_HASH)
    sessionStorage.setItem(SESSION_KEY, 'true')

    render(
      <PinLockGate>
        <div data-testid="protected-content">المحتوى المحمي</div>
      </PinLockGate>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()

    // App goes to background
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
    fireEvent(document, new Event('visibilitychange'))

    // Advance by less than 2 minutes (e.g. 1 minute)
    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })

    // Return to visible -> should still be unlocked
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    fireEvent(document, new Event('visibilitychange'))

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()

    // Go to background again
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
    fireEvent(document, new Event('visibilitychange'))

    // Advance by AUTO_LOCK_TIMEOUT_MS (2 minutes)
    act(() => {
      vi.advanceTimersByTime(AUTO_LOCK_TIMEOUT_MS)
    })

    // Return to visible -> should now auto-lock
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    fireEvent(document, new Event('visibilitychange'))

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByText('تطبيق بَصير مقفل')).toBeInTheDocument()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })
})
