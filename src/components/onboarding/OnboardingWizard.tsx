import React, { useState, useEffect, useMemo } from 'react'
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { BaseerLogo } from '../ui/BaseerLogo'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useCategories } from '../../hooks/useCategories'
import { PRESET_CURRENCIES, toFils, detectDefaultCurrency, MAX_AMOUNT_FILS } from '../../lib/money'
import { archiveCategory, archiveCategoriesBatch } from '../../services/categories'
import { addRecurring, processDueRecurring } from '../../services/recurring'
import type { Category } from '../../types'
import { WelcomeCurrencyStep } from './steps/WelcomeCurrencyStep'
import { FinancialCycleStep } from './steps/FinancialCycleStep'
import { OpeningBalanceStep } from './steps/OpeningBalanceStep'
import { CategoriesSelectionStep } from './steps/CategoriesSelectionStep'

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
      const openingBalanceFils = openingBalance
        ? Math.min(MAX_AMOUNT_FILS, Math.max(0, toFils(openingBalance, decimalsOrCurrency)))
        : 0
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
        const rawSalaryFils = toFils(salaryAmount, decimalsOrCurrency)
        const salaryFils = Math.min(MAX_AMOUNT_FILS, Math.max(0, rawSalaryFils))
        if (salaryFils > 0) {
          const incomeCategories = categories.filter((c) => c.type === 'income' && !c.archived)
          const salaryCat =
            incomeCategories.find((c) => c.name.includes('راتب')) || incomeCategories[0]

          if (salaryCat) {
            const today = new Date()
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
            const startDate = new Date(today.getFullYear(), today.getMonth(), safeMonthStartDay, 0, 0, 0, 0)
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
      hideCloseButton
      title=""
      className="max-w-xl p-0 overflow-hidden rounded-2xl"
    >
      <div className="p-2 sm:p-3 space-y-5 text-start">
        {/* Header with step progress and Skip button */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <BaseerLogo variant="app-icon" size={38} className="shrink-0 shadow-xs" />
            <div>
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                الخطوة {step} من 4: {stepsTitles[step - 1]}
              </div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-50 mt-0.5">
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
          <WelcomeCurrencyStep
            displayName={displayName}
            setDisplayName={setDisplayName}
            currency={currency}
            setCurrency={setCurrency}
            isCustomCurrency={isCustomCurrency}
            setIsCustomCurrency={setIsCustomCurrency}
            customCurrencyDecimals={customCurrencyDecimals}
            setCustomCurrencyDecimals={setCustomCurrencyDecimals}
          />
        )}

        {/* STEP 2: Financial Cycle */}
        {step === 2 && (
          <FinancialCycleStep
            monthStartDay={monthStartDay}
            setMonthStartDay={setMonthStartDay}
            rolloverBalance={rolloverBalance}
            setRolloverBalance={setRolloverBalance}
          />
        )}

        {/* STEP 3: Opening Balance & Income */}
        {step === 3 && (
          <OpeningBalanceStep
            openingBalance={openingBalance}
            setOpeningBalance={setOpeningBalance}
            addSalary={addSalary}
            setAddSalary={setAddSalary}
            salaryAmount={salaryAmount}
            setSalaryAmount={setSalaryAmount}
            monthStartDay={monthStartDay}
          />
        )}

        {/* STEP 4: Categories */}
        {step === 4 && (
          <CategoriesSelectionStep
            uid={uid}
            activeCategories={activeCategories}
            deselectedCategoryIds={deselectedCategoryIds}
            onToggleCategory={handleToggleCategory}
            categoryWarning={categoryWarning}
          />
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
                disabled={submitting || (step === 1 && isCustomCurrency && !currency.trim())}
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
                className="font-bold"
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
