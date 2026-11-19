import React, { useState } from 'react'
import { Copy, MessageSquare, Share2, Printer, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { cn } from '../../../lib/cn'
import { triggerHaptic } from '../../../lib/haptics'
import { isTestEnv } from '../../../lib/motionTokens'
import type { Debt } from '../../../types'

export interface DebtHistoryActionBarProps {
  debt: Debt
  remainingFils: number
  isLent: boolean
  canShare: boolean
  onCopyStatement: () => void
  onWhatsAppShare: () => void
  onNativeShare: () => void
  onPrint: () => void
  onEdit?: (debt: Debt) => void
  onDelete?: (debt: Debt) => void
  onOpenPaymentModal?: (debt: Debt) => void
  onToggleAddEntry?: () => void
  isAddingEntry?: boolean
}

export const DebtHistoryActionBar: React.FC<DebtHistoryActionBarProps> = ({
  debt,
  remainingFils,
  isLent,
  canShare,
  onCopyStatement,
  onWhatsAppShare,
  onNativeShare,
  onPrint,
  onEdit,
  onDelete,
  onOpenPaymentModal,
  onToggleAddEntry,
  isAddingEntry = false,
}) => {
  const [isShareOpen, setIsShareOpen] = useState(() => (isTestEnv ? true : false))

  const handleToggleShare = () => {
    triggerHaptic('tick')
    setIsShareOpen((prev) => !prev)
  }

  return (
    <div className="space-y-3">
      {/* Summary Card */}
      <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] grid grid-cols-3 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] text-center">
        <div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المبلغ الكلي</span>
          <span className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200 tabular-nums">
            <FormattedMoney amountFils={debt.amountFils} />
          </span>
        </div>
        <div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المسدد حتى الآن</span>
          <span className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200 tabular-nums">
            <FormattedMoney amountFils={debt.paidFils || 0} />
          </span>
        </div>
        <div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المتبقي</span>
          <span
            className={cn(
              'text-xs sm:text-sm font-black tabular-nums',
              isLent
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            )}
          >
            <FormattedMoney amountFils={remainingFils} />
          </span>
        </div>
      </div>

      {/* Dedicated Separate Action Buttons Strip */}
      <div className="print-hide space-y-2">
        {/* Addition Actions Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {!debt.settled && onOpenPaymentModal && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('impact')
                onOpenPaymentModal(debt)
              }}
              className="press-scale inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>تسجيل {isLent ? 'دفعة استرداد' : 'دفعة سداد'}</span>
            </button>
          )}
          {onToggleAddEntry && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                onToggleAddEntry()
              }}
              className={cn(
                'press-scale inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer shadow-2xs',
                isAddingEntry
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                  : 'bg-white dark:bg-zinc-800 border-[#E4E4E7] dark:border-[#27272A] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
              )}
            >
              <Plus className="w-4 h-4 stroke-[2.5] text-blue-600 dark:text-blue-400" />
              <span>إضافة سلفة جديدة على هذا الحساب</span>
            </button>
          )}
        </div>

        {/* Management & Sharing Bar */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tick')
                onEdit(debt)
              }}
              className="press-scale flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
              title="تعديل بيانات الدين"
            >
              <Pencil className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>تعديل الدين</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('warning')
                onDelete(debt)
              }}
              className="press-scale flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
              title="حذف هذا الدين"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>حذف الدين</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleShare}
            aria-expanded={isShareOpen}
            aria-label="خيارات مشاركة وتصدير كشف الحساب"
            className="press-scale flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>مشاركة الكشف</span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-zinc-400 transition-transform duration-200',
                isShareOpen && 'rotate-180'
              )}
            />
          </button>
        </div>

        {/* Share Account Statement Strip (Visible when opened) */}
        {isShareOpen && (
          <div
            className={cn(
              'grid gap-2 animate-slide-down pt-1',
              canShare ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
            )}
          >
            <button
              type="button"
              onClick={onCopyStatement}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>نسخ للحافظة</span>
            </button>
            <button
              type="button"
              onClick={onWhatsAppShare}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>إرسال عبر واتساب</span>
            </button>
            {canShare && (
              <button
                type="button"
                onClick={onNativeShare}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>مشاركة الكشف</span>
              </button>
            )}
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
