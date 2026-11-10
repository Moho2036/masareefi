import React from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'

export interface TransactionActionsBarProps {
  isEditing: boolean
  isLockedTransaction: boolean
  isLinkedToDebtPayment: boolean
  isActualDuplicate: boolean
  showDeleteConfirm: boolean
  onShowDeleteConfirm: (val: boolean) => void
  submitting: boolean
  deleting: boolean
  onClose: () => void
  onDelete: () => void
  onSaveAndAddAnother: () => void
  onDuplicateCurrent: () => void
}

export const TransactionActionsBar: React.FC<TransactionActionsBarProps> = ({
  isEditing,
  isLockedTransaction,
  isLinkedToDebtPayment,
  isActualDuplicate,
  showDeleteConfirm,
  onShowDeleteConfirm,
  submitting,
  deleting,
  onClose,
  onDelete,
  onSaveAndAddAnother,
  onDuplicateCurrent,
}) => {
  return (
    <>
      {/* Delete confirmation if editing */}
      {isEditing && !isLockedTransaction && showDeleteConfirm ? (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 space-y-2.5">
          <p className="text-xs font-bold text-red-800 dark:text-red-300">
            هل أنت متأكد من حذف هذه المعاملة نهائياً؟
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
              className="flex-1"
            >
              {deleting ? 'جاري الحذف...' : 'نعم، احذف المعاملة'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onShowDeleteConfirm(false)}
              disabled={deleting}
            >
              تراجع
            </Button>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
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

          {!isEditing && (
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

          {isEditing && !isLockedTransaction && !isLinkedToDebtPayment && (
            <Button
              type="button"
              variant="outline"
              onClick={onDuplicateCurrent}
              disabled={submitting || deleting}
              icon={<Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              className="text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              تكرار هذه المعاملة
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            إلغاء
          </Button>
        </div>

        {isEditing && !isLockedTransaction && !showDeleteConfirm && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onShowDeleteConfirm(true)}
            aria-label="حذف المعاملة"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 p-2.5"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </>
  )
}
