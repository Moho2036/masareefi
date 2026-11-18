import React, { useState } from 'react'
import { Link } from 'react-router'
import { Receipt, Plus, ChevronLeft } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { FormattedMoney } from '../ui/FormattedMoney'
import { CategoryIcon } from '../ui/CategoryIcon'
import { EmptyState } from '../ui/EmptyState'
import { RecentTransactionRow } from './RecentTransactionRow'
import type { Transaction, Category } from '../../types'
import type { CategoryDistributionItem } from '../../lib/reports'

export interface DashboardRecentTransactionsProps {
  isInitialOrLoading: boolean
  recentTransactions: Transaction[]
  topExpenseCategories: CategoryDistributionItem[]
  categoryMap: Map<string, Category>
  today: Date
  openAdd: (type?: 'income' | 'expense') => void
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
  onDelete?: (tx: Transaction) => void
}

export const DashboardRecentTransactions: React.FC<DashboardRecentTransactionsProps> = ({
  isInitialOrLoading,
  recentTransactions,
  topExpenseCategories,
  categoryMap,
  today,
  openAdd,
  openEdit,
  openDuplicate,
  onDelete,
}) => {
  const [swipedTxId, setSwipedTxId] = useState<string | null>(null)

  return (
    <div className="lg:col-span-7 space-y-5">
      {/* Recent Transactions Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              آخر المعاملات
            </h2>
          </div>
          <Link
            to="/transactions"
            className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span>عرض الكل</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isInitialOrLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 animate-pulse"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-16 h-2.5 rounded bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
                <div className="w-16 h-4 rounded bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              </div>
            ))}
          </div>
        ) : recentTransactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title="لا توجد معاملات مسجلة"
            description="أضف معاملتك الأولى لهذا الشهر للبدء بتتبع مصاريفك ومداخيلك."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => openAdd('expense')}
                className="gap-1 mt-1"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة معاملة</span>
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {recentTransactions.map((tx) => (
              <RecentTransactionRow
                key={tx.id}
                tx={tx}
                cat={categoryMap.get(tx.categoryId)}
                today={today}
                openEdit={openEdit}
                openDuplicate={openDuplicate}
                onDelete={onDelete}
                isSwipedOpen={swipedTxId === tx.id}
                onSwipeChange={(isOpen) => setSwipedTxId(isOpen ? tx.id : null)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Top 3 Monthly Expenses Card */}
      {topExpenseCategories.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-[#E4E4E7] dark:border-[#27272A]">
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100">
              أعلى مصاريف الشهر
            </h2>
            <Link
              to="/reports"
              className="py-1.5 px-2 -my-1.5 -mx-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/40 flex items-center gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span>التقارير الكاملة</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {topExpenseCategories.map((item) => (
              <Link
                key={item.categoryId}
                to={`/transactions?categoryId=${item.categoryId}&type=expense`}
                className="block space-y-1.5 group cursor-pointer p-1.5 -mx-1.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                      <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                    </span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                      <FormattedMoney amountFils={item.amountFils} />
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400 min-w-8 text-end tabular-nums select-none ps-2">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
