import React, { useState, useRef, useContext } from 'react'
import {
  Sun,
  Moon,
  Laptop,
  Coins,
  LogOut,
  Download,
  Upload,
  Database,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Smartphone,
  Share2,
  PlusSquare,
  Pencil,
  EyeOff,
  KeyRound,
  Fingerprint,
  Trash2,
  Info,
  Lock,
  Mail,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Toggle } from '../components/ui/Toggle'
import { Modal } from '../components/ui/Modal'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useToast } from '../hooks/useToast'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { SelectedMonthContext } from '../hooks/useSelectedMonth'
import { AppDataContext } from '../context/AppDataContext'
import { registerBiometricCredential } from '../components/security/PinLockGate'
import { toWesternDigits, getFinancialMonthRange } from '../lib/dates'
import {
  signOutUser,
  updateUserDisplayName,
  sendUserEmailVerification,
  changeUserPassword,
  reauthenticateCurrentPassword,
  reauthenticateCurrentGoogle,
  deleteUserAccount,
} from '../services/auth'
import { getAllTransactions, addTransaction } from '../services/transactions'
import { getAllDebts } from '../services/debts'
import { processDueRecurring } from '../services/recurring'
import { resetUserData, deleteUserFirestoreData } from '../services/userProfile'
import {
  exportTransactionsToCsv,
  exportDebtsToCsv,
  exportRecurringToCsv,
  exportCirclesToCsv,
} from '../lib/exportCsv'
import {
  createFullBackup,
  downloadBackupFile,
  validateBackup,
  restoreBackup,
  type BackupValidationResult,
  type RestoreMode,
} from '../lib/backupRestore'
import { PRESET_CURRENCIES, getCurrencyConfig, toFils, fromFils } from '../lib/money'
import { cn } from '../lib/cn'
import type { ThemePreference, NotificationPrefs } from '../types'

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { user } = useAuth()
  const uid = user?.uid
  const isOnline = useOnlineStatus()
  const { data: settings, updateSettings } = useUserSettings()
  const { data: categories } = useCategories()
  const { data: recurring } = useRecurring()
  const { data: moneyCircles } = useMoneyCircles()
  const { showToast } = useToast()
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall()
  const selectedMonth = useContext(SelectedMonthContext)
  const appData = useContext(AppDataContext)
  const refreshData = selectedMonth?.refreshData

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [showManualInstallGuide, setShowManualInstallGuide] = useState(false)

  // Export & Backup states
  const [exportingTxs, setExportingTxs] = useState(false)
  const [exportingDebts, setExportingDebts] = useState(false)
  const [exportingRecurring, setExportingRecurring] = useState(false)
  const [exportingCircles, setExportingCircles] = useState(false)
  const [exportingJson, setExportingJson] = useState(false)
  const [restoringJson, setRestoringJson] = useState(false)
  const [restoreValidation, setRestoreValidation] = useState<BackupValidationResult | null>(null)
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Currency states
  const activeCurrency = settings?.currency || 'JOD'
  const isPreset = Boolean(PRESET_CURRENCIES[activeCurrency])
  const [isCustomCurrency, setIsCustomCurrency] = useState(!isPreset && activeCurrency !== 'JOD')
  const [customCurrencyInput, setCustomCurrencyInput] = useState(isPreset ? '' : activeCurrency)
  const [customDecimals, setCustomDecimals] = useState<number>(settings?.customCurrencyDecimals ?? 2)
  const [savingCurrency, setSavingCurrency] = useState(false)

  const [prevCurrency, setPrevCurrency] = useState(settings?.currency)
  if (settings?.currency !== prevCurrency) {
    setPrevCurrency(settings?.currency)
    const isCustom = settings?.currency ? !PRESET_CURRENCIES[settings.currency] : false
    setIsCustomCurrency(isCustom)
    setCustomCurrencyInput(isCustom ? settings?.currency || '' : '')
  }

  const [prevMonthStartDay, setPrevMonthStartDay] = useState(settings?.monthStartDay)
  if (settings?.monthStartDay !== prevMonthStartDay) {
    setPrevMonthStartDay(settings?.monthStartDay)
    if (settings?.monthStartDay !== undefined) {
      setSelectedDay(String(settings.monthStartDay))
    }
  }

  // Display Name state
  const effectiveDisplayName = settings?.displayName?.trim() || user?.displayName?.trim() || 'مستخدم بَصير'
  const [isEditingName, setIsEditingName] = useState(false)
  const [displayNameInput, setDisplayNameInput] = useState(
    settings?.displayName?.trim() || user?.displayName?.trim() || ''
  )
  const [savingName, setSavingName] = useState(false)

  const [prevDisplayName, setPrevDisplayName] = useState(settings?.displayName)
  if (settings?.displayName !== prevDisplayName) {
    setPrevDisplayName(settings?.displayName)
    setDisplayNameInput(settings?.displayName?.trim() || user?.displayName?.trim() || '')
  }

  // Password Change Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Balance Reconciliation Modal state
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [reconcileAmount, setReconcileAmount] = useState(
    settings?.openingBalanceFils ? String(fromFils(settings.openingBalanceFils)) : ''
  )
  const [savingReconcile, setSavingReconcile] = useState(false)

  // PIN Lock & Security state
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
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinConfirmInput, setPinConfirmInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  // Danger Zone states
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resettingData, setResettingData] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Re-auth modal for account deletion or sensitive actions
  const [showReauthModal, setShowReauthModal] = useState(false)
  const [reauthPassword, setReauthPassword] = useState('')
  const [reauthenticating, setReauthenticating] = useState(false)

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

  // Handlers
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
      await updateSettings({ displayName: trimmed })
      if (user) {
        await updateUserDisplayName(user, trimmed).catch(() => {})
      }
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
    }
  }

  const handleSendVerificationEmail = async () => {
    if (!user) return
    try {
      await sendUserEmailVerification()
      showToast('تم إرسال رابط تأكيد البريد الإلكتروني إلى صندوق الوارد', 'success')
    } catch (err) {
      console.error('Failed to send verification email:', err)
      showToast('تعذر إرسال رابط التحقق، يرجى المحاولة لاحقاً', 'error')
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
      if (errorObj?.code === 'auth/requires-recent-login' || errorObj?.code === 'auth/wrong-password') {
        showToast('كلمة المرور الحالية غير صحيحة أو يتطلب الإجراء إعادة تسجيل الدخول', 'error')
        setShowPasswordModal(false)
        setShowReauthModal(true)
      } else {
        showToast('تعذر تغيير كلمة المرور، يرجى التحقق والمحاولة ثانية', 'error')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  const activeConfig = getCurrencyConfig(activeCurrency, settings?.customCurrencyDecimals)

  const handleSelectPreset = async (code: string) => {
    setIsCustomCurrency(false)
    if (code === activeCurrency) return
    try {
      const payload: { currency: string; customCurrencyDecimals?: number | null } = { currency: code }
      if (settings?.customCurrencyDecimals !== undefined) {
        payload.customCurrencyDecimals = null
      }
      await updateSettings(payload)
      showToast(`تم تغيير العملة إلى ${PRESET_CURRENCIES[code]?.name || code} بنجاح`, 'success')
    } catch (err) {
      console.error('Failed to update currency:', err)
      showToast('تعذر تغيير العملة', 'error')
    }
  }

  const handleSaveCustomCurrency = async () => {
    const trimmed = customCurrencyInput.trim()
    if (!trimmed) return
    const resolved = getCurrencyConfig(trimmed)
    if (PRESET_CURRENCIES[resolved.code]) {
      setIsCustomCurrency(false)
      setCustomCurrencyInput('')
      if (resolved.code === activeCurrency) return
      setSavingCurrency(true)
      try {
        await updateSettings({ currency: resolved.code, customCurrencyDecimals: undefined })
        showToast(`تم تغيير العملة إلى ${PRESET_CURRENCIES[resolved.code]?.name || resolved.code} بنجاح`, 'success')
      } catch (err) {
        console.error('Failed to update currency:', err)
        showToast('تعذر تغيير العملة', 'error')
      } finally {
        setSavingCurrency(false)
      }
      return
    }

    if (trimmed === activeCurrency && settings?.customCurrencyDecimals === customDecimals) return
    setSavingCurrency(true)
    try {
      await updateSettings({ currency: trimmed, customCurrencyDecimals: customDecimals })
      showToast(`تم تعيين العملة المخصصة: ${trimmed}`, 'success')
      setIsCustomCurrency(true)
    } catch (err) {
      console.error('Failed to save custom currency:', err)
      showToast('تعذر حفظ العملة المخصصة', 'error')
    } finally {
      setSavingCurrency(false)
    }
  }

  const currentStartDay =
    selectedDay ?? (settings?.monthStartDay ? String(settings.monthStartDay) : '1')

  const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'تلقائي', icon: <Laptop className="w-4 h-4" /> },
    { value: 'light', label: 'فاتح', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'داكن', icon: <Moon className="w-4 h-4" /> },
  ]

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `يوم ${i + 1} من كل شهر`,
  }))

  const handleThemeChange = async (newTheme: ThemePreference) => {
    if (newTheme === theme) return
    setTheme(newTheme)
    try {
      await updateSettings({ theme: newTheme })
    } catch (err) {
      console.error('Failed to persist theme:', err)
    }
  }

  const handleStartDayChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const parsed = parseInt(val, 10)
    const currentSaved = settings?.monthStartDay ?? 1
    if (parsed === currentSaved) {
      setSelectedDay(val)
      return
    }
    setSelectedDay(val)
    try {
      await updateSettings({ monthStartDay: parsed })
      showToast(`تم تعيين بداية الشهر المالي إلى يوم ${parsed} من كل شهر`, 'success')
    } catch (err) {
      console.error('Failed to persist month start day:', err)
    }
  }

  const handleToggleRollover = async (checked: boolean) => {
    try {
      await updateSettings({ rolloverBalance: checked })
      showToast(
        checked
          ? 'تم تفعيل ترحيل الرصيد المتبقي تلقائياً'
          : 'تم إيقاف ترحيل الرصيد، يعتمد التطبيق الآن على كل شهر منفصلاً',
        'success'
      )
    } catch (err) {
      console.error('Failed to toggle rollover balance:', err)
      showToast('تعذر تحديث إعدادات ترحيل الرصيد', 'error')
    }
  }

  const handleToggleRolloverStartDate = async (checked: boolean) => {
    try {
      const currentCycleStart =
        selectedMonth?.range?.start ??
        getFinancialMonthRange(new Date(), settings?.monthStartDay ?? 1).start
      const nextDate = checked ? currentCycleStart : null
      await updateSettings({ rolloverStartDate: nextDate })
      showToast(
        checked
          ? 'تم تصفير العجز/الفائض السابق، وسيبدأ احتساب الترحيل من دورة هذا الشهر فصاعداً'
          : 'تم إلغاء القيد وسيعتمد الترحيل على كافة المعاملات السابقة',
        'success'
      )
    } catch (err) {
      console.error('Failed to toggle rollover start date:', err)
    }
  }

  const handleSaveReconciliation = async () => {
    if (!uid) return
    const trimmed = reconcileAmount.trim()
    if (!trimmed || trimmed.startsWith('-')) {
      showToast('يرجى إدخال مبلغ صالح', 'error')
      return
    }
    const decimals = settings?.customCurrencyDecimals ?? PRESET_CURRENCIES[activeCurrency]?.decimals ?? 3
    const targetFils = toFils(trimmed, decimals)
    if (isNaN(targetFils) || targetFils < 0) {
      showToast('يرجى إدخال مبلغ صالح', 'error')
      return
    }
    setSavingReconcile(true)
    try {
      const currentCycle =
        selectedMonth?.range ??
        getFinancialMonthRange(new Date(), settings?.monthStartDay ?? 1)

      const allTxs = await getAllTransactions(uid)
      const relevantTxs = allTxs.filter((tx) => {
        const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
        if (settings?.rolloverBalance === false) {
          return txDate >= currentCycle.start && txDate < currentCycle.end
        }
        if (settings?.rolloverStartDate) {
          const rawStart = settings.rolloverStartDate
          const startDate =
            rawStart instanceof Date
              ? rawStart
              : typeof (rawStart as { toDate?: () => Date }).toDate === 'function'
              ? (rawStart as { toDate: () => Date }).toDate()
              : new Date(rawStart as unknown as string | number)
          return txDate >= startDate
        }
        return true
      })

      const netTxFils = relevantTxs.reduce((acc, tx) => {
        return tx.type === 'income' ? acc + tx.amountFils : acc - tx.amountFils
      }, 0)

      const requiredOpening = targetFils - netTxFils

      if (requiredOpening >= 0) {
        await updateSettings({ openingBalanceFils: requiredOpening })
      } else {
        await updateSettings({ openingBalanceFils: 0 })
        const diffExpenseFils = -requiredOpening
        const expenseCategory =
          categories.find((c) => c.type === 'expense' && (c.name === 'أخرى' || c.name.includes('أخرى'))) ||
          categories.find((c) => c.type === 'expense')

        if (expenseCategory) {
          await addTransaction(uid, {
            type: 'expense',
            amountFils: diffExpenseFils,
            categoryId: expenseCategory.id,
            title: 'تسوية رصيد (فرق جرد)',
            note: 'معاملة تسوية مسجلة آلياً لمطابقة الرصيد الفعلي',
            date: new Date(),
          })
        }
      }

      showToast('تمت تسوية وتحديث الرصيد الفعلي بنجاح', 'success')
      setShowReconcileModal(false)
      refreshData?.()
      if (appData) {
        // AppDataContext active
      }
    } catch (err) {
      console.error('Failed to reconcile balance:', err)
      showToast('تعذر تحديث الرصيد', 'error')
    } finally {
      setSavingReconcile(false)
    }
  }

  const handleUpdateNotificationPref = async (partial: Partial<NotificationPrefs>) => {
    // Request browser notification permission safely if supported and currently default
    if (
      (partial.dailyReminder === true ||
        partial.debtReminders === true ||
        partial.circleAlerts === true ||
        partial.budgetWarnings === true ||
        partial.autoPayments === true) &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission()
      } catch {
        // ignore
      }
    }

    const currentPrefs = settings?.notificationPrefs || {}
    const nextPrefs: NotificationPrefs = { ...currentPrefs, ...partial }
    try {
      await updateSettings({ notificationPrefs: nextPrefs })
      showToast('تم تحديث تفضيلات التنبيهات', 'success')
    } catch (err) {
      console.error('Failed to update notification prefs:', err)
    }
  }

  // PIN setup
  const handleSavePin = async () => {
    setPinError(null)
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      setPinError('رمز PIN يجب أن يتكون من 4 أرقام')
      return
    }
    if (pinInput !== pinConfirmInput) {
      setPinError('رمزا الدخول غير متطابقين')
      return
    }
    if (!pinKey) return

    try {
      const hash = await hashPin(pinInput)
      localStorage.setItem(pinKey, hash)
      if (legacyPinKey) {
        localStorage.setItem(legacyPinKey, hash)
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

  // Sign out
  const handleSignOut = async () => {
    setLoggingOut(true)
    try {
      await signOutUser()
    } catch (err) {
      console.error('Failed to sign out:', err)
    } finally {
      setLoggingOut(false)
      setShowSignOutModal(false)
    }
  }

  // CSV Exports
  const handleExportTransactions = async () => {
    if (!user) return
    setExportingTxs(true)
    try {
      const txs = await getAllTransactions(user.uid)
      if (txs.length === 0) {
        showToast('لا توجد أي معاملات لتصديرها', 'info')
        return
      }
      exportTransactionsToCsv(txs, categories, {
        symbol: activeConfig.symbol,
        decimals: activeConfig.decimals,
      })
      showToast('تم تصدير المعاملات بنجاح', 'success')
    } catch (err) {
      console.error('Failed to export transactions:', err)
      showToast('تعذر تصدير المعاملات', 'error')
    } finally {
      setExportingTxs(false)
    }
  }

  const handleExportDebts = async () => {
    if (!user) return
    setExportingDebts(true)
    try {
      const debts = await getAllDebts(user.uid)
      if (debts.length === 0) {
        showToast('لا توجد أي ديون لتصديرها', 'info')
        return
      }
      exportDebtsToCsv(debts, {
        symbol: activeConfig.symbol,
        decimals: activeConfig.decimals,
      })
      showToast('تم تصدير سجل الديون بنجاح', 'success')
    } catch (err) {
      console.error('Failed to export debts:', err)
      showToast('تعذر تصدير سجل الديون', 'error')
    } finally {
      setExportingDebts(false)
    }
  }

  const handleExportRecurring = () => {
    if (!recurring || recurring.length === 0) {
      showToast('لا توجد أي معاملات متكررة لتصديرها', 'info')
      return
    }
    setExportingRecurring(true)
    try {
      exportRecurringToCsv(recurring, categories, {
        symbol: activeConfig.symbol,
        decimals: activeConfig.decimals,
      })
      showToast('تم تصدير المعاملات المتكررة بنجاح', 'success')
    } catch (err) {
      console.error('Failed to export recurring:', err)
    } finally {
      setExportingRecurring(false)
    }
  }

  const handleExportCircles = () => {
    if (!moneyCircles || moneyCircles.length === 0) {
      showToast('لا توجد أي جمعيات لتصديرها', 'info')
      return
    }
    setExportingCircles(true)
    try {
      exportCirclesToCsv(moneyCircles, {
        symbol: activeConfig.symbol,
        decimals: activeConfig.decimals,
      })
      showToast('تم تصدير الجمعيات بنجاح', 'success')
    } catch (err) {
      console.error('Failed to export circles:', err)
    } finally {
      setExportingCircles(false)
    }
  }

  // Backup & Restore
  const handleDownloadJsonBackup = async () => {
    if (!user) return
    setExportingJson(true)
    try {
      const backup = await createFullBackup(user.uid)
      downloadBackupFile(backup)
      await updateSettings({ lastBackupAt: new Date().toISOString() })
      showToast('تم تنزيل النسخة الاحتياطية الشاملة بنجاح', 'success')
    } catch (err) {
      console.error('Failed to export full backup:', err)
      showToast('تعذر إنشاء النسخة الاحتياطية', 'error')
    } finally {
      setExportingJson(false)
    }
  }

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result
      if (typeof text !== 'string') return
      const res = validateBackup(text)
      if (!res.valid) {
        showToast(res.error || 'ملف غير صالح', 'error')
        return
      }
      setRestoreMode('merge')
      setRestoreValidation(res)
    }
    reader.onerror = () => {
      showToast('تعذر قراءة الملف المحدد', 'error')
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleConfirmRestore = async () => {
    if (!user || !restoreValidation?.data) return
    setRestoringJson(true)
    try {
      await restoreBackup(user.uid, restoreValidation.data, restoreMode)
      if (restoreValidation.data.data.settings?.displayName) {
        setDisplayNameInput(restoreValidation.data.data.settings.displayName)
      }
      showToast(
        restoreMode === 'merge'
          ? 'تم دمج النسخة الاحتياطية بنجاح!'
          : 'تمت استعادة النسخة الاحتياطية واستبدال البيانات بنجاح!',
        'success'
      )
      try {
        const executedCount = await processDueRecurring(user.uid)
        if (executedCount > 0) {
          showToast(
            `تم تنفيذ ${executedCount} معاملة متكررة مستحقة تلقائياً بعد الاستعادة!`,
            'info'
          )
        }
      } catch (recErr) {
        console.error('Failed to process due recurring after restore:', recErr)
      }
      refreshData?.()
      setRestoreValidation(null)
    } catch (err) {
      console.error('Failed to restore backup:', err)
      showToast('تعذر استعادة النسخة الاحتياطية', 'error')
    } finally {
      setRestoringJson(false)
    }
  }

  // Danger Zone Handlers
  const handleResetUserData = async () => {
    if (!user || resetConfirmText.trim() !== 'تصفير') return
    setResettingData(true)
    try {
      await resetUserData(user.uid)
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

  const handleDeleteAccount = async () => {
    if (!user) return
    if (!isOnline) {
      showToast('يجب الاتصال بالإنترنت لإتمام حذف الحساب', 'error')
      return
    }
    if (deleteConfirmText.trim() !== 'حذف نهائي') return

    setDeletingAccount(true)
    try {
      await deleteUserFirestoreData(user.uid)
      await deleteUserAccount()
      if (typeof window !== 'undefined' && window.localStorage) {
        Object.keys(localStorage).forEach((k) => {
          if (k.includes(user.uid)) localStorage.removeItem(k)
        })
      }
      showToast('تم حذف الحساب نهائياً، نتمنى رؤيتك قريباً', 'info')
    } catch (err: unknown) {
      console.error('Failed to delete account:', err)
      const errorObj = err as { code?: string }
      if (errorObj?.code === 'auth/requires-recent-login') {
        setShowDeleteModal(false)
        setShowReauthModal(true)
      } else {
        showToast('تعذر حذف الحساب، يرجى إعادة تسجيل الدخول والمحاولة ثانية', 'error')
      }
    } finally {
      setDeletingAccount(false)
    }
  }

  const handleReauthAndComplete = async () => {
    if (!user) return
    setReauthenticating(true)
    try {
      if (reauthPassword) {
        await reauthenticateCurrentPassword(reauthPassword)
      } else {
        await reauthenticateCurrentGoogle()
      }
      showToast('تم تأكيد الهوية بنجاح، يمكنك إعادة تنفيذ الإجراء الآن', 'success')
      setShowReauthModal(false)
      setReauthPassword('')
    } catch (err) {
      console.error('Re-auth failed:', err)
      showToast('فشل تأكيد الهوية، يرجى التحقق من كلمة المرور', 'error')
    } finally {
      setReauthenticating(false)
    }
  }

  const avatarColors = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899', '#18181b']
  const rawCreationDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('ar-JO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null
  const userCreationDate = rawCreationDate ? toWesternDigits(rawCreationDate) : null
  const isGoogleOnly = Boolean(
    user?.providerData?.length &&
      user.providerData.every((p) => p.providerId === 'google.com')
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-slide-up text-start">
      <PageHeader
        title="الإعدادات"
        subtitle="الملف الشخصي، المظهر والخصوصية، الدورة المالية، وتأمين الحساب"
      />

      {/* CARD 1: Profile & Identity */}
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
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  حالة البريد الإلكتروني
                </span>
              </div>
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  مؤكد
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-bold">
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

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  المزامنة السحابية
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-bold">
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
                onClick={() => setShowPasswordModal(true)}
                className="text-xs font-bold"
              >
                تغيير كلمة المرور
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* CARD 2: Appearance & Privacy Mode */}
      <Card
        title="المظهر والألوان ووضع الخصوصية"
        subtitle="السمة البصرية، إخفاء الأرصدة، وترتيب التصنيفات"
      >
        <div className="space-y-5 pt-2">
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              السمة البصرية للتطبيق
            </label>
            <SegmentedControl<ThemePreference>
              value={theme}
              onChange={handleThemeChange}
              options={themeOptions}
              className="w-full sm:w-auto"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              الوضع الحالي النشط:{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {resolvedTheme === 'dark' ? 'داكن' : 'فاتح'}
              </span>{' '}
              {theme === 'system' && '(تلقائي حسب النظام)'}
            </p>
          </div>

          {/* Privacy Mode Toggle */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="hide-balances-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>وضع الخصوصية وإخفاء الأرقام</span>
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                إخفاء قيم الأرصدة والمبالغ برمز (•••••) في جميع الشاشات.
              </p>
            </div>
            <Toggle
              id="hide-balances-toggle"
              checked={settings?.hideBalances ?? false}
              onChange={(checked) => updateSettings({ hideBalances: checked })}
            />
          </div>

          {/* Hide Zero Decimals Toggle */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="hide-zero-decimals-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>إخفاء الكسور الصفرية</span>
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                إخفاء الأصفار بعد الفاصلة في المبالغ الصحيحة (عرض 50 د.أ بدلاً من 50.000 د.أ).
              </p>
            </div>
            <Toggle
              id="hide-zero-decimals-toggle"
              checked={settings?.hideZeroDecimals ?? true}
              onChange={(checked) => updateSettings({ hideZeroDecimals: checked })}
            />
          </div>

          {/* Category Sort Mode */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="category-sort-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                ترتيب التصنيفات حسب الأكثر استخداماً
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                إظهار التصنيفات الأكثر استخداماً أولاً في القوائم.
              </p>
            </div>
            <Toggle
              id="category-sort-toggle"
              checked={settings?.categorySortMode !== 'manual'}
              onChange={(checked) => updateSettings({ categorySortMode: checked ? 'usage' : 'manual' })}
            />
          </div>
        </div>
      </Card>

      {/* CARD 3: Financial Cycle & Rollover */}
      <Card
        title="إعدادات الدورة المالية والترحيل"
        subtitle="يوم بداية الدورة المالية، ترحيل الرصيد، وتسوية الرصيد الفعلي"
      >
        <div className="pt-2 space-y-5">
          <div className="max-w-xs">
            <Select
              label="يوم بداية الدورة المالية"
              value={currentStartDay}
              onChange={handleStartDayChange}
              options={dayOptions}
              helperText="تبدأ جميع تقاريرك الشهرية وحسابات الصرف والحد اليومي الآمن من هذا اليوم (أقصى يوم هو 28 لضمان انتظام الحساب في شهر فبراير وكافة الأشهر)."
            />
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="rollover-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                ترحيل الرصيد المتبقي من الأشهر السابقة تلقائياً (Rollover)
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                ترحيل الفائض أو العجز المتراكم تلقائياً إلى رصيد الشهر التالي.
              </p>
            </div>
            <Toggle
              id="rollover-toggle"
              checked={settings?.rolloverBalance ?? true}
              onChange={handleToggleRollover}
            />
          </div>

          {/* Rollover Start Date Option */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="rollover-start-date-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                بدء احتساب الترحيل من هذا الشهر فقط (تصفير العجز السابق)
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                تصفير العجز السابق وبدء احتساب الترحيل من دورة هذا الشهر فصاعداً.
              </p>
            </div>
            <Toggle
              id="rollover-start-date-toggle"
              checked={Boolean(settings?.rolloverStartDate)}
              onChange={handleToggleRolloverStartDate}
            />
          </div>

          {/* Balance Reconciliation Button */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                تسوية وتعديل الرصيد الفعلي
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                الرصيد الافتتاحي المسجل حالياً:{' '}
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {settings?.openingBalanceFils ? fromFils(settings.openingBalanceFils) : 0} {activeConfig.symbol}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              onClick={() => setShowReconcileModal(true)}
              className="font-bold text-xs"
            >
              تسوية وتعديل الرصيد
            </Button>
          </div>
        </div>
      </Card>

      {/* CARD 4: Official Currency */}
      <Card
        title="العملة الرسمية والكسور"
        subtitle="اختر العملة المعتمدة في حساباتك وعدد المنازل العشرية"
      >
        <div className="space-y-4 pt-2">
          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {Object.values(PRESET_CURRENCIES).map((curr) => {
              const isSelected = !isCustomCurrency && activeCurrency === curr.code
              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => handleSelectPreset(curr.code)}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-2xl border text-start transition-all cursor-pointer',
                    isSelected
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  <span className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-black text-zinc-700 dark:text-zinc-300 select-none shrink-0">{curr.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{curr.name}</div>
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                      {curr.code} ({curr.symbol})
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Custom Currency Option */}
            <button
              type="button"
              onClick={() => setIsCustomCurrency(true)}
              className={cn(
                'flex items-center gap-2.5 p-3 rounded-2xl border text-start transition-all cursor-pointer',
                isCustomCurrency
                  ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              )}
            >
              <Coins className="w-5 h-5 text-zinc-500 dark:text-zinc-400 select-none shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">عملة أخرى</div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium truncate">
                  {isCustomCurrency && customCurrencyInput ? customCurrencyInput : 'تحديد يدوي'}
                </div>
              </div>
            </button>
          </div>

          {/* Custom Currency Details */}
          {isCustomCurrency && (
            <div className="p-4 rounded-2xl border border-dashed border-blue-300 dark:border-blue-800/70 bg-blue-50/40 dark:bg-blue-950/20 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5 items-end">
                <div className="flex-1 w-full">
                  <Input
                    label="رمز أو اسم العملة المخصصة"
                    placeholder="مثال: ج.م أو د.ك أو QAR أو ليرة"
                    value={customCurrencyInput}
                    onChange={(e) => setCustomCurrencyInput(e.target.value)}
                    maxLength={20}
                    helperText="سيظهر هذا الرمز بجانب جميع المبالغ المالية في التطبيق."
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={handleSaveCustomCurrency}
                    disabled={!customCurrencyInput.trim() || savingCurrency}
                    variant="primary"
                    className="w-full sm:w-auto font-bold"
                  >
                    {savingCurrency ? 'جاري الحفظ...' : 'تطبيق العملة'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsCustomCurrency(false)
                      setCustomCurrencyInput('')
                    }}
                    variant="outline"
                    className="w-full sm:w-auto font-bold"
                  >
                    إلغاء
                  </Button>
                </div>
              </div>

              {/* Decimals Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  عدد المنازل العشرية بعد الفاصلة
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 0, label: '0 خانات', desc: 'دون كسور (ليرة، دينار عراقي)' },
                    { val: 2, label: 'خانتان (2)', desc: 'الأغلبية (دولار، ريال)' },
                    { val: 3, label: '3 خانات', desc: 'فلس/مليم (دينار كويتي/أردني)' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setCustomDecimals(opt.val)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        customDecimals === opt.val
                          ? 'border-blue-500 bg-blue-600 text-white font-bold shadow-xs'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="text-xs font-black">{opt.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Coins className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              العملة النشطة الحالية:{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {activeConfig.name} ({activeConfig.symbol}) — {activeConfig.decimals} منازل عشرية
              </span>
            </span>
          </div>

          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1 leading-relaxed">
            ملاحظة: تغيير العملة يحدّث رمز وطريقة عرض المبالغ فقط ولا يقوم بتحويل الأرقام المسجلة سابقاً بأسعار الصرف.
          </p>
        </div>
      </Card>

      {/* CARD 5: Notification Preferences */}
      <Card
        title="مركز التنبيهات والإشعارات"
        subtitle="تخصيص الإشعارات التلقائية للتسديد، الديون، الجمعيات، والميزانية"
      >
        <div className="space-y-4 pt-2">
          {/* Auto Payments */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="pref-auto-payments" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                تنبيهات المعاملات الدورية والتسديد التلقائي
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                إشعارك عند استحقاق الفواتير والاشتراكات الدورية أو تنفيذها تلقائياً.
              </p>
            </div>
            <Toggle
              id="pref-auto-payments"
              checked={settings?.notificationPrefs?.autoPayments ?? true}
              onChange={(checked) => handleUpdateNotificationPref({ autoPayments: checked })}
            />
          </div>

          {/* Debt Reminders */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <label htmlFor="pref-debt-reminders" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                  تذكير استحقاق الديون والقروض
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  تنبيهك قبل موعد سداد أو استرداد الديون لتفادي التأخير.
                </p>
              </div>
              <Toggle
                id="pref-debt-reminders"
                checked={settings?.notificationPrefs?.debtReminders ?? true}
                onChange={(checked) => handleUpdateNotificationPref({ debtReminders: checked })}
              />
            </div>

            {/* Reminder days selector */}
            {(settings?.notificationPrefs?.debtReminders ?? true) && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-zinc-600 dark:text-zinc-400 font-semibold">
                  التنبيه قبل الموعد بـ:
                </span>
                {[
                  { days: 0, label: 'في نفس اليوم' },
                  { days: 1, label: 'قبل يوم' },
                  { days: 3, label: 'قبل 3 أيام' },
                ].map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => handleUpdateNotificationPref({ debtReminderDaysBefore: opt.days })}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      (settings?.notificationPrefs?.debtReminderDaysBefore ?? 3) === opt.days
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Money Circles Alerts */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="pref-circle-alerts" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                تنبيهات الجمعيات وموعد القبض
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                إشعارك عند حلول دورك في الاستلام، ومتابعة الأقساط المعلقة للأعضاء إذا كنت مدير الجمعية.
              </p>
            </div>
            <Toggle
              id="pref-circle-alerts"
              checked={settings?.notificationPrefs?.circleAlerts ?? true}
              onChange={(checked) => handleUpdateNotificationPref({ circleAlerts: checked })}
            />
          </div>

          {/* Budget Warnings */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="pref-budget-warnings" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                تحذيرات الميزانية وتجاوز الصرف
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                تنبيه ذكي عند استهلاك 80% من الميزانية أو توقع حدوث عجز في نهاية الشهر.
              </p>
            </div>
            <Toggle
              id="pref-budget-warnings"
              checked={settings?.notificationPrefs?.budgetWarnings ?? true}
              onChange={(checked) => handleUpdateNotificationPref({ budgetWarnings: checked })}
            />
          </div>

          {/* Daily Reminder */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="pref-daily-reminder" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                التذكير اليومي لتسجيل المصاريف
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                رسالة تذكير مسائية لتسجيل فواتير ومصاريف يومك للحفاظ على دقة السجلات.
              </p>
            </div>
            <Toggle
              id="pref-daily-reminder"
              checked={settings?.notificationPrefs?.dailyReminder ?? false}
              onChange={(checked) => handleUpdateNotificationPref({ dailyReminder: checked })}
            />
          </div>
        </div>
      </Card>

      {/* CARD 6: Security & App PIN Lock */}
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
                    onClick={handleRemovePin}
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
                <label htmlFor="biometrics-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-2">
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

      {/* CARD 7: PWA App Installation */}
      <Card
        title="تثبيت التطبيق (PWA)"
        subtitle="تثبيت تطبيق بَصير على هاتفك أو حاسوبك للعمل بدون إنترنت وسرعة فائقة"
      >
        <div className="pt-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {isInstalled ? 'التطبيق مثبت حالياً' : 'تطبيق ويب تقدمي (PWA)'}
                </div>
                <div className="text-xs text-zinc-400">
                  {isInstalled
                    ? 'يعمل التطبيق كبرنامج مستقل مع دعم كامل للعمل بلا اتصال'
                    : 'يعمل بكامل ميزاته مباشرة من الشاشة الرئيسية دون الحاجة للمتجر'}
                </div>
              </div>
            </div>

            {isInstalled ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>مثبت على الجهاز</span>
              </div>
            ) : isInstallable ? (
              <Button
                variant="primary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={promptInstall}
                className="font-bold"
              >
                تثبيت التطبيق على جهازك
              </Button>
            ) : isIOS ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 text-xs font-bold shrink-0">
                <Smartphone className="w-4 h-4" />
                <span>أجهزة آبل iOS</span>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManualInstallGuide((prev) => !prev)}
                className="font-bold text-xs shrink-0"
              >
                طريقة التثبيت اليدوي
              </Button>
            )}
          </div>

          {/* iOS Instructions */}
          {isIOS && !isInstalled && (
            <div className="p-4 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-sky-300">
                <Share2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>خطوات تثبيت التطبيق على الآيفون والآيباد (iOS Safari):</span>
              </div>
              <ol className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300 list-decimal list-inside ps-1">
                <li className="leading-relaxed">
                  اضغط على زر{' '}
                  <span className="font-bold text-zinc-900 dark:text-white inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                    المشاركة (Share <Share2 className="w-3 h-3 inline text-sky-500" />)
                  </span>{' '}
                  في شريط أدوات متصفح سفاري (Safari).
                </li>
                <li className="leading-relaxed">
                  مرر للأسفل في القائمة واختر{' '}
                  <span className="font-bold text-zinc-900 dark:text-white inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
                    "إضافة إلى الشاشة الرئيسية" (Add to Home Screen <PlusSquare className="w-3 h-3 inline text-emerald-500" />)
                  </span>.
                </li>
                <li className="leading-relaxed">
                  اضغط على <span className="font-bold text-zinc-900 dark:text-white">"إضافة" (Add)</span> في الزاوية العلوية ليظهر التطبيق كأيقونة مستقلة على شاشتك.
                </li>
              </ol>
            </div>
          )}

          {/* Manual Install Instructions for Chrome / Edge / Android */}
          {!isInstalled && !isInstallable && !isIOS && showManualInstallGuide && (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/80 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>خطوات التثبيت اليدوي عبر متصفح Chrome أو Edge أو أندرويد:</span>
              </div>
              <ol className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300 list-decimal list-inside ps-1">
                <li className="leading-relaxed">
                  اضغط على قائمة المتصفح (أيقونة الثلاث نقاط <span className="font-bold text-zinc-900 dark:text-white">⋮</span> أعلى أو أسفل الشاشة).
                </li>
                <li className="leading-relaxed">
                  اختر <span className="font-bold text-zinc-900 dark:text-white">"تثبيت التطبيق"</span> أو <span className="font-bold text-zinc-900 dark:text-white">"الإضافة إلى الشاشة الرئيسية" (Add to Home Screen)</span>.
                </li>
                <li className="leading-relaxed">
                  أكّد التثبيت ليظهر تطبيق بَصير مباشرة على جهازك ويعمل بدون إنترنت وبشاشة كاملة.
                </li>
              </ol>
            </div>
          )}
        </div>
      </Card>

      {/* CARD 8: Backup & CSV Exports */}
      <Card
        title="تصدير البيانات والنسخ الاحتياطي"
        subtitle="تصدير بياناتك المالية وسجلات الديون إلى ملفات Excel/CSV أو نسخ احتياطي شامل JSON"
      >
        <div className="pt-2 space-y-5">
          {/* JSON Full Backup */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/80 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  النسخ الاحتياطي الشامل (JSON)
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  حفظ أو استعادة كافة بيانات حسابك (المعاملات، التصنيفات، الديون، المتكررات، الجمعيات، والإعدادات) في ملف واحد.
                </p>
                {settings?.lastBackupAt && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                    آخر نسخة تم تنزيلها: {toWesternDigits(new Date(settings.lastBackupAt).toLocaleString('ar-JO'))}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                variant="primary"
                size="md"
                icon={<Download className="w-4 h-4" />}
                onClick={handleDownloadJsonBackup}
                disabled={exportingJson || !user}
                className="flex-1 font-bold text-xs sm:text-sm"
              >
                {exportingJson ? 'جاري التحضير...' : 'تنزيل نسخة احتياطية شاملة (JSON)'}
              </Button>

              <Button
                variant="outline"
                size="md"
                icon={<Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                onClick={handleTriggerFileInput}
                disabled={restoringJson || !user}
                className="flex-1 font-bold text-xs sm:text-sm"
              >
                استعادة نسخة احتياطية (JSON)
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelected}
                className="hidden"
                aria-label="اختيار ملف النسخة الاحتياطية"
              />
            </div>
          </div>

          {/* CSV Table Exports (4 buttons) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              تصدير الجداول (Excel / CSV مع دعم العربية):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="md"
                icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                onClick={handleExportTransactions}
                disabled={exportingTxs || !user}
                className="font-bold text-xs"
              >
                {exportingTxs ? 'جاري التصدير...' : 'تصدير جميع المعاملات (CSV)'}
              </Button>

              <Button
                variant="outline"
                size="md"
                icon={<FileSpreadsheet className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                onClick={handleExportDebts}
                disabled={exportingDebts || !user}
                className="font-bold text-xs"
              >
                {exportingDebts ? 'جاري التصدير...' : 'تصدير سجل الديون (CSV)'}
              </Button>

              <Button
                variant="outline"
                size="md"
                icon={<FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                onClick={handleExportRecurring}
                disabled={exportingRecurring || !user}
                className="font-bold text-xs"
              >
                {exportingRecurring ? 'جاري التصدير...' : 'تصدير المعاملات المتكررة (CSV)'}
              </Button>

              <Button
                variant="outline"
                size="md"
                icon={<FileSpreadsheet className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                onClick={handleExportCircles}
                disabled={exportingCircles || !user}
                className="font-bold text-xs"
              >
                {exportingCircles ? 'جاري التصدير...' : 'تصدير الجمعيات المالية (CSV)'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* CARD 9: Danger Zone */}
      <Card
        title="منطقة الخطر"
        subtitle="الإجراءات الحساسة التي تؤدي إلى تصفير البيانات أو حذف الحساب"
        className="border-red-200 dark:border-red-950/60"
      >
        <div className="space-y-4 pt-2">
          {/* Action 1: Reset Data */}
          <div className="p-4 rounded-2xl bg-red-50/40 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-red-900 dark:text-red-200">
                تصفير بيانات الحساب (Reset Data)
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
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
          <div className="p-4 rounded-2xl bg-red-50/40 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-bold text-red-900 dark:text-red-200">
                حذف الحساب نهائياً (Delete Account)
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
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

      {/* CARD 10: About Baseer */}
      <Card title="حول تطبيق بَصير" subtitle="معلومات الإصدار، التشفير، وحماية الخصوصية">
        <div className="pt-2 space-y-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 dark:bg-zinc-800 border border-blue-500/40 text-white flex items-center justify-center shadow-xs shrink-0">
              <img src="/icons/icon.svg" alt="بَصير" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <div className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                بَصير — Baseer
              </div>
              <div className="text-[11px] text-zinc-400">
                الإصدار 2.5.0 (Swiss Carbon & Sapphire Clarity)
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <span>أمان سحابي وخصوصية تامة</span>
            </div>
            <p>
              بياناتك المالية مشفرة ومحفوظة بأمان عبر Google Cloud Firestore مع قواعد أمان صارمة تضمن عدم وصول أي طرف آخر لبياناتك. التطبيق خالٍ تماماً من الإعلانات ومن أدوات التتبع الخارجية.
            </p>
          </div>
        </div>
      </Card>

      {/* MODALS */}

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
              onClick={handleSignOut}
              disabled={loggingOut}
              icon={<LogOut className="w-4 h-4 rtl:rotate-180" />}
            >
              {loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
            </Button>
          </div>
        </div>
      </Modal>

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
              {changingPassword ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Balance Reconciliation Modal */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title="تسوية وتعديل الرصيد الفعلي"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            أدخل الرصيد الفعلي الموجود حالياً في محفظتك النقدية أو حسابك البنكي لتسوية وتحديث الرصيد الافتتاحي:
          </p>
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              الرصيد الفعلي ({activeConfig.symbol})
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={reconcileAmount}
              onChange={(e) => setReconcileAmount(e.target.value)}
              placeholder="0.00"
              dir="ltr"
              className="font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowReconcileModal(false)}
              disabled={savingReconcile}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveReconciliation}
              disabled={savingReconcile || !reconcileAmount.trim()}
            >
              {savingReconcile ? 'جاري التسوية...' : 'حفظ وتسوية الرصيد'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* PIN Setup Modal */}
      <Modal
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false)
          setPinInput('')
          setPinConfirmInput('')
          setPinError(null)
        }}
        title="تعيين رمز الدخول (PIN)"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            أدخل رمز دخول مكون من 4 أرقام. سيتم حفظ الرمز مشفراً محلياً على هذا الجهاز لحماية شاشاتك:
          </p>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              رمز الدخول الجديد (4 أرقام)
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              dir="ltr"
              className="font-mono tracking-widest text-center text-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              تأكيد رمز الدخول (4 أرقام)
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirmInput}
              onChange={(e) => setPinConfirmInput(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              dir="ltr"
              className="font-mono tracking-widest text-center text-lg"
            />
          </div>

          {pinError && (
            <div className="text-xs font-bold text-red-600 dark:text-red-400">
              {pinError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowPinModal(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSavePin}
              disabled={pinInput.length !== 4 || pinConfirmInput.length !== 4}
            >
              تفعيل القفل
            </Button>
          </div>
        </div>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        isOpen={Boolean(restoreValidation?.valid)}
        onClose={() => setRestoreValidation(null)}
        title="تأكيد استعادة النسخة الاحتياطية"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            تم فحص ملف النسخة الاحتياطية بنجاح. يرجى مراجعة ملخص البيانات واختيار طريقة الاستعادة المناسبة:
          </p>

          {restoreValidation?.summary && (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-500">تاريخ إنشاء النسخة:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200" dir="ltr">
                  {new Date(restoreValidation.summary.exportedAt).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-500">المعاملات المالية:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {restoreValidation.summary.transactionsCount} معاملة
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-500">التصنيفات:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {restoreValidation.summary.categoriesCount} تصنيف
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-500">سجلات الديون:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {restoreValidation.summary.debtsCount} دين
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-500">المعاملات المتكررة:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {restoreValidation.summary.recurringCount} معاملة
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-500">الجمعيات المالية:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {restoreValidation.summary.circlesCount} جمعية
                </span>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
              طريقة الاستعادة:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRestoreMode('merge')}
                className={cn(
                  'p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-2.5',
                  restoreMode === 'merge'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">دمج مع البيانات الحالية (آمن - مستحسن)</span>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                      restoreMode === 'merge'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    )}
                  >
                    {restoreMode === 'merge' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  يضيف ويحدث السجلات الموجودة في النسخة الاحتياطية دون حذف المعاملات أو الديون الأحدث التي أضافها المستخدم في حسابه.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRestoreMode('replace')}
                className={cn(
                  'p-3.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-2.5',
                  restoreMode === 'replace'
                    ? 'border-red-500 bg-red-50/70 dark:bg-red-950/40 text-red-950 dark:text-red-100 ring-2 ring-red-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">استبدال كامل للبيانات</span>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                      restoreMode === 'replace'
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    )}
                  >
                    {restoreMode === 'replace' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  يمسح السجلات غير الموجودة في النسخة الاحتياطية ويعيد الحساب تماماً كما كان وقت النسخة.
                </p>
              </button>
            </div>
          </div>

          {/* Mode Notice */}
          {restoreMode === 'replace' ? (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="space-y-1">
                <span className="font-bold block">تحذير هام (استبدال كامل):</span>
                <p className="leading-relaxed text-red-700 dark:text-red-300">
                  سيتم حذف كافة المعاملات والديون والجمعيات والمتكررات المسجلة حالياً والتي لم تكن موجودة في ملف النسخة الاحتياطية. لن تتمكن من التراجع عن هذا الإجراء!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <p className="leading-relaxed">
                الوضع الآمن: ستتم إضافة السجلات وتحديثها مع الاحتفاظ الكامل ببياناتك ومعاملاتك الحالية التي أضفتها لاحقاً دون حذف أي شيء.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setRestoreValidation(null)}
              disabled={restoringJson}
            >
              إلغاء
            </Button>
            <Button
              variant={restoreMode === 'replace' ? 'danger' : 'primary'}
              size="md"
              onClick={handleConfirmRestore}
              disabled={restoringJson}
            >
              {restoringJson
                ? 'جاري الاستعادة...'
                : restoreMode === 'replace'
                ? 'استبدال كافة البيانات'
                : 'تأكيد ودمج البيانات'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Data Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false)
          setResetConfirmText('')
        }}
        enableHistoryBack={false}
        title="تأكيد تصفير بيانات الحساب"
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
              onClick={handleDownloadJsonBackup}
              disabled={exportingJson || !user}
              className="font-bold text-xs shrink-0"
            >
              {exportingJson ? 'جاري التنزيل...' : 'تنزيل نسخة احتياطية أولاً'}
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
              {resettingData ? 'جاري تصفير البيانات...' : 'تأكيد تصفير كافة البيانات'}
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
              className="bg-red-700 hover:bg-red-800"
            >
              {deletingAccount ? 'جاري حذف الحساب...' : 'حذف الحساب نهائياً'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Re-Authentication Modal */}
      <Modal
        isOpen={showReauthModal}
        onClose={() => setShowReauthModal(false)}
        enableHistoryBack={false}
        title="تأكيد الهوية (إعادة تسجيل الدخول)"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            لأسباب أمنية مشددة، يتطلب هذا الإجراء الحساس تأكيد كلمة المرور أو إعادة التحقق عبر حسابك قبل الاستمرار:
          </p>

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

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReauthAndComplete}
              disabled={reauthenticating}
              className="w-full sm:w-auto"
            >
              إعادة التحقق عبر Google
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReauthModal(false)}
                disabled={reauthenticating}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReauthAndComplete}
                disabled={reauthenticating || !reauthPassword}
              >
                {reauthenticating ? 'جاري التحقق...' : 'تأكيد ومتابعة'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
