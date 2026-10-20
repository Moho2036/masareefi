import React, { useState, useRef } from 'react'
import {
  Sun,
  Moon,
  Laptop,
  Coins,
  LogOut,
  Download,
  Upload,
  Database,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
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
import { useToast } from '../hooks/useToast'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { signOutUser } from '../services/auth'
import { getAllTransactions } from '../services/transactions'
import { getAllDebts } from '../services/debts'
import { exportTransactionsToCsv, exportDebtsToCsv } from '../lib/exportCsv'
import {
  createFullBackup,
  downloadBackupFile,
  validateBackup,
  restoreBackup,
  type BackupValidationResult,
} from '../lib/backupRestore'
import { PRESET_CURRENCIES, getCurrencyConfig } from '../lib/money'
import { cn } from '../lib/cn'
import type { ThemePreference } from '../types'

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { user } = useAuth()
  const { data: settings, updateSettings } = useUserSettings()
  const { data: categories } = useCategories()
  const { showToast } = useToast()
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [exportingTxs, setExportingTxs] = useState(false)
  const [exportingDebts, setExportingDebts] = useState(false)
  const [exportingJson, setExportingJson] = useState(false)
  const [restoringJson, setRestoringJson] = useState(false)
  const [restoreValidation, setRestoreValidation] = useState<BackupValidationResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeCurrency = settings?.currency || 'JOD'
  const isPreset = Boolean(PRESET_CURRENCIES[activeCurrency])
  const [isCustomCurrency, setIsCustomCurrency] = useState(!isPreset && activeCurrency !== 'JOD')
  const [customCurrencyInput, setCustomCurrencyInput] = useState(isPreset ? '' : activeCurrency)
  const [savingCurrency, setSavingCurrency] = useState(false)

  // Track previous settings to adjust state during render when settings load or change from Firestore
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

  const activeConfig = getCurrencyConfig(activeCurrency)

  const handleSelectPreset = async (code: string) => {
    setIsCustomCurrency(false)
    if (code === activeCurrency) return
    try {
      await updateSettings({ currency: code })
      showToast(`تم تغيير العملة إلى ${PRESET_CURRENCIES[code]?.name || code} بنجاح`, 'success')
    } catch (err) {
      console.error('Failed to update currency:', err)
      showToast('تعذر تغيير العملة', 'error')
    }
  }

  const handleSaveCustomCurrency = async () => {
    const trimmed = customCurrencyInput.trim()
    if (!trimmed || trimmed === activeCurrency) return
    setSavingCurrency(true)
    try {
      await updateSettings({ currency: trimmed })
      showToast(`تم تعيين العملة المخصصة: ${trimmed}`, 'success')
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
    } catch (err) {
      console.error('Failed to persist month start day:', err)
    }
  }

  const handleSignOut = async () => {
    setLoggingOut(true)
    try {
      await signOutUser()
    } catch (err) {
      console.error('Failed to sign out:', err)
    } finally {
      setLoggingOut(false)
    }
  }

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

  const handleDownloadJsonBackup = async () => {
    if (!user) return
    setExportingJson(true)
    try {
      const backup = await createFullBackup(user.uid)
      downloadBackupFile(backup)
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
      await restoreBackup(user.uid, restoreValidation.data)
      showToast('تمت استعادة النسخة الاحتياطية بنجاح!', 'success')
      setRestoreValidation(null)
    } catch (err) {
      console.error('Failed to restore backup:', err)
      showToast('تعذر استعادة النسخة الاحتياطية', 'error')
    } finally {
      setRestoringJson(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-slide-up">
      <PageHeader
        title="الإعدادات"
        subtitle="تفضيلات المظهر، بداية الشهر المالي، وإدارة الحساب"
      />

      {/* Theme Settings Card */}
      <Card
        title="المظهر والألوان"
        subtitle="اختر المظهر المفضل للتطبيق أو دعه يتبع إعدادات جهازك"
      >
        <div className="space-y-4 pt-2">
          <SegmentedControl<ThemePreference>
            value={theme}
            onChange={handleThemeChange}
            options={themeOptions}
            className="w-full sm:w-auto"
          />

          <p className="text-xs text-slate-500 dark:text-slate-400">
            الوضع الحالي النشط:{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {resolvedTheme === 'dark' ? 'داكن' : 'فاتح'}
            </span>{' '}
            {theme === 'system' && '(تلقائي حسب النظام)'}
          </p>
        </div>
      </Card>

      {/* Financial Month Start Day & Rollover */}
      <Card
        title="إعدادات الدورة المالية"
        subtitle="حدد يوم بداية الدورة المالية وإمكانية ترحيل الرصيد التراكمي من الأشهر السابقة"
      >
        <div className="pt-2 space-y-5">
          <div className="max-w-xs">
            <Select
              label="يوم بداية الدورة المالية"
              value={currentStartDay}
              onChange={handleStartDayChange}
              options={dayOptions}
              helperText="الافتراضي هو اليوم الأول من كل شهر (1 إلى 28)."
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="rollover-toggle" className="text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                ترحيل الرصيد المتبقي من الأشهر السابقة تلقائياً
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                عند التفعيل، يُضاف الفائض أو العجز المتراكم من الأشهر السابقة إلى رصيد الشهر الحالي، مما يمنحك رصيداً تراكمياً حقيقياً وتفادي العجز الوهمي في بداية الشهر.
              </p>
            </div>
            <Toggle
              id="rollover-toggle"
              checked={settings?.rolloverBalance ?? true}
              onChange={handleToggleRollover}
            />
          </div>
        </div>
      </Card>

      {/* Currency Selection Card */}
      <Card
        title="العملة الرسمية"
        subtitle="اختر العملة المعتمدة في حساباتك وشاشات التطبيق"
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
                    'flex items-center gap-2.5 p-3 rounded-xl border text-start transition-all cursor-pointer',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  )}
                >
                  <span className="text-xl select-none">{curr.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{curr.name}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
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
                'flex items-center gap-2.5 p-3 rounded-xl border text-start transition-all cursor-pointer',
                isCustomCurrency
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              )}
            >
              <span className="text-xl select-none">✏️</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">عملة أخرى</div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
                  {isCustomCurrency && customCurrencyInput ? customCurrencyInput : 'تحديد يدوي'}
                </div>
              </div>
            </button>
          </div>

          {/* Custom Currency Input */}
          {isCustomCurrency && (
            <div className="p-3.5 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
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
                <Button
                  onClick={handleSaveCustomCurrency}
                  disabled={!customCurrencyInput.trim() || savingCurrency}
                  variant="primary"
                  className="w-full sm:w-auto"
                >
                  {savingCurrency ? 'جاري الحفظ...' : 'تطبيق العملة'}
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
            <Coins className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              العملة النشطة الحالية:{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {activeConfig.name} ({activeConfig.symbol})
              </span>
            </span>
          </div>
        </div>
      </Card>

      {/* PWA App Installation Card */}
      <Card
        title="تثبيت التطبيق (PWA)"
        subtitle="يمكنك تثبيت تطبيق مصاريفي على هاتفك أو حاسوبك للعمل بدون إنترنت وسرعة فائقة"
      >
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {isInstalled ? 'التطبيق مثبت حالياً' : 'تطبيق ويب تقدمي (PWA)'}
              </div>
              <div className="text-xs text-slate-400">
                {isInstalled
                  ? 'يعمل التطبيق كبرنامج مستقل مع دعم كامل للعمل بلا اتصال'
                  : 'يعمل بكامل ميزاته مباشرة من الشاشة الرئيسية دون الحاجة للمتجر'}
              </div>
            </div>
          </div>

          {isInstalled ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>مثبت على الجهاز</span>
            </div>
          ) : isInstallable ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={promptInstall}
            >
              تثبيت التطبيق على جهازك
            </Button>
          ) : (
            <span className="text-xs text-slate-400 font-medium">
              متاح للتثبيت من متصفحك عبر زر المشاركة أو القائمة
            </span>
          )}
        </div>
      </Card>

      {/* Data Export & Backup Card */}
      <Card
        title="تصدير البيانات والنسخ الاحتياطي"
        subtitle="تصدير بياناتك المالية وسجلات الديون إلى ملفات Excel/CSV أو نسخ احتياطي شامل JSON"
      >
        <div className="pt-2 space-y-5">
          {/* Section 1: Comprehensive JSON Backup */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  النسخ الاحتياطي الشامل (JSON)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  حفظ أو استعادة كافة بيانات حسابك (المعاملات، التصنيفات، الديون، المتكررات، الجمعيات، والإعدادات) في ملف واحد.
                </p>
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
                icon={<Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
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

          {/* Section 2: CSV Exports */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              تصدير الجداول (Excel / CSV مع دعم العربية):
            </h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                size="md"
                icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                onClick={handleExportTransactions}
                disabled={exportingTxs || !user}
                className="flex-1 font-bold"
              >
                {exportingTxs ? 'جاري التصدير...' : 'تصدير جميع المعاملات (CSV)'}
              </Button>

              <Button
                variant="outline"
                size="md"
                icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                onClick={handleExportDebts}
                disabled={exportingDebts || !user}
                className="flex-1 font-bold"
              >
                {exportingDebts ? 'جاري التصدير...' : 'تصدير سجل الديون (CSV)'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Account Info */}
      <Card title="الحساب الشخصي" subtitle="معلومات تسجيل الدخول عبر Google">
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'صورة المستخدم'}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
                {user?.displayName ? user.displayName.charAt(0) : 'م'}
              </div>
            )}
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {user?.displayName || 'مستخدم مصاريفي'}
              </div>
              <div className="text-xs text-slate-400" dir="ltr">
                {user?.email || 'بدون بريد إلكتروني'}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<LogOut className="w-4 h-4 rtl:rotate-180" />}
            onClick={handleSignOut}
            disabled={loggingOut}
          >
            {loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
          </Button>
        </div>
      </Card>

      {/* Restore Confirmation Modal */}
      <Modal
        isOpen={Boolean(restoreValidation?.valid)}
        onClose={() => setRestoreValidation(null)}
        title="تأكيد استعادة النسخة الاحتياطية"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            تم فحص ملف النسخة الاحتياطية بنجاح. فيما يلي ملخص البيانات التي سيتم استعادتها وحفظها في حسابك:
          </p>

          {restoreValidation?.summary && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500">تاريخ إنشاء النسخة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                  {new Date(restoreValidation.summary.exportedAt).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500">المعاملات المالية:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {restoreValidation.summary.transactionsCount} معاملة
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500">التصنيفات:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {restoreValidation.summary.categoriesCount} تصنيف
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500">سجلات الديون:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {restoreValidation.summary.debtsCount} دين
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500">المعاملات المتكررة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {restoreValidation.summary.recurringCount} معاملة
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">الجمعيات المالية:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {restoreValidation.summary.circlesCount} جمعية
                </span>
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="leading-relaxed">
              تتم الاستعادة مع الحفاظ على المعرفات الأصلية لمنع تكرار السجلات في حال استعادة نفس النسخة أكثر من مرة.
            </p>
          </div>

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
              variant="primary"
              size="md"
              onClick={handleConfirmRestore}
              disabled={restoringJson}
            >
              {restoringJson ? 'جاري الاستعادة...' : 'تأكيد واستعادة البيانات'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
