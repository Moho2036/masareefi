import React from 'react'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { CategoryDistributionItem } from '../../lib/reports'
import type { Transaction } from '../../types'

export interface CategoryTransactionsModalProps {
  category: CategoryDistributionItem | null
  transactions: Transaction[]
  onClose: () => void
}

export const CategoryTransactionsModal: React.FC<CategoryTransactionsModalProps> = ({
  category,
  transactions,
  onClose,
}) => {
  return (
    <Modal
      isOpen={category !== null}
      onClose={onClose}
      title={category ? `معاملات ${category.name}` : undefined}
    >
      <div className="space-y-4 pt-1">
        {category && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <CategoryIcon icon={category.icon} color={category.color} size="md" />
              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                {category.name}
              </span>
            </div>
            <div className="text-end">
              <div className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                <FormattedMoney amountFils={category.amountFils} />
              </div>
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold">
                {category.percentage}% من الإجمالي
              </div>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            لا توجد معاملات مسجلة في هذا التصنيف خلال هذه الفترة
          </div>
        ) : (
          <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A]">
            {transactions.map((tx) => {
              const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-100">
                      {tx.title?.trim() || tx.note?.trim() || category?.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {toWesternDigits(formatDate(txDate, 'd MMMM yyyy', { locale: ar }))}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'font-black text-sm',
                      tx.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    <FormattedMoney amountFils={tx.amountFils} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-2">
          <Button type="button" variant="outline" className="w-full h-11 rounded-xl" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  )
}
