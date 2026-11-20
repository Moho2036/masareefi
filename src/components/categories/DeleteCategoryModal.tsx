import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { cn } from '../../lib/cn'
import type { Category } from '../../types'
import type { CategoryUsageDetails } from '../../lib/categoryUsage'

export interface DeleteCategoryModalProps {
  catToDelete: Category | null
  onClose: () => void
  categories: Category[]
  usageDetails: CategoryUsageDetails
  usageText: string
  deleteMode: 'archive' | 'reassign'
  setDeleteMode: (mode: 'archive' | 'reassign') => void
  targetReassignCatId: string
  setTargetReassignCatId: (id: string) => void
  isDeleting: boolean
  onConfirmDelete: () => void
  onReassignAndDelete: () => void
  onArchive: (cat: Category) => void
}

export const DeleteCategoryModal: React.FC<DeleteCategoryModalProps> = ({
  catToDelete,
  onClose,
  categories,
  usageDetails,
  usageText,
  deleteMode,
  setDeleteMode,
  targetReassignCatId,
  setTargetReassignCatId,
  isDeleting,
  onConfirmDelete,
  onReassignAndDelete,
  onArchive,
}) => {
  if (!catToDelete) return null

  const otherActiveCats = categories.filter(
    (c) => c.type === catToDelete.type && c.id !== catToDelete.id && !c.archived
  )

  return (
    <Modal
      isOpen={Boolean(catToDelete)}
      onClose={onClose}
      title={catToDelete.archived ? 'تأكيد حذف التصنيف المؤرشف' : 'تأكيد حذف أو أرشفة التصنيف'}
    >
      {usageDetails.isInUse ? (
        catToDelete.archived ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold mb-1">
                  هذا التصنيف مؤرشف بالفعل ومرتبط بسجلات مالية ({usageText})
                </p>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-xs">
                  لحذف هذا التصنيف المؤرشف نهائياً دون الإضرار ببياناتك المالية، يرجى تحديد تصنيف نشط بديل لترحيل كافة المعاملات والالتزامات المرتبطة به إليه.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">
                التصنيف البديل لنقل السجلات إليه:
              </label>
              {otherActiveCats.length === 0 ? (
                <div className="text-xs text-red-500 font-semibold p-2">
                  لا توجد تصنيفات نشطة أخرى من نفس النوع لنقل السجلات إليها. يجب إضافة تصنيف نشط أولاً.
                </div>
              ) : (
                <Select
                  value={targetReassignCatId}
                  onChange={(e) => setTargetReassignCatId(e.target.value)}
                  options={otherActiveCats.map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                onClick={onReassignAndDelete}
                disabled={isDeleting || otherActiveCats.length === 0 || !targetReassignCatId}
              >
                {isDeleting ? 'جاري نقل السجلات...' : 'نقل السجلات وحذف التصنيف نهائياً'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold mb-1">
                  هذا التصنيف مرتبط بسجلات مالية حالية ({usageText})
                </p>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-xs">
                  لحماية دقة تقاريرك، يمكنك إما <strong>أرشفة التصنيف</strong> (لإخفائه من شاشات الإضافة مع حفظ التاريخ)، أو <strong>نقل كافة السجلات المرتبطة به</strong> إلى تصنيف بديل ثم حذفه نهائياً.
                </p>
              </div>
            </div>

            {/* Choice Selector: أرشفة أو نقل وحذف */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
                اختر الإجراء المطلوب:
              </label>
              <div className="grid grid-cols-1 gap-2">
                <label
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer transition-all',
                    deleteMode === 'archive'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100 ring-2 ring-blue-600/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}
                >
                  <input
                    type="radio"
                    name="delete-action"
                    checked={deleteMode === 'archive'}
                    onChange={() => setDeleteMode('archive')}
                    className="text-blue-600 focus:ring-blue-600"
                  />
                  <div className="min-w-0">
                    <div className="font-bold">أرشفة التصنيف (مستحسن)</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                      إخفاء التصنيف من شاشات الإضافة مع الإبقاء على كافة المعاملات والتقارير التاريخية دون أي تعديل.
                    </div>
                  </div>
                </label>

                <label
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer transition-all',
                    deleteMode === 'reassign'
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 text-blue-950 dark:text-blue-100 ring-2 ring-blue-600/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}
                >
                  <input
                    type="radio"
                    name="delete-action"
                    checked={deleteMode === 'reassign'}
                    onChange={() => setDeleteMode('reassign')}
                    className="text-blue-600 focus:ring-blue-600"
                  />
                  <div className="min-w-0">
                    <div className="font-bold">نقل كافة السجلات إلى تصنيف آخر وحذفه نهائياً</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                      ترحيل جميع المعاملات والمتكررة والجمعيات المرتبطة به إلى تصنيف نشط آخر ثم حذف هذا التصنيف.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* If Reassign mode: choose target category */}
            {deleteMode === 'reassign' && (
              <div className="space-y-1.5 p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  التصنيف البديل لنقل السجلات إليه:
                </label>
                {otherActiveCats.length === 0 ? (
                  <div className="text-xs text-red-500 font-semibold p-2">
                    لا توجد تصنيفات نشطة أخرى من نفس النوع لنقل السجلات إليها. يجب إضافة تصنيف نشط أولاً.
                  </div>
                ) : (
                  <Select
                    value={targetReassignCatId}
                    onChange={(e) => setTargetReassignCatId(e.target.value)}
                    options={otherActiveCats.map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={isDeleting}
              >
                إلغاء
              </Button>
              {deleteMode === 'archive' ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => onArchive(catToDelete)}
                  disabled={isDeleting}
                >
                  أرشفة التصنيف
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="md"
                  onClick={onReassignAndDelete}
                  disabled={isDeleting || otherActiveCats.length === 0 || !targetReassignCatId}
                >
                  {isDeleting ? 'جاري نقل السجلات...' : 'نقل السجلات وحذف التصنيف'}
                </Button>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              هل أنت متأكد من حذف تصنيف &quot;{catToDelete.name}&quot; نهائياً؟ هذا التصنيف غير مرتبط بأي معاملات، ولا يمكن التراجع عن الحذف.
            </p>
          </div>
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
              onClick={onConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'جاري الحذف...' : 'حذف نهائي'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
