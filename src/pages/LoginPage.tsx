import React, { useState } from 'react'
import { Navigate } from 'react-router'
import { Wallet, AlertCircle, User as UserIcon, Mail, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/auth'

export const LoginPage: React.FC = () => {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signingInGoogle, setSigningInGoogle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900" role="status">
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <span className="sr-only">جاري التحميل...</span>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

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
      } else if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
      } else if (errCode === 'auth/weak-password') {
        setError('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.')
      } else {
        setError('تعذر إتمام العملية. يرجى التحقق من اتصالك والمحاولة مجدداً.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setSigningInGoogle(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      console.error('Google sign-in error:', err)
      setError('تعذر تسجيل الدخول باستخدام حساب Google. يرجى المحاولة مرة أخرى.')
    } finally {
      setSigningInGoogle(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-100 dark:border-slate-700/60 shadow-xl text-center space-y-6">
        {/* App Logo */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <Wallet className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.2]" />
        </div>

        {/* Brand Details */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">
            مصاريفي
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            تابع مصاريفك ومداخيلك بسهولة
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div role="tablist" aria-label="نوع المصادقة" className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-750/70 rounded-2xl text-xs font-bold">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login')
              setError(null)
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
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
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            حساب جديد
          </button>
        </div>

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
              <label htmlFor="signup-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                  className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <UserIcon className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-start"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-start"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || signingInGoogle}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 shadow-md shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
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
            <div className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <span className="relative bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-400">
            أو
          </span>
        </div>

        {/* Google Sign-in Button */}
        <div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingInGoogle || submitting}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 font-bold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingInGoogle ? (
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
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
      </div>
    </div>
  )
}
