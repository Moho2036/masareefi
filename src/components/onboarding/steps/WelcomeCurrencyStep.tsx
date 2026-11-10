import React from 'react'
import { PRESET_CURRENCIES } from '../../../lib/money'

export interface WelcomeCurrencyStepProps {
  displayName: string
  setDisplayName: (val: string) => void
  currency: string
  setCurrency: (val: string) => void
  isCustomCurrency: boolean
  setIsCustomCurrency: (val: boolean) => void
  customCurrencyDecimals: number
  setCustomCurrencyDecimals: (val: number) => void
}

export const WelcomeCurrencyStep: React.FC<WelcomeCurrencyStepProps> = ({
  displayName,
  setDisplayName,
  currency,
  setCurrency,
  isCustomCurrency,
  setIsCustomCurrency,
  customCurrencyDecimals,
  setCustomCurrencyDecimals,
}) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <label htmlFor="onboarding-name" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
          الاسم الشخصي
        </label>
        <input
          id="onboarding-name"
          type="text"
          autoComplete="off"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="كيف تفضل أن نناديك؟"
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
          عملة الحساب الأساسية
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(PRESET_CURRENCIES).map((curr) => {
            const isSelected = !isCustomCurrency && currency === curr.code
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => {
                  setIsCustomCurrency(false)
                  setCurrency(curr.code)
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-full">
                  {curr.name}
                </span>
                <span className="text-[11px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 mt-1">
                  {curr.symbol} • {curr.flag}
                </span>
              </button>
            )
          })}
        </div>

        {/* Custom Currency Toggle & Details */}
        <div className="mt-3">
          {!isCustomCurrency ? (
            <button
              type="button"
              onClick={() => {
                setIsCustomCurrency(true)
                if (PRESET_CURRENCIES[currency]) {
                  setCurrency('')
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-center"
            >
              + استخدام عملة مخصصة أخرى
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label htmlFor="onboarding-custom-currency" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  رمز أو اسم العملة المخصصة
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCurrency(false)
                    setCurrency('JOD')
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  العودة للعملات الأساسية
                </button>
              </div>
              <input
                id="onboarding-custom-currency"
                type="text"
                autoComplete="off"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.slice(0, 20))}
                placeholder="مثال: TRY أو د.ع أو GBP"
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
              />

              <div>
                <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  عدد المنازل العشرية (الكسور)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { decimals: 0, label: '0 خانات', desc: 'دون كسور (ليرة، دينار عراقي)' },
                    { decimals: 2, label: 'خانتان (2)', desc: 'الأغلبية (دولار، ريال)' },
                    { decimals: 3, label: '3 خانات', desc: 'فلس/مليم (دينار كويتي/أردني)' },
                  ].map((opt) => (
                    <button
                      key={opt.decimals}
                      type="button"
                      onClick={() => setCustomCurrencyDecimals(opt.decimals)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        customCurrencyDecimals === opt.decimals
                          ? 'border-blue-500 bg-blue-500 text-white font-bold shadow-xs'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="text-xs font-black">{opt.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
