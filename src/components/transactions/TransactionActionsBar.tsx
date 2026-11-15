import React from 'react'
import { Button } from '../ui/Button'

export interface TransactionActionsBarProps {
  isEditing: boolean
  isLockedTransaction?: boolean
  isLinkedToDebtPayment?: boolean
  isActualDuplicate?: boolean
  showDeleteConfirm?: boolean
  onShowDeleteConfirm?: (val: boolean) => void
  submitting: boolean
  deleting?: boolean
  onClose?: () => void
  onDelete?: () => void
  onSaveAndAddAnother?: () => void
  onDuplicateCurrent?: () => void
  canDelete?: boolean
  deleteConfirmMessage?: string
}

export const TransactionActionsBar: React.FC<TransactionActionsBarProps> = ({
  isEditing,
  isActualDuplicate,
  submitting,
  onSaveAndAddAnother,
}) => {
  return (
    <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-1">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="flex-1"
        >
          {submitting
            ? 'جاري الحفظ...'
            : isEditing
              ? 'تعديل المعاملة'
              : isActualDuplicate
                ? 'حفظ النسخة'
                : 'حفظ'}
        </Button>

        {!isEditing && !isActualDuplicate && onSaveAndAddAnother && (
          <Button
            type="button"
            variant="outline"
            onClick={onSaveAndAddAnother}
            disabled={submitting}
            className="text-xs sm:text-sm font-semibold whitespace-nowrap"
          >
            حفظ وإضافة أخرى
          </Button>
        )}
      </div>
    </div>
  )
}
