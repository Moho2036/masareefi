import React from 'react'
import { GitMerge } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Debt } from '../../types'

export interface DebtsMergeModalProps {
  mergeTarget: { debts: Debt[]; personName: string } | null
  onClose: () => void
  onConfirm: () => void
  isMerging: boolean
}

export const DebtsMergeModal: React.FC<DebtsMergeModalProps> = ({
  mergeTarget,
  onClose,
  onConfirm,
  isMerging,
}) => {
  return (
    <Modal
      isOpen={Boolean(mergeTarget)}
      onClose={onClose}
      title="تأكيد دمج سجلات الديون"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-zinc-800 dark:text-zinc-200">
          <GitMerge className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-sm font-semibold">
            {mergeTarget?.debts.length === 2
              ? `هل ترغب في دمج سجلي دين لـ "${mergeTarget?.personName}" في سجل دين موحد؟`
              : `هل ترغب في دمج ${mergeTarget?.debts.length} سجلات ديون لـ "${mergeTarget?.personName}" في سجل دين موحد؟`}
          </p>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          سيتم تحويل جميع السجلات والسلف ودفعات السداد السابقة إلى سجل واحد متكامل، مع الحفاظ الكامل على كافة المعاملات المالية ورصيد المحفظة.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isMerging}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onConfirm}
            disabled={isMerging}
          >
            {isMerging ? 'جاري الدمج...' : 'تأكيد الدمج الموحد'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
