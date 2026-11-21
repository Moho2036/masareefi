import React, { useState } from 'react'
import {
  Lock,
  Fingerprint,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { changeUserPassword } from '../../services/auth'
import { registerBiometricCredential } from '../security/PinLockGate'
import { toWesternDigits } from '../../lib/dates'
import { PinSetupModal, RemovePinModal } from './PinModals'
import type { User } from 'firebase/auth'

export interface SecuritySectionProps {
  user: User | null
  effectiveDisplayName: string
  showPasswordModal: boolean
  setShowPasswordModal: (val: boolean) => void
  onOpenReauthModal: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  user,
  effectiveDisplayName,
  showPasswordModal,
  setShowPasswordModal,
  onOpenReauthModal,
  showToast,
}) => {
  const uid = user?.uid
  const pinKey = uid ? `baseer_pin_hash_${uid}` : null
  const legacyPinKey = uid ? `masareefi_pin_hash_${uid}` : null
  const bioKey = uid ? `baseer_biometrics_enabled_${uid}` : null

  const [hasPinSet, setHasPinSet] = useState<boolean>(() => {
    if (!pinKey || typeof window === 'undefined' || !window.localStorage) return false
    return Boolean(localStorage.getItem(pinKey) || (legacyPinKey ? localStorage.getItem(legacyPinKey) : null))
  })
  const [bioEnabled, setBioEnabled] = useState<boolean>(() => {
    if (!bioKey || typeof window === 'undefined' || !window.localStorage) return false
    return localStorage.getItem(bioKey) === 'true'
  })

  // PIN modal states
  const [showPinModal, setShowPinModal] = useState(false)
  const [showRemovePinModal, setShowRemovePinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinConfirmInput, setPinConfirmInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Sync PIN state on pinKey change during render
  const [prevPinKey, setPrevPinKey] = useState(pinKey)
  if (prevPinKey !== pinKey) {
    setPrevPinKey(pinKey)
    setHasPinSet(
      pinKey && typeof window !== 'undefined' && window.localStorage
        ? Boolean(localStorage.getItem(pinKey) || (legacyPinKey ? localStorage.getItem(legacyPinKey) : null))
        : false
    )
    setBioEnabled(
      bioKey && typeof window !== 'undefined' && window.localStorage
        ? localStorage.getItem(bioKey) === 'true'
        : false
    )
  }

  const handleSavePin = async () => {
    setPinError(null)
    const cleanPin = toWesternDigits(pinInput).replace(/\D/g, '')
    const cleanConfirm = toWesternDigits(pinConfirmInput).replace(/\D/g, '')
    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setPinError('رمز PIN يجب أن يتكون من 4 أرقام')
      return
    }
    if (cleanPin !== cleanConfirm) {
      setPinError('رمزا الدخول غير متطابقين')
      return
    }
    if (!pinKey) return

    try {
      const hash = await hashPin(cleanPin)
      localStorage.setItem(pinKey, hash)
      if (legacyPinKey) {
        localStorage.setItem(legacyPinKey, hash)
      }
      if (typeof window !== 'undefined' && window.sessionStorage && uid) {
        sessionStorage.setItem(`baseer_session_unlocked_${uid}`, 'true')
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('baseer-pin-changed'))
      }
      setHasPinSet(true)
      setShowPinModal(false)
      setPinInput('')
      setPinConfirmInput('')
      showToast('تم تفعيل قفل التطبيق برمز PIN بنجاح', 'success')
    } catch (err) {
      console.error('Failed to save PIN:', err)
      setPinError('حدث خطأ أثناء حفظ الرمز')
    }
  }

  const handleRemovePin = () => {
    if (pinKey) localStorage.removeItem(pinKey)
    if (legacyPinKey) localStorage.removeItem(legacyPinKey)
    if (bioKey) localStorage.removeItem(bioKey)
    if (typeof window !== 'undefined' && window.sessionStorage && uid) {
      sessionStorage.removeItem(`baseer_session_unlocked_${uid}`)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baseer-pin-changed'))
    }
    setHasPinSet(false)
    setBioEnabled(false)
    showToast('تم إلغاء قفل التطبيق', 'info')
  }

  const handleToggleBiometrics = async (checked: boolean) => {
    if (!bioKey || !uid) return
    if (checked) {
      try {
        if (
          typeof window !== 'undefined' &&
          window.PublicKeyCredential &&
          typeof navigator.credentials?.create === 'function'
        ) {
          const registered = await registerBiometricCredential(uid, effectiveDisplayName)
          if (!registered) {
            showToast('تعذر تسجيل البصمة أو تم إلغاء العملية من قبل المستخدم', 'error')
            return
          }
        }
        localStorage.setItem(bioKey, 'true')
        setBioEnabled(true)
        showToast('تم تفعيل الفتح بالبصمة / Face ID', 'success')
      } catch (err) {
        console.warn('Failed to enable biometrics:', err)
        showToast('تعذر تفعيل الفتح بالبصمة على هذا الجهاز', 'error')
      }
    } else {
      localStorage.removeItem(bioKey)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`baseer_biometrics_cred_${uid}`)
      }
      setBioEnabled(false)
      showToast('تم تعطيل الفتح بالبصمة', 'info')
    }
  }

  const handleChangePassword = async () => {
    if (!user) return
    if (!currentPassword) {
      showToast('يرجى إدخال كلمة المرور الحالية', 'error')
      return
    }
    if (newPassword.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 خانات على الأقل', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('كلمتا المرور غير متطابقتين', 'error')
      return
    }
    setChangingPassword(true)
    try {
      await changeUserPassword(currentPassword, newPassword)
      showToast('تم تغيير كلمة المرور بنجاح', 'success')
      setShowPasswordModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const errorObj = err as { code?: string }
      if (errorObj?.code === 'auth/wrong-password' || errorObj?.code === 'auth/invalid-credential') {
        showToast('كلمة المرور الحالية غير صحيحة', 'error')
      } else if (errorObj?.code === 'auth/requires-recent-login') {
        showToast('يتطلب هذا الإجراء إعادة تسجيل الدخول', 'error')
        setShowPasswordModal(false)
        onOpenReauthModal()
      } else {
        showToast('تعذر تغيير كلمة المرور، يرجى التحقق والمحاولة ثانية', 'error')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <>
      <Card
        title="الأمان وقفل التطبيق"
        subtitle="حماية بياناتك الحساسة برمز PIN مكون من 4 أرقام والفتح بالبصمة"
      >
        <div className="space-y-5 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
                <Lock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {hasPinSet ? 'قفل PIN مفعل ومحمي على هذا الجهاز' : 'قفل التطبيق غير مفعل'}
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500">
                  {hasPinSet
                    ? 'يطلب التطبيق الرمز السري عند فتح الصفحة للحفاظ على سرية أرقامك'
                    : 'يمكنك تعيين رمز من 4 أرقام لمنع أي شخص من الاطلاع على مصاريفك'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasPinSet ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPinModal(true)}
                    className="font-bold text-xs"
                  >
                    تغيير الرمز
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowRemovePinModal(true)}
                    className="font-bold text-xs"
                  >
                    إلغاء القفل
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowPinModal(true)}
                  className="font-bold text-xs"
                >
                  تعيين رمز PIN (4 أرقام)
                </Button>
              )}
            </div>
          </div>

          {/* Biometrics */}
          {hasPinSet && typeof window !== 'undefined' && Boolean(window.PublicKeyCredential) && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <label
                  htmlFor="biometrics-toggle"
                  className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-2"
                >
                  <Fingerprint className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>فتح القفل بالبصمة / Face ID</span>
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  استخدام المصادقة البيومترية لجهازك لفتح التطبيق بسرعة وأمان دون كتابة الرمز في كل مرة.
                </p>
              </div>
              <Toggle
                id="biometrics-toggle"
                checked={bioEnabled}
                onChange={handleToggleBiometrics}
              />
            </div>
          )}
        </div>
      </Card>

      {/* PIN Setup Modal */}
      <PinSetupModal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false)
          setPinInput('')
          setPinConfirmInput('')
          setPinError(null)
        }}
        pinInput={pinInput}
        setPinInput={setPinInput}
        pinConfirmInput={pinConfirmInput}
        setPinConfirmInput={setPinConfirmInput}
        pinError={pinError}
        onSavePin={handleSavePin}
      />

      {/* Remove PIN Confirmation Modal */}
      <RemovePinModal
        isOpen={showRemovePinModal}
        onClose={() => setShowRemovePinModal(false)}
        onConfirmRemove={() => {
          handleRemovePin()
          setShowRemovePinModal(false)
        }}
      />

      {/* Password Change Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        }}
        title="تغيير كلمة المرور"
        hideCloseButton={true}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              كلمة المرور الحالية
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              كلمة المرور الجديدة (6 خانات على الأقل)
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              تأكيد كلمة المرور الجديدة
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowPasswordModal(false)}
              disabled={changingPassword}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
