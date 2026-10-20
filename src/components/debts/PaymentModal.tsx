import React, { useState } from 'react'
import { format } from 'date-fns'
import { Zap, AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Toggle } from '../ui/Toggle'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { addDebtPayment } from '../../services/debts'
import { toFils, fromFils } from '../../lib/money'
import { useCurrency } from '../../hooks/useCurrency'
import { getDebtRemainingFils } from '../../lib/debts'
import { parseLocalDateInput } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Debt } from '../../types'

export interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onSuccess?: () => void
}

interface PaymentFormContentProps {
  debt: Debt
  onClose: () => void
  onSuccess?: () => void
}

const PaymentFormContent: React.FC<PaymentFormContentProps> = ({
  debt,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { format: formatCurrency, config } = useCurrency()

  const [amountStr, setAmountStr] = useState('')
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [syncTransaction, setSyncTransaction] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const remainingFils = getDebtRemainingFils(debt)
  const isLent = debt.type === 'lent'
  const paymentsCount = (debt.payments || []).length
  const isMaxPaymentsReached = paymentsCount >= 100

  const handleFillFullRemaining = () => {
    setAmountStr(String(fromFils(remainingFils)))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (isMaxPaymentsReached) {
      setError('وصل هذا الدين إلى الحد الأقصى لعدد الدفعات (100 دفعة). يمكنك تسوية المبلغ المتبقي بدفعة واحدة عبر تعديل إجمالي الدين.')
      return
    }

    const amountFils = toFils(amountStr, config.decimals)
    if (amountFils <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    if (amountFils > remainingFils) {
      setError(`مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي (${formatCurrency(remainingFils)})`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const date = parseLocalDateInput(dateStr)
      const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
      const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
      const paymentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
      if (paymentDay < debtStartDay) {
        setError('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
        return
      }

      const fallbackNote = isLent ? 'استرداد دفعة دين' : 'سداد دفعة دين'
      await addDebtPayment(
        user.uid,
        debt,
        {
          amountFils,
          date,
          note: note.trim() || fallbackNote,
        },
        { syncTransaction }
      )

      showToast('تم تسجيل الدفعة بنجاح', 'success')
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error adding debt payment:', err)
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الدفعة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isMaxPaymentsReached && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-semibold space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>تم الوصول للحد الأقصى للدفعات (100 دفعة)</span>
          </div>
          <p>
            تفرض قواعد الأمان حداً أقصى 100 دفعة لكل دين. لا يمكن تسجيل دفعات إضافية لهذا السجل، ويمكنك تسوية المبلغ المتبقي بدفعة واحدة عبر تعديل إجمالي مبلغ الدين في شاشة التعديل.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Debt Info Card */}
      <div
        className={cn(
          'p-3.5 rounded-2xl border flex items-center justify-between',
          isLent
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/40'
            : 'bg-red-50 dark:bg-red-950/40 border-red-200/60 dark:border-red-900/40'
        )}
      >
        <div>
          <span
            className={cn(
              'text-xs font-bold block',
              isLent
                ? 'text-emerald-800 dark:text-emerald-300'
                : 'text-red-800 dark:text-red-300'
            )}
          >
            {debt.personName}
          </span>
          <span
            className={cn(
              'text-[11px] font-medium',
              isLent
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            المبلغ المتبقي الحالي
          </span>
        </div>
        <span
          className={cn(
            'text-lg font-black',
            isLent
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-red-700 dark:text-red-300'
          )}
        >
          {formatCurrency(remainingFils)}
        </span>
      </div>

      {/* Amount Input */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          مبلغ الدفعة
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

      {/* Quick Fill Button */}
      {remainingFils > 0 && (
        <button
          type="button"
          onClick={handleFillFullRemaining}
          className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>سداد كامل المبلغ المتبقي ({formatCurrency(remainingFils)}) بنقرة واحدة</span>
        </button>
      )}

      {/* Date */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          تاريخ الدفعة
        </label>
        <input
          type="date"
          value={dateStr}
          min={format(debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate), 'yyyy-MM-dd')}
          onChange={(e) => setDateStr(e.target.value)}
          className="w-full rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2 text-sm outline-none border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
          required
        />
      </div>

      {/* Note */}
      <div>
        <Input
          label="ملاحظة الدفعة (اختياري)"
          placeholder="مثال: تحويل كليك / نقد باليد"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Accounting Sync Toggle */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
        <Toggle
          checked={syncTransaction}
          onChange={setSyncTransaction}
          label={
            isLent
              ? 'إضافة الدفعة إلى الرصيد الحالي تلقائياً'
              : 'خصم الدفعة من الرصيد الحالي تلقائياً'
          }
          description={
            isLent
              ? 'تسجيل المعاملة كدخل لتحديث الرصيد الفعلي'
              : 'تسجيل المعاملة كمصروف لتحديث الرصيد الفعلي'
          }
        />
      </div>

      {/* Actions */}
      <div className="pt-2 flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          className="flex-1 font-bold"
          disabled={loading || isMaxPaymentsReached}
        >
          {loading ? 'جارٍ التسجيل...' : isMaxPaymentsReached ? 'الحد الأقصى مكتمل (100 دفعة)' : 'تأكيد تسجيل الدفعة'}
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

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  debt,
  onSuccess,
}) => {
  if (!debt) return null

  const isLent = debt.type === 'lent'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLent ? 'تسجيل دفعة استرداد' : 'تسجيل دفعة سداد'}
    >
      {isOpen && (
        <PaymentFormContent
          key={debt.id}
          debt={debt}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  )
}
