import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { AlertCircle, Info } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { DatePickerInput } from '../ui/DatePickerInput'
import { Toggle } from '../ui/Toggle'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useDebts } from '../../hooks/useDebts'
import { addDebt, updateDebt, checkDebtInitialTransactionExists } from '../../services/debts'
import { AppDataContext, type AppDataContextValue } from '../../context/AppDataContext'
import { toFils, fromFils, MAX_AMOUNT_FILS } from '../../lib/money'
import { toWesternDigits, parseLocalDateInput } from '../../lib/dates'
import { useCurrency } from '../../hooks/useCurrency'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'
import type { Debt, DebtType } from '../../types'

export interface DebtFormModalProps {
  isOpen: boolean
  onClose: () => void
  initialDebt?: Debt | null
  onSuccess?: () => void
}

interface DebtFormContentProps {
  initialDebt?: Debt | null
  onClose: () => void
  onSuccess?: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

const DebtFormContent: React.FC<DebtFormContentProps> = ({
  initialDebt,
  onClose,
  onSuccess,
  onDirtyChange,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { format: formatCurrency, config } = useCurrency()
  const { data: debts } = useDebts()

  const isEditing = Boolean(initialDebt)
  const hasMultipleEntries = Boolean(isEditing && initialDebt?.entries && initialDebt.entries.length > 1)

  const [type, setType] = useState<DebtType>(() => initialDebt?.type ?? 'lent')
  const [personName, setPersonName] = useState(() => initialDebt?.personName ?? '')
  const [amountStr, setAmountStr] = useState(() =>
    initialDebt ? String(fromFils(initialDebt.amountFils)) : ''
  )
  const [initialPaidStr, setInitialPaidStr] = useState('')
  const [startDateStr, setStartDateStr] = useState(() =>
    initialDebt?.startDate
      ? format(new Date(initialDebt.startDate), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  )
  const [hasDueDate, setHasDueDate] = useState(() => Boolean(initialDebt?.dueDate))
  const [dueDateStr, setDueDateStr] = useState(() =>
    initialDebt?.dueDate ? format(new Date(initialDebt.dueDate), 'yyyy-MM-dd') : ''
  )
  const [note, setNote] = useState(() => initialDebt?.note ?? '')
  const [syncTransaction, setSyncTransaction] = useState(true)
  const [syncManuallyToggled, setSyncManuallyToggled] = useState(false)
  const [checkingSync, setCheckingSync] = useState(isEditing)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialDebt) return
    onDirtyChange?.(
      Boolean(
        personName.trim() ||
          amountStr.trim() ||
          note.trim() ||
          initialPaidStr.trim()
      )
    )
  }, [onDirtyChange, initialDebt, personName, amountStr, note, initialPaidStr])

  const isPastDebt = React.useMemo(() => {
    if (isEditing) return false
    try {
      const parsed = parseLocalDateInput(startDateStr)
      const now = new Date()
      const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const initialPaid = toFils(initialPaidStr, config.decimals)
      return parsed < firstOfCurrentMonth || initialPaid > 0
    } catch {
      return false
    }
  }, [isEditing, startDateStr, initialPaidStr, config.decimals])

  useEffect(() => {
    if (!isEditing && !syncManuallyToggled) {
      if (isPastDebt) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSyncTransaction(false)
      } else {
        setSyncTransaction(true)
      }
    }
  }, [isPastDebt, isEditing, syncManuallyToggled])

  useEffect(() => {
    if (!user || !initialDebt) return
    let active = true
    checkDebtInitialTransactionExists(user.uid, initialDebt.id, initialDebt)
      .then((exists) => {
        if (active) {
          setSyncTransaction(exists)
          setCheckingSync(false)
        }
      })
      .catch((err) => {
        console.error('Failed to check debt initial transaction:', err)
        if (active) {
          setCheckingSync(false)
        }
      })
    return () => {
      active = false
    }
  }, [user, initialDebt])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const trimmedName = personName.trim()
    if (!trimmedName) {
      setError('يرجى إدخال اسم الشخص')
      return
    }

    const amountFils = toFils(amountStr, config.decimals)
    if (amountFils <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    if (amountFils > MAX_AMOUNT_FILS) {
      setError('المبلغ يتجاوز الحد الأقصى المسموح به')
      return
    }

    if (isEditing && initialDebt && amountFils < (initialDebt.paidFils || 0)) {
      setError(
        `لا يمكن أن يكون إجمالي الدين أقل من المبلغ المسدد بالفعل (${formatCurrency(initialDebt.paidFils)})`
      )
      return
    }

    setLoading(true)
    setError(null)

    try {
      const startDate = parseLocalDateInput(startDateStr)
      const dueDate = hasDueDate && dueDateStr ? parseLocalDateInput(dueDateStr) : null

      if (dueDate && dueDate < startDate) {
        setError('موعد الاستحقاق لا يمكن أن يسبق تاريخ الدين')
        setLoading(false)
        return
      }

      if (
        isEditing &&
        initialDebt &&
        Array.isArray(initialDebt.payments) &&
        initialDebt.payments.length > 0
      ) {
        const paymentDates = initialDebt.payments
          .map((p) => (p.date instanceof Date ? p.date : new Date(p.date)))
          .filter((d) => !isNaN(d.getTime()))

        if (paymentDates.length > 0) {
          const earliestPayment = new Date(Math.min(...paymentDates.map((d) => d.getTime())))
          const startDateDay = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
            0, 0, 0, 0
          )
          const earliestPaymentDay = new Date(
            earliestPayment.getFullYear(),
            earliestPayment.getMonth(),
            earliestPayment.getDate(),
            0, 0, 0, 0
          )
          if (startDateDay > earliestPaymentDay) {
            setError('تاريخ الدين لا يمكن أن يكون بعد تاريخ أقدم دفعة مسجلة')
            setLoading(false)
            return
          }
        }
      }

      if (isEditing && initialDebt) {
        const paidFils = initialDebt.paidFils ?? 0
        const settled = amountFils === paidFils
        const updatedEntries =
          initialDebt.entries && initialDebt.entries.length === 1 && amountFils !== initialDebt.amountFils
            ? [{ ...initialDebt.entries[0], amountFils }]
            : undefined

        await updateDebt(
          user.uid,
          initialDebt.id,
          {
            personName: trimmedName,
            type,
            amountFils,
            paidFils,
            settled,
            startDate,
            dueDate,
            note: note.trim(),
            ...(updatedEntries ? { entries: updatedEntries } : {}),
          },
          { syncTransaction }
        )
        triggerHaptic('light')
        showToast('تم تحديث بيانات الدين بنجاح', 'success')
      } else {
        const initialPaidFils = !isEditing && initialPaidStr.trim() ? toFils(initialPaidStr, config.decimals) : 0
        if (initialPaidFils < 0) {
          setError('المبلغ المسدد مسبقاً لا يمكن أن يكون سالباً')
          setLoading(false)
          return
        }
        if (initialPaidFils > amountFils) {
          setError('المبلغ المسدد مسبقاً لا يمكن أن يتجاوز إجمالي الدين')
          setLoading(false)
          return
        }

        const defaultDebtNote = type === 'lent' ? 'دين مستحق (لي)' : 'دين مستحق (عليّ)'
        const safeNote = note.trim() || defaultDebtNote
        await addDebt(
          user.uid,
          {
            personName: trimmedName,
            type,
            amountFils,
            startDate,
            dueDate,
            note: safeNote,
          },
          {
            syncTransaction,
            initialPaidFils: initialPaidFils > 0 ? initialPaidFils : undefined,
            initialPaymentNote: 'سداد مسبق (توثيقي)',
          }
        )
        triggerHaptic('light')
        showToast('تمت إضافة الدين بنجاح', 'success')
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error saving debt:', err)
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الدين')
    } finally {
      setLoading(false)
    }
  }

  const personSuggestions = React.useMemo(() => {
    if (isEditing) return []
    const query = personName.trim().toLowerCase()
    if (!query) return []
    const uniqueNames = Array.from(
      new Set((debts || []).map((d) => d.personName?.trim()).filter(Boolean))
    )
    return uniqueNames
      .filter((name) => {
        const lower = name.toLowerCase()
        return lower.includes(query) && lower !== query
      })
      .slice(0, 5)
  }, [debts, personName, isEditing])

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* 1. Type Selector (Segmented control) */}
      <div>
        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
          نوع الدين
        </label>
        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-[#E4E4E7] dark:border-[#27272A] gap-1 w-full">
          <button
            type="button"
            disabled={isEditing && (initialDebt?.payments?.length ?? 0) > 0}
            onClick={() => setType('lent')}
            className={cn(
              'flex-1 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5',
              type === 'lent'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              isEditing && (initialDebt?.payments?.length ?? 0) > 0
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer'
            )}
          >
            <span>مستحق لي (بذمة الآخرين)</span>
          </button>
          <button
            type="button"
            disabled={isEditing && (initialDebt?.payments?.length ?? 0) > 0}
            onClick={() => setType('borrowed')}
            className={cn(
              'flex-1 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5',
              type === 'borrowed'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              isEditing && (initialDebt?.payments?.length ?? 0) > 0
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer'
            )}
          >
            <span>التزام عليّ (للآخرين)</span>
          </button>
        </div>
        {isEditing && (initialDebt?.payments?.length ?? 0) > 0 && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium">
            لا يمكن تغيير اتجاه الدين بعد تسجيل دفعات سداد عليه حفاظاً على سلامة الحسابات.
          </p>
        )}
        {isEditing && (initialDebt?.payments?.length ?? 0) === 0 && type !== initialDebt?.type && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-semibold">
            تنبيه: تغيير نوع الدين سيقلب طبيعة الحركة المالية في المحفظة (من مصروف إلى دخل أو العكس).
          </p>
        )}
      </div>

      {/* 2. Person Name */}
      <div>
        <Input
          label="اسم الشخص"
          placeholder="مثال: أحمد العبدلله"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          required
          maxLength={100}
        />
        {!isEditing && personSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[11px] text-zinc-400 select-none">اقتراحات:</span>
            {personSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setPersonName(name)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer font-medium"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Amount Input in JOD */}
      <div>
        <label htmlFor="debt-total-amount" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
          المبلغ الكلي
        </label>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]',
            hasMultipleEntries
              ? 'opacity-60 bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed'
              : 'focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20'
          )}
        >
          <input
            id="debt-total-amount"
            type="text"
            inputMode="decimal"
            placeholder={config.decimals === 3 ? '0.000' : '0.00'}
            value={amountStr}
            onChange={(e) => setAmountStr(toWesternDigits(e.target.value))}
            disabled={hasMultipleEntries}
            readOnly={hasMultipleEntries}
            className={cn(
              'w-full bg-transparent text-2xl font-black text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none tabular-nums',
              hasMultipleEntries && 'cursor-not-allowed'
            )}
            required
          />
          <span className="text-base font-bold text-zinc-500 dark:text-zinc-400 select-none pe-1">
            {config.symbol}
          </span>
        </div>
        {hasMultipleEntries && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span>يتكون هذا الدين من عدة سلف مجمعة؛ لتعديل المبالغ يرجى إدارة السلف من نافذة سجل الحركات وكشف الحساب.</span>
          </p>
        )}
        {isEditing &&
          initialDebt &&
          !hasMultipleEntries &&
          (initialDebt.paidFils || 0) > 0 &&
          toFils(amountStr, config.decimals) > 0 &&
          toFils(amountStr, config.decimals) < (initialDebt.paidFils || 0) && (
            <p className="text-xs text-red-500 dark:text-red-400 font-semibold mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                لا يمكن أن يكون إجمالي الدين أقل من المبلغ المسدد بالفعل ({formatCurrency(initialDebt.paidFils)})
              </span>
            </p>
          )}
      </div>

      {/* 3b. Pre-paid Amount (for new debts) */}
      {!isEditing && (
        <div>
          <label htmlFor="pre-paid-input" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
            المبلغ المسدد مسبقاً من هذا الدين (اختياري)
          </label>
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
            <input
              id="pre-paid-input"
              type="text"
              inputMode="decimal"
              placeholder={config.decimals === 3 ? '0.000' : '0.00'}
              value={initialPaidStr}
              onChange={(e) => setInitialPaidStr(toWesternDigits(e.target.value))}
              className="w-full bg-transparent text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none tabular-nums"
            />
            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 select-none pe-1">
              {config.symbol}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            سجل المبلغ المسدد مسبقاً إذا كان الدين قديماً لتوثيق تاريخه وسداده دون التأثير على سيولة اليوم.
          </p>
        </div>
      )}

      {/* 4. Start Date */}
      <div>
        <DatePickerInput
          label="تاريخ الدين"
          value={startDateStr}
          onChange={(val) => setStartDateStr(val)}
          required
        />
      </div>

      {/* 5. Due Date Toggle */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <Toggle
          label="تحديد موعد استحقاق"
          description="تنبيه عند حلول موعد السداد المتفق عليه"
          checked={hasDueDate}
          onChange={(val) => {
            setHasDueDate(val)
            if (val && !dueDateStr) {
              setDueDateStr(format(new Date(), 'yyyy-MM-dd'))
            }
          }}
        />

        {hasDueDate && (
          <div className="pt-2">
            <DatePickerInput
              label="تاريخ الاستحقاق"
              value={dueDateStr}
              onChange={(val) => setDueDateStr(val)}
              required={hasDueDate}
            />
          </div>
        )}
      </div>

      {/* 6. Note */}
      <div>
        <Input
          label="ملاحظات وتفاصيل (اختياري)"
          placeholder="مثال: سبب السلفة، طريقة التسليم..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* 7. Accounting Sync Toggle */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <Toggle
          checked={syncTransaction}
          onChange={(val) => {
            setSyncManuallyToggled(true)
            setSyncTransaction(val)
          }}
          disabled={checkingSync || loading}
          label={
            type === 'lent'
              ? 'خصم المبلغ من الرصيد الحالي تلقائياً'
              : 'إضافة المبلغ للرصيد الحالي (استلمت المبلغ نقداً)'
          }
          description="يربط مبلغ أصل الدين برصيد محفظتك كمعاملة مالية (دفعات السداد تُدار بشكل مستقل)."
        />
        {isPastDebt && !syncTransaction && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1 font-medium pt-1 border-t border-amber-200/40 dark:border-amber-900/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>بما أن هذا دين سابق، تم إيقاف خصم أصل الدين من سيولة اليوم تلقائياً (ويمكنك تفعيله إن أردت).</span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          className="flex-1 font-bold"
          disabled={loading}
        >
          {loading ? 'جارٍ الحفظ...' : isEditing ? 'تحديث الدين' : 'حفظ الدين'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
        >
          إلغاء
        </Button>
      </div>
    </form>
  )
}

const fallbackAppData: AppDataContextValue = {
  settings: null,
  settingsLoading: false,
  settingsError: null,
  updateSettings: async () => {},
  categories: [],
  categoriesLoading: false,
  categoriesError: null,
  debts: [],
  debtsLoading: false,
  debtsError: null,
  recurring: [],
  recurringLoading: false,
  recurringError: null,
  moneyCircles: [],
  moneyCirclesLoading: false,
  moneyCirclesError: null,
  rolloverBalanceFils: 0,
  setRolloverBalanceFils: () => {},
}

export const DebtFormModal: React.FC<DebtFormModalProps> = ({
  isOpen,
  onClose,
  initialDebt,
  onSuccess,
}) => {
  const [isDirty, setIsDirty] = useState(false)
  const existingAppData = React.useContext(AppDataContext)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialDebt ? 'تعديل بيانات الدين' : 'إضافة دين جديد'}
      closeOnBackdropClick={!isDirty && !initialDebt}
    >
      {isOpen && (
        <AppDataContext.Provider value={existingAppData ?? fallbackAppData}>
          <DebtFormContent
            key={initialDebt?.id ?? 'new'}
            initialDebt={initialDebt}
            onClose={onClose}
            onSuccess={onSuccess}
            onDirtyChange={setIsDirty}
          />
        </AppDataContext.Provider>
      )}
    </Modal>
  )
}
