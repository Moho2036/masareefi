import { updateDebtPayment } from '../../services/debts'
import { recordCategoryUsage } from '../../lib/categoryUsage'
import type { Debt, DebtPayment } from '../../types'

export interface DebtPaymentLinked {
  debt: Debt
  payment: DebtPayment
}

export interface HandleLinkedDebtPaymentParams {
  userId: string
  linkedDebtPayment: DebtPaymentLinked
  initialCategoryId: string
  initialNote: string
  activeCategoryId: string
  note: string
  parsedDate: Date
  amountFils: number
  trimmedTitle: string
  isOutsideMonth: boolean
  setSelectedDate: (d: Date) => void
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onSuccess?: () => void
  onClose: () => void
}

export async function handleLinkedDebtPaymentUpdate(
  params: HandleLinkedDebtPaymentParams
): Promise<{ handled: true; error?: string } | { handled: false }> {
  const {
    userId,
    linkedDebtPayment,
    initialCategoryId,
    initialNote,
    activeCategoryId,
    note,
    parsedDate,
    amountFils,
    trimmedTitle,
    isOutsideMonth,
    setSelectedDate,
    showToast,
    onSuccess,
    onClose,
  } = params

  if (linkedDebtPayment.payment.isMerged) {
    const catOrNoteChanged =
      activeCategoryId !== initialCategoryId ||
      note.trim() !== initialNote.trim()
    if (!catOrNoteChanged) {
      return { handled: true, error: 'لا يمكن تعديل دفعة مدمجة من هنا، يرجى إدارتها من سجل الديون.' }
    }
  } else {
    const debtStartDate =
      linkedDebtPayment.debt.startDate instanceof Date
        ? linkedDebtPayment.debt.startDate
        : new Date(linkedDebtPayment.debt.startDate)
    const debtStartDay = new Date(
      debtStartDate.getFullYear(),
      debtStartDate.getMonth(),
      debtStartDate.getDate(),
      0, 0, 0, 0
    )
    const paymentDay = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
      0, 0, 0, 0
    )
    if (paymentDay < debtStartDay) {
      return { handled: true, error: 'تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين' }
    }
    const previousPaymentsSum = (linkedDebtPayment.debt.payments || []).reduce(
      (acc: number, p: DebtPayment) => acc + p.amountFils,
      0
    )
    const untrackedPaidFils = Math.max(
      0,
      (linkedDebtPayment.debt.paidFils || 0) - previousPaymentsSum
    )
    const otherPaymentsTotal = (linkedDebtPayment.debt.payments || [])
      .filter((p: DebtPayment) => p.id !== linkedDebtPayment.payment.id)
      .reduce((sum: number, p: DebtPayment) => sum + p.amountFils, 0)
    const remainingAllowed = Math.max(
      0,
      linkedDebtPayment.debt.amountFils - (otherPaymentsTotal + untrackedPaidFils)
    )
    if (amountFils > remainingAllowed) {
      return { handled: true, error: 'مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين' }
    }

    await updateDebtPayment(
      userId,
      linkedDebtPayment.debt,
      linkedDebtPayment.payment.id,
      {
        amountFils,
        date: parsedDate,
        note: note.trim().slice(0, 500),
        categoryId: activeCategoryId,
        title: trimmedTitle,
      }
    )
    recordCategoryUsage(activeCategoryId)
    showToast('تم تعديل دفعة الدين وتحديث سجل الدين بنجاح', 'success')
    if (isOutsideMonth) {
      setSelectedDate(parsedDate)
    }
    onSuccess?.()
    onClose()
    return { handled: true }
  }

  return { handled: false }
}
