import React, { useRef } from 'react'
import { CheckCircle2, Crown, AlertCircle, ArrowLeftRight, ChevronRight, ChevronLeft } from 'lucide-react'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { addMonths } from 'date-fns'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { cn } from '../../../lib/cn'
import type { MoneyCircle, CircleMember } from '../../../types'

export interface CircleMembersScheduleProps {
  circle: MoneyCircle
  viewingMonth: number
  onSelectMonth: (month: number) => void
  currentMonth: number
  userMonthlyFils: number
  isScheduled: boolean
  togglingMemberKey: string | null
  onToggleMemberPayment: (circle: MoneyCircle, memberId: string, month: number) => void
  onOpenSwapModal: (circle: MoneyCircle, member: CircleMember) => void
}

export const CircleMembersSchedule: React.FC<CircleMembersScheduleProps> = ({
  circle,
  viewingMonth,
  onSelectMonth,
  currentMonth,
  userMonthlyFils,
  isScheduled,
  togglingMemberKey,
  onToggleMemberPayment,
  onOpenSwapModal,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = (delta: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: delta, behavior: 'smooth' })
    }
  }

  return (
    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
      {/* Month selector for viewing past/current/future payments */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
          عرض دفعات الشهر:
        </span>
        <div className="flex items-center gap-1 max-w-full">
          {circle.membersCount > 4 && (
            <button
              type="button"
              onClick={() => handleScroll(150)}
              aria-label="الأشهر السابقة"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <div
            ref={scrollContainerRef}
            className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 max-w-full scroll-smooth"
          >
            {Array.from({ length: circle.membersCount }, (_, i) => i + 1).map((mNum) => (
              <button
                key={mNum}
                type="button"
                aria-label={`شهر ${mNum}`}
                onClick={() => onSelectMonth(mNum)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0',
                  viewingMonth === mNum
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                )}
              >
                شهر {mNum}
                <span className="text-[10px] opacity-80 ms-1 font-normal">
                  (
                  {formatDate(
                    addMonths(
                      circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate),
                      mNum - 1
                    ),
                    'MMM yyyy',
                    { locale: ar }
                  )}
                  )
                </span>
              </button>
            ))}
          </div>
          {circle.membersCount > 4 && (
            <button
              type="button"
              onClick={() => handleScroll(-150)}
              aria-label="الأشهر التالية"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Member grid - Swiss divided list */}
      <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden bg-white dark:bg-[#121215]">
        {circle.members.map((member) => {
          const hasPaid = member.paidMonths.includes(viewingMonth)
          const isUserFirstTurn = member.turnMonth === circle.myTurnMonth
          const isUserSecondTurn =
            circle.shareType === 'double' &&
            circle.secondTurnMonth !== undefined &&
            member.turnMonth === circle.secondTurnMonth
          const isUserMember = isUserFirstTurn || isUserSecondTurn
          const isReceiverThisMonth =
            member.turnMonth === viewingMonth ||
            (isUserMember &&
              (viewingMonth === circle.myTurnMonth ||
                (circle.shareType === 'double' &&
                  circle.secondTurnMonth !== undefined &&
                  viewingMonth === circle.secondTurnMonth)))
          const displayName =
            isUserSecondTurn && member.name.startsWith('عضو ')
              ? 'أنت (سهم 2)'
              : member.name
          const isOverdue = viewingMonth < currentMonth && !hasPaid && !isReceiverThisMonth

          return (
            <div
              key={member.id}
              className={cn(
                'flex items-center justify-between p-3 transition-colors',
                isReceiverThisMonth
                  ? 'bg-amber-50/30 dark:bg-amber-950/20'
                  : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
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
                    {isReceiverThisMonth ? (
                      'يقبض هذا الشهر'
                    ) : isUserMember && isScheduled ? (
                      member.paymentsByMonth?.[String(viewingMonth)] === false ? (
                        <span>قسط: <FormattedMoney amountFils={userMonthlyFils} /> (معلق يدوياً)</span>
                      ) : (
                        <span>قسط: <FormattedMoney amountFils={userMonthlyFils} /> (يُقتطع تلقائياً)</span>
                      )
                    ) : (
                      <span>قسط: <FormattedMoney amountFils={isUserMember ? userMonthlyFils : circle.monthlyAmountFils} /></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions: Swap Button (Manager mode) & Toggle / Exempt Badge */}
              <div className="flex items-center gap-1.5 shrink-0">
                {Boolean(circle.isManager) && (
                  <button
                    type="button"
                    onClick={() => onOpenSwapModal(circle, member)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="تبديل الدور"
                    aria-label={`تبديل دور ${displayName}`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {isReceiverThisMonth ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 select-none flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>مستلم الدورة (معفى)</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={togglingMemberKey === `${circle.id}_${member.id}_${viewingMonth}`}
                    onClick={() => onToggleMemberPayment(circle, member.id, viewingMonth)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed',
                      hasPaid
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : isOverdue
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-red-600 dark:text-red-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-red-200 dark:border-red-900/40'
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
  )
}
