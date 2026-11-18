import React from 'react'
import { Link } from 'react-router'
import { HandCoins, Calendar, ChevronLeft, ArrowUpRight } from 'lucide-react'
import { Card } from '../ui/Card'
import { FormattedMoney } from '../ui/FormattedMoney'
import { CategoryIcon } from '../ui/CategoryIcon'
import { formatDebtCount } from '../../lib/dashboard'
import { toWesternDigits } from '../../lib/dates'
import { format as formatDate, differenceInDays, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import { cn } from '../../lib/cn'
import type { Debt, Recurring, Category } from '../../types'
import type { DebtSummary } from '../../lib/debts'

export interface DashboardUpcomingSectionProps {
  isInitialOrLoading: boolean
  debtsLoading: boolean
  debtSummary: DebtSummary
  nearestUpcomingDebt: Debt | null
  upcomingRecurring: (Recurring & { nextDate: Date })[]
  recurringLoading: boolean
  categoryMap: Map<string, Category>
  today: Date
}

export const DashboardUpcomingSection: React.FC<DashboardUpcomingSectionProps> = ({
  isInitialOrLoading,
  debtsLoading,
  debtSummary,
  nearestUpcomingDebt,
  upcomingRecurring,
  recurringLoading,
  categoryMap,
  today,
}) => {
  return (
    <div id="upcoming-obligations-section" className="lg:col-span-5 space-y-5 scroll-mt-20">
      {/* Active Debts Summary */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
          <div className="flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              ملخص الديون والالتزامات
            </h2>
          </div>
          <Link
            to="/debts"
            className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
          >
            <span>إدارة الديون</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isInitialOrLoading || debtsLoading ? (
          <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] pt-1 animate-pulse">
            <div className="ps-2 sm:ps-3 pe-3 space-y-2">
              <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="w-20 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
              <div className="w-12 h-2.5 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="ps-3 sm:ps-4 pe-2 sm:pe-3 space-y-2">
              <div className="w-16 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="w-20 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
              <div className="w-12 h-2.5 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A]">
              <Link
                to="/debts?type=lent"
                className="flex flex-col gap-1 ps-2 sm:ps-3 pe-3 hover:opacity-80 transition-opacity cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                title="عرض المستحقات في صفحة الديون"
              >
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  مستحقات لك
                </span>
                <span
                  className={cn(
                    'text-base sm:text-lg font-black truncate',
                    debtSummary.lentActiveCount > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-zinc-500 dark:text-zinc-400 font-bold'
                  )}
                >
                  <FormattedMoney amountFils={debtSummary.lentFils} />
                </span>
                <span className="text-[10px] text-zinc-400">
                  {formatDebtCount(debtSummary.lentActiveCount, 'lent')}
                </span>
              </Link>

              <Link
                to="/debts?type=borrowed"
                className="flex flex-col gap-1 ps-3 sm:ps-4 pe-2 sm:pe-3 hover:opacity-80 transition-opacity cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                title="عرض الالتزامات في صفحة الديون"
              >
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  التزامات عليك
                </span>
                <span
                  className={cn(
                    'text-base sm:text-lg font-black truncate',
                    debtSummary.borrowedActiveCount > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-zinc-500 dark:text-zinc-400 font-bold'
                  )}
                >
                  <FormattedMoney amountFils={debtSummary.borrowedFils} />
                </span>
                <span className="text-[10px] text-zinc-400">
                  {formatDebtCount(debtSummary.borrowedActiveCount, 'borrowed')}
                </span>
              </Link>
            </div>

            {nearestUpcomingDebt && nearestUpcomingDebt.dueDate && (
              <Link
                to={`/debts?type=${nearestUpcomingDebt.type || 'borrowed'}`}
                className="mt-3 pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-col gap-1 min-h-[44px] justify-center text-xs hover:opacity-80 transition-opacity cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                title="عرض تفاصيل أقرب استحقاق في صفحة الديون"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      أقرب استحقاق ({nearestUpcomingDebt.type === 'lent' ? 'مستحق لك' : 'التزام عليك'}): {nearestUpcomingDebt.personName}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-xs sm:text-sm font-black select-none shrink-0 ps-2',
                      nearestUpcomingDebt.type === 'lent'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    <FormattedMoney
                      amountFils={Math.max(
                        0,
                        nearestUpcomingDebt.amountFils - (nearestUpcomingDebt.paidFils || 0)
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 ps-5">
                  <span>
                    {toWesternDigits(
                      formatDate(
                        new Date(nearestUpcomingDebt.dueDate),
                        new Date(nearestUpcomingDebt.dueDate).getFullYear() === today.getFullYear()
                          ? 'd MMMM'
                          : 'd MMMM yyyy',
                        { locale: ar }
                      )
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    {(() => {
                      const diff = differenceInDays(
                        startOfDay(new Date(nearestUpcomingDebt.dueDate)),
                        startOfDay(today)
                      )
                      if (diff < 0) return 'متأخر'
                      if (diff === 0) return 'يستحق اليوم'
                      if (diff === 1) return 'يستحق غداً'
                      if (diff === 2) return 'خلال يومين'
                      if (diff >= 3 && diff <= 10) return `خلال ${diff} أيام`
                      return `خلال ${diff} يوماً`
                    })()}
                  </span>
                </div>
              </Link>
            )}
          </>
        )}
      </Card>

      {/* Upcoming Recurring */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              المتكررات القادمة
            </h2>
          </div>
          <Link
            to="/recurring"
            className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors"
          >
            <span>إدارة المتكررة</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isInitialOrLoading || recurringLoading ? (
          <div className="space-y-2 pt-1 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  <div className="space-y-1">
                    <div className="w-24 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-14 h-2 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
                <div className="w-14 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : upcomingRecurring.length === 0 ? (
          <div className="py-2 flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              لا توجد معاملات متكررة نشطة
            </span>
            <Link
              to="/recurring"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-bold shrink-0"
            >
              <span>ضبط معاملة متكررة جديدة</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {upcomingRecurring.map((item) => {
              const cat = categoryMap.get(item.categoryId)
              const isExpense = item.type === 'expense'
              const nextDate =
                item.nextDate instanceof Date
                  ? item.nextDate
                  : new Date(item.nextDate)
              const nextDateFormatted = toWesternDigits(
                formatDate(nextDate, 'd MMMM', { locale: ar })
              )
              const diffDays = differenceInDays(startOfDay(nextDate), startOfDay(today))
              let relativeText: string
              if (diffDays < 0) {
                relativeText = 'مستحقة'
              } else if (diffDays === 0) {
                relativeText = 'اليوم'
              } else if (diffDays === 1) {
                relativeText = 'غداً'
              } else if (diffDays === 2) {
                relativeText = 'بعد يومين'
              } else if (diffDays >= 3 && diffDays <= 10) {
                relativeText = `بعد ${diffDays} أيام`
              } else {
                relativeText = `بعد ${diffDays} يوماً`
              }

              return (
                <Link
                  to="/recurring"
                  key={item.id}
                  className="flex items-center justify-between py-2 px-1.5 min-h-[44px] hover:bg-zinc-50 dark:hover:bg-zinc-800/40 rounded-xl transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                      <CategoryIcon icon={cat?.icon || 'repeat'} color={cat?.color} size="sm" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-zinc-800 dark:text-zinc-100 truncate">
                        {item.title || item.note || (cat ? cat.name : 'معاملة متكررة')}
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        {nextDateFormatted} • {relativeText}
                      </div>
                    </div>
                  </div>

                  <div className="text-end shrink-0 ps-2">
                    <div
                      className={cn(
                        'text-xs font-extrabold select-none',
                        isExpense
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      <FormattedMoney amountFils={item.amountFils} withSign={item.type} />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
