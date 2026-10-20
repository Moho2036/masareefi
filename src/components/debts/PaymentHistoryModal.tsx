import React, { useState } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Trash2, AlertCircle, Pencil } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { deleteDebtPayment, updateDebtPayment } from '../../services/debts'
import { useCurrency } from '../../hooks/useCurrency'
import { getDebtRemainingFils } from '../../lib/debts'
import { toWesternDigits, parseLocalDateInput } from '../../lib/dates'
import { fromFils, toFils } from '../../lib/money'
import { cn } from '../../lib/cn'
import type { Debt, DebtPayment } from '../../types'

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
  const { format: formatCurrency, config } = useCurrency()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletePaymentTx, setDeletePaymentTx] = useState(true)

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editAmountStr, setEditAmountStr] = useState('')
  const [editDateStr, setEditDateStr] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const handleClose = () => {
    setConfirmDeleteId(null)
    setDeletePaymentTx(true)
    setEditingPaymentId(null)
    setEditError(null)
    onClose()
  }

  if (!debt) return null

  const remainingFils = getDebtRemainingFils(debt)
  const payments = debt.payments || []
  const isLent = debt.type === 'lent'
  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const debtStartStr = format(debtStartDate, 'yyyy-MM-dd')

  const handleDeletePayment = async (paymentId: string, deleteTx: boolean = true) => {
    if (!user) return

    setDeletingId(paymentId)
    try {
      await deleteDebtPayment(user.uid, debt, paymentId, { deleteTransaction: deleteTx })
      showToast('تم حذف الدفعة وتحديث الرصيد', 'success')
      setConfirmDeleteId(null)
      setDeletePaymentTx(true)
      onSuccess?.()
    } catch (err) {
      console.error('Error deleting payment:', err)
      showToast(err instanceof Error ? err.message : 'فشل حذف الدفعة', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleStartEdit = (p: DebtPayment) => {
    setConfirmDeleteId(null)
    setEditingPaymentId(p.id)
    setEditAmountStr(String(fromFils(p.amountFils)))
    const pDate = p.date instanceof Date ? p.date : new Date(p.date)
    setEditDateStr(format(pDate, 'yyyy-MM-dd'))
    setEditNote(p.note || '')
    setEditError(null)
  }

  const handleCancelEdit = () => {
    setEditingPaymentId(null)
    setEditError(null)
  }

  const handleSaveEdit = async (p: DebtPayment) => {
    if (!user) return
    const amountFils = toFils(editAmountStr, config.decimals)
    if (amountFils <= 0) {
      setEditError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    const otherPaymentsTotal = payments
      .filter((item) => item.id !== p.id)
      .reduce((sum, item) => sum + item.amountFils, 0)
    const maxAllowed = Math.max(0, debt.amountFils - otherPaymentsTotal)
    if (amountFils > maxAllowed) {
      setEditError(`مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي (${formatCurrency(maxAllowed)})`)
      return
    }

    const date = parseLocalDateInput(editDateStr)
    const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
    const paymentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    if (paymentDay < debtStartDay) {
      setEditError('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
      return
    }

    setIsSavingEdit(true)
    setEditError(null)
    try {
      await updateDebtPayment(user.uid, debt, p.id, {
        amountFils,
        date,
        note: editNote.trim(),
      })
      showToast('تم تعديل الدفعة وتحديث الرصيد', 'success')
      setEditingPaymentId(null)
      onSuccess?.()
    } catch (err) {
      console.error('Error updating debt payment:', err)
      setEditError(err instanceof Error ? err.message : 'فشل تعديل الدفعة')
    } finally {
      setIsSavingEdit(false)
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
            <span
              className={cn(
                'text-xs sm:text-sm font-black',
                isLent
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              )}
            >
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
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-2.5"
                  >
                    {editingPaymentId === p.id ? (
                      <div className="w-full space-y-2.5">
                        {editError && (
                          <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50">
                            {editError}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">المبلغ</label>
                            <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800">
                              <input
                                type="number"
                                step="any"
                                value={editAmountStr}
                                onChange={(e) => setEditAmountStr(e.target.value)}
                                className="w-full text-xs font-bold bg-transparent outline-none text-slate-800 dark:text-slate-100"
                                required
                              />
                              <span className="text-[10px] text-slate-400 font-bold">{config.symbol}</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">التاريخ</label>
                            <input
                              type="date"
                              value={editDateStr}
                              min={debtStartStr}
                              onChange={(e) => setEditDateStr(e.target.value)}
                              className="w-full text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">الملاحظة</label>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                            placeholder="ملاحظة للدفعة..."
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(p)}
                            disabled={isSavingEdit}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
                          </button>
                        </div>
                      </div>
                    ) : confirmDeleteId === p.id ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div
                              className={cn(
                                'text-sm font-black',
                                isLent
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              )}
                            >
                              {isLent ? '+' : '-'} {formatCurrency(p.amountFils)}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                              {formattedDate}
                              {p.note ? ` • ${p.note}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-red-50/70 dark:bg-red-950/30 rounded-xl border border-red-200/80 dark:border-red-900/50 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>تأكيد حذف الدفعة؟</span>
                          </div>

                          <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700/80 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-200 select-none">
                            <input
                              type="checkbox"
                              checked={deletePaymentTx}
                              onChange={(e) => setDeletePaymentTx(e.target.checked)}
                              className="w-4 h-4 rounded-sm text-emerald-600 accent-emerald-600 cursor-pointer"
                            />
                            <span>حذف المعاملة المالية المرتبطة من سجل المعاملات أيضاً</span>
                          </label>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => {
                                setConfirmDeleteId(null)
                                setDeletePaymentTx(true)
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeletePayment(p.id, deletePaymentTx)}
                              className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={cn(
                              'text-sm font-black',
                              isLent
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            )}
                          >
                            {isLent ? '+' : '-'} {formatCurrency(p.amountFils)}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                            {formattedDate}
                            {p.note ? ` • ${p.note}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={Boolean(deletingId) || isSavingEdit}
                            onClick={() => handleStartEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="تعديل هذه الدفعة"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(deletingId) || isSavingEdit}
                            onClick={() => {
                              setEditingPaymentId(null)
                              setConfirmDeleteId(p.id)
                              setDeletePaymentTx(true)
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="حذف هذه الدفعة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
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
