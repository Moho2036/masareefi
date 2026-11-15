import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { DebtFormFields } from './DebtFormFields'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useDebts } from '../../hooks/useDebts'
import { addDebt, updateDebt, checkDebtInitialTransactionExists } from '../../services/debts'
import { AppDataContext, type AppDataContextValue } from '../../context/AppDataContext'
import { toFils, fromFils, MAX_AMOUNT_FILS } from '../../lib/money'
import { parseLocalDateInput } from '../../lib/dates'
import { useCurrency } from '../../hooks/useCurrency'
import { triggerHaptic } from '../../lib/haptics'
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncTransaction(!isPastDebt)
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
        triggerHaptic('impact')
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
        triggerHaptic('impact')
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

      <DebtFormFields
        isEditing={isEditing}
        initialDebt={initialDebt}
        type={type}
        setType={setType}
        personName={personName}
        setPersonName={setPersonName}
        personSuggestions={personSuggestions}
        amountStr={amountStr}
        setAmountStr={setAmountStr}
        hasMultipleEntries={hasMultipleEntries}
        initialPaidStr={initialPaidStr}
        setInitialPaidStr={setInitialPaidStr}
        startDateStr={startDateStr}
        setStartDateStr={setStartDateStr}
        hasDueDate={hasDueDate}
        setHasDueDate={setHasDueDate}
        dueDateStr={dueDateStr}
        setDueDateStr={setDueDateStr}
        note={note}
        setNote={setNote}
        syncTransaction={syncTransaction}
        setSyncTransaction={setSyncTransaction}
        setSyncManuallyToggled={setSyncManuallyToggled}
        checkingSync={checkingSync}
        loading={loading}
        isPastDebt={isPastDebt}
        config={config}
        formatCurrency={formatCurrency}
      />

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
      <AppDataContext.Provider value={existingAppData ?? fallbackAppData}>
        <DebtFormContent
          key={initialDebt?.id ?? 'new'}
          initialDebt={initialDebt}
          onClose={onClose}
          onSuccess={onSuccess}
          onDirtyChange={setIsDirty}
        />
      </AppDataContext.Provider>
    </Modal>
  )
}
