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
import { addDebt, updateDebt, checkDebtInitialTransactionExists } from '../../services/debts'
import { toFils, fromFils, MAX_AMOUNT_FILS } from '../../lib/money'
import { parseLocalDateInput } from '../../lib/dates'
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

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* 1. Type Selector (Segmented control) */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          نوع الدين
        </label>
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-700/60 gap-1 w-full">
          <button
            type="button"
            onClick={() => setType('lent')}
            className={cn(
              'flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5',
              type === 'lent'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>لي (أنا داينت فلان)</span>
          </button>
          <button
            type="button"
            onClick={() => setType('borrowed')}
            className={cn(
              'flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5',
              type === 'borrowed'
                ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span>عليّ (أنا استدنت)</span>
          </button>
        </div>
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
      </div>

      {/* 3. Amount Input in JOD */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          المبلغ الكلي
        </label>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700',
            hasMultipleEntries
              ? 'opacity-60 bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed'
              : 'focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20'
          )}
        >
          <input
            type="text"
            inputMode="decimal"
            placeholder={config.decimals === 3 ? '0.000' : '0.00'}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            disabled={hasMultipleEntries}
            readOnly={hasMultipleEntries}
            className={cn(
              'w-full bg-transparent text-2xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none',
              hasMultipleEntries && 'cursor-not-allowed'
            )}
            required
          />
          <span className="text-base font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
            {config.symbol}
          </span>
        </div>
        {hasMultipleEntries && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
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
          <label htmlFor="pre-paid-input" className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            المبلغ المسدد مسبقاً من هذا الدين (اختياري)
          </label>
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
            <input
              id="pre-paid-input"
              type="text"
              inputMode="decimal"
              placeholder={config.decimals === 3 ? '0.000' : '0.00'}
              value={initialPaidStr}
              onChange={(e) => setInitialPaidStr(e.target.value)}
              className="w-full bg-transparent text-base font-bold font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none"
            />
            <span className="text-sm font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
              {config.symbol}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
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
      <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              تحديد موعد استحقاق
            </span>
            <span className="text-[11px] text-slate-400">
              تنبيه عند حلول موعد السداد المتفق عليه
            </span>
          </div>
          <input
            type="checkbox"
            checked={hasDueDate}
            onChange={(e) => {
              setHasDueDate(e.target.checked)
              if (e.target.checked && !dueDateStr) {
                setDueDateStr(format(new Date(), 'yyyy-MM-dd'))
              }
            }}
            className="w-4 h-4 accent-emerald-500 cursor-pointer"
          />
        </div>

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
      <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
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

export const DebtFormModal: React.FC<DebtFormModalProps> = ({
  isOpen,
  onClose,
  initialDebt,
  onSuccess,
}) => {
  const [isDirty, setIsDirty] = useState(false)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialDebt ? 'تعديل بيانات الدين' : 'إضافة دين جديد'}
      closeOnBackdropClick={!isDirty && !initialDebt}
    >
      {isOpen && (
        <DebtFormContent
          key={initialDebt?.id ?? 'new'}
          initialDebt={initialDebt}
          onClose={onClose}
          onSuccess={onSuccess}
          onDirtyChange={setIsDirty}
        />
      )}
    </Modal>
  )
}
