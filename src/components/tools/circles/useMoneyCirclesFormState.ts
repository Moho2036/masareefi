import { useState } from 'react'
import {
  checkCircleHasTransactions,
} from '../../../services/moneyCircles'
import { fromFils } from '../../../lib/money'
import { format as formatDate } from 'date-fns'
import { getFinancialMonthRange } from '../../../lib/dates'
import { getNextCircleDueDate } from '../../../lib/recurring'
import { executeSaveCircle } from './saveCircleSubmit'
import type { MoneyCircle, Category, CircleShareType, Recurring } from '../../../types'

export interface UseMoneyCirclesFormStateProps {
  user: { uid: string } | null
  monthStartDay: number
  config: { decimals: number; symbol: string }
  categories: Category[]
  defaultExpenseCategory?: Category
  defaultIncomeCategory?: Category
  recurringList: Recurring[]
  depositedCircleIds: Set<string>
  addDepositedCircleId: (id: string) => void
  removeDepositedCircleId: (id: string) => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

function parseNumeric(val: string): number {
  if (!val) return 0
  const normalized = val.replace(/,/g, '')
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? 0 : parsed
}

export function useMoneyCirclesFormState({
  user,
  monthStartDay,
  config,
  categories: _categories,
  defaultExpenseCategory,
  defaultIncomeCategory,
  recurringList,
  depositedCircleIds,
  addDepositedCircleId,
  removeDepositedCircleId,
  showToast,
}: UseMoneyCirclesFormStateProps) {
  const getInitialStartDateStr = (startDay: number = monthStartDay) => {
    const cycleStart = getFinancialMonthRange(new Date(), startDay).start
    return formatDate(cycleStart, 'yyyy-MM-dd')
  }

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingCircle, setEditingCircle] = useState<MoneyCircle | null>(null)
  const [name, setName] = useState('')
  const [monthlyAmountStr, setMonthlyAmountStr] = useState('100')
  const [membersCountStr, setMembersCountStr] = useState('10')
  const [myTurnMonthStr, setMyTurnMonthStr] = useState('1')
  const [startDateStr, setStartDateStr] = useState(() => getInitialStartDateStr(monthStartDay))
  const [shareType, setShareType] = useState<CircleShareType>('full')
  const [secondTurnMonthStr, setSecondTurnMonthStr] = useState('2')
  const [expenseCategoryId, setExpenseCategoryId] = useState('')
  const [incomeCategoryId, setIncomeCategoryId] = useState('')
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [wasPausedOnOpen, setWasPausedOnOpen] = useState(false)
  const [autoScheduleTouched, setAutoScheduleTouched] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [customMembers, setCustomMembers] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hasLinkedTx, setHasLinkedTx] = useState(false)

  const parsedMembersCount = parseInt(membersCountStr, 10)
  const membersCount = isNaN(parsedMembersCount) ? 2 : Math.max(2, Math.min(50, parsedMembersCount))

  const parsedMyTurnMonth = parseInt(myTurnMonthStr, 10)
  const myTurnMonth = isNaN(parsedMyTurnMonth) ? 1 : Math.max(1, Math.min(membersCount, parsedMyTurnMonth))

  const setMembersCount = (val: number | string) => setMembersCountStr(String(val))
  const setMyTurnMonth = (val: number | string) => setMyTurnMonthStr(String(val))

  const existingRecForEditing = editingCircle
    ? recurringList.find(
        (r) =>
          r.circleId === editingCircle.id ||
          (editingCircle.recurringId && r.id === editingCircle.recurringId)
      )
    : undefined

  const initialDueDate = editingCircle
    ? getNextCircleDueDate(
        editingCircle.startDate,
        editingCircle.membersCount,
        editingCircle.myTurnMonth,
        []
      )
    : undefined

  const hasRecurringProgressed = Boolean(
    existingRecForEditing &&
      initialDueDate &&
      new Date(existingRecForEditing.nextDate).getTime() > initialDueDate.getTime()
  )

  const editingCircleAny = editingCircle as unknown as {
    depositedMonths?: number[]
    paidManualMonths?: number[]
  } | null

  const hasRecordedCirclePayments = Boolean(
    editingCircle &&
      ((editingCircle.members || []).some((m) => (m.paidMonths || []).length > 0) ||
        (editingCircleAny?.depositedMonths ?? []).length > 0 ||
        (editingCircleAny?.paidManualMonths ?? []).length > 0 ||
        depositedCircleIds.has(editingCircle.id) ||
        depositedCircleIds.has(`${editingCircle.id}_t2`) ||
        hasRecurringProgressed ||
        hasLinkedTx)
  )

  const showAmountOrMembersChangeWarning = Boolean(
    editingCircle &&
      (parseNumeric(monthlyAmountStr) !== fromFils(editingCircle.monthlyAmountFils) ||
        membersCount !== editingCircle.membersCount) &&
      hasRecordedCirclePayments
  )

  const handleMembersCountChange = (countInput: number | string) => {
    const count = typeof countInput === 'number' ? countInput : parseInt(countInput, 10)
    const safeCount = isNaN(count) ? 2 : Math.max(2, Math.min(50, count))
    setMembersCount(safeCount)
    let effectiveTurn = myTurnMonth
    if (Number(myTurnMonth) > safeCount) {
      effectiveTurn = safeCount
      setMyTurnMonth(safeCount)
    }

    setCustomMembers((prev) => {
      const next = [...prev]
      while (next.length < safeCount) {
        const idx = next.length + 1
        next.push(idx === effectiveTurn ? 'أنت' : `عضو ${idx}`)
      }
      return next
    })
  }

  const handleMyTurnMonthChange = (newTurnInput: number | string) => {
    const newTurn = typeof newTurnInput === 'number' ? newTurnInput : parseInt(newTurnInput, 10)
    const safeTurn = isNaN(newTurn) ? 1 : Math.max(1, Math.min(membersCount, newTurn))
    const oldTurn = myTurnMonth
    setMyTurnMonth(safeTurn)

    setCustomMembers((prev) => {
      const next = [...prev]
      while (next.length < membersCount) {
        const idx = next.length + 1
        next.push(idx === safeTurn ? 'أنت' : `عضو ${idx}`)
      }
      const oldIndex = oldTurn - 1
      const newIndex = safeTurn - 1
      if (oldIndex !== newIndex) {
        const displacedName = next[newIndex]
        if (oldIndex >= 0 && oldIndex < next.length) {
          if (
            displacedName &&
            displacedName !== 'أنت' &&
            displacedName !== `عضو ${safeTurn}`
          ) {
            next[oldIndex] = displacedName
          } else if (!next[oldIndex] || next[oldIndex] === 'أنت') {
            next[oldIndex] = `عضو ${oldTurn}`
          }
        }
        if (newIndex >= 0 && newIndex < next.length) {
          next[newIndex] = 'أنت'
        }
      }
      for (let idx = 0; idx < next.length; idx++) {
        if (idx !== newIndex && next[idx] === 'أنت') {
          next[idx] = `عضو ${idx + 1}`
        }
      }
      return next
    })
  }

  const handleOpenAddModal = () => {
    setEditingCircle(null)
    setName('')
    setMonthlyAmountStr('100')
    setMembersCount(10)
    setMyTurnMonth(1)
    setAutoSchedule(true)
    setWasPausedOnOpen(false)
    setAutoScheduleTouched(false)
    setIsManager(false)
    setExpenseCategoryId(defaultExpenseCategory?.id || '')
    setIncomeCategoryId(defaultIncomeCategory?.id || '')
    setShareType('full')
    setSecondTurnMonthStr('2')
    setStartDateStr(getInitialStartDateStr(monthStartDay))
    const initialNames: string[] = []
    for (let i = 1; i <= 10; i++) {
      initialNames.push(i === 1 ? 'أنت' : `عضو ${i}`)
    }
    setCustomMembers(initialNames)
    setFormError(null)
    setHasLinkedTx(false)
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (circle: MoneyCircle) => {
    setEditingCircle(circle)
    setName(circle.name)
    setMonthlyAmountStr(String(fromFils(circle.monthlyAmountFils)))
    setMembersCount(circle.membersCount)
    setMyTurnMonth(circle.myTurnMonth)
    setExpenseCategoryId(circle.expenseCategoryId || defaultExpenseCategory?.id || '')
    setIncomeCategoryId(circle.incomeCategoryId || defaultIncomeCategory?.id || '')
    setShareType(circle.shareType || 'full')
    setSecondTurnMonthStr(String(circle.secondTurnMonth || (circle.myTurnMonth === 1 ? 2 : 1)))
    const startDate =
      circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate)
    setStartDateStr(formatDate(startDate, 'yyyy-MM-dd'))
    setIsManager(Boolean(circle.isManager))

    const initialNames: string[] = []
    const secondTurnNum = circle.secondTurnMonth || (circle.myTurnMonth === 1 ? 2 : 1)
    for (let i = 1; i <= circle.membersCount; i++) {
      const existing = circle.members?.find((m) => m.turnMonth === i)
      const defaultForSecond =
        circle.shareType === 'double' && i === secondTurnNum ? 'أنت (سهم 2)' : `عضو ${i}`
      initialNames.push(
        existing?.name ?? (i === circle.myTurnMonth ? 'أنت' : defaultForSecond)
      )
    }
    setCustomMembers(initialNames)

    const linkedRec = recurringList.find(
      (r) => (circle.recurringId && r.id === circle.recurringId) || r.circleId === circle.id
    )
    const linkedRecId = circle.recurringId || linkedRec?.id
    const isPaused = Boolean(linkedRec && linkedRec.active === false)
    const isActivelyScheduled = Boolean(linkedRec && linkedRec.active !== false)

    setWasPausedOnOpen(isPaused)
    setAutoScheduleTouched(false)
    setAutoSchedule(isActivelyScheduled)
    setHasLinkedTx(false)

    if (user?.uid) {
      checkCircleHasTransactions(user.uid, circle.id, linkedRecId)
        .then((has) => {
          setHasLinkedTx(has)
        })
        .catch(() => {})
    }
    setFormError(null)
    setIsAddModalOpen(true)
  }

  const handleSaveCircle = async (e: React.FormEvent) => {
    e.preventDefault()
    await executeSaveCircle({
      user,
      editingCircle,
      name,
      monthlyAmount: parseNumeric(monthlyAmountStr),
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
    })
  }

  return {
    isAddModalOpen,
    setIsAddModalOpen,
    editingCircle,
    setEditingCircle,
    name,
    setName,
    monthlyAmountStr,
    setMonthlyAmountStr,
    membersCountStr,
    setMembersCountStr,
    myTurnMonthStr,
    setMyTurnMonthStr,
    startDateStr,
    setStartDateStr,
    shareType,
    setShareType,
    secondTurnMonthStr,
    setSecondTurnMonthStr,
    expenseCategoryId,
    setExpenseCategoryId,
    incomeCategoryId,
    setIncomeCategoryId,
    autoSchedule,
    setAutoSchedule,
    autoScheduleTouched,
    setAutoScheduleTouched,
    isManager,
    setIsManager,
    customMembers,
    setCustomMembers,
    formError,
    submitting,
    showAmountOrMembersChangeWarning,
    handleMembersCountChange,
    handleMyTurnMonthChange,
    handleOpenAddModal,
    handleOpenEditModal,
    handleSaveCircle,
  }
}
