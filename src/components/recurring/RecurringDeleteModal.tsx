import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Recurring } from '../../types'

export interface RecurringDeleteModalProps {
  item: Recurring | null
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}

export const RecurringDeleteModal: React.FC<RecurringDeleteModalProps> = ({
  item,
  onClose,
  onConfirm,
  deleting,
}) => {
  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title="تأكيد حذف المعاملة المتكررة"
      hideCloseButton={true}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            هل أنت متأكد من حذف هذه المعاملة المتكررة؟ لن يتم إنشاء أي معاملات مستقبلية منها.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={deleting}
          >
            إلغاء
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'جاري الحذف...' : 'حذف المعاملة المتكررة'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
