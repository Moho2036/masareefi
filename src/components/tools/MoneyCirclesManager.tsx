import React, { useState, useEffect, useRef, useMemo } from 'react'
import { format as formatDate } from 'date-fns'
import {
  Users,
  Plus,
  CheckCircle2,
  Check,
  Clock,
  Crown,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
  ArrowLeftRight,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { DatePickerInput } from '../ui/DatePickerInput'
import { Modal } from '../ui/Modal'
import { Toggle } from '../ui/Toggle'
import { EmptyState } from '../ui/EmptyState'
import { Select } from '../ui/Select'
import { CategoryIcon } from '../ui/CategoryIcon'
import { useAuth } from '../../hooks/useAuth'
import { useCurrency } from '../../hooks/useCurrency'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useMoneyCircles } from '../../hooks/useMoneyCircles'
import { useRecurring } from '../../hooks/useRecurring'
import { useCategories } from '../../hooks/useCategories'
import { useToast } from '../../hooks/useToast'
import { processDueRecurring, updateRecurring } from '../../services/recurring'
import { getOrCreateDebtCategory } from '../../services/debts'
import {
  addMoneyCircle,
  updateMoneyCircle,
  deleteMoneyCircle,
  deleteCirclePayout,
  getCurrentCircleMonth,
  isUserTurnMonth,
  checkCirclePayoutExists,
  checkCircleHasTransactions,
  depositCircleNetPayout,
  getCircleCycleIndex,
  isCircleFullyPaid,
  toggleCircleMemberPayment,
  swapMemberTurns,
} from '../../services/moneyCircles'
import { toFils, fromFils } from '../../lib/money'
import { parseLocalDateInput, toWesternDigits, getFinancialMonthRange } from '../../lib/dates'
import { getNextCircleDueDate } from '../../lib/recurring'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'
import type { MoneyCircle, CircleMember } from '../../types'

export const MoneyCirclesManager: React.FC = () => {
  const { user } = useAuth()
  const { data: settings } = useUserSettings()
  const monthStartDay = settings?.monthStartDay ?? 1
  const { data: circles, loading } = useMoneyCircles()
  const { data: recurringList } = useRecurring()
  const { data: categories } = useCategories()
  const { format, config } = useCurrency()
  const { showToast } = useToast()

  // Sorted circles: active circles first, completed last. Within each group, newest startDate first.
  const sortedCircles = useMemo(() => {
    return [...circles].sort((a, b) => {
      const aCompleted = a.status === 'completed'
      const bCompleted = b.status === 'completed'
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1
      }
      const aTime = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime()
      const bTime = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime()
      return bTime - aTime
    })
  }, [circles])

  const activeCircles = useMemo(
    () => sortedCircles.filter((c) => c.status !== 'completed'),
    [sortedCircles]
  )
  const completedCircles = useMemo(
    () => sortedCircles.filter((c) => c.status === 'completed'),
    [sortedCircles]
  )
  const [userToggledCompleted, setUserToggledCompleted] = useState<boolean | null>(null)
  const isCompletedExpanded =
    userToggledCompleted !== null ? userToggledCompleted : completedCircles.length <= 3

  const defaultExpenseCategory = useMemo(() => {
    const active = categories.filter((c) => c.type === 'expense' && !c.archived)
    return (
      active.find((c) => c.name.includes('سداد الديون والأقساط')) ||
      active.find((c) => c.name.includes('الجمعيات المالية') || c.name.includes('الجمعيات')) ||
      active.find((c) => c.name.includes('أقساط') || c.name.includes('ديون')) ||
      active[0] ||
      categories.find((c) => c.type === 'expense')
    )
  }, [categories])

  const defaultIncomeCategory = useMemo(() => {
    const active = categories.filter((c) => c.type === 'income' && !c.archived)
    return (
      active.find((c) => c.name.includes('الجمعيات المالية') || c.name.includes('الجمعيات')) ||
      active.find((c) => c.name.includes('استلام') || c.name.includes('دخل إضافي')) ||
      active.find((c) => c.name === 'أخرى') ||
      active[0] ||
      categories.find((c) => c.type === 'income')
    )
  }, [categories])

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteCircleId, setDeleteCircleId] = useState<string | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(false)
  const [depositingCircleId, setDepositingCircleId] = useState<string | null>(null)
  const [togglingMemberKey, setTogglingMemberKey] = useState<string | null>(null)
  const [depositedCircleIds, setDepositedCircleIds] = useState<Set<string>>(new Set())
  const checkedCirclesRef = useRef<Set<string>>(new Set())

  // Swap turn state
  const [swapTarget, setSwapTarget] = useState<{ circle: MoneyCircle; member: CircleMember } | null>(null)
  const [swapWithMemberId, setSwapWithMemberId] = useState<string>('')
  const [isSwapping, setIsSwapping] = useState(false)

  const getLinkedRecurring = (circle: MoneyCircle) => {
    return recurringList.find(
      (r) => r.id === circle.recurringId || r.circleId === circle.id
    )
  }

  const isCircleScheduled = (circle: MoneyCircle) => {
    const linked = getLinkedRecurring(circle)
    return Boolean(linked && linked.active !== false)
  }

  const getInitialStartDateStr = (startDay: number = monthStartDay) => {
    const cycleStart = getFinancialMonthRange(new Date(), startDay).start
    return formatDate(cycleStart, 'yyyy-MM-dd')
  }

  // Check which circles have already had their net payout deposited in transactions (only when due and not checked)
  useEffect(() => {
    let isCancelled = false
    const checkPayouts = async () => {
      if (!user || circles.length === 0) {
        if (!isCancelled) {
          setDepositedCircleIds((prev) => (prev.size === 0 ? prev : new Set()))
        }
        return
      }

      const now = new Date()
      const eligibleToCheck = circles.filter((c) => {
        const currentMonth = getCurrentCircleMonth(c, now, monthStartDay)
        const checkTurn1 =
          currentMonth >= c.myTurnMonth &&
          !depositedCircleIds.has(c.id) &&
          !checkedCirclesRef.current.has(c.id)
        const checkTurn2 = Boolean(
          c.shareType === 'double' &&
            c.secondTurnMonth &&
            currentMonth >= c.secondTurnMonth &&
            !depositedCircleIds.has(`${c.id}_t2`) &&
            !checkedCirclesRef.current.has(`${c.id}_t2`)
        )
        return checkTurn1 || checkTurn2
      })

      if (eligibleToCheck.length === 0) return

      const newlyDeposited: string[] = []
      await Promise.all(
        eligibleToCheck.map(async (c) => {
          const currentMonth = getCurrentCircleMonth(c, now, monthStartDay)
          try {
            if (
              currentMonth >= c.myTurnMonth &&
              !depositedCircleIds.has(c.id) &&
              !checkedCirclesRef.current.has(c.id)
            ) {
              const exists = await checkCirclePayoutExists(user.uid, c.id)
              checkedCirclesRef.current.add(c.id)
              if (exists) {
                newlyDeposited.push(c.id)
              }
            }
            if (
              c.shareType === 'double' &&
              c.secondTurnMonth &&
              currentMonth >= c.secondTurnMonth &&
              !depositedCircleIds.has(`${c.id}_t2`) &&
              !checkedCirclesRef.current.has(`${c.id}_t2`)
            ) {
              const exists2 = await checkCirclePayoutExists(user.uid, c.id, true)
              checkedCirclesRef.current.add(`${c.id}_t2`)
              if (exists2) {
                newlyDeposited.push(`${c.id}_t2`)
              }
            }
          } catch {
            // ignore
          }
        })
      )
      if (!isCancelled && newlyDeposited.length > 0) {
        setDepositedCircleIds((prev) => {
          const next = new Set(prev)
          newlyDeposited.forEach((id) => next.add(id))
          return next
        })
      }
    }
    void checkPayouts()
    return () => {
      isCancelled = true
    }
  }, [user, circles, monthStartDay, depositedCircleIds])

  // Form state (Add / Edit)
  const [editingCircle, setEditingCircle] = useState<MoneyCircle | null>(null)
  const [name, setName] = useState('')
  const [monthlyAmountStr, setMonthlyAmountStr] = useState('100')
  const [membersCountStr, setMembersCountStr] = useState('10')
  const [myTurnMonthStr, setMyTurnMonthStr] = useState('1')
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>('')
  const [incomeCategoryId, setIncomeCategoryId] = useState<string>('')
  const [shareType, setShareType] = useState<'full' | 'half' | 'double'>('full')
  const [secondTurnMonthStr, setSecondTurnMonthStr] = useState<string>('2')

  const parsedMembersCount = parseInt(membersCountStr, 10)
  const membersCount = isNaN(parsedMembersCount) ? 2 : Math.max(2, Math.min(50, parsedMembersCount))

  const parsedMyTurnMonth = parseInt(myTurnMonthStr, 10)
  const myTurnMonth = isNaN(parsedMyTurnMonth) ? 1 : Math.max(1, Math.min(membersCount, parsedMyTurnMonth))

  const setMembersCount = (val: number | string) => setMembersCountStr(String(val))
  const setMyTurnMonth = (val: number | string) => setMyTurnMonthStr(String(val))
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [startDateStr, setStartDateStr] = useState(() => getInitialStartDateStr(1))
  const [customMembers, setCustomMembers] = useState<string[]>([])
  const [isManager, setIsManager] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [hasLinkedTx, setHasLinkedTx] = useState(false)
  const [wasPausedOnOpen, setWasPausedOnOpen] = useState(false)
  const [autoScheduleTouched, setAutoScheduleTouched] = useState(false)

  // Warning when modifying monthly amount or members count of a circle with previously recorded payments
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
  const currentEnteredFils = toFils(parseFloat(monthlyAmountStr) || 0, config.decimals)
  const isMonthlyAmountChanged = Boolean(
    editingCircle && currentEnteredFils !== editingCircle.monthlyAmountFils
  )
  const isMembersCountChanged = Boolean(
    editingCircle && membersCount !== editingCircle.membersCount
  )
  const showAmountOrMembersChangeWarning = Boolean(
    editingCircle && (isMonthlyAmountChanged || isMembersCountChanged) && hasRecordedCirclePayments
  )

  // Track expanded circles
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null)
  // Selected month for viewing payments per circle
  const [selectedCircleMonth, setSelectedCircleMonth] = useState<Record<string, number>>({})

  // Initialize custom member names when members count changes (preserve previously typed names)
  const handleMembersCountChange = (count: number) => {
    const safeCount = Math.max(2, Math.min(50, count))
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
      // Keep previously entered names intact without slicing
      return next
    })
  }

  // Update turn month and sync custom member names
  const handleMyTurnMonthChange = (newTurn: number) => {
    const safeTurn = Math.max(1, Math.min(membersCount, newTurn))
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
    if (!user) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('يرجى إدخال اسم الجمعية')
      return
    }

    const monthlyAmount = parseFloat(monthlyAmountStr) || 0
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
          // Ensure member's payout month (i) is stripped, any month exceeding membersCount is removed,
          // and if this is the user member and their turn changed, strip both newTurnMonth and oldTurnMonth!
          const isUserMember = i === newTurnMonth || existingMember?.id === oldUserMember?.id
          const cleanedPaid = rawPaid.filter((mNum) => {
            if (mNum > membersCount) return false
            if (mNum === i) return false
            if (isTurnChanged && isUserMember && mNum === oldTurnMonth) {
              return false
            }
            return true
          })

          // Clean paymentsByMonth: retain only valid months (1 <= monthKey <= membersCount) and strip payout month i
          // If user member and turn changed, strip oldTurnMonth as well!
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
            // Rule was paused when modal opened, and user did NOT touch the toggle!
            // Preserve existing recurringId so updateMoneyCircle keeps it paused and doesn't delete it
            const effectiveRecId =
              editingCircle.recurringId ||
              recurringList.find((r) => r.circleId === editingCircle.id)?.id
            if (effectiveRecId) {
              recurringPayload = { recurringId: effectiveRecId }
            }
            shouldCreateOrReactivate = false
          } else {
            // User explicitly disabled auto-scheduling (or no prior rule)
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
        setDepositedCircleIds((prev) => {
          const next = new Set(prev)
          if (exists) next.add(editingCircle.id)
          else next.delete(editingCircle.id)
          return next
        })

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
      setDepositedCircleIds((prev) => new Set([...prev, depositedKey]))
      showToast('تم إيداع صافي الجمعية في رصيدك بنجاح', 'success')
    } catch (err) {
      console.error('Failed to deposit circle net:', err)
      showToast(err instanceof Error ? err.message : 'تعذر إيداع صافي الجمعية', 'error')
    } finally {
      setDepositingCircleId(null)
    }
  }

  const handleUndoDepositCircleNet = async (circle: MoneyCircle) => {
    if (!user) return
    setDepositingCircleId(circle.id)
    try {
      const isSecondTurn = Boolean(
        circle.shareType === 'double' && depositedCircleIds.has(`${circle.id}_t2`)
      )
      await deleteCirclePayout(user.uid, circle.id, isSecondTurn)
      setDepositedCircleIds((prev) => {
        const next = new Set(prev)
        if (isSecondTurn) {
          next.delete(`${circle.id}_t2`)
          checkedCirclesRef.current.delete(`${circle.id}_t2`)
        } else {
          next.delete(circle.id)
          checkedCirclesRef.current.delete(circle.id)
        }
        return next
      })
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

  // Toggle member paid status for a given month
  const handleToggleMemberPayment = async (
    circle: MoneyCircle,
    memberId: string,
    monthNum: number
  ) => {
    if (!user) return
    const toggleKey = `${circle.id}_${memberId}_${monthNum}`
    if (togglingMemberKey === toggleKey) return

    const targetMember = circle.members.find((m) => m.id === memberId)
    // The receiver for monthNum is exempt and cannot be toggled
    const isTargetExempt = Boolean(
      targetMember &&
        (targetMember.turnMonth === monthNum ||
          (targetMember.turnMonth === circle.myTurnMonth && circle.secondTurnMonth === monthNum))
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
    if (!user || !deleteCircleId) return
    try {
      await deleteMoneyCircle(user.uid, deleteCircleId, { deleteTransactions })
      setDepositedCircleIds((prev) => {
        const next = new Set(prev)
        next.delete(deleteCircleId)
        return next
      })
      showToast('تم حذف الجمعية بنجاح', 'info')
      setDeleteCircleId(null)
      setDeleteTransactions(false)
    } catch (err) {
      console.error('Failed to delete circle:', err)
      showToast('تعذر حذف الجمعية', 'error')
    }
  }

  const handleCompleteCircle = async (circle: MoneyCircle) => {
    if (!user) return
    try {
      await updateMoneyCircle(
        user.uid,
        circle.id,
        { status: 'completed' },
        { monthStartDay }
      )
      showToast('تم إنهاء الجمعية بنجاح', 'success')
    } catch (err) {
      console.error('Failed to complete circle:', err)
      showToast('تعذر إنهاء الجمعية', 'error')
    }
  }

  const handleConfirmSwap = async () => {
    if (!user || !swapTarget || !swapWithMemberId) return
    setIsSwapping(true)
    try {
      await swapMemberTurns(user.uid, swapTarget.circle.id, swapTarget.member.id, swapWithMemberId, {
        monthStartDay,
      })
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

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>نظام الجمعيات والصناديق المشتركة</span>
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            تتبع أدوار الاستلام، الأقساط الشهرية، ومعرفة مين دفع ومين ما دفع بكل شفافية
          </p>
        </div>

        <Button
          onClick={handleOpenAddModal}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          إنشاء جمعية جديدة
        </Button>
      </div>

      {/* Circles List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-1.5">
                    <div className="w-32 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-20 h-3 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  </div>
                </div>
                <div className="w-20 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-16 rounded-xl bg-zinc-50 dark:bg-zinc-800/40" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : circles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />}
            title="لا توجد جمعيات مالية نشطة حالياً"
            description="أنشئ جمعيتك الأولى لمتابعة الأدوار، الأقساط الشهرية، ودفعات الأعضاء بسهولة تامة."
            action={
              <Button onClick={handleOpenAddModal} variant="primary" icon={<Plus className="w-4 h-4" />}>
                إنشاء جمعية جديدة
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {(() => {
            const renderCircleCard = (circle: MoneyCircle) => {
              const now = new Date()
            const start = new Date(circle.startDate)
            const diffMonths = getCircleCycleIndex(circle.startDate, now, monthStartDay)
            const isStarted = diffMonths >= 0
            const isCompleted = circle.status === 'completed' || diffMonths >= circle.membersCount
            const currentMonth = getCurrentCircleMonth(circle, now, monthStartDay)
            const userMember = circle.members.find((m) => m.turnMonth === circle.myTurnMonth)

            const userExemptMonths = new Set<number>([circle.myTurnMonth])
            if (circle.shareType === 'double' && circle.secondTurnMonth) {
              userExemptMonths.add(circle.secondTurnMonth)
            }

            const hasDepositedTurn1 = depositedCircleIds.has(circle.id)
            const hasDepositedTurn2 =
              circle.shareType === 'double' && circle.secondTurnMonth
                ? depositedCircleIds.has(`${circle.id}_t2`)
                : true
            const isSecondTurnActiveNow =
              circle.shareType === 'double' && circle.secondTurnMonth === currentMonth
            const hasUserDeposited = isSecondTurnActiveNow
              ? depositedCircleIds.has(`${circle.id}_t2`)
              : hasDepositedTurn1
            const hasAllUserTurnsDeposited = hasDepositedTurn1 && hasDepositedTurn2

            const hasUserPaidAll = userMember
              ? Array.from({ length: circle.membersCount }, (_, i) => i + 1)
                  .filter((m) => !userExemptMonths.has(m))
                  .every((m) => userMember.paidMonths.includes(m))
              : false
            const isObligationsCompleted =
              circle.status === 'active' &&
              hasAllUserTurnsDeposited &&
              (circle.isManager
                ? isCircleFullyPaid(circle)
                : diffMonths >= circle.membersCount || hasUserPaidAll)
            const isUserTurn = isStarted && !isCompleted && !isObligationsCompleted && isUserTurnMonth(circle, now, monthStartDay)
            const isExpanded = expandedCircleId === circle.id
            const viewingMonth = selectedCircleMonth[circle.id] || currentMonth

            // Calculate user amounts based on shareType
            const userMonthlyFils =
              circle.shareType === 'half'
                ? Math.round(circle.monthlyAmountFils / 2)
                : circle.shareType === 'double'
                  ? circle.monthlyAmountFils * 2
                  : circle.monthlyAmountFils
            const userGrossFils =
              circle.shareType === 'half'
                ? Math.round(circle.totalAmountFils / 2)
                : circle.totalAmountFils
            const netAmountFils = userGrossFils - userMonthlyFils

            // Unpaid user months up to currentMonth
            const unpaidUserMonths =
              isStarted && circle.status !== 'completed' && userMember
                ? Array.from({ length: Math.min(currentMonth, circle.membersCount) }, (_, i) => i + 1).filter(
                    (m) => !userExemptMonths.has(m) && !userMember.paidMonths.includes(m)
                  )
                : []

            // Check if user has already received / deposited net turn payout (turn 1 or turn 2)
            const canDepositTurn1 = isStarted && currentMonth >= circle.myTurnMonth && !hasDepositedTurn1
            const canDepositTurn2 = Boolean(
              isStarted &&
                circle.shareType === 'double' &&
                circle.secondTurnMonth &&
                currentMonth >= circle.secondTurnMonth &&
                !depositedCircleIds.has(`${circle.id}_t2`)
            )
            const canDepositNet = canDepositTurn1 || canDepositTurn2
            const linkedRec = getLinkedRecurring(circle)
            const isScheduledActive = Boolean(linkedRec && linkedRec.active !== false)
            const isScheduledPaused = Boolean(linkedRec && linkedRec.active === false)
            const isScheduled = isScheduledActive

            // Calculate payments for viewing month: non-receivers who paid + 1 (the exempt receiver)
            const nonReceiverPaidCount = circle.members.filter(
              (m) => m.turnMonth !== viewingMonth && m.paidMonths.includes(viewingMonth)
            ).length
            const paidMembersCount = Math.min(circle.membersCount, nonReceiverPaidCount + 1)

            return (
              <Card
                key={circle.id}
                className="relative border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-2xs dark:shadow-none transition-all p-4 sm:p-5"
              >
                {/* Circle Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0',
                        isUserTurn
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      )}
                    >
                      {isUserTurn ? (
                        <Crown className="w-5 h-5 text-white" />
                      ) : (
                        <Users className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                        <span>{circle.name}</span>
                        {circle.shareType === 'half' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
                            نصف سهم
                          </span>
                        )}
                        {circle.shareType === 'double' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
                            سهمان: شهر {circle.myTurnMonth} و {circle.secondTurnMonth}
                          </span>
                        )}
                        {circle.isManager && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
                            أنت المدير
                          </span>
                        )}
                        {(circle.status === 'completed' || isCompleted) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
                            مكتملة
                          </span>
                        )}
                      </h4>
                      <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span>قسط: {format(userMonthlyFils)} / شهر</span>
                        <span>•</span>
                        <span>{circle.membersCount} أشهر ({circle.membersCount} أعضاء)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {(isCompleted || isObligationsCompleted) && circle.status !== 'completed' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleCompleteCircle(circle)}
                        className="text-xs text-zinc-600 dark:text-zinc-300"
                        icon={<CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                      >
                        إنهاء الجمعية
                      </Button>
                    )}

                    <div className="text-end me-2">
                      <div className="text-[11px] text-zinc-400">إجمالي المقبوض</div>
                      <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
                        {format(userGrossFils)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(circle)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                      title="تعديل الجمعية"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteCircleId(circle.id)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      title="حذف الجمعية"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Turn Announcement Banner */}
                {circle.status === 'completed' ? (
                  <div className="mt-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>اكتملت جميع دورات هذه الجمعية ({circle.membersCount} أشهر).</span>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-400">
                      مكتملة ✓
                    </span>
                  </div>
                ) : (isObligationsCompleted || (isCompleted && hasUserDeposited)) && circle.status === 'active' ? (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-900 dark:text-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs dark:shadow-none">
                    <div className="flex items-center gap-2.5 text-xs font-bold">
                      <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>اكتملت جميع التزامات وأدوار هذه الجمعية! يمكنك الآن نقلها إلى الأرشيف (مكتملة).</span>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleCompleteCircle(circle)}
                      className="text-xs shrink-0 self-end sm:self-auto"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      إنهاء الجمعية
                    </Button>
                  </div>
                ) : !isStarted ? (
                  <div className="mt-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-500" />
                      <span>
                        الجمعية تبدأ في:{' '}
                        <strong className="text-zinc-800 dark:text-zinc-100 font-bold">
                          {formatDate(start, 'yyyy/MM/dd')}
                        </strong>{' '}
                        (دورك: الشهر رقم {circle.myTurnMonth})
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-400">
                      لم تبدأ بعد
                    </span>
                  </div>
                ) : isUserTurn && canDepositNet ? (
                  /* Unified Swiss Banner for User Turn + Net Deposit */
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>هذا الشهر هو دورك في الاستلام! ستقبض {format(userGrossFils)}.</span>
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        حان موعد استلام حصتك من الجمعية! الصافي بعد حسم قسطك لهذا الشهر ({format(userMonthlyFils)}):{' '}
                        <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                          {format(netAmountFils)}
                        </strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                        لا يُخصم منك قسط
                      </span>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={depositingCircleId === circle.id}
                        onClick={() => handleDepositCircleNet(circle)}
                        className="font-bold shrink-0"
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        {depositingCircleId === circle.id
                          ? 'جارٍ الإيداع...'
                          : 'إيداع صافي الجمعية في الرصيد'}
                      </Button>
                    </div>
                  </div>
                ) : isUserTurn ? (
                  <div className="mt-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-800 dark:text-zinc-200 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
                      <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>هذا الشهر هو دورك في الاستلام! ستقبض {format(userGrossFils)}.</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                        {hasUserDeposited ? 'تم إيداع الصافي في الرصيد ✓' : 'لا يُخصم منك قسط'}
                      </span>
                      {hasUserDeposited && (
                        <button
                          type="button"
                          onClick={() => handleUndoDepositCircleNet(circle)}
                          disabled={depositingCircleId === circle.id}
                          className="text-[11px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 underline cursor-pointer disabled:opacity-50"
                        >
                          إلغاء الإيداع
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>
                        دورك في الاستلام:{' '}
                        <strong className="text-zinc-800 dark:text-zinc-100 font-bold">
                          الشهر رقم {circle.myTurnMonth}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-semibold text-zinc-400">
                        {circle.myTurnMonth > currentMonth
                          ? `باقي ${circle.myTurnMonth - currentMonth} أشهر على دورك`
                          : hasUserDeposited
                            ? 'تم استلام حصتك وإيداعها في الرصيد ✓'
                            : 'حان دورك ولم يتم إيداع الصافي بعد!'}
                      </span>
                      {hasUserDeposited && (
                        <button
                          type="button"
                          onClick={() => handleUndoDepositCircleNet(circle)}
                          disabled={depositingCircleId === circle.id}
                          className="text-[11px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 underline cursor-pointer disabled:opacity-50"
                        >
                          إلغاء الإيداع
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Prominent Deposit Net Payout Action (Only if canDepositNet and !isUserTurn) */}
                {canDepositNet && !isUserTurn && (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs dark:shadow-none">
                    <div className="text-xs">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 text-sm">
                        <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>حان موعد استلام حصتك من الجمعية!</span>
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        الصافي بعد حسم قسطك لهذا الشهر ({format(userMonthlyFils)}):{' '}
                        <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                          {format(netAmountFils)}
                        </strong>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={depositingCircleId === circle.id}
                      onClick={() => handleDepositCircleNet(circle)}
                      className="font-bold shrink-0"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      {depositingCircleId === circle.id
                        ? 'جارٍ الإيداع...'
                        : 'إيداع صافي الجمعية في الرصيد'}
                    </Button>
                  </div>
                )}

                {/* Recurring Schedule Status */}
                <div className="mt-3.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs">
                  {isScheduledActive ? (
                    <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-bold">
                      <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>مجدولة في المعاملات المتكررة (معفاة من الخصم في الشهر {circle.myTurnMonth})</span>
                    </div>
                  ) : isScheduledPaused && linkedRec ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>الجدولة التلقائية متوقفة مؤقتاً</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={<Zap className="w-3 h-3 text-amber-500" />}
                        onClick={() => handleResumeRecurring(linkedRec.id)}
                      >
                        تفعيل الجدولة
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="text-zinc-400">القسط غير مجدول كمعاملة متكررة</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={<Zap className="w-3 h-3 text-amber-500" />}
                        onClick={() => handleScheduleCircle(circle)}
                      >
                        جدولة القسط تلقائياً
                      </Button>
                    </div>
                  )}
                </div>

                {/* Unpaid User Installment Alert Banner */}
                {unpaidUserMonths.length > 0 && userMember && (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <span>
                          قسطك الشخصي لشهر {unpaidUserMonths[0]} بقيمة {format(userMonthlyFils)} غير مسدد بعد
                          {userMember.paymentsByMonth?.[String(unpaidUserMonths[0])] === false && (
                            <span className="font-bold text-amber-800 dark:text-amber-300">
                              {' '}(تم إلغاء الخصم التلقائي — بانتظار سدادك)
                            </span>
                          )}
                          {unpaidUserMonths.length > 1 && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-normal">
                              {' '}(لديك {unpaidUserMonths.length} أقساط غير مسددة)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={togglingMemberKey === `${circle.id}_${userMember.id}_${unpaidUserMonths[0]}`}
                      onClick={() => handleToggleMemberPayment(circle, userMember.id, unpaidUserMonths[0])}
                      className="text-xs shrink-0 self-end sm:self-auto bg-amber-600 hover:bg-amber-700 text-white"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      تسجيل سداد قسطي الآن
                    </Button>
                  </div>
                )}

                {/* Progress bar across months */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <span>
                      {isCompleted || isObligationsCompleted
                        ? 'اكتملت جميع دورات الجمعية'
                        : !isStarted
                          ? `الجمعية تبدأ في ${formatDate(start, 'yyyy/MM/dd')}`
                          : `التقدم الزمني: الشهر ${currentMonth} من ${circle.membersCount}`}
                    </span>
                    <span>
                      {isCompleted || isObligationsCompleted
                        ? '100%'
                        : !isStarted
                          ? '0%'
                          : `${Math.round((currentMonth / circle.membersCount) * 100)}%`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        circle.status === 'completed' ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-blue-600 dark:bg-blue-500'
                      )}
                      style={{
                        width: isCompleted || isObligationsCompleted
                          ? '100%'
                          : !isStarted
                            ? '0%'
                            : `${Math.round((currentMonth / circle.membersCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Manager Mode only: Member Payments Tracking & Table */}
                {Boolean(circle.isManager) && (
                  <>
                    {/* Toggle Details button: Who paid and who didn't */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>
                      دفعات الشهر {viewingMonth}:{' '}
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        {paidMembersCount} من {circle.membersCount} دفعوا
                      </strong>
                    </span>
                    {viewingMonth < currentMonth && (circle.membersCount - paidMembersCount) > 0 && (
                      <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                        ({circle.members.filter((m) => !m.paidMonths.includes(viewingMonth) && m.turnMonth !== viewingMonth).length} متأخر)
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={() => setExpandedCircleId(isExpanded ? null : circle.id)}
                    variant="ghost"
                    size="sm"
                    icon={isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  >
                    {isExpanded ? 'إخفاء جدول الأعضاء' : 'تتبع دفعات الأعضاء (مين دفع)'}
                  </Button>
                </div>

                {/* Expanded Member Payments Table */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                    {/* Month selector for viewing past/current/future payments */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        عرض دفعات الشهر:
                      </span>
                      <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
                        {Array.from({ length: circle.membersCount }, (_, i) => i + 1).map((mNum) => (
                          <button
                            key={mNum}
                            type="button"
                            onClick={() =>
                              setSelectedCircleMonth((prev) => ({ ...prev, [circle.id]: mNum }))
                            }
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0',
                              viewingMonth === mNum
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            )}
                          >
                            شهر {mNum}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Member grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {circle.members.map((member) => {
                        const hasPaid = member.paidMonths.includes(viewingMonth)
                        const isReceiverThisMonth = member.turnMonth === viewingMonth
                        const isUserFirstTurn = member.turnMonth === circle.myTurnMonth
                        const isUserSecondTurn =
                          circle.shareType === 'double' &&
                          circle.secondTurnMonth !== undefined &&
                          member.turnMonth === circle.secondTurnMonth
                        const isUserMember = isUserFirstTurn || isUserSecondTurn
                        const displayName =
                          isUserSecondTurn && member.name.startsWith('عضو ')
                            ? 'أنت (سهم 2)'
                            : member.name
                        const isOverdue = viewingMonth < currentMonth && !hasPaid && !isReceiverThisMonth

                        return (
                          <div
                            key={member.id}
                            className={cn(
                              'flex items-center justify-between p-2.5 rounded-xl border transition-all',
                              isReceiverThisMonth
                                ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700/50'
                                : hasPaid
                                  ? 'bg-zinc-50/70 dark:bg-zinc-900/50 border-[#E4E4E7] dark:border-[#27272A]'
                                  : isOverdue
                                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
                                    : 'bg-zinc-50/70 dark:bg-zinc-900/50 border-[#E4E4E7] dark:border-[#27272A]'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0',
                                  isReceiverThisMonth
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                                )}
                              >
                                {member.turnMonth}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1">
                                  <span>{displayName}</span>
                                  {isUserFirstTurn && (
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                      (أنت)
                                    </span>
                                  )}
                                  {isUserSecondTurn && (
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                      (سهمك الثاني)
                                    </span>
                                  )}
                                  {isUserMember && isScheduled && !isReceiverThisMonth && (
                                    !hasPaid && member.paymentsByMonth?.[String(viewingMonth)] === false ? (
                                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md border border-amber-300 dark:border-amber-800">
                                        معلّق يدوياً
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-md border border-blue-300 dark:border-blue-800">
                                        اقتطاع آلي
                                      </span>
                                    )
                                  )}
                                  {isReceiverThisMonth && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                      <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                      <span>مستلم الشهر</span>
                                    </span>
                                  )}
                                  {isOverdue && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                                      <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                                      <span>متأخر</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                  {isReceiverThisMonth
                                    ? 'يقبض هذا الشهر'
                                    : isUserMember && isScheduled
                                      ? member.paymentsByMonth?.[String(viewingMonth)] === false
                                        ? `قسط: ${format(userMonthlyFils)} (معلق يدوياً)`
                                        : `قسط: ${format(userMonthlyFils)} (يُقتطع تلقائياً)`
                                      : `قسط: ${isUserMember ? format(userMonthlyFils) : format(circle.monthlyAmountFils)}`}
                                </div>
                              </div>
                            </div>

                            {/* Actions: Swap Button (Manager mode) & Toggle / Exempt Badge */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {Boolean(circle.isManager) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSwapTarget({ circle, member })
                                    const others = circle.members.filter((m) => m.id !== member.id)
                                    if (others.length > 0) {
                                      setSwapWithMemberId(others[0].id)
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                  title="تبديل الدور ⇄"
                                  aria-label={`تبديل دور ${displayName}`}
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isReceiverThisMonth ? (
                                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 select-none flex items-center gap-1">
                                  <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>مستلم الدورة (معفى)</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={togglingMemberKey === `${circle.id}_${member.id}_${viewingMonth}`}
                                  onClick={() => handleToggleMemberPayment(circle, member.id, viewingMonth)}
                                  className={cn(
                                    'px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed',
                                    hasPaid
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : isOverdue
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-200 border border-red-300 dark:border-red-800'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400'
                                  )}
                                >
                                  {hasPaid ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>تم الدفع</span>
                                    </>
                                  ) : isOverdue ? (
                                    <span>متأخر</span>
                                  ) : (
                                    <span>لم يدفع</span>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                  </>
                )}

                {/* Non-Manager Mode: My Installments History Panel */}
                {!circle.isManager && userMember && (
                  <>
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 flex-wrap">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>
                          أقساطك المسددة:{' '}
                          <strong className="text-zinc-800 dark:text-zinc-200">
                            {userMember.paidMonths.length} من {circle.membersCount - userExemptMonths.size}
                          </strong>
                        </span>
                        {unpaidUserMonths.length > 0 && (
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            ({unpaidUserMonths.length} غير مسدد)
                          </span>
                        )}
                      </div>

                      <Button
                        onClick={() => setExpandedCircleId(isExpanded ? null : circle.id)}
                        variant="ghost"
                        size="sm"
                        icon={isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      >
                        {isExpanded ? 'إخفاء سجل أقساطي' : 'سجل أقساطي الشهرية (تسجيل / إلغاء الدفع)'}
                      </Button>
                    </div>

                    {/* Expanded Installments Grid for Non-Manager */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                        <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                          سجل دفعاتك الشهرية لهذه الجمعية:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {Array.from({ length: circle.membersCount }, (_, i) => i + 1).map((mNum) => {
                            const isExempt = userExemptMonths.has(mNum)
                            const hasPaid =
                              userMember.paidMonths.includes(mNum) ||
                              userMember.paymentsByMonth?.[String(mNum)] === true
                            const isOverdue = mNum < currentMonth && !hasPaid && !isExempt
                            const isCurrent = mNum === currentMonth

                            return (
                              <div
                                key={mNum}
                                className={cn(
                                  'flex items-center justify-between p-2.5 rounded-xl border transition-all',
                                  isExempt
                                    ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700/50'
                                    : hasPaid
                                      ? 'bg-zinc-50/70 dark:bg-zinc-900/50 border-[#E4E4E7] dark:border-[#27272A]'
                                      : isOverdue
                                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
                                        : 'bg-zinc-50/70 dark:bg-zinc-900/50 border-[#E4E4E7] dark:border-[#27272A]'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={cn(
                                      'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0',
                                      isExempt
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                                    )}
                                  >
                                    {mNum}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1">
                                      <span>شهر {mNum}</span>
                                      {isCurrent && (
                                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                          (الشهر الحالي)
                                        </span>
                                      )}
                                      {isOverdue && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                                          <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                                          <span>متأخر</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-400">
                                      {isExempt
                                        ? 'شهر استلام حصتك'
                                        : `قسط: ${format(userMonthlyFils)}`}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isExempt ? (
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 select-none flex items-center gap-1">
                                      <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                      <span>دورك في القبض (معفى)</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={togglingMemberKey === `${circle.id}_${userMember.id}_${mNum}`}
                                      onClick={() => handleToggleMemberPayment(circle, userMember.id, mNum)}
                                      className={cn(
                                        'px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed',
                                        hasPaid
                                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                                          : isOverdue
                                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-200 border border-red-300 dark:border-red-800'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400'
                                      )}
                                    >
                                      {hasPaid ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>تم الدفع ✓</span>
                                        </>
                                      ) : (
                                        <span>تسجيل الدفع</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )
          }

          return (
            <>
              {/* Active circles */}
              {activeCircles.map(renderCircleCard)}

              {/* If no active circles, but completed circles exist */}
              {activeCircles.length === 0 && completedCircles.length > 0 && (
                <Card className="p-6 text-center border-dashed border-[#E4E4E7] dark:border-[#27272A] bg-white/50 dark:bg-[#121215]/50 shadow-2xs dark:shadow-none">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    لا توجد جمعيات مالية نشطة حالياً.
                  </p>
                </Card>
              )}

              {/* Completed circles collapsible archive section */}
              {completedCircles.length > 0 && (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setUserToggledCompleted(!isCompletedExpanded)}
                    className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-850 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors cursor-pointer select-none border border-[#E4E4E7]/60 dark:border-[#27272A]"
                    aria-expanded={isCompletedExpanded}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>الجمعيات المكتملة ({completedCircles.length})</span>
                    </div>
                    {isCompletedExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </button>
                  {isCompletedExpanded && (
                    <div className="space-y-4 animate-slide-down">
                      {completedCircles.map(renderCircleCard)}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })()}
        </div>
      )}

      {/* Add / Edit Circle Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingCircle(null)
        }}
        title={editingCircle ? 'تعديل الجمعية المالية' : 'إنشاء جمعية مالية جديدة'}
        closeOnBackdropClick={Boolean(!editingCircle && !name.trim())}
      >
        <form onSubmit={handleSaveCircle} noValidate className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="اسم الجمعية"
            placeholder="مثال: جمعية الأهل، جمعية الزملاء"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`القسط الشهري (${config.symbol})`}
              type="text"
              inputMode="decimal"
              value={monthlyAmountStr}
              onChange={(e) => setMonthlyAmountStr(toWesternDigits(e.target.value))}
              required
            />

            <Input
              label="عدد الأعضاء (الأشهر)"
              type="number"
              min="2"
              max="50"
              value={membersCountStr}
              onChange={(e) => {
                const val = toWesternDigits(e.target.value)
                setMembersCountStr(val)
                const num = parseInt(val, 10)
                if (!isNaN(num) && num >= 2 && num <= 50) {
                  handleMembersCountChange(num)
                }
              }}
              onBlur={() => {
                const parsed = parseInt(membersCountStr, 10)
                const safeCount = isNaN(parsed) ? 2 : Math.max(2, Math.min(50, parsed))
                setMembersCountStr(String(safeCount))
                handleMembersCountChange(safeCount)
              }}
              required
            />
          </div>

          {/* Warning when modifying monthly amount or members count of a circle with previously recorded payments */}
          {showAmountOrMembersChangeWarning && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold">تنبيه بشأن تعديل تفاصيل الجمعية:</div>
                <p className="leading-relaxed text-[11px] text-amber-700 dark:text-amber-300">
                  تحتوي هذه الجمعية على أقساط أو دفعات مسجلة مسبقاً. تعديل القسط الشهري أو عدد الأعضاء سيقوم بتحديث حسابات الجمعية، وتحديث القسط في المعاملات المتكررة ومعاملة استلام الصافي المرتبطة بها تلقائياً.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="دورك في الاستلام (رقم الشهر)"
              type="number"
              min="1"
              max={membersCount}
              value={myTurnMonthStr}
              onChange={(e) => {
                const val = toWesternDigits(e.target.value)
                setMyTurnMonthStr(val)
                const num = parseInt(val, 10)
                if (!isNaN(num) && num >= 1 && num <= membersCount) {
                  handleMyTurnMonthChange(num)
                }
              }}
              onBlur={() => {
                const parsed = parseInt(myTurnMonthStr, 10)
                const safeTurn = isNaN(parsed) ? 1 : Math.max(1, Math.min(membersCount, parsed))
                setMyTurnMonthStr(String(safeTurn))
                handleMyTurnMonthChange(safeTurn)
              }}
              required
            />

            <DatePickerInput
              label="تاريخ البدء"
              value={startDateStr}
              onChange={(val) => setStartDateStr(val)}
              required
            />
          </div>

          {/* Share Size Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              حجم السهم في الجمعية
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShareType('full')}
                className={cn(
                  'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center',
                  shareType === 'full'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
                )}
              >
                سهم كامل (100%)
              </button>
              <button
                type="button"
                onClick={() => setShareType('half')}
                className={cn(
                  'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center',
                  shareType === 'half'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
                )}
              >
                نصف سهم (50%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShareType('double')
                  setCustomMembers((prev) => {
                    const next = [...prev]
                    const sec = parseInt(secondTurnMonthStr, 10)
                    if (!isNaN(sec) && sec >= 1 && sec <= membersCount) {
                      const idx = sec - 1
                      if (!next[idx] || next[idx].startsWith('عضو ')) {
                        next[idx] = 'أنت (سهم 2)'
                      }
                    }
                    return next
                  })
                }}
                className={cn(
                  'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center',
                  shareType === 'double'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
                )}
              >
                سهمان (دورين)
              </button>
            </div>
          </div>

          {/* Second Turn Month Selector for Double Share */}
          {shareType === 'double' && (
            <Select
              id="circle-second-turn"
              label="الدور الثاني للاستلام (للسهم الثاني)"
              value={secondTurnMonthStr}
              onChange={(e) => {
                const oldSec = parseInt(secondTurnMonthStr, 10)
                const newSecVal = e.target.value
                const newSec = parseInt(newSecVal, 10)
                setSecondTurnMonthStr(newSecVal)
                setCustomMembers((prev) => {
                  const next = [...prev]
                  if (!isNaN(oldSec) && oldSec >= 1 && oldSec <= membersCount) {
                    const oldIdx = oldSec - 1
                    if (next[oldIdx] === 'أنت (سهم 2)') {
                      next[oldIdx] = `عضو ${oldSec}`
                    }
                  }
                  if (!isNaN(newSec) && newSec >= 1 && newSec <= membersCount) {
                    const newIdx = newSec - 1
                    if (!next[newIdx] || next[newIdx].startsWith('عضو ')) {
                      next[newIdx] = 'أنت (سهم 2)'
                    }
                  }
                  return next
                })
              }}
              options={Array.from({ length: membersCount }, (_, i) => i + 1)
                .filter((m) => m !== myTurnMonth)
                .map((m) => ({
                  value: m,
                  label: `الشهر ${m}`,
                }))}
            />
          )}

          {/* Category Selectors for Expenses & Income */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                تصنيف أقساط المصاريف
              </label>
              <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-0.5">
                {categories
                  .filter((c) => c.type === 'expense' && !c.archived)
                  .map((cat) => {
                    const activeExpId = expenseCategoryId || defaultExpenseCategory?.id || ''
                    const isSelected = activeExpId === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setExpenseCategoryId(cat.id)}
                        className={cn(
                          'flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none min-w-0',
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 ring-2 ring-blue-600/20'
                            : 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        )}
                      >
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat.color}25` }}
                        >
                          <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                        </span>
                        <span className="truncate flex-1">{cat.name}</span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                تصنيف إيداع الصافي (دخل)
              </label>
              <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-0.5">
                {categories
                  .filter((c) => c.type === 'income' && !c.archived)
                  .map((cat) => {
                    const activeIncId = incomeCategoryId || defaultIncomeCategory?.id || ''
                    const isSelected = activeIncId === cat.id
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setIncomeCategoryId(cat.id)}
                        className={cn(
                          'flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none min-w-0',
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 ring-2 ring-blue-600/20'
                            : 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        )}
                      >
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat.color}25` }}
                        >
                          <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                        </span>
                        <span className="truncate flex-1">{cat.name}</span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-xs flex items-center justify-between font-bold text-zinc-800 dark:text-zinc-200">
            <span>المبلغ الإجمالي المقبوض:</span>
            <span className="text-sm font-black text-blue-600 dark:text-blue-400">
              {format(
                toFils(
                  ((parseFloat(monthlyAmountStr) || 0) * membersCount) *
                    (shareType === 'half' ? 0.5 : 1),
                  config.decimals
                )
              )}
              {shareType === 'double' ? ' (لكل دور استلام)' : ''}
            </span>
          </div>

          {/* Auto Schedule Toggle */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A]">
            <Toggle
              checked={autoSchedule}
              onChange={(val) => {
                setAutoSchedule(val)
                setAutoScheduleTouched(true)
              }}
              label="جدولة القسط في المعاملات المتكررة"
              description={`يخصم القسط شهرياً تلقائياً، مع تخطي الخصم تلقائياً في شهر استلامك (الشهر ${myTurnMonth})`}
            />
          </div>

          {/* Manager Mode Toggle */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A]">
            <Toggle
              checked={isManager}
              onChange={(val) => {
                setIsManager(val)
                if (val) {
                  setCustomMembers((prev) => {
                    const next = [...prev]
                    const secondTurnNum = parseInt(secondTurnMonthStr, 10)
                    while (next.length < membersCount) {
                      const idx = next.length + 1
                      const defaultForSecondTurn =
                        shareType === 'double' && idx === secondTurnNum ? 'أنت (سهم 2)' : `عضو ${idx}`
                      next.push(idx === myTurnMonth ? 'أنت' : defaultForSecondTurn)
                    }
                    const turnIdx = myTurnMonth - 1
                    if (turnIdx >= 0 && turnIdx < next.length) {
                      if (!next[turnIdx] || next[turnIdx].startsWith('عضو ')) {
                        next[turnIdx] = 'أنت'
                      }
                    }
                    if (shareType === 'double' && !isNaN(secondTurnNum)) {
                      const secondIdx = secondTurnNum - 1
                      if (secondIdx >= 0 && secondIdx < next.length) {
                        if (!next[secondIdx] || next[secondIdx].startsWith('عضو ')) {
                          next[secondIdx] = 'أنت (سهم 2)'
                        }
                      }
                    }
                    for (let idx = 0; idx < next.length; idx++) {
                      if (idx !== turnIdx && next[idx] === 'أنت') {
                        next[idx] = `عضو ${idx + 1}`
                      }
                    }
                    return next
                  })
                }
              }}
              label="أنا مدير الجمعية (تتبع أسماء ودفعات جميع الأعضاء)"
              description="فعّل هذا الخيار إذا كنت أنت من يدير الجمعية وترغب بتسجيل أسماء جميع المشتركين ومتابعة من دفع ومن لم يدفع كل شهر."
            />
          </div>

          {/* Members names list - only visible in manager mode */}
          {isManager && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                ترتيب وأسماء الأعضاء:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {Array.from({ length: membersCount }, (_, i) => {
                  const turn = i + 1
                  const isUser = turn === myTurnMonth
                  const isSecondTurn =
                    shareType === 'double' && turn === parseInt(secondTurnMonthStr, 10)
                  const defaultVal = isUser ? 'أنت' : isSecondTurn ? 'أنت (سهم 2)' : `عضو ${turn}`
                  return (
                    <div key={turn} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-black flex items-center justify-center shrink-0">
                        {turn}
                      </span>
                      <input
                        type="text"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-xs text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
                        value={customMembers[i] ?? defaultVal}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomMembers((prev) => {
                            const next = [...prev]
                            next[i] = val
                            return next
                          })
                        }}
                        placeholder={`اسم العضو رقم ${turn}`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsAddModalOpen(false)
                setEditingCircle(null)
              }}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting
                ? editingCircle
                  ? 'جاري الحفظ...'
                  : 'جاري الإنشاء...'
                : editingCircle
                  ? 'حفظ التعديلات'
                  : 'إنشاء الجمعية'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteCircleId !== null}
        onClose={() => {
          setDeleteCircleId(null)
          setDeleteTransactions(false)
        }}
        title="تأكيد حذف الجمعية"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            هل أنت متأكد من رغبتك في حذف هذه الجمعية؟ لن تتمكن من استرجاع بيانات الأقساط والأعضاء المسجلة فيها.
          </p>

          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="delete-circle-txs"
                className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer select-none"
              >
                حذف الأقساط والإيداعات المسجلة في المحفظة لهذه الجمعية
              </label>
              <input
                id="delete-circle-txs"
                type="checkbox"
                checked={deleteTransactions}
                onChange={(e) => setDeleteTransactions(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-sm border-zinc-300 focus:ring-blue-600 cursor-pointer shrink-0"
              />
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              تنبيه: إذا قمت بتحديد هذا الخيار، ستُحذف المعاملات وتتغير أرصدة محفظتك السابقة. الإبقاء عليها دون تحديد يضمن دقة تقاريرك المالية وسجل مصروفاتك التاريخي.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteCircleId(null)
                setDeleteTransactions(false)
              }}
            >
              إلغاء
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              نعم، حذف الجمعية
            </Button>
          </div>
        </div>
      </Modal>

      {/* Swap Turns Modal */}
      <Modal
        isOpen={Boolean(swapTarget)}
        onClose={() => {
          setSwapTarget(null)
          setSwapWithMemberId('')
        }}
        title="تبديل الدور بين الأعضاء"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            اختر العضو الذي ترغب في تبديل دور الاستلام معه لـ &quot;{swapTarget?.member.name}&quot; (الدور الحالي: شهر {swapTarget?.member.turnMonth}):
          </p>

          <Select
            id="swap-target-member-select"
            label="تبديل مع العضو:"
            value={swapWithMemberId}
            onChange={(e) => setSwapWithMemberId(e.target.value)}
            options={(swapTarget?.circle.members || [])
              .filter((m) => m.id !== swapTarget?.member.id)
              .map((m) => ({
                value: m.id,
                label: `${m.name} (شهر ${m.turnMonth})`,
              }))}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setSwapTarget(null)
                setSwapWithMemberId('')
              }}
              disabled={isSwapping}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmSwap}
              disabled={isSwapping || !swapWithMemberId}
            >
              {isSwapping ? 'جاري التبديل...' : 'تأكيد تبديل الدور ⇄'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
