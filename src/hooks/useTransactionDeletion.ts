import { useState, useMemo } from 'react'
import type { Transaction, MoneyCircle } from '../types'
import type { DebtLookup } from '../lib/transactionLocks'
import type { ToastType } from './useToast'
import { deleteTransaction } from '../services/transactions'
import { removeDebtPayment } from '../services/debts'
import { removeCircleInstallmentPayment } from '../services/moneyCircles'
import { getOccurrenceMonthIndex } from '../lib/recurring'

interface UseTransactionDeletionProps {
  userId: string | undefined
  circles: MoneyCircle[]
  debtLookup: DebtLookup
  circleIdsSet: Set<string>
  showToast: (msg: string, type?: ToastType) => void
}

export function useTransactionDeletion({
  userId,
  circles,
  debtLookup,
  circleIdsSet,
  showToast,
}: UseTransactionDeletionProps) {
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  const linkedDebtPayment = txToDelete?.id ? debtLookup.paymentByTxIdMap.get(txToDelete.id) ?? null : null

  const circleInstallmentToDelete = useMemo(() => {
    if (!txToDelete) return null
    const match = txToDelete.id.match(/^circle_(.+)_m(\d+)$/)
    if (match) {
      const c = circles.find((circle) => circle.id === match[1])
      return { name: c?.name || 'الجمعية' }
    }
    if (txToDelete.recurringId) {
      const c = circles.find((circle) => circle.recurringId === txToDelete.recurringId)
      if (c) return { name: c.name || 'الجمعية' }
    }
    return null
  }, [txToDelete, circles])

  const handleDeleteConfirm = async () => {
    if (!userId || !txToDelete) return

    if (linkedDebtPayment) {
      if (linkedDebtPayment.payment.isMerged) {
        showToast('لا يمكن حذف دفعة مدمجة من هنا، يرجى إدارتها من سجل الديون.', 'error')
        setTxToDelete(null)
        return
      }
      setDeleting(true)
      try {
        await removeDebtPayment(userId, linkedDebtPayment.debt, linkedDebtPayment.payment.id)
        showToast(
          `تم حذف دفعة السداد لـ (${linkedDebtPayment.debt.personName}) وإعادة فتح المبلغ المستحق في سجل الدين بنجاح`,
          'info'
        )
        setTxToDelete(null)
      } catch (err) {
        console.error('Failed to remove linked debt payment:', err)
        showToast('تعذر حذف دفعة الدين المرتبطة', 'error')
      } finally {
        setDeleting(false)
      }
      return
    }

    if (txToDelete.id.startsWith('debt_init_')) {
      const debtId = txToDelete.id.replace('debt_init_', '')
      if ((debtId && debtLookup.debtIdsSet.has(debtId)) || debtLookup.entryTxIdsSet.has(txToDelete.id)) {
        showToast('لا يمكن حذف معاملة أصل الدين من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.', 'error')
        setTxToDelete(null)
        return
      }
    }
    if (txToDelete.id.startsWith('debt_entry_')) {
      if (debtLookup.entryTxIdsSet.has(txToDelete.id)) {
        showToast('لا يمكن حذف معاملة السلفة الإضافية من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.', 'error')
        setTxToDelete(null)
        return
      }
    }
    if (txToDelete.id.startsWith('circle_payout_')) {
      const circleId = txToDelete.id.replace('circle_payout_', '')
      if (circleId && circleIdsSet.has(circleId)) {
        showToast('لا يمكن حذف معاملات إيداع الجمعيات من هنا، يرجى إدارتها من صفحة الجمعيات.', 'error')
        setTxToDelete(null)
        return
      }
    }
    const circleInstallmentMatch = txToDelete.id.match(/^circle_(.+)_m(\d+)$/)
    if (circleInstallmentMatch) {
      const circleId = circleInstallmentMatch[1]
      const monthNum = parseInt(circleInstallmentMatch[2], 10)
      setDeleting(true)
      try {
        await removeCircleInstallmentPayment(userId, circleId, monthNum)
        showToast('تم حذف قسط الجمعية وتحديث السجل بنجاح', 'info')
        setTxToDelete(null)
      } catch (err) {
        console.error('Failed to remove circle installment:', err)
        showToast('تعذر حذف قسط الجمعية', 'error')
      } finally {
        setDeleting(false)
      }
      return
    }
    if (!circleInstallmentMatch && txToDelete.recurringId) {
      const linkedCircle = circles.find((c) => c.recurringId === txToDelete.recurringId)
      if (linkedCircle) {
        const monthNum = getOccurrenceMonthIndex(linkedCircle.startDate, txToDelete.date)
        if (monthNum >= 1 && monthNum <= linkedCircle.membersCount) {
          setDeleting(true)
          try {
            await removeCircleInstallmentPayment(userId, linkedCircle.id, monthNum)
            showToast('تم حذف قسط الجمعية وتحديث السجل بنجاح', 'info')
            setTxToDelete(null)
          } catch (err) {
            console.error('Failed to remove circle installment:', err)
            showToast('تعذر حذف قسط الجمعية', 'error')
          } finally {
            setDeleting(false)
          }
          return
        }
      }
    }
    setDeleting(true)
    try {
      await deleteTransaction(userId, txToDelete.id)
      showToast('تم حذف المعاملة بنجاح', 'info')
      setTxToDelete(null)
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      showToast('تعذر حذف المعاملة', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return {
    txToDelete,
    setTxToDelete,
    deleting,
    linkedDebtPayment,
    circleInstallmentToDelete,
    handleDeleteConfirm,
  }
}
