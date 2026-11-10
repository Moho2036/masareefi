import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Toggle } from '../ui/Toggle'
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
  return (
    <Modal
      isOpen={Boolean(debtToDelete)}
      onClose={onClose}
      title="تأكيد حذف الدين"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">
            هل أنت متأكد من حذف سجل الدين الخاص بـ &quot;{debtToDelete?.personName}&quot;؟ سيتم حذف كافة بياناته ودفعاته بشكل نهائي.
          </p>
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
