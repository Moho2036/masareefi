import React from 'react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Toggle } from '../../ui/Toggle'
import type { MoneyCircle } from '../../../types'

export interface CircleConfirmationModalsProps {
  deleteCircleId: string | null
  onCloseDelete: () => void
  onConfirmDelete: () => void
  deleteTransactions: boolean
  setDeleteTransactions: (val: boolean) => void
  isDeleting: boolean
  confirmCompleteCircle: MoneyCircle | null
  onCloseComplete: () => void
  onConfirmComplete: () => void
  isCompleting: boolean
}

export const CircleConfirmationModals: React.FC<CircleConfirmationModalsProps> = ({
  deleteCircleId,
  onCloseDelete,
  onConfirmDelete,
  deleteTransactions,
  setDeleteTransactions,
  isDeleting,
  confirmCompleteCircle,
  onCloseComplete,
  onConfirmComplete,
  isCompleting,
}) => {
  return (
    <>
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteCircleId !== null}
        onClose={onCloseDelete}
        title="تأكيد حذف الجمعية"
        hideCloseButton={true}
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            هل أنت متأكد من رغبتك في حذف هذه الجمعية؟ لن تتمكن من استرجاع بيانات الأقساط والأعضاء المسجلة فيها.
          </p>

          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
            <Toggle
              checked={deleteTransactions}
              onChange={setDeleteTransactions}
              label="حذف الأقساط والإيداعات المسجلة في المحفظة لهذه الجمعية"
              description="حذف المعاملات المالية المرتبطة بالجمعية وتحديث رصيد المحفظة"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={onCloseDelete}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={onConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'جارٍ الحذف...' : 'نعم، حذف الجمعية'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Circle Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmCompleteCircle)}
        onClose={onCloseComplete}
        title="تأكيد إنهاء الجمعية"
        hideCloseButton={true}
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            هل أنت متأكد من رغبتك في نقل جمعية «<strong className="text-zinc-900 dark:text-zinc-100 font-bold">{confirmCompleteCircle?.name}</strong>» إلى قائمة الجمعيات المكتملة؟
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            سيتم إيقاف أي جدولة متكررة متبقية لأقساط هذه الجمعية، ويمكنك استعادتها للجمعيات النشطة في أي وقت.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              onClick={onCloseComplete}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={isCompleting}
              onClick={onConfirmComplete}
            >
              {isCompleting ? 'جارٍ الإنهاء...' : 'تأكيد الإنهاء'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
