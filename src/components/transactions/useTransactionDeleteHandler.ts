import { deleteTransaction } from '../../services/transactions'
import { removeDebtPayment } from '../../services/debts'
import { removeCircleInstallmentPayment } from '../../services/moneyCircles'
import type { Transaction } from '../../types'
import type { TransactionLockStatus } from '../../lib/transactionLocks'

export interface UseTransactionDeleteHandlerParams {
  user: { uid: string } | null
  initialTransaction?: Transaction | null
  lockStatus: TransactionLockStatus
  isSourceDeleted?: boolean
  setError: (err: string | null) => void
  setDeleting: (val: boolean) => void
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onSuccess?: () => void
  onClose: () => void
}

export function useTransactionDeleteHandler(params: UseTransactionDeleteHandlerParams) {
  const {
    user,
    initialTransaction,
    lockStatus,
    isSourceDeleted,
    setError,
    setDeleting,
    showToast,
    onSuccess,
    onClose,
  } = params

  const {
    isLinkedToDebtPayment,
    linkedDebtPayment,
    isLinkedToDebtInit,
    isLinkedToDebtEntry,
    isDebtExists,
    isDebtEntryExists,
    isLinkedToCircle,
    isCircleExists,
    isLinkedToCircleInstallment,
    circleInstallmentId,
    circleInstallmentMonth,
  } = lockStatus

  const handleDelete = async () => {
    if (!user || !initialTransaction) return
    if (isLinkedToDebtPayment && linkedDebtPayment) {
      if (linkedDebtPayment.payment.isMerged) {
        setError('لا يمكن حذف دفعة مدمجة من هنا، يرجى إدارتها من سجل الديون.')
        return
      }
      setDeleting(true)
      try {
        await removeDebtPayment(user.uid, linkedDebtPayment.debt, linkedDebtPayment.payment.id)
        showToast(
          `تم حذف دفعة السداد لـ (${linkedDebtPayment.debt.personName}) وإعادة فتح المبلغ المستحق في سجل الدين بنجاح`,
          'info'
        )
        onSuccess?.()
        onClose()
      } catch (err) {
        console.error('Failed to remove linked debt payment:', err)
        setError('تعذر حذف دفعة الدين المرتبطة')
      } finally {
        setDeleting(false)
      }
      return
    }
    if (isLinkedToDebtInit && isDebtExists && !isSourceDeleted) {
      setError('لا يمكن حذف معاملة أصل الدين من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.')
      return
    }
    if (isLinkedToDebtEntry && isDebtEntryExists && !isSourceDeleted) {
      setError('لا يمكن حذف معاملة السلفة الإضافية من هنا، يرجى حذف أو إدارة الدين من صفحة الديون.')
      return
    }
    if (isLinkedToCircle && isCircleExists && !isSourceDeleted) {
      setError('لا يمكن حذف معاملات إيداع الجمعيات من هنا، يرجى إدارتها من صفحة الجمعيات.')
      return
    }
    if (isLinkedToCircleInstallment && circleInstallmentId && circleInstallmentMonth && user) {
      setDeleting(true)
      try {
        await removeCircleInstallmentPayment(user.uid, circleInstallmentId, circleInstallmentMonth)
        showToast('تم حذف قسط الجمعية وتحديث السجل بنجاح', 'info')
        onSuccess?.()
        onClose()
      } catch (err) {
        console.error('Failed to remove circle installment:', err)
        setError('تعذر حذف قسط الجمعية')
      } finally {
        setDeleting(false)
      }
      return
    }
    setDeleting(true)
    try {
      await deleteTransaction(user.uid, initialTransaction.id)
      showToast('تم حذف المعاملة', 'info')
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      setError('تعذر حذف المعاملة')
    } finally {
      setDeleting(false)
    }
  }

  return { handleDelete }
}
