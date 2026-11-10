import React from 'react'
import {
  Crown,
  CheckCircle2,
  Clock,
  RefreshCw,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { addMonths, format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import type { MoneyCircle, CircleMember, Recurring } from '../../../types'

export interface CircleTurnBannersProps {
  circle: MoneyCircle
  start: Date
  currentMonth: number
  isStarted: boolean
  isCompleted: boolean
  isObligationsCompleted: boolean
  isUserTurn: boolean
  canDepositNet: boolean
  turnGrossFils: number
  userMonthlyFils: number
  netAmountFils: number
  hasUserDeposited: boolean
  isSecondTurnActiveNow: boolean
  hasDepositedTurn1: boolean
  hasDepositedTurn2: boolean
  depositingCircleId: string | null
  isScheduledActive: boolean
  isScheduledPaused: boolean
  linkedRec: Recurring | undefined
  unpaidUserMonths: number[]
  userMember: CircleMember | undefined
  togglingMemberKey: string | null
  onConfirmComplete: (circle: MoneyCircle) => void
  onDepositCircleNet: (circle: MoneyCircle) => void
  onUndoDepositCircleNet: (circle: MoneyCircle, turn: 't1' | 't2') => void
  onResumeRecurring: (recId: string) => void
  onScheduleCircle: (circle: MoneyCircle) => void
  onToggleMemberPayment: (circle: MoneyCircle, memberId: string, month: number) => void
}

export const CircleTurnBanners: React.FC<CircleTurnBannersProps> = ({
  circle,
  start,
  currentMonth,
  isStarted,
  isCompleted,
  isObligationsCompleted,
  isUserTurn,
  canDepositNet,
  turnGrossFils,
  userMonthlyFils,
  netAmountFils,
  hasUserDeposited,
  isSecondTurnActiveNow,
  hasDepositedTurn1,
  hasDepositedTurn2,
  depositingCircleId,
  isScheduledActive,
  isScheduledPaused,
  linkedRec,
  unpaidUserMonths,
  userMember,
  togglingMemberKey,
  onConfirmComplete,
  onDepositCircleNet,
  onUndoDepositCircleNet,
  onResumeRecurring,
  onScheduleCircle,
  onToggleMemberPayment,
}) => {
  return (
    <>
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
            onClick={() => onConfirmComplete(circle)}
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
        <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
              <span>هذا الشهر هو دورك في الاستلام! ستقبض <FormattedMoney amountFils={turnGrossFils} />.</span>
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              حان موعد استلام حصتك من الجمعية! الصافي بعد حسم قسطك لهذا الشهر (<FormattedMoney amountFils={userMonthlyFils} />):{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                <FormattedMoney amountFils={netAmountFils} />
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
              onClick={() => onDepositCircleNet(circle)}
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
            <span>هذا الشهر هو دورك في الاستلام! ستقبض <FormattedMoney amountFils={turnGrossFils} />.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
              {hasUserDeposited ? 'تم إيداع الصافي في الرصيد' : 'لا يُخصم منك قسط'}
            </span>
            {hasUserDeposited && (
              <button
                type="button"
                onClick={() => onUndoDepositCircleNet(circle, isSecondTurnActiveNow ? 't2' : 't1')}
                disabled={depositingCircleId === circle.id}
                className="text-[11px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 underline cursor-pointer disabled:opacity-50"
              >
                إلغاء الإيداع
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              دورك في الاستلام:{' '}
              <strong className="text-zinc-800 dark:text-zinc-100 font-bold">
                الشهر رقم {circle.myTurnMonth}{' '}
                <span className="text-[11px] font-normal text-zinc-500">
                  (
                  {formatDate(
                    addMonths(
                      circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate),
                      circle.myTurnMonth - 1
                    ),
                    'MMMM yyyy',
                    { locale: ar }
                  )}
                  )
                </span>
                {circle.shareType === 'double' && circle.secondTurnMonth && (
                  <>
                    {' '}و الشهر رقم {circle.secondTurnMonth}{' '}
                    <span className="text-[11px] font-normal text-zinc-500">
                      (
                      {formatDate(
                        addMonths(
                          circle.startDate instanceof Date ? circle.startDate : new Date(circle.startDate),
                          circle.secondTurnMonth - 1
                        ),
                        'MMMM yyyy',
                        { locale: ar }
                      )}
                      )
                    </span>
                  </>
                )}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {circle.shareType === 'double' && circle.secondTurnMonth ? (
              <>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-400">دور 1:</span>
                  <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                    {hasDepositedTurn1 ? 'تم إيداع الصافي' : circle.myTurnMonth > currentMonth ? `باقي ${circle.myTurnMonth - currentMonth} أشهر` : 'حان دورك'}
                  </span>
                  {hasDepositedTurn1 && (
                    <button
                      type="button"
                      onClick={() => onUndoDepositCircleNet(circle, 't1')}
                      disabled={depositingCircleId === circle.id}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 underline font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-400">دور 2:</span>
                  <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                    {hasDepositedTurn2 ? 'تم إيداع الصافي' : circle.secondTurnMonth > currentMonth ? `باقي ${circle.secondTurnMonth - currentMonth} أشهر` : 'حان دورك'}
                  </span>
                  {hasDepositedTurn2 && (
                    <button
                      type="button"
                      onClick={() => onUndoDepositCircleNet(circle, 't2')}
                      disabled={depositingCircleId === circle.id}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 underline font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {circle.myTurnMonth > currentMonth
                    ? (() => {
                        const diff = circle.myTurnMonth - currentMonth
                        if (diff === 1) return 'باقي شهر واحد على دورك'
                        if (diff === 2) return 'باقي شهران على دورك'
                        if (diff <= 10) return `باقي ${diff} أشهر على دورك`
                        return `باقي ${diff} شهراً على دورك`
                      })()
                    : hasUserDeposited
                      ? 'تم استلام حصتك وإيداعها في الرصيد'
                      : 'حان دورك ولم يتم إيداع الصافي بعد!'}
                </span>
                {hasUserDeposited && (
                  <button
                    type="button"
                    onClick={() => onUndoDepositCircleNet(circle, 't1')}
                    disabled={depositingCircleId === circle.id}
                    className="text-[11px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 underline cursor-pointer disabled:opacity-50"
                  >
                    إلغاء الإيداع
                  </button>
                )}
              </>
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
              الصافي بعد حسم قسطك لهذا الشهر (<FormattedMoney amountFils={userMonthlyFils} />):{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                <FormattedMoney amountFils={netAmountFils} />
              </strong>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={depositingCircleId === circle.id}
            onClick={() => onDepositCircleNet(circle)}
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
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>مجدولة في المعاملات المتكررة (معفاة من الخصم في الشهر {circle.myTurnMonth})</span>
          </div>
        ) : isScheduledPaused && linkedRec ? (
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
              <RefreshCw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>الجدولة التلقائية متوقفة مؤقتاً</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3 h-3 text-amber-500" />}
              onClick={() => onResumeRecurring(linkedRec.id)}
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
              icon={<Calendar className="w-3 h-3 text-zinc-500" />}
              onClick={() => onScheduleCircle(circle)}
            >
              جدولة القسط تلقائياً
            </Button>
          </div>
        )}
      </div>

      {/* Unpaid User Installment Alert Banner */}
      {unpaidUserMonths.length > 0 && userMember && (
        <div className="mt-3.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span>
                قسطك الشخصي لشهر {unpaidUserMonths[0]} بقيمة <FormattedMoney amountFils={userMonthlyFils} /> غير مسدد بعد
                {userMember.paymentsByMonth?.[String(unpaidUserMonths[0])] === false && (
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    {' '}(تم إلغاء الخصم التلقائي — بانتظار سدادك)
                  </span>
                )}
                {unpaidUserMonths.length > 1 && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-normal">
                    {' '}
                    (لديك{' '}
                    {unpaidUserMonths.length === 2
                      ? 'قسطان غير مسددين'
                      : unpaidUserMonths.length <= 10
                        ? `${unpaidUserMonths.length} أقساط غير مسددة`
                        : `${unpaidUserMonths.length} قسطاً غير مسدد`}
                    )
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
            onClick={() => onToggleMemberPayment(circle, userMember.id, unpaidUserMonths[0])}
            className="text-xs shrink-0 self-end sm:self-auto"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            تسجيل سداد قسطي الآن
          </Button>
        </div>
      )}
    </>
  )
}
