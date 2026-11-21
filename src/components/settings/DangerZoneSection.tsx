import React, { useState, useRef } from 'react'
import { Trash2, Download } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import {
  deleteUserAccount,
  reauthenticateCurrentPassword,
  reauthenticateCurrentGoogle,
} from '../../services/auth'
import { resetUserData, deleteUserFirestoreData } from '../../services/userProfile'
import { clearWorkHoursPrefs } from '../tools/workHours/workHoursPrefs'
import type { User } from 'firebase/auth'

export interface DangerZoneSectionProps {
  user: User | null
  isOnline: boolean
  exportingJson: boolean
  onDownloadBackup: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  refreshData?: () => void | Promise<void>
  showReauthModal?: boolean
  setShowReauthModal?: (val: boolean) => void
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  user,
  isOnline,
  exportingJson,
  onDownloadBackup,
  showToast,
  refreshData,
  showReauthModal: propShowReauthModal,
  setShowReauthModal: propSetShowReauthModal,
}) => {
  // Danger Zone states
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resettingData, setResettingData] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Re-auth modal for account deletion or sensitive actions
  const [internalShowReauthModal, setInternalShowReauthModal] = useState(false)
  const showReauthModal = propShowReauthModal !== undefined ? propShowReauthModal : internalShowReauthModal
  const setShowReauthModal = propSetShowReauthModal || setInternalShowReauthModal
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthenticating, setReauthenticating] = useState(false)
  const reauthenticatedAtRef = useRef<number>(0)
  const pendingActionRef = useRef<'delete-account' | null>(null)

  const hasGoogleProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === 'google.com')
  )
  const hasPasswordProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === 'password')
  )
  const isGoogleOnly = Boolean(hasGoogleProvider && !hasPasswordProvider)

  const handleResetUserData = async () => {
    if (!user || resetConfirmText.trim() !== 'تصفير') return
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      showToast('يجب الاتصال بالإنترنت لإتمام تصفير البيانات', 'error')
      return
    }
    setResettingData(true)
    try {
      await resetUserData(user.uid)
      clearWorkHoursPrefs()
      showToast('تم تصفير جميع المعاملات والديون والجمعيات بنجاح', 'success')
      setShowResetModal(false)
      setResetConfirmText('')
      refreshData?.()
    } catch (err) {
      console.error('Failed to reset data:', err)
      showToast('تعذر تصفير البيانات، يرجى المحاولة لاحقاً', 'error')
    } finally {
      setResettingData(false)
    }
  }

  const executeAccountDeletion = async () => {
    if (!user) return
    setDeletingAccount(true)
    try {
      // 1. Force fresh token validation
      await user.getIdToken(true)

      // 2. Wipe Firestore data while credentials are guaranteed active
      await deleteUserFirestoreData(user.uid)

      // 3. Immediately delete Firebase Auth account
      await deleteUserAccount()

      if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(localStorage).forEach((k) => {
          if (k.includes(user.uid)) localStorage.removeItem(k)
        })
        clearWorkHoursPrefs()
      }
      showToast('تم حذف الحساب نهائياً، نتمنى رؤيتك قريباً', 'info')
    } catch (err: unknown) {
      console.error('Failed to delete account:', err)
      const errorObj = err as { code?: string }
      if (errorObj?.code === 'auth/requires-recent-login') {
        pendingActionRef.current = 'delete-account'
        setShowDeleteModal(false)
        setShowReauthModal(true)
      } else {
        showToast('تعذر حذف الحساب، يرجى إعادة تسجيل الدخول والمحاولة ثانية', 'error')
      }
    } finally {
      setDeletingAccount(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      showToast('يجب الاتصال بالإنترنت لإتمام حذف الحساب', 'error')
      return
    }
    if (deleteConfirmText.trim() !== 'حذف نهائي') return

    const ONE_MINUTE_MS = 60 * 1000
    const elapsedSinceReauth = Date.now() - reauthenticatedAtRef.current
    if (elapsedSinceReauth > ONE_MINUTE_MS) {
      pendingActionRef.current = 'delete-account'
      setShowDeleteModal(false)
      setShowReauthModal(true)
      return
    }

    await executeAccountDeletion()
  }

  const handleReauthWithPassword = async () => {
    if (!user) return
    if (!reauthPassword.trim()) {
      showToast('يرجى إدخال كلمة المرور', 'error')
      return
    }
    setReauthenticating(true)
    try {
      await reauthenticateCurrentPassword(reauthPassword)
      reauthenticatedAtRef.current = Date.now()
      setShowReauthModal(false)
      setReauthPassword('')
      if (pendingActionRef.current === 'delete-account') {
        pendingActionRef.current = null
        setShowDeleteModal(true)
        setDeleteConfirmText('')
        showToast('تم تأكيد الهوية بنجاح، يرجى تأكيد حذف الحساب نهائياً', 'info')
      } else {
        showToast('تم تأكيد الهوية بنجاح، يمكنك متابعة الإجراء الآن', 'success')
      }
    } catch (err) {
      console.error('Password re-auth failed:', err)
      showToast('كلمة المرور غير صحيحة، يرجى التحقق والمحاولة ثانية', 'error')
    } finally {
      setReauthenticating(false)
    }
  }

  const handleReauthWithGoogle = async () => {
    if (!user) return
    setReauthenticating(true)
    try {
      await reauthenticateCurrentGoogle()
      reauthenticatedAtRef.current = Date.now()
      setShowReauthModal(false)
      if (pendingActionRef.current === 'delete-account') {
        pendingActionRef.current = null
        setShowDeleteModal(true)
        setDeleteConfirmText('')
        showToast('تم تأكيد الهوية بنجاح، يرجى تأكيد حذف الحساب نهائياً', 'info')
      } else {
        showToast('تم تأكيد الهوية بنجاح، يمكنك متابعة الإجراء الآن', 'success')
      }
    } catch (err) {
      console.error('Google re-auth failed:', err)
      showToast('فشل تأكيد الهوية عبر Google، يرجى المحاولة مرة أخرى', 'error')
    } finally {
      setReauthenticating(false)
    }
  }

  return (
    <>
      <Card
        title="منطقة الخطر"
        subtitle="الإجراءات الحساسة التي تؤدي إلى تصفير البيانات أو حذف الحساب"
        className="border-red-200 dark:border-red-950/60"
      >
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 pt-1">
          {/* Action 1: Reset Data */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-2">
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                تصفير بيانات الحساب (Reset Data)
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                حذف جميع المعاملات والديون والجمعيات والمتكررات وتصفير الرصيد، مع الإبقاء على حسابك وتصنيفاتك وإعداداتك.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setShowResetModal(true)}
              className="shrink-0 font-bold text-xs"
            >
              تصفير البيانات
            </Button>
          </div>

          {/* Action 2: Delete Account Permanently */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                حذف الحساب نهائياً (Delete Account)
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                حذف حسابك السحابي وكافة بياناتك وتصنيفاتك وملفك الشخصي نهائياً من خوادمنا بلا أي إمكانية للاسترجاع.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setShowDeleteModal(true)}
              className="shrink-0 font-bold text-xs bg-red-700 hover:bg-red-800"
            >
              حذف الحساب نهائياً
            </Button>
          </div>
        </div>
      </Card>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false)
          setResetConfirmText('')
        }}
        enableHistoryBack={false}
        title="تأكيد تصفير بيانات الحساب"
        hideCloseButton={true}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300 leading-relaxed">
            <span className="font-bold block mb-1">تحذير لا رجعة فيه:</span>
            سيتم حذف كافة المعاملات والديون والجمعيات والمعاملات المتكررة وتصفير الرصيد الافتتاحي. سيتم الاحتفاظ بحسابك الشخصي وتصنيفاتك وإعدادات المظهر والعملة.
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              ننصح بحفظ نسخة احتياطية من بياناتك قبل المتابعة:
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={onDownloadBackup}
              disabled={exportingJson || !user}
              className="font-bold text-xs shrink-0"
            >
              {exportingJson ? 'جارٍ التنزيل...' : 'تنزيل نسخة احتياطية أولاً'}
            </Button>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              للتأكيد، اكتب كلمة <span className="text-red-600 font-black">"تصفير"</span> في الحقل أدناه:
            </label>
            <Input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="تصفير"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setShowResetModal(false)
                setResetConfirmText('')
              }}
              disabled={resettingData}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleResetUserData}
              disabled={resetConfirmText.trim() !== 'تصفير' || resettingData}
            >
              {resettingData ? 'جارٍ تصفير البيانات...' : 'تأكيد تصفير كافة البيانات'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeleteConfirmText('')
        }}
        enableHistoryBack={false}
        title="حذف الحساب نهائياً"
        hideCloseButton={true}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-300 leading-relaxed">
            <span className="font-bold block mb-1">إجراء نهائي ومدمر:</span>
            سيتم مسح حسابك وكافة بياناتك المالية والتصنيفات والسجلات نهائياً من خوادم السحابة. لن تتمكن من استرجاع أي بيانات بعد هذا الإجراء.
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              للتأكيد، اكتب عبارة <span className="text-red-600 font-black">"حذف نهائي"</span> أدناه:
            </label>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="حذف نهائي"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setShowDeleteModal(false)
                setDeleteConfirmText('')
              }}
              disabled={deletingAccount}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText.trim() !== 'حذف نهائي' || deletingAccount}
            >
              {deletingAccount ? 'جارٍ حذف الحساب...' : 'حذف الحساب نهائياً'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Re-Authentication Modal */}
      <Modal
        isOpen={showReauthModal}
        onClose={() => {
          setShowReauthModal(false)
          pendingActionRef.current = null
        }}
        enableHistoryBack={false}
        title="تأكيد الهوية (إعادة تسجيل الدخول)"
        hideCloseButton={true}
      >
        <div className="space-y-4 text-start">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {isGoogleOnly
              ? 'يرجى تأكيد هويتك عبر حساب Google للمتابعة:'
              : 'يرجى تأكيد كلمة المرور للمتابعة:'}
          </p>

          {!isGoogleOnly && hasPasswordProvider && (
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                أدخل كلمة المرور الحالية لحسابك
              </label>
              <Input
                type="password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            {hasGoogleProvider && hasPasswordProvider && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReauthWithGoogle}
                disabled={reauthenticating}
                className="w-full sm:w-auto"
              >
                {reauthenticating ? 'جارٍ التحقق...' : 'إعادة التحقق عبر Google'}
              </Button>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowReauthModal(false)
                  pendingActionRef.current = null
                }}
                disabled={reauthenticating}
              >
                إلغاء
              </Button>
              {isGoogleOnly ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReauthWithGoogle}
                  disabled={reauthenticating}
                >
                  {reauthenticating ? 'جارٍ التحقق...' : 'تأكيد الهوية عبر حساب Google'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReauthWithPassword}
                  disabled={reauthenticating || !reauthPassword.trim()}
                >
                  {reauthenticating ? 'جارٍ التحقق...' : 'تأكيد ومتابعة'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
