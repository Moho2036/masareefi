import React, { useState } from 'react'
import {
  Pencil,
  LogOut,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Database,
  KeyRound,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { updateUserDisplayName, sendUserEmailVerification } from '../../services/auth'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { User } from 'firebase/auth'
import type { UserSettings } from '../../types'

export interface ProfileSectionProps {
  user: User | null
  settings: UserSettings | null | undefined
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onOpenPasswordModal: () => void
  onSignOut: () => Promise<void>
  loggingOut: boolean
  displayNameInput?: string
  setDisplayNameInput?: (val: string) => void
  effectiveDisplayName?: string
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  user,
  settings,
  updateSettings,
  showToast,
  onOpenPasswordModal,
  onSignOut,
  loggingOut,
  displayNameInput: propDisplayNameInput,
  setDisplayNameInput: propSetDisplayNameInput,
  effectiveDisplayName: propEffectiveDisplayName,
}) => {
  const avatarColors = ['#2563EB', '#059669', '#DC2626', '#D97706', '#7C3AED', '#DB2777']

  const defaultEffectiveDisplayName =
    settings?.displayName?.trim() || user?.displayName?.trim() || user?.email?.split('@')[0] || 'المستخدم'
  const effectiveDisplayName = propEffectiveDisplayName ?? defaultEffectiveDisplayName

  const [isEditingName, setIsEditingName] = useState(false)
  const [internalDisplayNameInput, setInternalDisplayNameInput] = useState(effectiveDisplayName)
  const displayNameInput = propDisplayNameInput !== undefined ? propDisplayNameInput : internalDisplayNameInput
  const setDisplayNameInput = propSetDisplayNameInput || setInternalDisplayNameInput
  const [savingName, setSavingName] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)

  const isGoogleOnly = Boolean(
    user?.providerData?.length === 1 && user.providerData[0].providerId === 'google.com'
  )

  const userCreationDate = user?.metadata?.creationTime
    ? toWesternDigits(new Date(user.metadata.creationTime).toLocaleDateString('ar-JO', {
        year: 'numeric',
        month: 'short',
      }))
    : null

  const handleSaveDisplayName = async () => {
    const trimmed = displayNameInput.trim()
    if (!trimmed) {
      showToast('يرجى إدخال اسم صالح', 'error')
      return
    }
    if (trimmed === effectiveDisplayName) {
      setIsEditingName(false)
      return
    }
    setSavingName(true)
    try {
      if (user) {
        await updateUserDisplayName(user, trimmed)
      }
      await updateSettings({ displayName: trimmed })
      showToast('تم تحديث الاسم بنجاح', 'success')
      setIsEditingName(false)
    } catch (err) {
      console.error('Failed to update display name:', err)
      showToast('تعذر تحديث الاسم', 'error')
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarColorSelect = async (color: string) => {
    try {
      await updateSettings({ avatarColor: color })
      showToast('تم تحديث لون الصورة الرمزية', 'success')
    } catch (err) {
      console.error('Failed to update avatar color:', err)
      showToast('تعذر تحديث اللون', 'error')
    }
  }

  const handleSendVerificationEmail = async () => {
    try {
      await sendUserEmailVerification()
      showToast('تم إرسال رابط تأكيد البريد الإلكتروني إلى صندوقك', 'success')
    } catch (err) {
      console.error('Failed to send verification email:', err)
      showToast('تعذر إرسال رابط التأكيد، يرجى المحاولة لاحقاً', 'error')
    }
  }

  return (
    <>
      <Card title="الملف الشخصي والهوية" subtitle="بيانات حسابك، لون الرمز الشخصي، وحالة التحقق">
        <div className="pt-2 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={effectiveDisplayName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover shadow-xs shrink-0 border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <div
                  style={{ backgroundColor: settings?.avatarColor || undefined }}
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-xs shrink-0 transition-colors',
                    !settings?.avatarColor && 'bg-blue-600'
                  )}
                >
                  {effectiveDisplayName.charAt(0) || 'ب'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2 max-w-sm">
                    <Input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="أدخل اسمك"
                      maxLength={100}
                      className="text-xs sm:text-sm py-1.5 font-sans"
                      autoFocus
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveDisplayName}
                      disabled={savingName || !displayNameInput.trim()}
                      className="shrink-0 text-xs font-bold"
                    >
                      {savingName ? 'جاري الحفظ...' : 'حفظ'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDisplayNameInput(effectiveDisplayName)
                        setIsEditingName(false)
                      }}
                      disabled={savingName}
                      className="shrink-0 text-xs"
                    >
                      إلغاء
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-black text-zinc-900 dark:text-zinc-50 truncate">
                      {effectiveDisplayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="تعديل الاسم"
                      aria-label="تعديل الاسم"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate" dir="ltr">
                    {user?.email || 'بدون بريد إلكتروني'}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {user?.providerData?.some((p) => p.providerId === 'google.com')
                      ? 'حساب Google'
                      : 'حساب بريد إلكتروني'}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<LogOut className="w-4 h-4 rtl:rotate-180" />}
              onClick={() => setShowSignOutModal(true)}
              className="shrink-0 font-bold"
            >
              تسجيل الخروج
            </Button>
          </div>

          {/* Avatar Color Palette */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              تخصيص لون الصورة الرمزية:
            </span>
            <div className="flex items-center gap-2">
              {avatarColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleAvatarColorSelect(color)}
                  className={`w-7 h-7 rounded-xl border-2 transition-transform cursor-pointer ${
                    settings?.avatarColor === color
                      ? 'border-zinc-900 dark:border-white scale-110 shadow-xs'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Email Verification & Cloud Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  حالة البريد الإلكتروني
                </span>
              </div>
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  مؤكد
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    غير مؤكد
                  </span>
                  <button
                    type="button"
                    onClick={handleSendVerificationEmail}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                  >
                    إرسال الرابط
                  </button>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  المزامنة السحابية
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                متصل بالسحابة
              </span>
            </div>
          </div>

          {/* Account Details & Change Password */}
          <div className="flex items-center justify-between pt-2 text-xs text-zinc-400 dark:text-zinc-500 flex-wrap gap-2">
            <div>
              {userCreationDate && <span>عضو منذ: {userCreationDate}</span>}
            </div>
            {!isGoogleOnly && (
              <Button
                variant="ghost"
                size="sm"
                icon={<KeyRound className="w-3.5 h-3.5 text-zinc-500" />}
                onClick={onOpenPasswordModal}
                className="text-xs font-bold"
              >
                تغيير كلمة المرور
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Sign Out Confirmation Modal */}
      <Modal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        enableHistoryBack={false}
        title="تأكيد تسجيل الخروج"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟ بياناتك محفوظة بأمان على السحابة وستتمكن من الوصول إليها فور تسجيل الدخول مجدداً.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowSignOutModal(false)}
              disabled={loggingOut}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={onSignOut}
              disabled={loggingOut}
            >
              {loggingOut ? 'جاري تسجيل الخروج...' : 'تسجيل الخروج'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
