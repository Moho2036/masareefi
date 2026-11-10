import { useState } from 'react'
import { processDueRecurring, updateRecurring } from '../../../services/recurring'
import { getOrCreateDebtCategory } from '../../../services/debts'
import {
  updateMoneyCircle,
  deleteMoneyCircle,
  deleteCirclePayout,
  getCurrentCircleMonth,
  depositCircleNetPayout,
  toggleCircleMemberPayment,
  swapMemberTurns,
} from '../../../services/moneyCircles'
import type { MoneyCircle, CircleMember, Category, Recurring } from '../../../types'

export interface UseMoneyCirclesActionsProps {
  user: { uid: string } | null
  monthStartDay: number
  defaultExpenseCategory?: Category
  defaultIncomeCategory?: Category
  recurringList: Recurring[]
  depositedCircleIds: Set<string>
  addDepositedCircleId: (id: string) => void
  removeDepositedCircleId: (id: string) => void
  checkedCirclesRef: React.MutableRefObject<Set<string>>
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function useMoneyCirclesActions({
  user,
  monthStartDay,
  defaultExpenseCategory,
  defaultIncomeCategory,
  recurringList,
  depositedCircleIds,
  addDepositedCircleId,
  removeDepositedCircleId,
  checkedCirclesRef,
  showToast,
}: UseMoneyCirclesActionsProps) {
  const [deleteCircleId, setDeleteCircleId] = useState<string | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmCompleteCircle, setConfirmCompleteCircle] = useState<MoneyCircle | null>(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [depositingCircleId, setDepositingCircleId] = useState<string | null>(null)
  const [togglingMemberKey, setTogglingMemberKey] = useState<string | null>(null)
  const [swapTarget, setSwapTarget] = useState<{ circle: MoneyCircle; member: CircleMember } | null>(null)
  const [swapWithMemberId, setSwapWithMemberId] = useState<string>('')
  const [isSwapping, setIsSwapping] = useState(false)

  const isCircleScheduled = (circle: MoneyCircle) => {
    const linked = recurringList.find(
      (r) => r.id === circle.recurringId || r.circleId === circle.id
    )
    return Boolean(linked && linked.active !== false)
  }

  const handleScheduleCircle = async (circle: MoneyCircle) => {
    if (!user) return
    const targetCatId = circle.expenseCategoryId || defaultExpenseCategory?.id
    if (!targetCatId) {
      showToast('يرجى إنشاء تصنيف مصاريف أولاً', 'error')
      return
    }
    const isAlreadyScheduled = isCircleScheduled(circle)
    if (isAlreadyScheduled) {
      showToast('القسط مجدول بالفعل كمعاملة متكررة', 'info')
      return
    }
    try {
      await updateMoneyCircle(
        user.uid,
        circle.id,
        {},
        {
          monthStartDay,
          createRecurringRule: true,
          defaultCategoryId: targetCatId,
        }
      )
      await processDueRecurring(user.uid)
      showToast('تمت جدولة القسط بنجاح مع تخطي شهر استلامك!', 'success')
    } catch (err) {
      console.error('Failed to schedule circle:', err)
      showToast('تعذر جدولة القسط', 'error')
    }
  }

  const handleDepositCircleNet = async (circle: MoneyCircle) => {
    if (!user) return
    setDepositingCircleId(circle.id)
    try {
      let incomeCatId = circle.incomeCategoryId || defaultIncomeCategory?.id
      if (!incomeCatId) {
        incomeCatId = await getOrCreateDebtCategory(user.uid, 'income')
      }

      const currentMonth = getCurrentCircleMonth(circle, new Date(), monthStartDay)
      const isSecondTurnDeposit = Boolean(
        circle.shareType === 'double' &&
          circle.secondTurnMonth &&
          currentMonth >= circle.secondTurnMonth &&
          depositedCircleIds.has(circle.id)
      )

      await depositCircleNetPayout(user.uid, circle, incomeCatId, isSecondTurnDeposit)
      const depositedKey = isSecondTurnDeposit ? `${circle.id}_t2` : circle.id
      addDepositedCircleId(depositedKey)
      showToast('تم إيداع صافي الجمعية في رصيدك بنجاح', 'success')
    } catch (err) {
      console.error('Failed to deposit circle net:', err)
      showToast(err instanceof Error ? err.message : 'تعذر إيداع صافي الجمعية', 'error')
    } finally {
      setDepositingCircleId(null)
    }
  }

  const handleUndoDepositCircleNet = async (circle: MoneyCircle, targetTurn?: 't1' | 't2') => {
    if (!user) return
    setDepositingCircleId(circle.id)
    try {
      const isSecondTurn = targetTurn
        ? targetTurn === 't2'
        : Boolean(circle.shareType === 'double' && depositedCircleIds.has(`${circle.id}_t2`))
      await deleteCirclePayout(user.uid, circle.id, isSecondTurn)
      if (isSecondTurn) {
        removeDepositedCircleId(`${circle.id}_t2`)
        checkedCirclesRef.current.delete(`${circle.id}_t2`)
      } else {
        removeDepositedCircleId(circle.id)
        checkedCirclesRef.current.delete(circle.id)
      }
      showToast('تم إلغاء إيداع صافي الجمعية من الرصيد', 'info')
    } catch (err) {
      console.error('Failed to undo deposit circle net:', err)
      showToast(err instanceof Error ? err.message : 'تعذر إلغاء إيداع صافي الجمعية', 'error')
    } finally {
      setDepositingCircleId(null)
    }
  }

  const handleResumeRecurring = async (recId: string) => {
    if (!user) return
    try {
      await updateRecurring(user.uid, recId, { active: true })
      await processDueRecurring(user.uid)
      showToast('تمت إعادة تفعيل الجدولة التلقائية للقسط', 'success')
    } catch (err) {
      console.error('Failed to resume recurring:', err)
      showToast('تعذر إعادة تفعيل الجدولة', 'error')
    }
  }

  const handleToggleMemberPayment = async (
    circle: MoneyCircle,
    memberId: string,
    monthNum: number
  ) => {
    if (!user) return
    const toggleKey = `${circle.id}_${memberId}_${monthNum}`
    if (togglingMemberKey === toggleKey) return

    const targetMember = circle.members.find((m) => m.id === memberId)
    const isUserMember = Boolean(
      targetMember &&
        (targetMember.turnMonth === circle.myTurnMonth ||
          (circle.shareType === 'double' &&
            circle.secondTurnMonth !== undefined &&
            targetMember.turnMonth === circle.secondTurnMonth))
    )
    const isTargetExempt = Boolean(
      targetMember &&
        (targetMember.turnMonth === monthNum ||
          (isUserMember &&
            (monthNum === circle.myTurnMonth ||
              (circle.shareType === 'double' && monthNum === circle.secondTurnMonth))))
    )
    if (isTargetExempt) return

    setTogglingMemberKey(toggleKey)
    try {
      const res = await toggleCircleMemberPayment(
        user.uid,
        circle.id,
        memberId,
        monthNum,
        defaultExpenseCategory?.id
      )
      if (res.isUser) {
        showToast(
          res.paid
            ? 'تم تسجيل القسط وخصمه من الرصيد'
            : 'تم إلغاء القسط واسترداد المبلغ للرصيد',
          res.paid ? 'success' : 'info'
        )
      }
    } catch (err) {
      console.error('Failed to toggle member payment:', err)
      showToast('تعذر تحديث حالة الدفع', 'error')
    } finally {
      setTogglingMemberKey(null)
    }
  }

  const handleDelete = async () => {
    if (!user || !deleteCircleId || isDeleting) return
    setIsDeleting(true)
    try {
      await deleteMoneyCircle(user.uid, deleteCircleId, { deleteTransactions })
      removeDepositedCircleId(deleteCircleId)
      removeDepositedCircleId(`${deleteCircleId}_t2`)
      checkedCirclesRef.current.delete(deleteCircleId)
      checkedCirclesRef.current.delete(`${deleteCircleId}_t2`)
      showToast('تم حذف الجمعية بنجاح', 'info')
      setDeleteCircleId(null)
      setDeleteTransactions(false)
    } catch (err) {
      console.error('Failed to delete circle:', err)
      showToast('تعذر حذف الجمعية', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCompleteCircle = async (circle: MoneyCircle) => {
    if (!user) return
    setIsCompleting(true)
    try {
      await updateMoneyCircle(
        user.uid,
        circle.id,
        { status: 'completed' },
        { monthStartDay }
      )
      showToast('تم إنهاء الجمعية بنجاح', 'success')
      setConfirmCompleteCircle(null)
    } catch (err) {
      console.error('Failed to complete circle:', err)
      showToast('تعذر إنهاء الجمعية', 'error')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleRestoreCircle = async (circle: MoneyCircle) => {
    if (!user) return
    try {
      await updateMoneyCircle(
        user.uid,
        circle.id,
        { status: 'active' },
        { monthStartDay }
      )
      showToast('تمت استعادة الجمعية إلى القائمة النشطة بنجاح', 'success')
    } catch (err) {
      console.error('Failed to restore circle:', err)
      showToast('تعذر استعادة الجمعية', 'error')
    }
  }

  const handleConfirmSwap = async () => {
    if (!user || !swapTarget || !swapWithMemberId) return
    setIsSwapping(true)
    try {
      await swapMemberTurns(user.uid, swapTarget.circle.id, swapTarget.member.id, swapWithMemberId, {
        monthStartDay,
      })
      removeDepositedCircleId(swapTarget.circle.id)
      removeDepositedCircleId(`${swapTarget.circle.id}_t2`)
      checkedCirclesRef.current.delete(swapTarget.circle.id)
      checkedCirclesRef.current.delete(`${swapTarget.circle.id}_t2`)
      showToast('تم تبديل الأدوار بنجاح', 'success')
      setSwapTarget(null)
      setSwapWithMemberId('')
    } catch (err) {
      console.error('Swap turns failed:', err)
      showToast(err instanceof Error ? err.message : 'تعذر تبديل الدور', 'error')
    } finally {
      setIsSwapping(false)
    }
  }

  return {
    deleteCircleId,
    setDeleteCircleId,
    deleteTransactions,
    setDeleteTransactions,
    isDeleting,
    handleDelete,
    confirmCompleteCircle,
    setConfirmCompleteCircle,
    isCompleting,
    handleCompleteCircle,
    handleRestoreCircle,
    depositingCircleId,
    handleDepositCircleNet,
    handleUndoDepositCircleNet,
    handleResumeRecurring,
    handleScheduleCircle,
    togglingMemberKey,
    handleToggleMemberPayment,
    swapTarget,
    setSwapTarget,
    swapWithMemberId,
    setSwapWithMemberId,
    isSwapping,
    handleConfirmSwap,
  }
}
