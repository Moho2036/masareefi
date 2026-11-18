import React from 'react'
import { format } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
import { FormattedMoney } from '../ui/FormattedMoney'
import { getDebtRemainingFils } from '../../lib/debts'
import { toWesternDigits } from '../../lib/dates'
import type { Debt } from '../../types'

export interface DebtDeleteModalProps {
  debtToDelete: Debt | null
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
  hasLinkedTransactions: boolean
  deleteTransactions: boolean
  setDeleteTransactions: (val: boolean) => void
}

export const DebtDeleteModal: React.FC<DebtDeleteModalProps> = ({
  debtToDelete,
  onClose,
  onConfirm,
  isDeleting,
  hasLinkedTransactions,
  deleteTransactions,
  setDeleteTransactions,
}) => {
  if (!debtToDelete) return null

  const isLent = debtToDelete.type === 'lent'
  const remainingFils = getDebtRemainingFils(debtToDelete)
  const startDate = debtToDelete.startDate instanceof Date ? debtToDelete.startDate : new Date(debtToDelete.startDate)
  const formattedStartDate = toWesternDigits(format(startDate, 'yyyy/MM/dd'))

  return (
    <Modal
      isOpen={Boolean(debtToDelete)}
      onClose={onClose}
      hideCloseButton={true}
      title="تأكيد حذف الدين"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">
            هل أنت متأكد من حذف سجل الدين؟ سيتم حذف كافة بياناته ودفعاته بشكل نهائي.
          </p>
        </div>

        {/* Detailed Debt Summary Card (DEBT-05) */}
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
              {debtToDelete.personName}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]">
              {isLent ? 'مستحق لك' : 'التزام عليك'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
            <div>
              <span className="text-zinc-400 dark:text-zinc-500 block text-[11px]">المبلغ الأصلي</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                <FormattedMoney amountFils={debtToDelete.amountFils} />
              </span>
            </div>
            <div>
              <span className="text-zinc-400 dark:text-zinc-500 block text-[11px]">المتبقي الفعلي</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 tabular-nums">
                <FormattedMoney amountFils={remainingFils} />
              </span>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5 flex items-center justify-between">
            <span>تاريخ البدء: {formattedStartDate}</span>
            {debtToDelete.note && <span className="truncate max-w-[160px]" title={debtToDelete.note}>{debtToDelete.note}</span>}
          </div>
        </div>

        {hasLinkedTransactions && (
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
            <Toggle
              id="delete-debt-txs"
              label="حذف المعاملات المالية المرتبطة بهذا الدين (أصل الدين والدفعات) من المحفظة أيضاً"
              checked={deleteTransactions}
              onChange={setDeleteTransactions}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
          >
            إلغاء
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'جاري الحذف...' : 'حذف الدين'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
