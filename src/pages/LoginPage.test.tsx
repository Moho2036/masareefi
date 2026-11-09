import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { LoginPage } from './LoginPage'

const mockSignInWithGoogle = vi.fn().mockResolvedValue(undefined)
const mockSignInWithEmail = vi.fn().mockResolvedValue(undefined)
const mockSignUpWithEmail = vi.fn().mockResolvedValue(undefined)
const mockResetPassword = vi.fn().mockResolvedValue(undefined)

vi.mock('../services/auth', () => ({
  signInWithGoogle: () => mockSignInWithGoogle(),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
  signUpWithEmail: (...args: unknown[]) => mockSignUpWithEmail(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}))

let mockUser: unknown = null
let mockLoading = false

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
  }),
}))

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = null
    mockLoading = false
  })

  it('renders login form by default with email, password, and submit button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    expect(screen.getByText('بَصير')).toBeDefined()
    expect(screen.getByLabelText('البريد الإلكتروني')).toBeDefined()
    expect(screen.getByLabelText('كلمة المرور')).toBeDefined()
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeDefined()
    expect(screen.getByRole('button', { name: /الدخول بحساب Google/i })).toBeDefined()
  })

  it('switches between login and signup modes', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    // Initially in login mode, full name field is not present
    expect(screen.queryByLabelText('الاسم الكامل')).toBeNull()

    // Switch to signup mode
    const signupTab = screen.getByRole('tab', { name: 'حساب جديد' })
    fireEvent.click(signupTab)

    expect(screen.getByLabelText('الاسم الكامل')).toBeDefined()
    expect(screen.getByRole('button', { name: 'إنشاء الحساب' })).toBeDefined()
  })

  it('validates name, email, and password length in signup mode', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    // Switch to signup
    fireEvent.click(screen.getByRole('tab', { name: 'حساب جديد' }))

    // Empty name
    const submitBtn = screen.getByRole('button', { name: 'إنشاء الحساب' })
    fireEvent.click(submitBtn)
    expect(screen.getByText('يرجى إدخال اسم المستخدم')).toBeDefined()

    // Fill name, empty email
    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'محمد أحمد' } })
    fireEvent.click(submitBtn)
    expect(screen.getByText('يرجى إدخال البريد الإلكتروني')).toBeDefined()

    // Fill email, short password (< 6 chars)
    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: '123' } })
    fireEvent.click(submitBtn)
    expect(screen.getByText('كلمة المرور يجب أن لا تقل عن 6 خانات')).toBeDefined()
  })

  it('submits signup with trimmed values and calls signUpWithEmail', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('tab', { name: 'حساب جديد' }))

    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: '  محمد أحمد  ' } })
    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), { target: { value: '  user@example.com  ' } })
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), { target: { value: 'secret123' } })

    const submitBtn = screen.getByRole('button', { name: 'إنشاء الحساب' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockSignUpWithEmail).toHaveBeenCalledWith(
        'user@example.com',
        'secret123',
        'محمد أحمد'
      )
    })
  })

  it('validates password mismatch in signup mode', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('tab', { name: 'حساب جديد' }))

    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'محمد' } })
    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور'), { target: { value: 'different123' } })

    const submitBtn = screen.getByRole('button', { name: 'إنشاء الحساب' })
    fireEvent.click(submitBtn)

    expect(screen.getByText('كلمتا المرور غير متطابقتين')).toBeDefined()
    expect(mockSignUpWithEmail).not.toHaveBeenCalled()
  })

  it('displays password strength meter dynamically in signup mode', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('tab', { name: 'حساب جديد' }))

    // Initially with empty password, meter label is not present
    expect(screen.queryByText('قوة كلمة المرور:')).toBeNull()

    // Weak password
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: '123456' } })
    expect(screen.getByText('قوة كلمة المرور:')).toBeDefined()
    expect(screen.getByText('ضعيفة')).toBeDefined()

    // Strong password
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'StrongP@ssw0rd!' } })
    expect(screen.getByText('قوية')).toBeDefined()
  })

  it('displays trust and security footnote', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    expect(screen.getByText('بياناتك مشفرة ومحمية بالكامل ولا يطلع عليها أحد')).toBeDefined()
  })

  it('submits login with email and password and calls signInWithEmail', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('كلمة المرور'), { target: { value: 'secret123' } })

    const submitBtn = screen.getByRole('button', { name: 'تسجيل الدخول' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith('user@example.com', 'secret123')
    })
  })

  it('calls signInWithGoogle when Google button is clicked', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    const googleBtn = screen.getByRole('button', { name: /الدخول بحساب Google/i })
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled()
    })
  })

  it('toggles password visibility between password and text types when clicking eye button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    const passwordInput = screen.getByLabelText('كلمة المرور')
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleBtn = screen.getByRole('button', { name: 'إظهار كلمة المرور' })
    fireEvent.click(toggleBtn)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'إخفاء كلمة المرور' })).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'إخفاء كلمة المرور' }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('validates email before sending reset password link', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    const forgotBtn = screen.getByRole('button', { name: 'نسيت كلمة المرور؟' })
    fireEvent.click(forgotBtn)

    expect(screen.getByText('يرجى إدخال البريد الإلكتروني أولاً لاستعادة كلمة المرور')).toBeDefined()
    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('sends password reset link and shows success message', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), {
      target: { value: 'user@example.com' },
    })

    const forgotBtn = screen.getByRole('button', { name: 'نسيت كلمة المرور؟' })
    fireEvent.click(forgotBtn)

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('user@example.com')
      expect(
        screen.getByText('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.')
      ).toBeDefined()
    })
  })

  it('shows appropriate error message when resetPassword fails with auth/user-not-found', async () => {
    mockResetPassword.mockRejectedValueOnce({ code: 'auth/user-not-found' })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), {
      target: { value: 'unknown@example.com' },
    })

    const forgotBtn = screen.getByRole('button', { name: 'نسيت كلمة المرور؟' })
    fireEvent.click(forgotBtn)

    await waitFor(() => {
      expect(screen.getByText('لا يوجد حساب مسجل بهذا البريد الإلكتروني.')).toBeDefined()
    })
  })

  it('shows appropriate Arabic error message when Google sign-in fails with auth/popup-blocked', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce({ code: 'auth/popup-blocked' })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    const googleBtn = screen.getByRole('button', { name: /الدخول بحساب Google/i })
    fireEvent.click(googleBtn)

    await waitFor(() => {
      expect(
        screen.getByText(
          'تم حظر نافذة تسجيل الدخول المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة لهذا الموقع والمحاولة مجدداً.'
        )
      ).toBeDefined()
    })
  })

  it('renders theme toggle button on login screen and toggles theme', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    const themeBtn = screen.getByRole('button', { name: /التبديل إلى الوضع/i })
    expect(themeBtn).toBeDefined()
    fireEvent.click(themeBtn)
    expect(screen.getByRole('button', { name: /التبديل إلى الوضع/i })).toBeDefined()
  })
})
