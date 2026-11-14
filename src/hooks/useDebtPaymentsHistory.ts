import { useState } from 'react'
import { format } from 'date-fns'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { useCurrency } from './useCurrency'
import {
  deleteDebtPayment,
  updateDebtPayment,
  checkDebtPaymentTransactionExists,
  compactDebtPayments,
} from '../services/debts'
import { resolvePaymentAmountWithTolerance } from '../lib/debts'
import { parseLocalDateInput } from '../lib/dates'
import { fromFils, toFils } from '../lib/money'
import { triggerHaptic } from '../lib/haptics'
import type { Debt, DebtPayment } from '../types'

interface UseDebtPaymentsHistoryProps {
  debt: Debt | null
  onSuccess?: () => void
}

export function useDebtPaymentsHistory({ debt, onSuccess }: UseDebtPaymentsHistoryProps) {
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
  const [editSyncTx, setEditSyncTx] = useState(true)
  const [checkingEditSync, setCheckingEditSync] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)

  const payments = debt?.payments || []
  const debtStartDate = debt?.startDate
    ? debt.startDate instanceof Date
      ? debt.startDate
      : new Date(debt.startDate)
    : new Date()
  const debtStartStr = format(debtStartDate, 'yyyy-MM-dd')

  const handleDeletePayment = async (paymentId: string, deleteTx: boolean = true) => {
    if (!user || !debt) return

    setDeletingId(paymentId)
    try {
      await deleteDebtPayment(user.uid, debt, paymentId, { deleteTransaction: deleteTx })
      triggerHaptic('destructive')
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
    if (!debt) return
    setConfirmDeleteId(null)
    setEditingPaymentId(p.id)
    setEditAmountStr(String(fromFils(p.amountFils)))
    const pDate = p.date instanceof Date ? p.date : new Date(p.date)
    setEditDateStr(format(pDate, 'yyyy-MM-dd'))
    setEditNote(p.note || '')
    setEditError(null)

    const isSynced = Boolean(p.transactionId)
    setEditSyncTx(isSynced)

    if (user && !p.transactionId) {
      setCheckingEditSync(true)
      checkDebtPaymentTransactionExists(user.uid, debt, p)
        .then((exists) => {
          setEditSyncTx(exists)
        })
        .catch(() => {})
        .finally(() => {
          setCheckingEditSync(false)
        })
    } else {
      setCheckingEditSync(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingPaymentId(null)
    setEditSyncTx(true)
    setCheckingEditSync(false)
    setEditError(null)
  }

  const handleSaveEdit = async (p: DebtPayment) => {
    if (!user || !debt) return
    let amountFils = toFils(editAmountStr, config.decimals)
    if (amountFils <= 0) {
      setEditError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    const previousPaymentsSum = payments.reduce((acc, item) => acc + item.amountFils, 0)
    const untrackedPaidFils = Math.max(0, (debt.paidFils || 0) - previousPaymentsSum)
    const otherPaymentsTotal = payments
      .filter((item) => item.id !== p.id)
      .reduce((sum, item) => sum + item.amountFils, 0)
    const maxAllowed = Math.max(0, debt.amountFils - (otherPaymentsTotal + untrackedPaidFils))

    amountFils = resolvePaymentAmountWithTolerance(amountFils, maxAllowed, config.decimals)

    if (amountFils > maxAllowed) {
      setEditError(`مبلغ الدفعة لا يمكن أن يتجاوز الحد الأقصى المتاح للتعديل (${formatCurrency(maxAllowed)})`)
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
        syncTransaction: editSyncTx,
      })
      triggerHaptic('impact')
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

  const handleCompact = async () => {
    if (!user || !debt) return
    setIsCompacting(true)
    try {
      const result = await compactDebtPayments(user.uid, debt.id)
      if (result.mergedCount > 0) {
        showToast(`تم دمج ${result.mergedCount} دفعة قديمة بنجاح`, 'success')
        onSuccess?.()
      } else {
        showToast('لا توجد دفعات كافية للدمج', 'info')
      }
    } catch (err) {
      console.error('Failed to compact payments:', err)
      showToast(err instanceof Error ? err.message : 'فشل دمج الدفعات', 'error')
    } finally {
      setIsCompacting(false)
    }
  }

  const resetPaymentsState = () => {
    setConfirmDeleteId(null)
    setDeletePaymentTx(true)
    setEditingPaymentId(null)
    setEditSyncTx(true)
    setCheckingEditSync(false)
    setEditError(null)
  }

  return {
    payments,
    debtStartStr,
    isCompacting,
    handleCompact,
    deletingId,
    confirmDeleteId,
    setConfirmDeleteId,
    deletePaymentTx,
    setDeletePaymentTx,
    handleDeletePayment,
    editingPaymentId,
    setEditingPaymentId,
    editAmountStr,
    setEditAmountStr,
    editDateStr,
    setEditDateStr,
    editNote,
    setEditNote,
    editSyncTx,
    setEditSyncTx,
    checkingEditSync,
    editError,
    isSavingEdit,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    resetPaymentsState,
  }
}
