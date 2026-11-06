/* eslint-disable react-refresh/only-export-components */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Delete, Fingerprint, Lock, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOutUser } from '../../services/auth'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export interface PinLockGateProps {
  children: React.ReactNode
}

export const AUTO_LOCK_TIMEOUT_MS = 2 * 60 * 1000

const EASTERN_ARABIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
}

/**
 * Simple SHA-256 hash helper using Web Crypto API.
 */
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function registerBiometricCredential(
  uid: string,
  displayName: string
): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    typeof navigator.credentials?.create !== 'function'
  ) {
    return false
  }

  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const encoder = new TextEncoder()
    const userId = encoder.encode(uid)

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'بَصير (Baseer)',
          id: window.location.hostname || undefined,
        },
        user: {
          id: userId,
          name: displayName || uid,
          displayName: displayName || uid,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!credential || !credential.rawId) return false

    const credId = arrayBufferToBase64(credential.rawId)
    localStorage.setItem(`baseer_biometrics_cred_${uid}`, credId)
    return true
  } catch (err) {
    console.warn('Biometric registration failed:', err)
    return false
  }
}

export async function verifyBiometricCredential(uid: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    typeof navigator.credentials?.get !== 'function'
  ) {
    return false
  }

  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const storedCredId = localStorage.getItem(`baseer_biometrics_cred_${uid}`)
    const allowCredentials: PublicKeyCredentialDescriptor[] = []

    if (storedCredId) {
      try {
        allowCredentials.push({
          id: base64ToArrayBuffer(storedCredId),
          type: 'public-key',
        })
      } catch {
        // ignore malformed stored cred id
      }
    }

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        userVerification: 'required',
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    return Boolean(assertion && assertion.id)
  } catch (err) {
    console.warn('Biometric verification failed:', err)
    return false
  }
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false)
  const [failedAttempts, setFailedAttempts] = useState<number>(0)
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0)

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
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [lockoutSeconds])

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
          sessionStorage.setItem(unlockSessionKey, 'true')
          setIsUnlocked(true)
          setInputPin('')
          setErrorMsg(null)
          setFailedAttempts(0)
          setLockoutSeconds(0)
        } else {
          const nextAttempts = failedAttempts + 1
          if (nextAttempts >= 5) {
            setLockoutSeconds(30)
            setFailedAttempts(0)
            setErrorMsg('تم إيقاف المحاولات مؤقتاً لمدة 30 ثانية بسبب تكرار الخطأ')
          } else {
            setFailedAttempts(nextAttempts)
            setErrorMsg('رمز الدخول غير صحيح، يرجى المحاولة مرة أخرى')
          }
          setInputPin('')
        }
      } catch (err) {
        console.error('PIN verification error:', err)
        setErrorMsg('حدث خطأ أثناء التحقق')
        setInputPin('')
      }
    },
    [pinStorageKey, legacyPinStorageKey, unlockSessionKey, failedAttempts]
  )

  // Handle number tap
  const handleDigit = useCallback(
    (digit: string) => {
      if (lockoutSeconds > 0) return
      if (inputPin.length >= 4) return
      setErrorMsg(null)
      const nextPin = inputPin + digit
      setInputPin(nextPin)
      if (nextPin.length === 4) {
        void verifyPin(nextPin)
      }
    },
    [inputPin, lockoutSeconds, verifyPin]
  )

  // Handle backspace
  const handleDelete = useCallback(() => {
    if (lockoutSeconds > 0) return
    setErrorMsg(null)
    setInputPin((prev) => prev.slice(0, -1))
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090B] text-white p-6 select-none" dir="rtl">
      <div className="w-full max-w-xs flex flex-col items-center text-center space-y-6">
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#121215] border border-[#27272A] flex items-center justify-center text-blue-400 shadow-xl">
          <Lock className="w-8 h-8 stroke-[2.2]" />
        </div>

        <div>
          <h1 className="text-xl font-black text-white">تطبيق بَصير مقفل</h1>
          <p className="text-xs text-zinc-400 mt-1">أدخل رمز الدخول المكون من 4 أرقام للمتابعة</p>
        </div>

        {/* PIN Dots */}
        <div dir="ltr" className="flex items-center justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = inputPin.length > index
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  isFilled
                    ? 'bg-blue-500 border-blue-500 scale-110 shadow-sm shadow-blue-500/50'
                    : 'border-zinc-700 bg-zinc-800/60'
                }`}
              />
            )
          })}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="text-xs font-bold text-red-500 dark:text-red-400 animate-in fade-in duration-150">
            {errorMsg}
          </div>
        )}

        {/* Numeric Keypad */}
        <div dir="ltr" className="grid grid-cols-3 gap-3 w-full pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={lockoutSeconds > 0}
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 text-xl font-black transition-all cursor-pointer border border-zinc-700/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}

          {/* Biometrics button */}
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={!isBiometricsAvailable || lockoutSeconds > 0}
            className={`h-14 rounded-2xl flex items-center justify-center transition-all border ${
              isBiometricsAvailable && lockoutSeconds === 0
                ? 'bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 text-blue-400 border-zinc-700/40 cursor-pointer'
                : 'opacity-0 pointer-events-none border-transparent'
            }`}
          >
            <Fingerprint className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* Zero */}
          <button
            type="button"
            disabled={lockoutSeconds > 0}
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 text-xl font-black transition-all cursor-pointer border border-zinc-700/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            disabled={lockoutSeconds > 0}
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer border border-zinc-700/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Forgot PIN Recovery */}
        <button
          type="button"
          onClick={() => setShowForgotModal(true)}
          className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors pt-2 cursor-pointer"
        >
          نسيت رمز الدخول؟
        </button>
      </div>

      {/* Forgot PIN Confirmation Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="استعادة رمز الدخول"
      >
        <div className="space-y-4 text-start">
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            لأسباب أمنية وحماية خصوصيتك، يُحفظ رمز الدخول محلياً على جهازك فقط. لإلغاء القفل، يمكنك تسجيل الخروج من هذا الجهاز ثم تسجيل الدخول مرة أخرى بحسابك السحابي بأمان.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowForgotModal(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={handleForgotPinReset}
              icon={<LogOut className="w-4 h-4" />}
            >
              تسجيل الخروج وإعادة التعيين
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
