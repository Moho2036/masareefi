/* eslint-disable react-refresh/only-export-components */
import React, { useState, useCallback } from 'react'
import { Delete, Fingerprint, Lock, LogOut } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { signOutUser } from '../../services/auth'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export interface PinLockGateProps {
  children: React.ReactNode
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

  const getStoredPinHash = () => {
    if (!pinStorageKey || typeof window === 'undefined' || !window.localStorage) return null
    return (
      localStorage.getItem(pinStorageKey) ||
      (legacyPinStorageKey ? localStorage.getItem(legacyPinStorageKey) : null)
    )
  }

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

  const isBiometricsAvailable =
    Boolean(biometricsStorageKey) &&
    typeof window !== 'undefined' &&
    Boolean(window.PublicKeyCredential) &&
    localStorage.getItem(biometricsStorageKey || '') === 'true'

  // Handle number tap
  const handleDigit = (digit: string) => {
    if (inputPin.length >= 4) return
    setErrorMsg(null)
    const nextPin = inputPin + digit
    setInputPin(nextPin)
    if (nextPin.length === 4) {
      void verifyPin(nextPin)
    }
  }

  // Handle backspace
  const handleDelete = () => {
    setErrorMsg(null)
    setInputPin((prev) => prev.slice(0, -1))
  }

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
        } else {
          setErrorMsg('رمز الدخول غير صحيح، يرجى المحاولة مرة أخرى')
          setInputPin('')
        }
      } catch (err) {
        console.error('PIN verification error:', err)
        setErrorMsg('حدث خطأ أثناء التحقق')
        setInputPin('')
      }
    },
    [pinStorageKey, legacyPinStorageKey, unlockSessionKey]
  )

  // Trigger Biometrics unlock
  const handleBiometricUnlock = async () => {
    if (!uid || !unlockSessionKey) return
    setErrorMsg(null)
    try {
      const verified = await verifyBiometricCredential(uid)
      if (verified) {
        sessionStorage.setItem(unlockSessionKey, 'true')
        setIsUnlocked(true)
        setErrorMsg(null)
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
    await signOutUser()
    setShowForgotModal(false)
  }

  // If app is not protected with PIN or already unlocked, render children
  if (!hasPin || isUnlocked) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-900 text-white p-6 select-none" dir="rtl">
      <div className="w-full max-w-xs flex flex-col items-center text-center space-y-6">
        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-3xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-blue-400 shadow-xl">
          <Lock className="w-8 h-8 stroke-[2.2]" />
        </div>

        <div>
          <h1 className="text-xl font-black text-white">تطبيق بَصير مقفل</h1>
          <p className="text-xs text-zinc-400 mt-1">أدخل رمز الدخول المكون من 4 أرقام للمتابعة</p>
        </div>

        {/* PIN Dots */}
        <div className="flex items-center justify-center gap-4 py-2">
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
          <div className="text-xs font-bold text-rose-400 animate-in fade-in duration-150">
            {errorMsg}
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 text-xl font-black transition-all cursor-pointer border border-zinc-700/40"
            >
              {digit}
            </button>
          ))}

          {/* Biometrics button */}
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={!isBiometricsAvailable}
            className={`h-14 rounded-2xl flex items-center justify-center transition-all border ${
              isBiometricsAvailable
                ? 'bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 text-blue-400 border-zinc-700/40 cursor-pointer'
                : 'opacity-0 pointer-events-none border-transparent'
            }`}
          >
            <Fingerprint className="w-6 h-6 stroke-[2.2]" />
          </button>

          {/* Zero */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 text-xl font-black transition-all cursor-pointer border border-zinc-700/40"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:bg-zinc-600 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer border border-zinc-700/40"
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
