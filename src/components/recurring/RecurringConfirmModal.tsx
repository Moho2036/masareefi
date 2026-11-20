import React from 'react'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { toWesternDigits } from '../../lib/dates'
import type { Recurring, Category } from '../../types'

export interface RecurringConfirmModalProps {
  item: Recurring | null
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  amountStr: string
  setAmountStr: (val: string) => void
  submitting: boolean
  error: string | null
  categoryMap: Map<string, Category>
}

export const RecurringConfirmModal: React.FC<RecurringConfirmModalProps> = ({
  item,
  onClose,
  onSubmit,
  amountStr,
  setAmountStr,
  submitting,
  error,
  categoryMap,
}) => {
  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title="تأكيد وتسجيل الدفعة الدورية"
      hideCloseButton={true}
    >
      {item && (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold block">
              المعاملة:
            </span>
            <span className="text-sm font-black text-zinc-800 dark:text-zinc-100">
              {item.title || categoryMap.get(item.categoryId)?.name || 'معاملة دورية'}
            </span>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              تاريخ الاستحقاق:{' '}
              {toWesternDigits(
                formatDate(
                  item.nextDate instanceof Date
                    ? item.nextDate
                    : new Date(item.nextDate),
                  'd LLLL yyyy',
                  { locale: ar }
                )
              )}
            </div>
          </div>

          <div>
            <Input
              label="المبلغ المسجل لهذه الدفعة"
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(toWesternDigits(e.target.value))}
              required
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              يمكنك تعديل المبلغ الفعلي لهذه الدفعة دون تغيير المبلغ الأساسي للمعاملة.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-800/50"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting}
            >
              {submitting ? 'جاري التأكيد...' : 'تأكيد وتسجيل المعاملة'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
