import React, { useState, useEffect, useRef } from 'react'
import { format as formatDate } from 'date-fns'
import {
  Users,
  Plus,
  CheckCircle2,
  Clock,
  Crown,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Toggle } from '../ui/Toggle'
import { EmptyState } from '../ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useCurrency } from '../../hooks/useCurrency'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useMoneyCircles } from '../../hooks/useMoneyCircles'
import { useRecurring } from '../../hooks/useRecurring'
import { useCategories } from '../../hooks/useCategories'
import { useToast } from '../../hooks/useToast'
import { processDueRecurring } from '../../services/recurring'
import { getOrCreateDebtCategory } from '../../services/debts'
import {
  addMoneyCircle,
  updateMoneyCircle,
  deleteMoneyCircle,
  getCurrentCircleMonth,
  isUserTurnMonth,
  checkCirclePayoutExists,
  checkCircleHasTransactions,
  depositCircleNetPayout,
  getCircleCycleIndex,
  isCircleFullyPaid,
} from '../../services/moneyCircles'
import { toFils, fromFils } from '../../lib/money'
import { parseLocalDateInput } from '../../lib/dates'
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

  const defaultExpenseCategory = categories.find((c) => c.type === 'expense' && !c.archived)
  const defaultIncomeCategory =
    categories.find((c) => c.type === 'income' && !c.archived) ||
    categories.find((c) => c.type === 'income')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteCircleId, setDeleteCircleId] = useState<string | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(false)
  const [depositingCircleId, setDepositingCircleId] = useState<string | null>(null)
  const [depositedCircleIds, setDepositedCircleIds] = useState<Set<string>>(new Set())
  const checkedCirclesRef = useRef<Set<string>>(new Set())

  const isCircleScheduled = (circle: MoneyCircle) => {
    return recurringList.some(
      (r) =>
        (r.id === circle.recurringId || r.circleId === circle.id) &&
        r.active !== false
    )
  }

  const getInitialStartDateStr = (startDay: number = monthStartDay) => {
    const now = new Date()
    const safeDay = Math.min(28, Math.max(1, Math.round(startDay)))
    const dayStr = String(safeDay).padStart(2, '0')
    const monthStr = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${monthStr}-${dayStr}`
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
        if (depositedCircleIds.has(c.id)) return false
        const currentMonth = getCurrentCircleMonth(c, now, monthStartDay)
        if (currentMonth < c.myTurnMonth) return false
        if (checkedCirclesRef.current.has(c.id)) return false
        return true
      })

      if (eligibleToCheck.length === 0) return

      const newlyDeposited: string[] = []
      await Promise.all(
        eligibleToCheck.map(async (c) => {
          try {
            checkedCirclesRef.current.add(c.id)
            const exists = await checkCirclePayoutExists(user.uid, c.id)
            if (exists) {
              newlyDeposited.push(c.id)
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
  const [membersCount, setMembersCount] = useState(10)
  const [myTurnMonth, setMyTurnMonth] = useState(1)
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [startDateStr, setStartDateStr] = useState(() => getInitialStartDateStr(1))
  const [customMembers, setCustomMembers] = useState<string[]>([])
  const [isManager, setIsManager] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [hasLinkedTx, setHasLinkedTx] = useState(false)

  // Warning when modifying monthly amount or members count of a circle with previously recorded payments
  const existingRecForEditing = editingCircle
    ? recurringList.find(
        (r) =>
          r.circleId === editingCircle.id ||
          (editingCircle.recurringId && r.id === editingCircle.recurringId)
      )
    : undefined

  const hasRecurringProgressed = Boolean(
    existingRecForEditing &&
      new Date(existingRecForEditing.nextDate).getTime() >
        new Date(existingRecForEditing.startDate).getTime()
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

  // Update turn month and sync custom member names when user is manager
  const handleMyTurnMonthChange = (newTurn: number) => {
    const safeTurn = Math.max(1, Math.min(membersCount, newTurn))
    const oldTurn = myTurnMonth
    setMyTurnMonth(safeTurn)

    if (isManager) {
      setCustomMembers((prev) => {
        const next = [...prev]
        while (next.length < membersCount) {
          const idx = next.length + 1
          next.push(idx === safeTurn ? 'أنت' : `عضو ${idx}`)
        }
        const oldIndex = oldTurn - 1
        if (oldIndex >= 0 && oldIndex < next.length) {
          if (!next[oldIndex] || next[oldIndex] === 'أنت') {
            next[oldIndex] = `عضو ${oldTurn}`
          }
        }
        const newIndex = safeTurn - 1
        if (newIndex >= 0 && newIndex < next.length) {
          next[newIndex] = 'أنت'
        }
        return next
      })
    }
  }

  const handleOpenAddModal = () => {
    setEditingCircle(null)
    setName('')
    setMonthlyAmountStr('100')
    setMembersCount(10)
    setMyTurnMonth(1)
    setAutoSchedule(true)
    setIsManager(false)
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
    const startDate =
      circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate)
    setStartDateStr(formatDate(startDate, 'yyyy-MM-dd'))
    setIsManager(Boolean(circle.isManager))

    const initialNames: string[] = []
    for (let i = 1; i <= circle.membersCount; i++) {
      const existing = circle.members?.find((m) => m.turnMonth === i)
      initialNames.push(existing?.name ?? (i === circle.myTurnMonth ? 'أنت' : `عضو ${i}`))
    }
    setCustomMembers(initialNames)

    const linkedRecId =
      circle.recurringId || recurringList.find((r) => r.circleId === circle.id)?.id
    const isActivelyScheduled = recurringList.some(
      (r) =>
        (r.id === circle.recurringId || r.circleId === circle.id) &&
        r.active !== false
    )
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
        const members: CircleMember[] = []
        for (let i = 1; i <= membersCount; i++) {
          const defaultName = i === myTurnMonth ? 'أنت' : `عضو ${i}`
          const enteredName = isManager ? (customMembers[i - 1] || '').trim() : ''
          const memberName = enteredName || defaultName

          const existingMember =
            editingCircle.members?.find((m) => m.name === memberName) ||
            editingCircle.members?.find((m) => m.turnMonth === i)

          const rawPaid = existingMember?.paidMonths || []
          // Ensure member's payout month (i) is stripped and any month exceeding membersCount is removed
          const cleanedPaid = rawPaid.filter((mNum) => mNum <= membersCount && mNum !== i)

          // Clean paymentsByMonth: retain only valid months (1 <= monthKey <= membersCount) and strip payout month i
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
            ...(autoSchedule
              ? editingCircle.recurringId
                ? { recurringId: editingCircle.recurringId }
                : {}
              : { recurringId: '' }),
          },
          {
            monthStartDay,
            createRecurringRule: autoSchedule,
            defaultCategoryId: defaultExpenseCategory?.id,
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

        showToast('تم تعديل الجمعية بنجاح', 'success')
      } else {
        const members: CircleMember[] = []
        for (let i = 1; i <= membersCount; i++) {
          const defaultName = i === myTurnMonth ? 'أنت' : `عضو ${i}`
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
        })

        if (autoSchedule && defaultExpenseCategory) {
          try {
            await updateMoneyCircle(
              user.uid,
              circleId,
              {},
              {
                monthStartDay,
                createRecurringRule: true,
                defaultCategoryId: defaultExpenseCategory.id,
              }
            )
            await processDueRecurring(user.uid)
          } catch (recErr) {
            console.error('Failed to auto-schedule recurring for circle:', recErr)
          }
        }

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
    if (!user || !defaultExpenseCategory) return
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
          defaultCategoryId: defaultExpenseCategory.id,
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
      let incomeCatId = defaultIncomeCategory?.id
      if (!incomeCatId) {
        incomeCatId = await getOrCreateDebtCategory(user.uid, 'income')
      }

      await depositCircleNetPayout(user.uid, circle, incomeCatId)
      setDepositedCircleIds((prev) => new Set([...prev, circle.id]))
      showToast('تم إيداع صافي الجمعية في رصيدك بنجاح', 'success')
    } catch (err) {
      console.error('Failed to deposit circle net:', err)
      showToast(err instanceof Error ? err.message : 'تعذر إيداع صافي الجمعية', 'error')
    } finally {
      setDepositingCircleId(null)
    }
  }

  // Toggle member paid status for a given month
  const handleToggleMemberPayment = async (
    circle: MoneyCircle,
    memberId: string,
    monthNum: number
  ) => {
    if (!user) return
    const targetMember = circle.members.find((m) => m.id === memberId)
    // The receiver for monthNum is exempt and cannot be toggled
    if (targetMember && targetMember.turnMonth === monthNum) return

    const updatedMembers = circle.members.map((m) => {
      if (m.id !== memberId) return m
      const hasPaid =
        m.paidMonths.includes(monthNum) ||
        m.paymentsByMonth?.[String(monthNum)] === true
      const newPaid = hasPaid
        ? m.paidMonths.filter((mn) => mn !== monthNum)
        : [...m.paidMonths.filter((mn) => mn !== monthNum), monthNum]
      const newPaymentsByMonth = { ...(m.paymentsByMonth || {}) }
      if (hasPaid) {
        delete newPaymentsByMonth[String(monthNum)]
      } else {
        newPaymentsByMonth[String(monthNum)] = true
      }
      return {
        ...m,
        paidMonths: newPaid,
        paymentsByMonth: newPaymentsByMonth,
      }
    })

    try {
      await updateMoneyCircle(
        user.uid,
        circle.id,
        { members: updatedMembers },
        { monthStartDay }
      )
    } catch (err) {
      console.error('Failed to toggle member payment:', err)
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

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            <span>نظام الجمعيات والصناديق المشتركة</span>
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
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
        <div className="p-8 text-center text-sm text-slate-400">جاري تحميل الجمعيات...</div>
      ) : circles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-8 h-8 text-emerald-500" />}
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
          {circles.map((circle) => {
            const now = new Date()
            const start = new Date(circle.startDate)
            const diffMonths = getCircleCycleIndex(circle.startDate, now, monthStartDay)
            const isStarted = diffMonths >= 0
            const isCompleted = circle.status === 'completed' || diffMonths >= circle.membersCount
            const isObligationsCompleted =
              circle.status === 'active' &&
              (diffMonths >= circle.membersCount || isCircleFullyPaid(circle))
            const currentMonth = getCurrentCircleMonth(circle, now, monthStartDay)
            const isUserTurn = isStarted && !isCompleted && !isObligationsCompleted && isUserTurnMonth(circle, now, monthStartDay)
            const isExpanded = expandedCircleId === circle.id
            const viewingMonth = selectedCircleMonth[circle.id] || currentMonth

            // Check if user has already received / deposited net turn payout
            const hasUserDeposited = depositedCircleIds.has(circle.id)
            const canDepositNet = isStarted && !isCompleted && currentMonth >= circle.myTurnMonth && !hasUserDeposited
            const netAmountFils = circle.totalAmountFils - circle.monthlyAmountFils
            const isScheduled = isCircleScheduled(circle)

            // Calculate payments for viewing month: non-receivers who paid + 1 (the exempt receiver)
            const nonReceiverPaidCount = circle.members.filter(
              (m) => m.turnMonth !== viewingMonth && m.paidMonths.includes(viewingMonth)
            ).length
            const paidMembersCount = Math.min(circle.membersCount, nonReceiverPaidCount + 1)

            return (
              <Card
                key={circle.id}
                className={cn(
                  'relative border-2 transition-all p-4 sm:p-5',
                  isUserTurn
                    ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent'
                    : 'border-slate-200/80 dark:border-slate-700/80'
                )}
              >
                {/* Circle Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0',
                        isUserTurn
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      {isUserTurn ? (
                        <Crown className="w-5 h-5 text-white" />
                      ) : (
                        <Users className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>{circle.name}</span>
                        {circle.isManager && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            أنت المدير
                          </span>
                        )}
                        {(circle.status === 'completed' || isCompleted) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            مكتملة
                          </span>
                        )}
                      </h4>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>قسط: {format(circle.monthlyAmountFils)} / شهر</span>
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
                        className="text-xs text-slate-600 dark:text-slate-300"
                        icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      >
                        إنهاء الجمعية
                      </Button>
                    )}

                    <div className="text-end me-2">
                      <div className="text-[11px] text-slate-400">إجمالي المقبوض</div>
                      <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {format(circle.totalAmountFils)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(circle)}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                      title="تعديل الجمعية"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteCircleId(circle.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      title="حذف الجمعية"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Turn Announcement Banner */}
                {circle.status === 'completed' ? (
                  <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-750/50 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>اكتملت جميع دورات هذه الجمعية ({circle.membersCount} أشهر).</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      مكتملة ✓
                    </span>
                  </div>
                ) : isObligationsCompleted ? (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5 text-xs font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>🎉 اكتملت جميع التزامات وأدوار هذه الجمعية! يمكنك الآن نقلها إلى الأرشيف (مكتملة).</span>
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
                  <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-750/50 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      <span>
                        الجمعية تبدأ في:{' '}
                        <strong className="text-slate-800 dark:text-slate-100 font-bold">
                          {formatDate(start, 'yyyy/MM/dd')}
                        </strong>{' '}
                        (دورك: الشهر رقم {circle.myTurnMonth})
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      لم تبدأ بعد
                    </span>
                  </div>
                ) : isUserTurn ? (
                  <div className="mt-3.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs font-bold">
                      <Crown className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span>هذا الشهر هو دورك في الاستلام! ستقبض {format(circle.totalAmountFils)}.</span>
                    </div>
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-emerald-500 text-white shrink-0">
                      {hasUserDeposited ? 'تم إيداع الصافي في الرصيد ✓' : 'لا يُخصم منك قسط'}
                    </span>
                  </div>
                ) : (
                  <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-750/50 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>
                        دورك في الاستلام:{' '}
                        <strong className="text-slate-800 dark:text-slate-100 font-bold">
                          الشهر رقم {circle.myTurnMonth}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {circle.myTurnMonth > currentMonth
                        ? `باقي ${circle.myTurnMonth - currentMonth} أشهر على دورك`
                        : hasUserDeposited
                          ? 'تم استلام حصتك وإيداعها في الرصيد ✓'
                          : 'حان دورك ولم يتم إيداع الصافي بعد!'}
                    </span>
                  </div>
                )}

                {/* Prominent Deposit Net Payout Action */}
                {canDepositNet && (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-2 border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="text-xs">
                      <div className="font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 text-sm">
                        <Crown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>حان موعد استلام حصتك من الجمعية!</span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        الصافي بعد حسم قسطك لهذا الشهر ({format(circle.monthlyAmountFils)}):{' '}
                        <strong className="text-emerald-700 dark:text-emerald-400 font-black text-sm">
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
                      className="font-bold shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      {depositingCircleId === circle.id
                        ? 'جارٍ الإيداع...'
                        : 'إيداع صافي الجمعية في الرصيد'}
                    </Button>
                  </div>
                )}

                {/* Recurring Schedule Status */}
                <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750/40 border border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-xs">
                  {isScheduled ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                      <Zap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>مجدولة في المعاملات المتكررة (معفاة من الخصم في الشهر {circle.myTurnMonth})</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="text-slate-400">القسط غير مجدول كمعاملة متكررة</span>
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

                {/* Progress bar across months */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        circle.status === 'completed' ? 'bg-slate-400 dark:bg-slate-500' : 'bg-emerald-500'
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
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>
                      دفعات الشهر {viewingMonth}:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
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
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {/* Month selector for viewing past/current/future payments */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
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
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
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
                        const isUserMember = member.turnMonth === circle.myTurnMonth
                        const isOverdue = viewingMonth < currentMonth && !hasPaid && !isReceiverThisMonth

                        return (
                          <div
                            key={member.id}
                            className={cn(
                              'flex items-center justify-between p-2.5 rounded-xl border transition-all',
                              isReceiverThisMonth
                                ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700/50'
                                : hasPaid
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                                  : isOverdue
                                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
                                    : 'bg-slate-50 dark:bg-slate-750/40 border-slate-200/80 dark:border-slate-700/60'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0',
                                  isReceiverThisMonth
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                )}
                              >
                                {member.turnMonth}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                                  <span>{member.name}</span>
                                  {isUserMember && (
                                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                      (أنت)
                                    </span>
                                  )}
                                  {isUserMember && isScheduled && !isReceiverThisMonth && (
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                                      اقتطاع آلي
                                    </span>
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
                                <div className="text-[10px] text-slate-400">
                                  {isReceiverThisMonth
                                    ? 'يقبض هذا الشهر'
                                    : isUserMember && isScheduled
                                      ? `قسط: ${format(circle.monthlyAmountFils)} (يُقتطع تلقائياً)`
                                      : `قسط: ${format(circle.monthlyAmountFils)}`}
                                </div>
                              </div>
                            </div>

                            {/* Toggle Button or Exempt Receiver Badge */}
                            {isReceiverThisMonth ? (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 select-none flex items-center gap-1 shrink-0">
                                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>مستلم الدورة (معفى)</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleMemberPayment(circle, member.id, viewingMonth)}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1',
                                  hasPaid
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : isOverdue
                                      ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 hover:bg-red-200 border border-red-300 dark:border-red-800'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
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
                        )
                      })}
                    </div>
                  </div>
                )}
                  </>
                )}
              </Card>
            )
          })}
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
        closeOnBackdropClick={false}
      >
        <form onSubmit={handleSaveCircle} className="space-y-4">
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
              type="number"
              min="1"
              step="any"
              value={monthlyAmountStr}
              onChange={(e) => setMonthlyAmountStr(e.target.value)}
              required
            />

            <Input
              label="عدد الأعضاء (الأشهر)"
              type="number"
              min="2"
              max="50"
              value={membersCount}
              onChange={(e) => handleMembersCountChange(parseInt(e.target.value, 10) || 2)}
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
              value={myTurnMonth}
              onChange={(e) => handleMyTurnMonthChange(parseInt(e.target.value, 10) || 1)}
              required
            />

            <Input
              label="تاريخ البدء"
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              required
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-200">
            <span>المبلغ الإجمالي المقبوض:</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {format(toFils((parseFloat(monthlyAmountStr) || 0) * membersCount, config.decimals))}
            </span>
          </div>

          {/* Auto Schedule Toggle */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750/50 border border-slate-200/80 dark:border-slate-700/60">
            <Toggle
              checked={autoSchedule}
              onChange={setAutoSchedule}
              label="جدولة القسط في المعاملات المتكررة"
              description={`يخصم القسط شهرياً تلقائياً، مع تخطي الخصم تلقائياً في شهر استلامك (الشهر ${myTurnMonth})`}
            />
          </div>

          {/* Manager Mode Toggle */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750/50 border border-slate-200/80 dark:border-slate-700/60">
            <Toggle
              checked={isManager}
              onChange={setIsManager}
              label="أنا مدير الجمعية (تتبع أسماء ودفعات جميع الأعضاء)"
              description="فعّل هذا الخيار إذا كنت أنت من يدير الجمعية وترغب بتسجيل أسماء جميع المشتركين ومتابعة من دفع ومن لم يدفع كل شهر."
            />
          </div>

          {/* Members names list - only visible in manager mode */}
          {isManager && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ترتيب وأسماء الأعضاء:
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-1">
                {Array.from({ length: membersCount }, (_, i) => {
                  const turn = i + 1
                  const isUser = turn === myTurnMonth
                  return (
                    <div key={turn} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black flex items-center justify-center shrink-0">
                        {turn}
                      </span>
                      <input
                        type="text"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                        value={customMembers[i] ?? (isUser ? 'أنت' : `عضو ${turn}`)}
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

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
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
          <p className="text-sm text-slate-600 dark:text-slate-300">
            هل أنت متأكد من رغبتك في حذف هذه الجمعية؟ لن تتمكن من استرجاع بيانات الأقساط والأعضاء المسجلة فيها.
          </p>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="delete-circle-txs"
                className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer select-none"
              >
                حذف الأقساط والإيداعات المسجلة في المحفظة لهذه الجمعية
              </label>
              <input
                id="delete-circle-txs"
                type="checkbox"
                checked={deleteTransactions}
                onChange={(e) => setDeleteTransactions(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
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
    </div>
  )
}
