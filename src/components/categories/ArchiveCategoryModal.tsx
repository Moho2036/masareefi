import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import type { Category } from '../../types'

export interface ArchiveCategoryModalProps {
  catToArchive: Category | null
  onClose: () => void
  onConfirm: (cat: Category) => void
  isArchiving: boolean
  linkedCommitmentsText: string | null
}

export const ArchiveCategoryModal: React.FC<ArchiveCategoryModalProps> = ({
  catToArchive,
  onClose,
  onConfirm,
  isArchiving,
  linkedCommitmentsText,
}) => {
  return (
    <Modal
      isOpen={Boolean(catToArchive)}
      onClose={onClose}
      title="تأكيد أرشفة التصنيف"
      hideCloseButton={true}
    >
      {catToArchive && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
              <CategoryIcon icon={catToArchive.icon} color={catToArchive.color} size="md" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {catToArchive.name}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {catToArchive.type === 'expense' ? 'تصنيف مصروفات' : 'تصنيف مداخيل'}
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            هل أنت متأكد من رغبتك في أرشفة هذا التصنيف؟ سيتم إخفاؤه من شاشات إضافة المعاملات الجديدة مع الإبقاء على كافة سجلاته وتقاريره التاريخية، ويمكنك استعادته في أي وقت من قسم &quot;التصنيفات المؤرشفة&quot;.
          </p>

          {linkedCommitmentsText && (
            <div className="flex items-start gap-2.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/60 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-bold">تنبيه: </span>
                لا يزال هذا التصنيف مرتبطاً بالتزامات نشطة ({linkedCommitmentsText}). ستظل هذه الالتزامات قائمة.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isArchiving}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => onConfirm(catToArchive)}
              disabled={isArchiving}
            >
              {isArchiving ? 'جاري الأرشفة...' : 'أرشفة التصنيف'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
