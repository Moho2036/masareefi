import React, { useState } from 'react'
import { Coins } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { PRESET_CURRENCIES, getCurrencyConfig } from '../../lib/money'
import { cn } from '../../lib/cn'
import type { UserSettings } from '../../types'

export interface CurrencySectionProps {
  activeCurrency: string
  settings: UserSettings | null | undefined
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export const CurrencySection: React.FC<CurrencySectionProps> = ({
  activeCurrency,
  settings,
  updateSettings,
  showToast,
}) => {
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

  const [prevCustomDecimals, setPrevCustomDecimals] = useState(settings?.customCurrencyDecimals)
  if (settings?.customCurrencyDecimals !== prevCustomDecimals) {
    setPrevCustomDecimals(settings?.customCurrencyDecimals)
    if (typeof settings?.customCurrencyDecimals === 'number') {
      setCustomDecimals(settings.customCurrencyDecimals)
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

  return (
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
                <span className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-black text-zinc-700 dark:text-zinc-300 select-none shrink-0">
                  {curr.symbol}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{curr.name}</div>
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                    {curr.code}
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
          <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            العملة النشطة الحالية:{' '}
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {activeConfig.name} ({activeConfig.symbol}) — {activeConfig.decimals} منازل عشرية
            </span>
          </span>
        </div>

        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1 leading-relaxed">
          ملاحظة: تغيير العملة يحدّث رمز وطريقة عرض المبالغ فقط ولا يقوم بتحويل الأرقام المسجلة سابقاً بأسعار الصرف.
        </p>
      </div>
    </Card>
  )
}
