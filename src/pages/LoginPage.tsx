import React, { useState, useMemo } from 'react'
import { Navigate } from 'react-router'
import {
  AlertCircle,
  CheckCircle2,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
} from '../services/auth'
import { AppShellSkeleton } from '../components/skeletons/AppShellSkeleton'
import { BaseerLogo } from '../components/ui/BaseerLogo'

export const LoginPage: React.FC = () => {
  const { user, loading } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signingInGoogle, setSigningInGoogle] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'bg-zinc-200 dark:bg-zinc-700' }
    let score = 0
    if (password.length >= 6) score += 1
    if (password.length >= 8 && /[0-9]/.test(password)) score += 1
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
    if (/[^a-zA-Z0-9]/.test(password)) score += 1

    switch (score) {
      case 1:
        return { score: 1, label: 'ضعيفة', color: 'bg-red-500' }
      case 2:
        return { score: 2, label: 'مقبولة', color: 'bg-amber-500' }
      case 3:
        return { score: 3, label: 'جيدة', color: 'bg-blue-500' }
      case 4:
      default:
        return { score: 4, label: 'قوية', color: 'bg-emerald-500' }
    }
  }, [password])

  if (loading) {
    return <AppShellSkeleton />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const trimmedEmail = email.trim()
    const trimmedName = name.trim()

    if (mode === 'signup') {
      if (!trimmedName) {
        setError('يرجى إدخال اسم المستخدم')
        return
      }
    }

    if (!trimmedEmail) {
      setError('يرجى إدخال البريد الإلكتروني')
      return
    }

    if (!password) {
      setError('يرجى إدخال كلمة المرور')
      return
    }

    if (mode === 'signup' && password.length < 6) {
      setError('كلمة المرور يجب أن لا تقل عن 6 خانات')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(trimmedEmail, password, trimmedName)
      } else {
        await signInWithEmail(trimmedEmail, password)
      }
    } catch (err: unknown) {
      console.error('Email auth error:', err)
      const errCode = (err as { code?: string })?.code || ''
      if (errCode === 'auth/email-already-in-use') {
        setError('البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استخدام بريد آخر.')
      } else if (errCode === 'auth/invalid-email') {
        setError('البريد الإلكتروني المدخل غير صالح.')
      } else if (errCode === 'auth/user-not-found') {
        setError('لا يوجد حساب مسجل بهذا البريد الإلكتروني.')
      } else if (errCode === 'auth/user-disabled') {
        setError('تم تعطيل هذا الحساب. يرجى التواصل مع الدعم الفني.')
      } else if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
      } else if (errCode === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.')
      } else if (errCode === 'auth/operation-not-allowed') {
        setError('التسجيل بالبريد وكلمة المرور غير مفعّل حالياً، يرجى الدخول بحساب Google.')
      } else if (errCode === 'auth/account-exists-with-different-credential') {
        setError('هذا البريد مرتبط بحساب Google، يرجى الضغط على الدخول بحساب Google أدناه.')
      } else if (errCode === 'auth/too-many-requests') {
        setError('تم إيقاف المحاولات مؤقتاً لكثرة الطلبات. يرجى المحاولة بعد قليل.')
      } else if (errCode === 'auth/network-request-failed') {
        setError('تعذر الاتصال بالشبكة. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.')
      } else {
        setError('تعذر إتمام العملية. يرجى التحقق من اتصالك والمحاولة مجدداً.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setSuccessMessage(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('يرجى إدخال البريد الإلكتروني أولاً لاستعادة كلمة المرور')
      return
    }

    setResettingPassword(true)
    try {
      await resetPassword(trimmedEmail)
      setSuccessMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.')
    } catch (err: unknown) {
      console.error('Password reset error:', err)
      const errCode = (err as { code?: string })?.code || ''
      if (errCode === 'auth/user-not-found') {
        setError('لا يوجد حساب مسجل بهذا البريد الإلكتروني.')
      } else if (errCode === 'auth/invalid-email') {
        setError('البريد الإلكتروني المدخل غير صالح.')
      } else if (errCode === 'auth/too-many-requests') {
        setError('تم إيقاف المحاولات مؤقتاً لكثرة الطلبات. يرجى المحاولة بعد قليل.')
      } else if (errCode === 'auth/network-request-failed') {
        setError('تعذر الاتصال بالشبكة. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.')
      } else {
        setError('تعذر إرسال رابط إعادة تعيين كلمة المرور. يرجى التحقق من البريد الإلكتروني والمحاولة لاحقاً.')
      }
    } finally {
      setResettingPassword(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setSuccessMessage(null)
    setSigningInGoogle(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      console.error('Google sign-in error:', err)
      const errCode = (err as { code?: string })?.code || ''
      if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
        setError('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.')
      } else if (errCode === 'auth/popup-blocked') {
        setError('تم حظر نافذة تسجيل الدخول المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة لهذا الموقع والمحاولة مجدداً.')
      } else if (errCode === 'auth/network-request-failed') {
        setError('تعذر الاتصال بالشبكة. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً.')
      } else if (errCode === 'auth/account-exists-with-different-credential') {
        setError('هذا البريد مرتبط بطريقة دخول أخرى. يرجى تسجيل الدخول بالبريد وكلمة المرور.')
      } else {
        setError('تعذر تسجيل الدخول باستخدام حساب Google. يرجى المحاولة مرة أخرى.')
      }
    } finally {
      setSigningInGoogle(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#F4F4F5] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Theme Toggle Button */}
      <div className="absolute top-4 end-4 sm:top-6 sm:end-6 z-10">
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={resolvedTheme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
          title={resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          className="press-scale p-2.5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-xs dark:shadow-none transition-colors cursor-pointer"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-500" />
          ) : (
            <Moon className="w-5 h-5 text-zinc-600" />
          )}
        </button>
      </div>

      <div className="w-full max-w-sm bg-white dark:bg-[#121215] rounded-2xl p-6 sm:p-8 border border-[#E4E4E7] dark:border-[#27272A] shadow-xl text-center space-y-6">
        {/* App Logo */}
        <div className="flex justify-center">
          <BaseerLogo variant="app-icon" size={64} className="shadow-xs" />
        </div>

        {/* Brand Details */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">
            بَصير
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
            بصيرتك المالية لإدارة مصاريفك ومداخيلك بوضوح
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div role="tablist" aria-label="نوع المصادقة" className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-900 border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl text-xs font-bold">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login')
              setError(null)
              setSuccessMessage(null)
              setConfirmPassword('')
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => {
              setMode('signup')
              setError(null)
              setSuccessMessage(null)
              setConfirmPassword('')
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 text-start rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-start rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form noValidate onSubmit={handleEmailSubmit} className="space-y-3.5 text-start">
          {mode === 'signup' && (
            <div>
              <label htmlFor="signup-name" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                الاسم الكامل
              </label>
              <div className="relative">
                <input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد أحمد"
                  required={mode === 'signup'}
                  className="w-full h-11 ps-10 pe-3.5 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-base sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
                <UserIcon className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                required
                className="w-full h-11 ps-10 pe-3.5 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-base sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-start"
              />
              <Mail className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className="w-full h-11 ps-10 pe-10 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-base sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-start"
              />
              <Lock className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 absolute end-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'login' && (
              <div className="flex justify-end pt-1.5">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resettingPassword || submitting || signingInGoogle}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {resettingPassword ? 'جاري إرسال الرابط...' : 'نسيت كلمة المرور؟'}
                </button>
              </div>
            )}
            {mode === 'signup' && password.length > 0 && (
              <div className="space-y-1.5 pt-1.5" aria-label="مستوى قوة كلمة المرور">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-zinc-500 dark:text-zinc-400">قوة كلمة المرور:</span>
                  <span
                    className={
                      passwordStrength.score === 1
                        ? 'text-red-500'
                        : passwordStrength.score === 2
                          ? 'text-amber-500'
                          : passwordStrength.score === 3
                            ? 'text-blue-500'
                            : 'text-emerald-500'
                    }
                  >
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full rounded-full transition-colors ${
                        step <= passwordStrength.score
                          ? passwordStrength.color
                          : 'bg-zinc-200 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  required={mode === 'signup'}
                  className="w-full h-11 ps-10 pe-10 py-2 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-base sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-start"
                />
                <Lock className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة المرور' : 'إظهار تأكيد كلمة المرور'}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 absolute end-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || signingInGoogle}
            className="w-full h-11 px-4 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === 'signup' ? (
              'إنشاء الحساب'
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E4E4E7] dark:border-[#27272A]" />
          </div>
          <span className="relative bg-white dark:bg-[#121215] px-3 text-xs font-semibold text-zinc-400">
            أو
          </span>
        </div>

        {/* Google Sign-in Button */}
        <div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingInGoogle || submitting}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 font-bold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingInGoogle ? (
              <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{signingInGoogle ? 'جاري تسجيل الدخول...' : 'الدخول بحساب Google'}</span>
          </button>
        </div>

        {/* Trust & Security Footnote */}
        <div className="pt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>بياناتك مشفرة ومحمية بالكامل ولا يطلع عليها أحد</span>
        </div>
      </div>
    </div>
  )
}
