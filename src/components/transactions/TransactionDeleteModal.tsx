import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { Transaction, Debt, DebtEntry } from '../../types'

export interface TransactionDeleteModalProps {
  txToDelete: Transaction | null
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
  linkedDebtPayment: { debt: Debt; payment: Debt['payments'][number] } | null
  linkedDebtInit?: Debt | null
  linkedDebtEntry?: { debt: Debt; entry: DebtEntry } | null
  circleInstallmentToDelete: { name: string } | null
}

export const TransactionDeleteModal: React.FC<TransactionDeleteModalProps> = ({
  txToDelete,
  onClose,
  onConfirm,
  deleting,
  linkedDebtPayment,
  linkedDebtInit,
  linkedDebtEntry,
  circleInstallmentToDelete,
}) => {
  return (
    <Modal
      isOpen={Boolean(txToDelete)}
      onClose={onClose}
      title="تأكيد حذف المعاملة"
      hideCloseButton={true}
    >
      <div className="space-y-4">
        {linkedDebtPayment && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>تنبيه: هذه المعاملة مرتبطة بدفعة سداد دين</span>
            </div>
            <p className="leading-relaxed text-[11px] text-zinc-500 dark:text-zinc-400">
              هذه المعاملة مرتبطة بسجل دين لـ <strong>{linkedDebtPayment.debt.personName}</strong>. عند تأكيد الحذف، سيتم أيضاً حذف دفعة السداد وإعادة فتح المبلغ المستحق في سجل الديون للحفاظ على تطابق الرصيد المحاسبي.
            </p>
          </div>
        )}
        {linkedDebtInit && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>تنبيه: هذه المعاملة تمثل أصل الدين</span>
            </div>
            <p className="leading-relaxed text-[11px] text-zinc-500 dark:text-zinc-400">
              هذه المعاملة تمثل نشوء الدين لـ <strong>{linkedDebtInit.personName}</strong>. عند تأكيد الحذف، سيتم حذف سجل الدين بالكامل من صفحة الديون للحفاظ على تطابق الرصيد المحاسبي.
            </p>
          </div>
        )}
        {linkedDebtEntry && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>تنبيه: هذه المعاملة مرتبطة بسلفة إضافية</span>
            </div>
            <p className="leading-relaxed text-[11px] text-zinc-500 dark:text-zinc-400">
              هذه المعاملة مرتبطة بسلفة إضافية في سجل دين <strong>{linkedDebtEntry.debt.personName}</strong>. عند تأكيد الحذف، سيتم حذف السلفة وإعادة احتساب إجمالي الدين للحفاظ على دقة الحسابات.
            </p>
          </div>
        )}
        {circleInstallmentToDelete && (
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>تنبيه: هذه المعاملة مرتبطة بقسط جمعية</span>
            </div>
            <p className="leading-relaxed text-[11px] text-zinc-500 dark:text-zinc-400">
              هذه المعاملة مرتبطة بقسط في <strong>{circleInstallmentToDelete.name}</strong>. عند تأكيد الحذف، سيتم تحويل حالة القسط تلقائياً إلى "غير مسدد" في جدول الجمعية للحفاظ على دقة الحسابات.
            </p>
          </div>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          هل أنت متأكد من رغبتك في حذف هذه المعاملة؟ لا يمكن التراجع عن هذا الإجراء.
        </p>
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
            {deleting ? 'جاري الحذف...' : 'حذف المعاملة'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
