import React, { useState, useRef } from 'react'
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { getAllTransactions } from '../../services/transactions'
import { getAllDebts } from '../../services/debts'
import { processDueRecurring } from '../../services/recurring'
import { exportAllFinancialDataToCsv } from '../../lib/exportCsv'
import {
  createFullBackup,
  downloadBackupFile,
  validateBackup,
  restoreBackup,
  type BackupValidationResult,
  type RestoreMode,
} from '../../lib/backupRestore'
import { getCurrencyConfig } from '../../lib/money'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { UserSettings, Category, Recurring, MoneyCircle } from '../../types'
import type { User } from 'firebase/auth'

export interface BackupExportSectionProps {
  user: User | null
  settings: UserSettings | null | undefined
  categories: Category[]
  recurring: Recurring[]
  moneyCircles: MoneyCircle[]
  activeCurrency: string
  isOnline: boolean
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  refreshData?: () => void | Promise<void>
  onDisplayNameRestored?: (name: string) => void
}

export const BackupExportSection: React.FC<BackupExportSectionProps> = ({
  user,
  settings,
  categories,
  recurring,
  moneyCircles,
  activeCurrency,
  isOnline,
  updateSettings,
  showToast,
  refreshData,
  onDisplayNameRestored,
}) => {
  const activeConfig = getCurrencyConfig(activeCurrency, settings?.customCurrencyDecimals)

  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportingJson, setExportingJson] = useState(false)
  const [restoringJson, setRestoringJson] = useState(false)
  const [restoreValidation, setRestoreValidation] = useState<BackupValidationResult | null>(null)
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportAllCsv = async () => {
    if (!user) return
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      showToast('يجب الاتصال بالإنترنت لإتمام تصدير البيانات', 'error')
      return
    }
    setExportingCsv(true)
    try {
      const [txs, debts] = await Promise.all([
        getAllTransactions(user.uid),
        getAllDebts(user.uid),
      ])
      if (
        txs.length === 0 &&
        debts.length === 0 &&
        (!recurring || recurring.length === 0) &&
        (!moneyCircles || moneyCircles.length === 0)
      ) {
        showToast('لا توجد أي بيانات مالية لتصديرها', 'info')
        return
      }
      exportAllFinancialDataToCsv(
        {
          transactions: txs,
          categories,
          debts,
          recurring: recurring || [],
          circles: moneyCircles || [],
        },
        {
          symbol: activeConfig.symbol,
          decimals: activeConfig.decimals,
        }
      )
      showToast('تم تصدير السجل المالي الشامل بنجاح', 'success')
    } catch (err) {
      console.error('Failed to export full csv:', err)
      showToast('تعذر تصدير السجل المالي', 'error')
    } finally {
      setExportingCsv(false)
    }
  }

  const handleDownloadJsonBackup = async () => {
    if (!user) return
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      showToast('يجب الاتصال بالإنترنت لإتمام تنزيل النسخة الاحتياطية', 'error')
      return
    }
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

    const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024 // 20 MB
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      showToast('حجم الملف كبير جداً (الحد الأقصى 20 ميغابايت)، يرجى اختيار ملف نسخة احتياطية صالح', 'error')
      return
    }

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
        onDisplayNameRestored?.(restoreValidation.data.data.settings.displayName)
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

  return (
    <>
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
                {exportingJson ? 'جارٍ التحضير...' : 'تنزيل نسخة احتياطية شاملة (JSON)'}
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

          {/* CSV Table Exports */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              تصدير الجداول (Excel / CSV مع دعم العربية):
            </h4>
            <Button
              variant="outline"
              size="md"
              icon={<FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              onClick={handleExportAllCsv}
              disabled={exportingCsv || !user}
              className="w-full font-bold text-xs sm:text-sm"
            >
              {exportingCsv ? 'جارٍ التصدير...' : 'تصدير السجل المالي الشامل (Excel / CSV)'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Restore Confirmation Modal */}
      <Modal
        isOpen={Boolean(restoreValidation?.valid)}
        onClose={() => setRestoreValidation(null)}
        title="تأكيد استعادة النسخة الاحتياطية"
        hideCloseButton={true}
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
              {[
                { label: 'المعاملات المالية:', value: `${restoreValidation.summary.transactionsCount} معاملة`, highlight: true },
                { label: 'التصنيفات:', value: `${restoreValidation.summary.categoriesCount} تصنيف` },
                { label: 'سجلات الديون:', value: `${restoreValidation.summary.debtsCount} دين` },
                { label: 'المعاملات المتكررة:', value: `${restoreValidation.summary.recurringCount} معاملة` },
                { label: 'الجمعيات المالية:', value: `${restoreValidation.summary.circlesCount} جمعية`, isLast: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    'flex justify-between items-center py-1',
                    !item.isLast && 'border-b border-zinc-200/60 dark:border-zinc-800'
                  )}
                >
                  <span className="text-zinc-500">{item.label}</span>
                  <span
                    className={
                      item.highlight
                        ? 'font-black text-blue-600 dark:text-blue-400'
                        : 'font-bold text-zinc-800 dark:text-zinc-200'
                    }
                  >
                    {item.value}
                  </span>
                </div>
              ))}
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
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold">دمج مع البيانات الحالية (آمن - مستحسن)</span>
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                      restoreMode === 'merge'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    )}
                  >
                    {restoreMode === 'merge' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  إضافة وتحديث السجلات مع الاحتفاظ الكامل ببياناتك ومعاملاتك الحالية دون أي حذف.
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
                  حذف السجلات غير الموجودة في النسخة ومطابقة بيانات الحساب لوقت أخذ النسخة بدقة.
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
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <p className="leading-relaxed">
                الوضع الآمن: ستتم إضافة السجلات وتحديثها مع الاحتفاظ الكامل ببياناتك ومعاملاتك الحالية التي أضفتها لاحقاً دون حذف أي شيء.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3">
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
                ? 'جارٍ الاستعادة...'
                : restoreMode === 'replace'
                  ? 'استبدال كافة البيانات'
                  : 'تأكيد ودمج البيانات'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
