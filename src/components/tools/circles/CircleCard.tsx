import React from 'react'
import {
  Users,
  Crown,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { CircleMembersSchedule } from './CircleMembersSchedule'
import { CircleInstallmentsHistory } from './CircleInstallmentsHistory'
import { CircleTurnBanners } from './CircleTurnBanners'
import { format as formatDate } from 'date-fns'
import {
  getCurrentCircleMonth,
  getCircleCycleIndex,
  isUserTurnMonth,
  isCircleFullyPaid,
} from '../../../services/moneyCircles'
import { cn } from '../../../lib/cn'
import type { MoneyCircle, CircleMember, Recurring } from '../../../types'

export interface CircleCardProps {
  circle: MoneyCircle
  monthStartDay: number
  depositedCircleIds: Set<string>
  expandedCircleId: string | null
  setExpandedCircleId: (id: string | null) => void
  selectedCircleMonth: Record<string, number>
  setSelectedCircleMonth: React.Dispatch<React.SetStateAction<Record<string, number>>>
  togglingMemberKey: string | null
  depositingCircleId: string | null
  getLinkedRecurring: (circle: MoneyCircle) => Recurring | undefined
  handleOpenEditModal: (circle: MoneyCircle) => void
  setDeleteCircleId: (id: string) => void
  setConfirmCompleteCircle: (circle: MoneyCircle) => void
  handleRestoreCircle: (circle: MoneyCircle) => void
  handleDepositCircleNet: (circle: MoneyCircle) => void
  handleUndoDepositCircleNet: (circle: MoneyCircle, turn: 't1' | 't2') => void
  handleToggleMemberPayment: (circle: MoneyCircle, memberId: string, month: number) => void
  handleResumeRecurring: (recId: string) => void
  handleScheduleCircle: (circle: MoneyCircle) => void
  setSwapTarget: (target: { circle: MoneyCircle; member: CircleMember } | null) => void
  setSwapWithMemberId: (id: string) => void
}

export const CircleCard: React.FC<CircleCardProps> = ({
  circle,
  monthStartDay,
  depositedCircleIds,
  expandedCircleId,
  setExpandedCircleId,
  selectedCircleMonth,
  setSelectedCircleMonth,
  togglingMemberKey,
  depositingCircleId,
  getLinkedRecurring,
  handleOpenEditModal,
  setDeleteCircleId,
  setConfirmCompleteCircle,
  handleRestoreCircle,
  handleDepositCircleNet,
  handleUndoDepositCircleNet,
  handleToggleMemberPayment,
  handleResumeRecurring,
  handleScheduleCircle,
  setSwapTarget,
  setSwapWithMemberId,
}) => {
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
  const userTotalGrossFils =
    circle.shareType === 'half'
      ? Math.round(circle.totalAmountFils / 2)
      : circle.shareType === 'double'
        ? circle.totalAmountFils * 2
        : circle.totalAmountFils
  const turnGrossFils =
    circle.shareType === 'half'
      ? Math.round(circle.totalAmountFils / 2)
      : circle.totalAmountFils
  const netAmountFils = turnGrossFils - userMonthlyFils

  // Unpaid user months up to currentMonth
  const unpaidUserMonths =
    isStarted && circle.status !== 'completed' && userMember
      ? Array.from({ length: Math.min(currentMonth, circle.membersCount) }, (_, i) => i + 1).filter(
          (m) => !userExemptMonths.has(m) && !userMember.paidMonths.includes(m)
        )
      : []

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

  const isUserReceivingInViewingMonth =
    viewingMonth === circle.myTurnMonth ||
    (circle.shareType === 'double' &&
      circle.secondTurnMonth !== undefined &&
      viewingMonth === circle.secondTurnMonth)

  const exemptCount = (circle.shareType === 'double' && isUserReceivingInViewingMonth) ? 2 : 1

  const nonReceiverPaidCount = circle.members.filter((m) => {
    if (circle.shareType === 'double' && isUserReceivingInViewingMonth) {
      if (m.turnMonth === circle.myTurnMonth || m.turnMonth === circle.secondTurnMonth) {
        return false
      }
    } else if (m.turnMonth === viewingMonth) {
      return false
    }
    return m.paidMonths.includes(viewingMonth)
  }).length
  const paidMembersCount = Math.min(circle.membersCount, nonReceiverPaidCount + exemptCount)

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
              <span>قسط: <FormattedMoney amountFils={userMonthlyFils} /> / شهر</span>
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
              onClick={() => setConfirmCompleteCircle(circle)}
              className="text-xs text-zinc-600 dark:text-zinc-300"
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
            >
              إنهاء الجمعية
            </Button>
          )}

          {circle.status === 'completed' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRestoreCircle(circle)}
              className="text-xs text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400"
              icon={<RotateCcw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
            >
              استعادة للنشطة
            </Button>
          )}

          <div className="text-end me-2">
            <div className="text-[11px] text-zinc-400">إجمالي المقبوض</div>
            <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 select-none">
              <FormattedMoney amountFils={userTotalGrossFils} />
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

      {/* Status & Turn Banners */}
      <CircleTurnBanners
        circle={circle}
        start={start}
        currentMonth={currentMonth}
        isStarted={isStarted}
        isCompleted={isCompleted}
        isObligationsCompleted={isObligationsCompleted}
        isUserTurn={isUserTurn}
        canDepositNet={canDepositNet}
        turnGrossFils={turnGrossFils}
        userMonthlyFils={userMonthlyFils}
        netAmountFils={netAmountFils}
        hasUserDeposited={hasUserDeposited}
        isSecondTurnActiveNow={isSecondTurnActiveNow}
        hasDepositedTurn1={hasDepositedTurn1}
        hasDepositedTurn2={hasDepositedTurn2}
        depositingCircleId={depositingCircleId}
        isScheduledActive={isScheduledActive}
        isScheduledPaused={isScheduledPaused}
        linkedRec={linkedRec}
        unpaidUserMonths={unpaidUserMonths}
        userMember={userMember}
        togglingMemberKey={togglingMemberKey}
        onConfirmComplete={setConfirmCompleteCircle}
        onDepositCircleNet={handleDepositCircleNet}
        onUndoDepositCircleNet={handleUndoDepositCircleNet}
        onResumeRecurring={handleResumeRecurring}
        onScheduleCircle={handleScheduleCircle}
        onToggleMemberPayment={handleToggleMemberPayment}
      />

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
                  ({circle.membersCount - paidMembersCount} متأخر)
                </span>
              )}
            </div>

            <Button
              onClick={() => setExpandedCircleId(isExpanded ? null : circle.id)}
              variant="ghost"
              size="sm"
              icon={isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            >
              {isExpanded ? 'إخفاء جدول الأعضاء' : 'تتبع دفعات الأعضاء وسجل السداد'}
            </Button>
          </div>

          {isExpanded && (
            <CircleMembersSchedule
              circle={circle}
              viewingMonth={viewingMonth}
              onSelectMonth={(mNum) => setSelectedCircleMonth((prev) => ({ ...prev, [circle.id]: mNum }))}
              currentMonth={currentMonth}
              userMonthlyFils={userMonthlyFils}
              isScheduled={isScheduled}
              togglingMemberKey={togglingMemberKey}
              onToggleMemberPayment={handleToggleMemberPayment}
              onOpenSwapModal={(c, m) => {
                setSwapTarget({ circle: c, member: m })
                const others = c.members.filter((mem) => mem.id !== m.id)
                if (others.length > 0) {
                  setSwapWithMemberId(others[0].id)
                }
              }}
            />
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

          {isExpanded && (
            <CircleInstallmentsHistory
              circle={circle}
              userMember={userMember}
              userExemptMonths={userExemptMonths}
              currentMonth={currentMonth}
              userMonthlyFils={userMonthlyFils}
              togglingMemberKey={togglingMemberKey}
              onToggleMemberPayment={handleToggleMemberPayment}
            />
          )}
        </>
      )}
    </Card>
  )
}
