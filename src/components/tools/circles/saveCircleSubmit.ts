import type { MoneyCircle, Category, CircleMember, CircleShareType, Recurring } from '../../../types'
import {
  addMoneyCircle,
  updateMoneyCircle,
  checkCirclePayoutExists,
} from '../../../services/moneyCircles'
import { processDueRecurring } from '../../../services/recurring'
import { toFils } from '../../../lib/money'
import { parseLocalDateInput } from '../../../lib/dates'
import { triggerHaptic } from '../../../lib/haptics'

export interface SaveCircleParams {
  user: { uid: string } | null
  editingCircle: MoneyCircle | null
  name: string
  monthlyAmount: number
  membersCount: number
  myTurnMonth: number
  startDateStr: string
  shareType: CircleShareType
  secondTurnMonthStr: string
  expenseCategoryId: string
  incomeCategoryId: string
  autoSchedule: boolean
  wasPausedOnOpen: boolean
  autoScheduleTouched: boolean
  isManager: boolean
  customMembers: string[]
  monthStartDay: number
  config: { decimals: number; symbol: string }
  defaultExpenseCategory?: Category
  defaultIncomeCategory?: Category
  recurringList: Recurring[]
  addDepositedCircleId: (id: string) => void
  removeDepositedCircleId: (id: string) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  setFormError: (err: string | null) => void
  setSubmitting: (submitting: boolean) => void
  setIsAddModalOpen: (open: boolean) => void
  setEditingCircle: (circle: MoneyCircle | null) => void
}

export async function executeSaveCircle(params: SaveCircleParams): Promise<void> {
  const {
    user,
    editingCircle,
    name,
    monthlyAmount,
    membersCount,
    myTurnMonth,
    startDateStr,
    shareType,
    secondTurnMonthStr,
    expenseCategoryId,
    incomeCategoryId,
    autoSchedule,
    wasPausedOnOpen,
    autoScheduleTouched,
    isManager,
    customMembers,
    monthStartDay,
    config,
    defaultExpenseCategory,
    defaultIncomeCategory,
    recurringList,
    addDepositedCircleId,
    removeDepositedCircleId,
    showToast,
    setFormError,
    setSubmitting,
    setIsAddModalOpen,
    setEditingCircle,
  } = params

  if (!user) return
  const trimmedName = name.trim()
  if (!trimmedName) {
    setFormError('يرجى إدخال اسم الجمعية')
    return
  }

  if (monthlyAmount <= 0) {
    setFormError('يرجى إدخال قسط شهري صحيح')
    return
  }

  setSubmitting(true)
  setFormError(null)

  try {
    const totalAmountFils = toFils(monthlyAmount * membersCount, config.decimals)
    const monthlyAmountFils = toFils(monthlyAmount, config.decimals)
    const startDate = parseLocalDateInput(startDateStr)

    if (editingCircle) {
      const oldTurnMonth = editingCircle.myTurnMonth
      const newTurnMonth = myTurnMonth
      const isTurnChanged = oldTurnMonth !== newTurnMonth
      const oldUserMember = editingCircle.members?.find(
        (m) => m.turnMonth === oldTurnMonth || m.name === 'أنت'
      )

      const members: CircleMember[] = []
      const secondTurnNum = shareType === 'double' ? parseInt(secondTurnMonthStr, 10) : undefined
      for (let i = 1; i <= membersCount; i++) {
        const isSecond = shareType === 'double' && i === secondTurnNum
        const defaultName = i === newTurnMonth ? 'أنت' : isSecond ? 'أنت (سهم 2)' : `عضو ${i}`

        let existingMember: CircleMember | undefined

        if (i === newTurnMonth) {
          existingMember = oldUserMember
        } else if (i === oldTurnMonth) {
          existingMember = editingCircle.members?.find(
            (m) => m.turnMonth === newTurnMonth && m.id !== oldUserMember?.id
          )
          if (!existingMember) {
            const enteredName = isManager ? (customMembers[i - 1] || '').trim() : ''
            const searchName = enteredName || defaultName
            existingMember = editingCircle.members?.find(
              (m) => m.name === searchName && m.id !== oldUserMember?.id
            )
          }
        } else {
          existingMember = editingCircle.members?.find(
            (m) => m.turnMonth === i && m.id !== oldUserMember?.id
          )
          if (!existingMember) {
            const enteredName = isManager ? (customMembers[i - 1] || '').trim() : ''
            const searchName = enteredName || defaultName
            existingMember = editingCircle.members?.find(
              (m) => m.name === searchName && m.id !== oldUserMember?.id
            )
          }
        }

        let memberName: string
        if (isManager) {
          const enteredName = (customMembers[i - 1] || '').trim()
          memberName = enteredName || defaultName
        } else {
          memberName =
            i === newTurnMonth
              ? 'أنت'
              : isSecond
                ? (existingMember?.name && existingMember.name !== 'أنت' && !existingMember.name.startsWith('عضو ')
                    ? existingMember.name
                    : 'أنت (سهم 2)')
                : existingMember?.name && existingMember.name !== 'أنت'
                  ? existingMember.name
                  : defaultName
        }

        const rawPaid = existingMember?.paidMonths || []
        const isUserMember = i === newTurnMonth || existingMember?.id === oldUserMember?.id
        const cleanedPaid = rawPaid.filter((mNum) => {
          if (mNum > membersCount) return false
          if (mNum === i) return false
          if (isTurnChanged && isUserMember && mNum === oldTurnMonth) {
            return false
          }
          return true
        })

        const rawPaymentsByMonth = existingMember?.paymentsByMonth
        let cleanedPaymentsByMonth: Record<string, boolean> | undefined = undefined
        if (rawPaymentsByMonth) {
          cleanedPaymentsByMonth = {}
          for (const [key, val] of Object.entries(rawPaymentsByMonth)) {
            const monthKeyNum = Number(key)
            if (
              !isNaN(monthKeyNum) &&
              monthKeyNum >= 1 &&
              monthKeyNum <= membersCount &&
              monthKeyNum !== i &&
              (!isTurnChanged || !isUserMember || monthKeyNum !== oldTurnMonth) &&
              Boolean(val)
            ) {
              cleanedPaymentsByMonth[key] = true
            }
          }
        }

        members.push({
          id: existingMember?.id || `mem_${i}`,
          name: memberName,
          turnMonth: i,
          paidMonths: cleanedPaid,
          ...(cleanedPaymentsByMonth ? { paymentsByMonth: cleanedPaymentsByMonth } : {}),
        })
      }

      let recurringPayload: { recurringId?: string } = {}
      let shouldCreateOrReactivate = false

      if (autoSchedule) {
        const effectiveRecId =
          editingCircle.recurringId ||
          recurringList.find((r) => r.circleId === editingCircle.id)?.id
        if (effectiveRecId) {
          recurringPayload = { recurringId: effectiveRecId }
        }
        shouldCreateOrReactivate = true
      } else {
        if (wasPausedOnOpen && !autoScheduleTouched) {
          const effectiveRecId =
            editingCircle.recurringId ||
            recurringList.find((r) => r.circleId === editingCircle.id)?.id
          if (effectiveRecId) {
            recurringPayload = { recurringId: effectiveRecId }
          }
          shouldCreateOrReactivate = false
        } else {
          recurringPayload = { recurringId: '' }
          shouldCreateOrReactivate = false
        }
      }

      await updateMoneyCircle(
        user.uid,
        editingCircle.id,
        {
          name: trimmedName,
          monthlyAmountFils,
          membersCount,
          totalAmountFils,
          myTurnMonth,
          startDate,
          members,
          isManager,
          expenseCategoryId: expenseCategoryId || defaultExpenseCategory?.id,
          incomeCategoryId: incomeCategoryId || defaultIncomeCategory?.id,
          shareType,
          secondTurnMonth: shareType === 'double' ? parseInt(secondTurnMonthStr, 10) : undefined,
          ...recurringPayload,
        },
        {
          monthStartDay,
          createRecurringRule: shouldCreateOrReactivate,
          defaultCategoryId: expenseCategoryId || defaultExpenseCategory?.id,
        }
      )

      if (autoSchedule) {
        await processDueRecurring(user.uid).catch((err) => {
          console.error('Failed to process due recurring after circle edit:', err)
        })
      }

      const exists = await checkCirclePayoutExists(user.uid, editingCircle.id)
      if (exists) {
        addDepositedCircleId(editingCircle.id)
      } else {
        removeDepositedCircleId(editingCircle.id)
      }

      triggerHaptic('light')
      showToast('تم تعديل الجمعية بنجاح', 'success')
    } else {
      const members: CircleMember[] = []
      const secondTurnNum = shareType === 'double' ? parseInt(secondTurnMonthStr, 10) : undefined
      for (let i = 1; i <= membersCount; i++) {
        const isSecond = shareType === 'double' && i === secondTurnNum
        const defaultName = i === myTurnMonth ? 'أنت' : isSecond ? 'أنت (سهم 2)' : `عضو ${i}`
        const enteredName = isManager ? (customMembers[i - 1] || '').trim() : ''
        const memberName = enteredName || defaultName
        members.push({
          id: `mem_${i}`,
          name: memberName,
          turnMonth: i,
          paidMonths: [],
        })
      }

      const circleId = await addMoneyCircle(user.uid, {
        name: trimmedName,
        monthlyAmountFils,
        membersCount,
        totalAmountFils,
        myTurnMonth,
        startDate,
        members,
        status: 'active',
        isManager,
        expenseCategoryId: expenseCategoryId || defaultExpenseCategory?.id,
        incomeCategoryId: incomeCategoryId || defaultIncomeCategory?.id,
        shareType,
        ...(shareType === 'double' ? { secondTurnMonth: parseInt(secondTurnMonthStr, 10) } : {}),
      })

      if (autoSchedule && (expenseCategoryId || defaultExpenseCategory)) {
        try {
          await updateMoneyCircle(
            user.uid,
            circleId,
            {},
            {
              monthStartDay,
              createRecurringRule: true,
              defaultCategoryId: expenseCategoryId || defaultExpenseCategory?.id,
            }
          )
          await processDueRecurring(user.uid)
        } catch (recErr) {
          console.error('Failed to auto-schedule recurring for circle:', recErr)
        }
      }

      triggerHaptic('light')
      showToast('تم إنشاء الجمعية بنجاح', 'success')
    }

    setIsAddModalOpen(false)
    setEditingCircle(null)
  } catch (err) {
    console.error('Failed to save circle:', err)
    setFormError(err instanceof Error ? err.message : 'تعذر حفظ الجمعية')
  } finally {
    setSubmitting(false)
  }
}
