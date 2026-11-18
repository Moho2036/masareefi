import React from 'react'
import { Link } from 'react-router'
import { AlertCircle, ArrowLeft, Users } from 'lucide-react'
import type { TransactionLockStatus } from '../../lib/transactionLocks'
import type { MoneyCircle } from '../../types'

export interface TransactionLockBannersProps {
  lockStatus: TransactionLockStatus
  isSourceDeleted?: boolean
  linkedCircleInstallment: MoneyCircle | null
  circleInstallmentMonth: number | null
  onClose: () => void
}

export const TransactionLockBanners: React.FC<TransactionLockBannersProps> = ({
  lockStatus,
  isSourceDeleted,
  linkedCircleInstallment,
  circleInstallmentMonth,
  onClose,
}) => {
  const {
    isLinkedToDebtInit,
    isLinkedToDebtEntry,
    isDebtExists,
    isDebtEntryExists,
    isLinkedToDebtPayment,
    linkedDebtPayment,
    isLinkedToCircle,
    isCircleExists,
    isLinkedToCircleInstallment,
    isCircleInstallmentExists,
    isSourceMissing,
  } = lockStatus

  return (
    <>
      {/* Linked Debt Init or Entry Warning Banner */}
      {((isLinkedToDebtInit && isDebtExists) || (isLinkedToDebtEntry && isDebtEntryExists)) &&
        !isSourceDeleted && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {isLinkedToDebtEntry
                  ? 'معاملة سلفة إضافية متزامنة مع سجل الديون'
                  : 'معاملة أصل الدين متزامنة مع سجل الديون'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 pe-1">
              {isLinkedToDebtEntry
                ? 'هذه المعاملة تمثل سلفة إضافية مرتبطة بالدين. لتعديل المبلغ أو حذف السلفة، يرجى إدارتها من صفحة الديون. يمكنك تغيير التصنيف والملاحظة هنا.'
                : 'هذه المعاملة تمثل نشوء الدين الأصلي. لتعديل المبلغ أو حذف الدين، يرجى إدارته من صفحة الديون. يمكنك تغيير التصنيف والملاحظة هنا.'}
            </p>
            <Link
              to="/debts"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs dark:shadow-none"
            >
              <span>الانتقال إلى سجل الديون</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

      {/* Linked Debt Payment Warning Banner */}
      {isLinkedToDebtPayment && (
        linkedDebtPayment?.payment?.isMerged ? (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-amber-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>معاملة مرتبطة بدفعة دين مدمجة لـ ({linkedDebtPayment.debt.personName})</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 pe-1">
              هذه المعاملة تمثل رصيد دفعات سابقة تم دمجها في سجل الدين. لا يمكن تعديل مبلغها أو حذفها من هنا، يرجى إدارتها من صفحة الديون.
            </p>
            <Link
              to="/debts"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs dark:shadow-none"
            >
              <span>الانتقال إلى سجل الديون</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-blue-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                {linkedDebtPayment
                  ? `معاملة مرتبطة بدفعة سداد دين لـ (${linkedDebtPayment.debt.personName})`
                  : 'معاملة مرتبطة بدفعة سداد دين'}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 pe-1">
              عند تعديل المبلغ أو حذف هذه المعاملة، سيتم تلقائياً تحديث دفعة السداد في سجل الدين وإعادة احتساب رصيد الدين وحالة الإغلاق.
            </p>
          </div>
        )
      )}

      {/* Linked Circle Payout Warning Banner */}
      {isLinkedToCircle && isCircleExists && !isSourceDeleted && (
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-blue-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>معاملة مرتبطة بإيداع جمعية مالية</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 pe-1">
            هذه المعاملة تم إنشاؤها تلقائياً عند إيداع صافي استلام الجمعية. لتعديل المبلغ أو حذفها يرجى الانتقال إلى صفحة الجمعيات، أو يمكنك تغيير التصنيف والملاحظة وحفظ التعديل هنا.
          </p>
          <Link
            to="/tools?tool=circles"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs dark:shadow-none"
          >
            <span>الانتقال إلى صفحة الجمعيات</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Linked Circle Installment Warning Banner */}
      {isLinkedToCircleInstallment && isCircleInstallmentExists && (
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border-s-2 border-blue-500 text-zinc-700 dark:text-zinc-300 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>معاملة مرتبطة بقسط جمعية ({linkedCircleInstallment?.name || 'جمعية'}) - شهر {circleInstallmentMonth}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400 pe-1">
            عند حذف هذه المعاملة، سيتم تلقائياً تحديث حالة القسط في جدول الجمعية وإلغاء تسجيل الدفع.
          </p>
        </div>
      )}

      {/* Orphaned Unlocked Banner */}
      {isSourceMissing &&
        (isLinkedToDebtInit || isLinkedToDebtEntry || isLinkedToCircle) && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0" />
            <span>تم فك قفل هذه المعاملة نظراً لحذف السجل الأصلي المرتبط بها. يمكنك تعديلها أو حذفها بحرية.</span>
          </div>
        )}
    </>
  )
}
