import React from 'react'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { FormattedMoney } from '../ui/FormattedMoney'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Recurring, Category, Transaction } from '../../types'

export interface RecurringHistoryModalProps {
  item: Recurring | null
  onClose: () => void
  historyTxs: Transaction[]
  categoryMap: Map<string, Category>
}

export const RecurringHistoryModal: React.FC<RecurringHistoryModalProps> = ({
  item,
  onClose,
  historyTxs,
  categoryMap,
}) => {
  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title={
        item
          ? `سجل دفعات: ${item.title || categoryMap.get(item.categoryId)?.name || 'المعاملة'}`
          : 'سجل الدفعات'
      }
    >
      {item && (
        <div className="space-y-3">
          {historyTxs.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
              لم يتم تسجيل أي دفعات سابقة لهذه المعاملة المتكررة حتى الآن.
            </div>
          ) : (
            <div className="divide-y divide-[#E4E4E7] dark:divide-[#27272A] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] px-3 bg-zinc-50/50 dark:bg-zinc-900/40">
              {historyTxs.map((tx) => {
                const txDateFormatted = toWesternDigits(
                  formatDate(
                    tx.date instanceof Date ? tx.date : new Date(tx.date),
                    'd LLLL yyyy',
                    { locale: ar }
                  )
                )
                return (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-zinc-800 dark:text-zinc-100">
                        {tx.title || txDateFormatted}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {txDateFormatted}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'font-black text-sm select-none',
                        tx.type === 'expense'
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      <FormattedMoney amountFils={tx.amountFils} withSign={tx.type} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={onClose}
            >
              إغلاق
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
