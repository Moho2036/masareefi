import React from 'react'
import { CheckCircle2, Crown, AlertCircle } from 'lucide-react'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { addMonths } from 'date-fns'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { cn } from '../../../lib/cn'
import type { MoneyCircle, CircleMember } from '../../../types'

export interface CircleInstallmentsHistoryProps {
  circle: MoneyCircle
  userMember: CircleMember
  userExemptMonths: Set<number>
  currentMonth: number
  userMonthlyFils: number
  togglingMemberKey: string | null
  onToggleMemberPayment: (circle: MoneyCircle, memberId: string, month: number) => void
}

export const CircleInstallmentsHistory: React.FC<CircleInstallmentsHistoryProps> = ({
  circle,
  userMember,
  userExemptMonths,
  currentMonth,
  userMonthlyFils,
  togglingMemberKey,
  onToggleMemberPayment,
}) => {
  return (
    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
      <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
        سجل دفعاتك الشهرية لهذه الجمعية:
      </div>
      <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden bg-white dark:bg-[#121215]">
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
                'flex items-center justify-between p-3 transition-colors',
                isExempt
                  ? 'bg-amber-50/30 dark:bg-amber-950/20'
                  : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
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
                      : <span>قسط: <FormattedMoney amountFils={userMonthlyFils} /></span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isExempt ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 select-none flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>دورك في القبض (معفى)</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={togglingMemberKey === `${circle.id}_${userMember.id}_${mNum}`}
                    onClick={() => onToggleMemberPayment(circle, userMember.id, mNum)}
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

      {/* Member Turn Schedule Transparency for Non-Managers */}
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
        <div className="text-xs font-bold text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
          <span>جدول أدوار الجمعية ومواعيد الاستلام:</span>
          <span className="text-[11px] font-normal text-zinc-400">للاطلاع والشفافية</span>
        </div>
        <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] overflow-hidden bg-white dark:bg-[#121215]">
          {circle.members.map((member) => {
            const turnDate = addMonths(
              circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate),
              member.turnMonth - 1
            )
            const isUserFirst = member.turnMonth === circle.myTurnMonth
            const isUserSecond =
              circle.shareType === 'double' &&
              circle.secondTurnMonth !== undefined &&
              member.turnMonth === circle.secondTurnMonth
            const isUser = isUserFirst || isUserSecond
            const displayName =
              isUserSecond && member.name.startsWith('عضو ')
                ? 'أنت (سهم 2)'
                : isUserFirst
                  ? 'أنت'
                  : member.name

            return (
              <div
                key={member.id}
                className={cn(
                  'flex items-center justify-between p-2.5 text-xs transition-colors',
                  isUser
                    ? 'bg-blue-50/40 dark:bg-blue-950/20'
                    : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {member.turnMonth}
                  </span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {displayName}
                  </span>
                  {isUserFirst && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      (أنت)
                    </span>
                  )}
                  {isUserSecond && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      (سهمك الثاني)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-[11px]">
                  <span>شهر {member.turnMonth}</span>
                  <span>•</span>
                  <span>{formatDate(turnDate, 'MMMM yyyy', { locale: ar })}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
