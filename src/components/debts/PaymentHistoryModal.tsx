import React, { useState } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Trash2, AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { deleteDebtPayment } from '../../services/debts'
import { useCurrency } from '../../hooks/useCurrency'
import { getDebtRemainingFils } from '../../lib/debts'
import { toWesternDigits } from '../../lib/dates'
import type { Debt } from '../../types'

export interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onSuccess?: () => void
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  debt,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { format: formatCurrency } = useCurrency()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleClose = () => {
    setConfirmDeleteId(null)
    onClose()
  }

  if (!debt) return null

  const remainingFils = getDebtRemainingFils(debt)
  const payments = debt.payments || []

  const handleDeletePayment = async (paymentId: string) => {
    if (!user) return

    setDeletingId(paymentId)
    try {
      await deleteDebtPayment(user.uid, debt, paymentId)
      showToast('تم حذف الدفعة وتحديث الرصيد', 'success')
      setConfirmDeleteId(null)
      onSuccess?.()
    } catch (err) {
      console.error('Error deleting payment:', err)
      showToast(err instanceof Error ? err.message : 'فشل حذف الدفعة', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`سجل الدفعات — ${debt.personName}`}
    >
      <div className="space-y-4">
        {/* Summary Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">المبلغ الأصلي</span>
            <span className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200">
              {formatCurrency(debt.amountFils)}
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">المسدد حتى الآن</span>
            <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(debt.paidFils || 0)}
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">المتبقي</span>
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
              {formatCurrency(remainingFils)}
            </span>
          </div>
        </div>

        {/* Payments List */}
        {payments.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">لا توجد أي دفعات مسجلة بعد لهذا الدين</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
            {payments
              .slice()
              .reverse()
              .map((p) => {
                const formattedDate = toWesternDigits(
                  format(p.date, 'd MMMM yyyy', { locale: ar })
                )
                const isDeleting = deletingId === p.id

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        + {formatCurrency(p.amountFils)}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        {formattedDate}
                        {p.note ? ` • ${p.note}` : ''}
                      </div>
                    </div>

                    {confirmDeleteId === p.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeletePayment(p.id)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(deletingId)}
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="حذف هذه الدفعة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              })}
          </div>
        )}

        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full font-bold"
            onClick={handleClose}
          >
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  )
}
