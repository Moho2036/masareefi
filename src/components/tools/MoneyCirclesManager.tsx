import React, { useState, useEffect } from 'react'
import { addMonths } from 'date-fns'
import {
  Users,
  Plus,
  CheckCircle2,
  Clock,
  Crown,
  Trash2,
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
import { useMoneyCircles } from '../../hooks/useMoneyCircles'
import { useCategories } from '../../hooks/useCategories'
import { useToast } from '../../hooks/useToast'
import { addRecurring, deleteRecurring } from '../../services/recurring'
import { getOrCreateDebtCategory } from '../../services/debts'
import {
  addMoneyCircle,
  updateMoneyCircle,
  deleteMoneyCircle,
  getCurrentCircleMonth,
  isUserTurnMonth,
  checkCirclePayoutExists,
  depositCircleNetPayout,
} from '../../services/moneyCircles'
import { toFils } from '../../lib/money'
import { parseLocalDateInput } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { MoneyCircle, CircleMember } from '../../types'

export const MoneyCirclesManager: React.FC = () => {
  const { user } = useAuth()
  const { data: circles, loading } = useMoneyCircles()
  const { data: categories } = useCategories()
  const { format, config } = useCurrency()
  const { showToast } = useToast()

  const defaultExpenseCategory = categories.find((c) => c.type === 'expense' && !c.archived)
  const defaultIncomeCategory =
    categories.find((c) => c.type === 'income' && !c.archived) ||
    categories.find((c) => c.type === 'income')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deleteCircleId, setDeleteCircleId] = useState<string | null>(null)
  const [depositingCircleId, setDepositingCircleId] = useState<string | null>(null)
  const [depositedCircleIds, setDepositedCircleIds] = useState<Set<string>>(new Set())

  // Check which circles have already had their net payout deposited in transactions
  useEffect(() => {
    let isCancelled = false
    const checkPayouts = async () => {
      if (!user || circles.length === 0) {
        if (!isCancelled) {
          setDepositedCircleIds(new Set())
        }
        return
      }
      const deposited = new Set<string>()
      await Promise.all(
        circles.map(async (c) => {
          try {
            const exists = await checkCirclePayoutExists(user.uid, c.id)
            if (exists) {
              deposited.add(c.id)
            }
          } catch {
            // ignore
          }
        })
      )
      if (!isCancelled) {
        setDepositedCircleIds(deposited)
      }
    }
    void checkPayouts()
    return () => {
      isCancelled = true
    }
  }, [user, circles])

  // Add Circle form state
  const [name, setName] = useState('')
  const [monthlyAmountStr, setMonthlyAmountStr] = useState('100')
  const [membersCount, setMembersCount] = useState(10)
  const [myTurnMonth, setMyTurnMonth] = useState(1)
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [startDateStr, setStartDateStr] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [customMembers, setCustomMembers] = useState<string[]>([])
  const [isManager, setIsManager] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Track expanded circles
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null)
  // Selected month for viewing payments per circle
  const [selectedCircleMonth, setSelectedCircleMonth] = useState<Record<string, number>>({})

  // Initialize custom member names when members count changes
  const handleMembersCountChange = (count: number) => {
    const safeCount = Math.max(2, Math.min(50, count))
    setMembersCount(safeCount)
    if (myTurnMonth > safeCount) {
      setMyTurnMonth(safeCount)
    }

    setCustomMembers((prev) => {
      const next = [...prev]
      while (next.length < safeCount) {
        const idx = next.length + 1
        next.push(idx === myTurnMonth ? 'أنت' : `عضو ${idx}`)
      }
      return next.slice(0, safeCount)
    })
  }

  const handleOpenAddModal = () => {
    setName('')
    setMonthlyAmountStr('100')
    setMembersCount(10)
    setMyTurnMonth(4)
    setAutoSchedule(true)
    setIsManager(false)
    const initialNames: string[] = []
    for (let i = 1; i <= 10; i++) {
      initialNames.push(i === 4 ? 'أنت' : `عضو ${i}`)
    }
    setCustomMembers(initialNames)
    setFormError(null)
    setIsAddModalOpen(true)
  }

  const handleCreateCircle = async (e: React.FormEvent) => {
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
      const members: CircleMember[] = []
      for (let i = 1; i <= membersCount; i++) {
        const memberName = isManager
          ? ((customMembers[i - 1] || '').trim() || (i === myTurnMonth ? 'أنت' : `عضو ${i}`))
          : (i === myTurnMonth ? 'أنت' : `عضو ${i}`)
        members.push({
          id: `mem_${i}`,
          name: memberName,
          turnMonth: i,
          paidMonths: [],
        })
      }

      const totalAmountFils = toFils(monthlyAmount * membersCount)
      const monthlyAmountFils = toFils(monthlyAmount)
      const startDate = parseLocalDateInput(startDateStr)

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
          const recId = await addRecurring(user.uid, {
            type: 'expense',
            amountFils: monthlyAmountFils,
            categoryId: defaultExpenseCategory.id,
            title: `قسط ${trimmedName}`,
            note: `قسط شهري للجمعية - معفى من الخصم في شهر الاستلام (${myTurnMonth})`,
            frequency: 'monthly',
            startDate,
            nextDate: startDate,
            endDate: addMonths(startDate, membersCount - 1),
            active: true,
            circleId,
            skipMonth: myTurnMonth,
          })
          await updateMoneyCircle(user.uid, circleId, { recurringId: recId })
        } catch (recErr) {
          console.error('Failed to auto-schedule recurring for circle:', recErr)
        }
      }

      showToast('تم إنشاء الجمعية بنجاح', 'success')
      setIsAddModalOpen(false)
    } catch (err) {
      console.error('Failed to create circle:', err)
      setFormError(err instanceof Error ? err.message : 'تعذر إنشاء الجمعية')
    } finally {
      setSubmitting(false)
    }
  }

  const handleScheduleCircle = async (circle: MoneyCircle) => {
    if (!user || !defaultExpenseCategory) return
    try {
      const recId = await addRecurring(user.uid, {
        type: 'expense',
        amountFils: circle.monthlyAmountFils,
        categoryId: defaultExpenseCategory.id,
        title: `قسط ${circle.name}`,
        note: `قسط شهري للجمعية - معفى من الخصم في شهر الاستلام (${circle.myTurnMonth})`,
        frequency: 'monthly',
        startDate: circle.startDate,
        nextDate: circle.startDate,
        endDate: addMonths(circle.startDate, circle.membersCount - 1),
        active: true,
        circleId: circle.id,
        skipMonth: circle.myTurnMonth,
      })
      await updateMoneyCircle(user.uid, circle.id, { recurringId: recId })
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
    const updatedMembers = circle.members.map((m) => {
      if (m.id !== memberId) return m
      const hasPaid = m.paidMonths.includes(monthNum)
      const newPaid = hasPaid
        ? m.paidMonths.filter((mn) => mn !== monthNum)
        : [...m.paidMonths, monthNum]
      return { ...m, paidMonths: newPaid }
    })

    try {
      await updateMoneyCircle(user.uid, circle.id, { members: updatedMembers })
    } catch (err) {
      console.error('Failed to toggle member payment:', err)
    }
  }

  const handleDelete = async () => {
    if (!user || !deleteCircleId) return
    const circleToDelete = circles.find((c) => c.id === deleteCircleId)
    try {
      if (circleToDelete?.recurringId) {
        await deleteRecurring(user.uid, circleToDelete.recurringId).catch(() => {})
      }
      await deleteMoneyCircle(user.uid, deleteCircleId)
      setDepositedCircleIds((prev) => {
        const next = new Set(prev)
        next.delete(deleteCircleId)
        return next
      })
      showToast('تم حذف الجمعية بنجاح', 'info')
      setDeleteCircleId(null)
    } catch (err) {
      console.error('Failed to delete circle:', err)
      showToast('تعذر حذف الجمعية', 'error')
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
            const currentMonth = getCurrentCircleMonth(circle)
            const isUserTurn = isUserTurnMonth(circle)
            const isExpanded = expandedCircleId === circle.id
            const viewingMonth = selectedCircleMonth[circle.id] || currentMonth

            // Check if user has already received / deposited net turn payout
            const hasUserDeposited = depositedCircleIds.has(circle.id)
            const canDepositNet = currentMonth >= circle.myTurnMonth && !hasUserDeposited
            const netAmountFils = circle.totalAmountFils - circle.monthlyAmountFils

            // Calculate payments for viewing month
            const paidMembersCount = circle.members.filter((m) =>
              m.paidMonths.includes(viewingMonth)
            ).length

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
                        {circle.status === 'completed' && (
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
                    <div className="text-end me-2">
                      <div className="text-[11px] text-slate-400">إجمالي المقبوض</div>
                      <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {format(circle.totalAmountFils)}
                      </div>
                    </div>

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
                {isUserTurn ? (
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
                  {circle.recurringId ? (
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
                    <span>التقدم الزمني: الشهر {currentMonth} من {circle.membersCount}</span>
                    <span>{Math.round((currentMonth / circle.membersCount) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.round((currentMonth / circle.membersCount) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Manager Mode only: Member Payments Tracking & Table */}
                {Boolean(circle.isManager) && (
                  <>
                    {/* Toggle Details button: Who paid and who didn't */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>
                      دفعات الشهر {viewingMonth}:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {paidMembersCount} من {circle.membersCount} دفعوا
                      </strong>
                    </span>
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

                        return (
                          <div
                            key={member.id}
                            className={cn(
                              'flex items-center justify-between p-2.5 rounded-xl border transition-all',
                              isReceiverThisMonth
                                ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700/50'
                                : hasPaid
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
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
                                  {isReceiverThisMonth && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                      <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                                      <span>مستلم الشهر</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {isReceiverThisMonth ? 'يقبض هذا الشهر' : `قسط: ${format(circle.monthlyAmountFils)}`}
                                </div>
                              </div>
                            </div>

                            {/* Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleMemberPayment(circle, member.id, viewingMonth)}
                              className={cn(
                                'px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1',
                                hasPaid
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                              )}
                            >
                              {hasPaid ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>تم الدفع</span>
                                </>
                              ) : (
                                <span>لم يدفع</span>
                              )}
                            </button>
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

      {/* Add Circle Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="إنشاء جمعية مالية جديدة"
      >
        <form onSubmit={handleCreateCircle} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="دورك في الاستلام (رقم الشهر)"
              type="number"
              min="1"
              max={membersCount}
              value={myTurnMonth}
              onChange={(e) => setMyTurnMonth(parseInt(e.target.value, 10) || 1)}
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
              {format(toFils((parseFloat(monthlyAmountStr) || 0) * membersCount))}
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
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'جاري الإنشاء...' : 'إنشاء الجمعية'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteCircleId !== null}
        onClose={() => setDeleteCircleId(null)}
        title="تأكيد حذف الجمعية"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            هل أنت متأكد من رغبتك في حذف هذه الجمعية؟ لن تتمكن من استرجاع بيانات الأقسـاط والأعضاء المسجلة فيها.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button variant="ghost" onClick={() => setDeleteCircleId(null)}>
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
