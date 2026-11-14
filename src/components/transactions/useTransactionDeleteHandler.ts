import { deleteTransaction } from '../../services/transactions'
import { deleteDebt, deleteDebtEntry, removeDebtPayment } from '../../services/debts'
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
    linkedDebt,
    linkedDebtEntry,
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
    if (isLinkedToDebtInit && linkedDebt && !isSourceDeleted) {
      setDeleting(true)
      try {
        await deleteDebt(user.uid, linkedDebt.id, { deleteTransactions: true })
        showToast(`تم حذف الدين لـ (${linkedDebt.personName}) وجميع معاملاته بنجاح`, 'info')
        onSuccess?.()
        onClose()
      } catch (err) {
        console.error('Failed to delete linked debt:', err)
        setError('تعذر حذف الدين المرتبط')
      } finally {
        setDeleting(false)
      }
      return
    }
    if (isLinkedToDebtEntry && linkedDebtEntry && !isSourceDeleted) {
      if (linkedDebtEntry.entry.isMerged) {
        setError('لا يمكن حذف سلفة مدمجة من هنا، يرجى إدارتها من سجل الديون.')
        return
      }
      setDeleting(true)
      try {
        await deleteDebtEntry(user.uid, linkedDebtEntry.debt, linkedDebtEntry.entry.id)
        showToast(`تم حذف السلفة الإضافية لـ (${linkedDebtEntry.debt.personName}) بنجاح`, 'info')
        onSuccess?.()
        onClose()
      } catch (err) {
        console.error('Failed to delete linked debt entry:', err)
        setError('تعذر حذف السلفة الإضافية المرتبطة')
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
