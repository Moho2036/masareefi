/* eslint-disable react-refresh/only-export-components */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import { BaseerLogo } from '../ui/BaseerLogo'
import { useAuth } from '../../hooks/useAuth'
import { signOutUser } from '../../services/auth'
import {
  AUTO_LOCK_TIMEOUT_MS,
  EASTERN_ARABIC_DIGITS,
  hashPin,
  registerBiometricCredential,
  verifyBiometricCredential,
} from './pinCrypto'
import { PinKeypad } from './PinKeypad'
import { PinForgotModal } from './PinForgotModal'
import { triggerHaptic } from '../../lib/haptics'

export { AUTO_LOCK_TIMEOUT_MS, registerBiometricCredential }

export interface PinLockGateProps {
  children: React.ReactNode
}

export const PinLockGate: React.FC<PinLockGateProps> = ({ children }) => {
  const { user } = useAuth()
  const uid = user?.uid

  const pinStorageKey = uid ? `baseer_pin_hash_${uid}` : null
  const legacyPinStorageKey = uid ? `masareefi_pin_hash_${uid}` : null
  const biometricsStorageKey = uid ? `baseer_biometrics_enabled_${uid}` : null
  const unlockSessionKey = uid ? `baseer_session_unlocked_${uid}` : null

  const getStoredPinHash = useCallback(() => {
    if (!pinStorageKey || typeof window === 'undefined' || !window.localStorage) return null
    return (
      localStorage.getItem(pinStorageKey) ||
      (legacyPinStorageKey ? localStorage.getItem(legacyPinStorageKey) : null)
    )
  }, [pinStorageKey, legacyPinStorageKey])

  const lockoutSessionKey = uid ? `baseer_pin_lockout_until_${uid}` : 'baseer_pin_lockout_until'
  const failedAttemptsSessionKey = uid ? `baseer_pin_failed_attempts_${uid}` : 'baseer_pin_failed_attempts'

  const [hasPin, setHasPin] = useState<boolean>(() => Boolean(getStoredPinHash()))
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    const hash = getStoredPinHash()
    if (!hash) return true
    return unlockSessionKey && typeof window !== 'undefined' && window.sessionStorage
      ? sessionStorage.getItem(unlockSessionKey) === 'true'
      : false
  })

  // Adjust state during render when uid changes
  const [prevUid, setPrevUid] = useState(uid)
  if (prevUid !== uid) {
    setPrevUid(uid)
    const hash = getStoredPinHash()
    setHasPin(Boolean(hash))
    setIsUnlocked(!hash || (unlockSessionKey ? sessionStorage.getItem(unlockSessionKey) === 'true' : false))
  }

  const [inputPin, setInputPin] = useState<string>('')
  const pinBufferRef = useRef<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return 0
    const stored = sessionStorage.getItem(failedAttemptsSessionKey)
    return stored ? parseInt(stored, 10) || 0 : 0
  })
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return 0
    const until = sessionStorage.getItem(lockoutSessionKey)
    if (!until) return 0
    const diffMs = parseInt(until, 10) - Date.now()
    const diffSecs = Math.ceil(diffMs / 1000)
    return diffSecs > 0 ? diffSecs : 0
  })

  const hiddenAtRef = useRef<number | null>(null)

  const isBiometricsAvailable =
    Boolean(biometricsStorageKey) &&
    typeof window !== 'undefined' &&
    Boolean(window.PublicKeyCredential) &&
    localStorage.getItem(biometricsStorageKey || '') === 'true'

  // 1. Instant lock state synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleSync = () => {
      const hash = getStoredPinHash()
      const pinExists = Boolean(hash)
      setHasPin(pinExists)
      if (!pinExists) {
        setIsUnlocked(true)
      } else {
        const unlocked =
          unlockSessionKey && window.sessionStorage
            ? sessionStorage.getItem(unlockSessionKey) === 'true'
            : false
        setIsUnlocked(unlocked)
      }
    }

    window.addEventListener('baseer-pin-changed', handleSync)
    window.addEventListener('storage', handleSync)

    return () => {
      window.removeEventListener('baseer-pin-changed', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [getStoredPinHash, unlockSessionKey])

  // 2. Auto-lock on background
  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (getStoredPinHash()) {
          hiddenAtRef.current = Date.now()
        }
      } else if (document.visibilityState === 'visible') {
        if (
          hiddenAtRef.current !== null &&
          Date.now() - hiddenAtRef.current >= AUTO_LOCK_TIMEOUT_MS &&
          getStoredPinHash()
        ) {
          if (unlockSessionKey && typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem(unlockSessionKey)
          }
          setIsUnlocked(false)
          pinBufferRef.current = ''
          setInputPin('')
          setErrorMsg(null)
        }
        hiddenAtRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [getStoredPinHash, unlockSessionKey])

  // 3. Brute-force lockout countdown
  useEffect(() => {
    if (lockoutSeconds <= 0) return

    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const until = sessionStorage.getItem(lockoutSessionKey)
        if (until) {
          const diffMs = parseInt(until, 10) - Date.now()
          const diffSecs = Math.ceil(diffMs / 1000)
          if (diffSecs <= 0) {
            sessionStorage.removeItem(lockoutSessionKey)
            setLockoutSeconds(0)
            clearInterval(timer)
            return
          }
          setLockoutSeconds(diffSecs)
          return
        }
      }
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [lockoutSeconds, lockoutSessionKey])

  // Verify PIN against stored hash
  const verifyPin = useCallback(
    async (pinToVerify: string) => {
      if (!pinStorageKey || !unlockSessionKey) return
      try {
        const storedHash =
          localStorage.getItem(pinStorageKey) ||
          (legacyPinStorageKey ? localStorage.getItem(legacyPinStorageKey) : null)
        const computedHash = await hashPin(pinToVerify)

        if (storedHash === computedHash) {
          triggerHaptic('success')
          sessionStorage.setItem(unlockSessionKey, 'true')
          if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem(lockoutSessionKey)
            sessionStorage.removeItem(failedAttemptsSessionKey)
          }
          setIsUnlocked(true)
          pinBufferRef.current = ''
          setInputPin('')
          setErrorMsg(null)
          setFailedAttempts(0)
          setLockoutSeconds(0)
        } else {
          triggerHaptic('destructive')
          const nextAttempts = failedAttempts + 1
          if (nextAttempts >= 5) {
            const until = Date.now() + 30 * 1000
            if (typeof window !== 'undefined' && window.sessionStorage) {
              sessionStorage.setItem(lockoutSessionKey, String(until))
              sessionStorage.setItem(failedAttemptsSessionKey, '0')
            }
            setLockoutSeconds(30)
            setFailedAttempts(0)
            setErrorMsg('تم إيقاف المحاولات مؤقتاً لمدة 30 ثانية بسبب تكرار الخطأ')
          } else {
            if (typeof window !== 'undefined' && window.sessionStorage) {
              sessionStorage.setItem(failedAttemptsSessionKey, String(nextAttempts))
            }
            setFailedAttempts(nextAttempts)
            setErrorMsg('رمز الدخول غير صحيح، يرجى المحاولة مرة أخرى')
          }
          pinBufferRef.current = ''
          setInputPin('')
        }
      } catch (err) {
        triggerHaptic('destructive')
        console.error('PIN verification error:', err)
        setErrorMsg('حدث خطأ أثناء التحقق')
        pinBufferRef.current = ''
        setInputPin('')
      }
    },
    [pinStorageKey, legacyPinStorageKey, unlockSessionKey, failedAttempts, lockoutSessionKey, failedAttemptsSessionKey]
  )

  // Handle number tap
  const handleDigit = useCallback(
    (digit: string) => {
      if (lockoutSeconds > 0) return
      if (pinBufferRef.current.length >= 4) return
      triggerHaptic('tick')
      setErrorMsg(null)
      const nextPin = pinBufferRef.current + digit
      pinBufferRef.current = nextPin
      setInputPin(nextPin)
      if (nextPin.length === 4) {
        pinBufferRef.current = ''
        void verifyPin(nextPin)
      }
    },
    [lockoutSeconds, verifyPin]
  )

  // Handle backspace
  const handleDelete = useCallback(() => {
    if (lockoutSeconds > 0) return
    triggerHaptic('tick')
    setErrorMsg(null)
    pinBufferRef.current = pinBufferRef.current.slice(0, -1)
    setInputPin(pinBufferRef.current)
  }, [lockoutSeconds])

  // 4. Physical Keyboard Support
  useEffect(() => {
    if (!hasPin || isUnlocked || showForgotModal || lockoutSeconds > 0) return
    if (typeof window === 'undefined') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        e.preventDefault()
        handleDelete()
        return
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleDigit(e.key)
        return
      }
      if (EASTERN_ARABIC_DIGITS[e.key]) {
        e.preventDefault()
        handleDigit(EASTERN_ARABIC_DIGITS[e.key])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasPin, isUnlocked, showForgotModal, lockoutSeconds, handleDigit, handleDelete])

  // Trigger Biometrics unlock
  const handleBiometricUnlock = async () => {
    if (!uid || !unlockSessionKey || lockoutSeconds > 0) return
    setErrorMsg(null)
    try {
      const verified = await verifyBiometricCredential(uid)
      if (verified) {
        sessionStorage.setItem(unlockSessionKey, 'true')
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.removeItem(lockoutSessionKey)
          sessionStorage.removeItem(failedAttemptsSessionKey)
        }
        setIsUnlocked(true)
        setErrorMsg(null)
        setFailedAttempts(0)
        setLockoutSeconds(0)
      } else {
        setErrorMsg('فشل التحقق بالبصمة، يرجى إدخال رمز PIN')
      }
    } catch (err) {
      console.warn('Biometric unlock failed:', err)
      setErrorMsg('فشل التحقق بالبصمة، يرجى إدخال رمز PIN')
    }
  }

  // Reset PIN via cloud signout
  const handleForgotPinReset = async () => {
    if (pinStorageKey) {
      localStorage.removeItem(pinStorageKey)
    }
    if (legacyPinStorageKey) {
      localStorage.removeItem(legacyPinStorageKey)
    }
    if (biometricsStorageKey) {
      localStorage.removeItem(biometricsStorageKey)
    }
    if (uid) {
      localStorage.removeItem(`baseer_biometrics_cred_${uid}`)
    }
    if (unlockSessionKey) {
      sessionStorage.removeItem(unlockSessionKey)
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(lockoutSessionKey)
      sessionStorage.removeItem(failedAttemptsSessionKey)
    }
    setFailedAttempts(0)
    setLockoutSeconds(0)
    await signOutUser()
    setShowForgotModal(false)
  }

  // If app is not protected with PIN or already unlocked, render children
  if (!hasPin || isUnlocked) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F4F4F5] dark:bg-[#09090B] text-zinc-900 dark:text-white p-6 select-none" dir="rtl">
      <div className="w-full max-w-xs flex flex-col items-center text-center space-y-6">
        {/* App Lock Logo */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <BaseerLogo variant="app-icon" size={64} className="shadow-lg" />
            <div className="absolute -bottom-1 -start-1 w-6 h-6 rounded-full bg-zinc-900 dark:bg-zinc-800 border-2 border-white dark:border-[#09090B] flex items-center justify-center text-blue-400">
              <Lock className="w-3 h-3 stroke-[2.5]" />
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white">تطبيق بَصير مقفل</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">أدخل رمز الدخول المكون من 4 أرقام للمتابعة</p>
        </div>

        {/* PIN Dots & Keypad */}
        <PinKeypad
          inputPin={inputPin}
          errorMsg={errorMsg}
          lockoutSeconds={lockoutSeconds}
          isBiometricsAvailable={isBiometricsAvailable}
          onDigit={handleDigit}
          onDelete={handleDelete}
          onBiometric={handleBiometricUnlock}
        />

        {/* Forgot PIN Recovery */}
        <button
          type="button"
          onClick={() => setShowForgotModal(true)}
          className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors pt-2 cursor-pointer"
        >
          نسيت رمز الدخول؟
        </button>
      </div>

      {/* Forgot PIN Confirmation Modal */}
      <PinForgotModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onConfirmReset={handleForgotPinReset}
      />
    </div>
  )
}
