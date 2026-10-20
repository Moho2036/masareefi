import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Toggle } from '../ui/Toggle'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { addDebt, updateDebt, checkDebtInitialTransactionExists } from '../../services/debts'
import { toFils, fromFils } from '../../lib/money'
import { parseLocalDateInput } from '../../lib/dates'
import { useCurrency } from '../../hooks/useCurrency'
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
}

const DebtFormContent: React.FC<DebtFormContentProps> = ({
  initialDebt,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { format: formatCurrency, config } = useCurrency()

  const isEditing = Boolean(initialDebt)

  const [type, setType] = useState<DebtType>(() => initialDebt?.type ?? 'lent')
  const [personName, setPersonName] = useState(() => initialDebt?.personName ?? '')
  const [amountStr, setAmountStr] = useState(() =>
    initialDebt ? String(fromFils(initialDebt.amountFils)) : ''
  )
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
  const [checkingSync, setCheckingSync] = useState(isEditing)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !initialDebt) return
    let active = true
    checkDebtInitialTransactionExists(user.uid, initialDebt.id)
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

    const amountFils = toFils(amountStr)
    if (amountFils <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    if (isEditing && initialDebt && amountFils < (initialDebt.paidFils || 0)) {
      setError(
        `المبلغ الجديد لا يمكن أن يقل عن المبالغ المسددة مسبقاً (${formatCurrency(initialDebt.paidFils)})`
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

      if (isEditing && initialDebt) {
        await updateDebt(
          user.uid,
          initialDebt.id,
          {
            personName: trimmedName,
            type,
            amountFils,
            paidFils: initialDebt.paidFils ?? 0,
            startDate,
            dueDate,
            note: note.trim(),
          },
          { syncTransaction }
        )
        showToast('تم تحديث بيانات الدين بنجاح', 'success')
      } else {
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
          { syncTransaction }
        )
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
          <input
            type="text"
            inputMode="decimal"
            placeholder={config.decimals === 3 ? '0.000' : '0.00'}
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full bg-transparent text-2xl font-black text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none"
            required
          />
          <span className="text-base font-bold text-slate-400 dark:text-slate-500 select-none pe-1">
            {config.symbol}
          </span>
        </div>
      </div>

      {/* 4. Start Date */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          تاريخ الدين
        </label>
        <input
          type="date"
          value={startDateStr}
          onChange={(e) => setStartDateStr(e.target.value)}
          className="w-full rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2 text-sm outline-none border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
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
            <input
              type="date"
              value={dueDateStr}
              onChange={(e) => setDueDateStr(e.target.value)}
              className="w-full rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2 text-sm outline-none border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
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
      <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
        <Toggle
          checked={syncTransaction}
          onChange={setSyncTransaction}
          disabled={checkingSync || loading}
          label={
            type === 'lent'
              ? 'خصم المبلغ من الرصيد الحالي تلقائياً'
              : 'إضافة المبلغ للرصيد الحالي (استلمت المبلغ نقداً)'
          }
          description={
            isEditing
              ? syncTransaction
                ? 'المعاملة مرتبطة بالرصيد. إيقاف المفتاح سيحذف المعاملة ويلغي تأثيرها على الرصيد.'
                : 'المعاملة غير مرتبطة بالرصيد. تفعيل المفتاح سينشئ معاملة ويؤثر على الرصيد.'
              : type === 'lent'
                ? 'تسجيل المعاملة كمصروف لتحديث الرصيد الفعلي'
                : 'تسجيل المعاملة كدخل لتحديث الرصيد الفعلي'
          }
        />
      </div>

      {/* Actions */}
      <div className="pt-2 flex items-center gap-3">
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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialDebt ? 'تعديل بيانات الدين' : 'إضافة دين جديد'}
    >
      {isOpen && (
        <DebtFormContent
          key={initialDebt?.id ?? 'new'}
          initialDebt={initialDebt}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  )
}
