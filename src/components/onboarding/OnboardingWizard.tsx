import React, { useState, useEffect, useMemo } from 'react'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Coins,
  CheckCircle2,
  X,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { CategoryIcon } from '../ui/CategoryIcon'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useCategories } from '../../hooks/useCategories'
import { PRESET_CURRENCIES, toFils, detectDefaultCurrency } from '../../lib/money'
import { archiveCategory, archiveCategoriesBatch, addCategory } from '../../services/categories'
import { addRecurring, processDueRecurring } from '../../services/recurring'
import type { Category } from '../../types'

export interface OnboardingWizardProps {
  isOpen: boolean
  onComplete: () => void
}

interface OnboardingDraft {
  step: number
  displayName: string
  currency: string
  customCurrencyDecimals?: number
  isCustomCurrency?: boolean
  monthStartDay: number
  rolloverBalance: boolean
  openingBalance: string
  addSalary: boolean
  salaryAmount: string
  deselectedCategoryIds: string[]
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onComplete }) => {
  const { user } = useAuth()
  const uid = user?.uid
  const { data: settings, updateSettings } = useUserSettings()
  const { data: categories } = useCategories()

  const draftKey = uid ? `baseer_onboarding_draft_${uid}` : null

  const initialDraft = useMemo(() => {
    if (!draftKey || typeof window === 'undefined' || !window.sessionStorage) return null
    try {
      const raw = window.sessionStorage.getItem(draftKey)
      if (raw) return JSON.parse(raw) as Partial<OnboardingDraft>
    } catch {
      // ignore
    }
    return null
  }, [draftKey])

  const initialCurrency = initialDraft?.currency ?? (settings?.currency || detectDefaultCurrency())
  const initialIsCustom = initialDraft?.isCustomCurrency ?? !PRESET_CURRENCIES[initialCurrency]

  const [step, setStep] = useState<number>(() => initialDraft?.step ?? 1)
  const [displayName, setDisplayName] = useState<string>(
    () => initialDraft?.displayName ?? (settings?.displayName || user?.displayName || '')
  )
  const [currency, setCurrency] = useState<string>(() => initialCurrency)
  const [isCustomCurrency, setIsCustomCurrency] = useState<boolean>(() => initialIsCustom)
  const [customCurrencyDecimals, setCustomCurrencyDecimals] = useState<number>(
    () => initialDraft?.customCurrencyDecimals ?? (settings?.customCurrencyDecimals ?? 2)
  )
  const [monthStartDay, setMonthStartDay] = useState<number>(
    () => initialDraft?.monthStartDay ?? (settings?.monthStartDay || 1)
  )
  const [rolloverBalance, setRolloverBalance] = useState<boolean>(
    () => initialDraft?.rolloverBalance ?? (settings?.rolloverBalance ?? true)
  )
  const [openingBalance, setOpeningBalance] = useState<string>(() => initialDraft?.openingBalance ?? '')
  const [addSalary, setAddSalary] = useState<boolean>(() => initialDraft?.addSalary ?? false)
  const [salaryAmount, setSalaryAmount] = useState<string>(() => initialDraft?.salaryAmount ?? '')
  const [deselectedCategoryIds, setDeselectedCategoryIds] = useState<string[]>(
    () => initialDraft?.deselectedCategoryIds ?? []
  )
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null)

  // Step 4 Inline Category Creation State
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false)
  const [newCatName, setNewCatName] = useState<string>('')
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense')
  const [newCatColor, setNewCatColor] = useState<string>('#2563eb')
  const [creatingCategory, setCreatingCategory] = useState<boolean>(false)

  // Save draft to sessionStorage on change
  useEffect(() => {
    if (!isOpen || !draftKey || typeof window === 'undefined' || !window.sessionStorage) return
    const draft: OnboardingDraft = {
      step,
      displayName,
      currency,
      customCurrencyDecimals,
      isCustomCurrency,
      monthStartDay,
      rolloverBalance,
      openingBalance,
      addSalary,
      salaryAmount,
      deselectedCategoryIds,
    }
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // ignore
    }
  }, [
    isOpen,
    draftKey,
    step,
    displayName,
    currency,
    customCurrencyDecimals,
    isCustomCurrency,
    monthStartDay,
    rolloverBalance,
    openingBalance,
    addSalary,
    salaryAmount,
    deselectedCategoryIds,
  ])

  // Cleanup draft and mark complete
  const markCompletedLocally = () => {
    if (uid && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`baseer_onboarding_done_${uid}`, 'true')
        window.localStorage.setItem(`masareefi_onboarding_done_${uid}`, 'true')
      } catch {
        // ignore
      }
    }
    if (draftKey && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(draftKey)
      } catch {
        // ignore
      }
    }
  }

  // Handle Skip
  const handleSkip = async () => {
    setSubmitting(true)
    try {
      if (updateSettings) {
        await updateSettings({
          onboardingCompleted: true,
          openingBalanceFils: 0,
        })
      }
      markCompletedLocally()
      onComplete()
    } catch (err) {
      console.error('Failed to skip onboarding:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Finish
  const handleFinish = async () => {
    if (!uid) return
    setSubmitting(true)
    try {
      const isCustom = isCustomCurrency || !PRESET_CURRENCIES[currency]
      const decimalsOrCurrency = isCustom ? customCurrencyDecimals : currency
      const openingBalanceFils = openingBalance ? Math.max(0, toFils(openingBalance, decimalsOrCurrency)) : 0
      const safeMonthStartDay = Math.min(28, Math.max(1, Math.round(monthStartDay || 1)))

      // 1. Update user settings in Firestore
      if (updateSettings) {
        await updateSettings({
          displayName: displayName.trim().slice(0, 100) || (user?.displayName || 'مستخدم بَصير'),
          currency: currency || 'JOD',
          customCurrencyDecimals: isCustom ? customCurrencyDecimals : undefined,
          monthStartDay: safeMonthStartDay,
          rolloverBalance,
          openingBalanceFils,
          onboardingCompleted: true,
        })
      }

      // 2. Add recurring salary rule if chosen
      if (addSalary && salaryAmount) {
        const salaryFils = toFils(salaryAmount, decimalsOrCurrency)
        if (salaryFils > 0) {
          const incomeCategories = categories.filter((c) => c.type === 'income' && !c.archived)
          const salaryCat =
            incomeCategories.find((c) => c.name.includes('راتب')) || incomeCategories[0]

          if (salaryCat) {
            const today = new Date()
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
            const startDate = new Date(today.getFullYear(), today.getMonth(), safeMonthStartDay, 12, 0, 0, 0)
            if (startDate < todayStart) {
              startDate.setMonth(startDate.getMonth() + 1)
            }

            await addRecurring(uid, {
              type: 'income',
              amountFils: salaryFils,
              categoryId: salaryCat.id,
              title: 'الراتب الشهري',
              note: 'راتب شهري مسجل عبر معالج التأسيس',
              frequency: 'monthly',
              startDate,
              nextDate: startDate,
              active: true,
            })

            if (startDate <= today) {
              await processDueRecurring(uid).catch(() => {})
            }
          }

          // Save work hours preferences
          if (typeof window !== 'undefined' && window.localStorage) {
            const workPrefs = JSON.stringify({
              salary: salaryAmount,
              currencyCode: currency,
              dailyHours: '8',
              workDays: '22',
              workDaysMode: 'month',
            })
            window.localStorage.setItem('baseer_work_hours_prefs', workPrefs)
            window.localStorage.setItem('masareefi_work_hours_prefs', workPrefs)
          }
        }
      }

      // 3. Archive deselected categories in background
      if (deselectedCategoryIds.length > 0) {
        if (typeof archiveCategoriesBatch === 'function') {
          await archiveCategoriesBatch(uid, deselectedCategoryIds, true).catch((e) =>
            console.warn('Failed to batch archive categories:', e)
          )
        } else {
          await Promise.all(
            deselectedCategoryIds.map((catId) =>
              archiveCategory(uid, catId, true).catch((e) => console.warn('Failed to archive category:', e))
            )
          )
        }
      }

      markCompletedLocally()
      onComplete()
    } catch (err) {
      console.error('Failed to complete onboarding:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle Category selection with minimum 1 active guarantee per type
  const handleToggleCategory = (cat: Category) => {
    setCategoryWarning(null)
    const isCurrentlyDeselected = deselectedCategoryIds.includes(cat.id)

    if (isCurrentlyDeselected) {
      // Re-enable
      setDeselectedCategoryIds((prev) => prev.filter((id) => id !== cat.id))
    } else {
      // Attempting to deselect: check if it's the last active of its type
      const activeOfSameType = categories.filter(
        (c) => c.type === cat.type && !c.archived && !deselectedCategoryIds.includes(c.id)
      )
      if (activeOfSameType.length <= 1) {
        setCategoryWarning(`يجب الإبقاء على تصنيف نشط واحد على الأقل في قسم ${cat.type === 'expense' ? 'المصاريف' : 'المداخيل'}.`)
        return
      }
      setDeselectedCategoryIds((prev) => [...prev, cat.id])
    }
  }

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.archived),
    [categories]
  )

  const stepsTitles = [
    'الترحيب والعملة',
    'الدورة المالية',
    'الرصيد والدخل',
    'التصنيفات',
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      enableHistoryBack={false}
      title=""
      className="max-w-xl p-0 overflow-hidden rounded-3xl"
    >
      <div className="p-6 sm:p-8 space-y-6 text-start">
        {/* Header with step progress and Skip button */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-400">
                الخطوة {step} من 4: {stepsTitles[step - 1]}
              </div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50">
                تجهيز حسابك في بَصير
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            تخطي
          </button>
        </div>

        {/* Top Progress Bar */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-blue-600 dark:bg-blue-500' : 'bg-zinc-100 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Welcome & Currency */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <label htmlFor="onboarding-name" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                الاسم الشخصي
              </label>
              <input
                id="onboarding-name"
                type="text"
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
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 mb-1">{curr.flag}</span>
                      <span className="text-xs font-black">{curr.symbol}</span>
                      <span className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-full">
                        {curr.name}
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
        )}

        {/* STEP 2: Financial Cycle & Rollover */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="onboarding-start-day" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  يوم بداية الدورة المالية (نزول الراتب)
                </label>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-black">
                  يوم {monthStartDay} من كل شهر
                </span>
              </div>
              <input
                id="onboarding-start-day"
                type="range"
                min="1"
                max="28"
                value={monthStartDay}
                onChange={(e) => setMonthStartDay(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {[1, 15, 25, 26, 27, 28].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setMonthStartDay(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      monthStartDay === d
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    يوم {d}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                تبدأ جميع تقاريرك الشهرية وحسابات الصرف والحد اليومي الآمن من هذا اليوم (أقصى يوم هو 28 لضمان انتظام الحساب في شهر فبراير وكافة الأشهر).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    ترحيل الرصيد التلقائي (Rollover)
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    نقل الفائض أو العجز إلى الدورة الشهرية التالية
                  </div>
                </div>
                <Toggle
                  checked={rolloverBalance}
                  onChange={setRolloverBalance}
                  id="onboarding-rollover-toggle"
                  label="تفعيل ترحيل الرصيد"
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/60 dark:border-zinc-700/60 pt-2 leading-relaxed">
                عند تفعيل هذا الخيار، يتم ترحيل الفائض المالي المتبقي كسيولة إضافية في رصيد الشهر التالي، وحسم العجز لضمان عدم تجاوز ميزانيتك الواقعية.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Opening Balance & Income Setup */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <label htmlFor="onboarding-opening-balance" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                الرصيد الافتتاحي الحالي (في محفظتك أو حسابك البنكي)
              </label>
              <div className="relative">
                <input
                  id="onboarding-opening-balance"
                  type="text"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                />
                <Coins className="w-4 h-4 text-zinc-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
                المبلغ النقدي المتوفر لديك لبدء التتبع به. لا يُسجل كدخل شهر، فلا يؤثر على معدل ادخارك السنوي.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    تسجيل الراتب الشهري المتكرر تلقائياً
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    إيداع الراتب آلياً كل شهر في يوم بداية دورتك المالية ({monthStartDay})
                  </div>
                </div>
                <Toggle
                  checked={addSalary}
                  onChange={setAddSalary}
                  id="onboarding-salary-toggle"
                  label="تسجيل الراتب تلقائياً"
                />
              </div>

              {addSalary && (
                <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 animate-in fade-in duration-150">
                  <label htmlFor="onboarding-salary-amount" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    قيمة الراتب الشهري
                  </label>
                  <input
                    id="onboarding-salary-amount"
                    type="text"
                    inputMode="decimal"
                    value={salaryAmount}
                    onChange={(e) => setSalaryAmount(e.target.value)}
                    placeholder="مثال: 750"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Category Customization */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                اختر التصنيفات التي تهمك
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                انقر على التصنيف لإلغائه أو تفعيله (سيتم أرشفة غير المحدد تلقائياً ويمكنك استعادته في أي وقت).
              </p>
            </div>

            {categoryWarning && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                {categoryWarning}
              </div>
            )}

            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
              {activeCategories.map((cat) => {
                const isSelected = !deselectedCategoryIds.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 opacity-60'
                    }`}
                  >
                    <CategoryIcon icon={cat.icon} color={isSelected ? cat.color : undefined} size="sm" />
                    <span>{cat.name}</span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Add Custom Category Form */}
            {!showAddCategory ? (
              <button
                type="button"
                onClick={() => setShowAddCategory(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <span>+ تصنيف مخصص</span>
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">إضافة تصنيف جديد</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false)
                      setNewCatName('')
                    }}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="اسم التصنيف (مثال: صالة رياضية)"
                    className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCatType('expense')}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold border cursor-pointer ${
                        newCatType === 'expense'
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      مصروف
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCatType('income')}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold border cursor-pointer ${
                        newCatType === 'income'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      دخل
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                          newCatColor === c ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!newCatName.trim() || creatingCategory}
                    onClick={async () => {
                      if (!uid || !newCatName.trim()) return
                      setCreatingCategory(true)
                      try {
                        await addCategory(uid, {
                          name: newCatName.trim(),
                          type: newCatType,
                          icon: newCatType === 'expense' ? 'tag' : 'wallet',
                          color: newCatColor,
                          archived: false,
                          order: activeCategories.length + 1,
                        })
                        setNewCatName('')
                        setShowAddCategory(false)
                      } catch (err) {
                        console.error('Failed to add category:', err)
                      } finally {
                        setCreatingCategory(false)
                      }
                    }}
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    {creatingCategory ? 'جاري الإضافة...' : 'حفظ التصنيف'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={submitting}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                السابق
              </Button>
            )}
          </div>

          <div>
            {step < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                <span>التالي</span>
                <ArrowLeft className="w-4 h-4 ms-1.5" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinish}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-500/20"
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                {submitting ? 'جاري الحفظ...' : 'إتمام وبدء الاستخدام'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
