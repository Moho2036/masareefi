import React, { useState } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { AlertCircle, Pencil, Trash2, ChevronDown, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { DatePickerInput } from '../../ui/DatePickerInput'
import { Toggle } from '../../ui/Toggle'
import { toWesternDigits } from '../../../lib/dates'
import { triggerHaptic } from '../../../lib/haptics'
import { springSnappy } from '../../../lib/motionTokens'
import { cn } from '../../../lib/cn'
import type { DebtPayment } from '../../../types'

export interface DebtHistoryPaymentsSectionProps {
  payments: DebtPayment[]
  isLent: boolean
  debtStartStr: string
  currencySymbol: string
  formatCurrency: (fils: number) => string
  isCompacting: boolean
  onCompact: () => void
  deletingId: string | null
  confirmDeleteId: string | null
  setConfirmDeleteId: (id: string | null) => void
  deletePaymentTx: boolean
  setDeletePaymentTx: (val: boolean) => void
  onDeletePayment: (paymentId: string, deleteTx: boolean) => void
  editingPaymentId: string | null
  editAmountStr: string
  setEditAmountStr: (val: string) => void
  editDateStr: string
  setEditDateStr: (val: string) => void
  editNote: string
  setEditNote: (val: string) => void
  editSyncTx: boolean
  setEditSyncTx: (val: boolean) => void
  checkingEditSync: boolean
  editError: string | null
  isSavingEdit: boolean
  onStartEdit: (p: DebtPayment) => void
  onCancelEdit: () => void
  onSaveEdit: (p: DebtPayment) => void
  onOpenPaymentModal?: () => void
  isSettled?: boolean
}

export const DebtHistoryPaymentsSection: React.FC<DebtHistoryPaymentsSectionProps> = ({
  payments,
  isLent,
  debtStartStr,
  currencySymbol,
  formatCurrency,
  isCompacting,
  onCompact,
  deletingId,
  confirmDeleteId,
  setConfirmDeleteId,
  deletePaymentTx,
  setDeletePaymentTx,
  onDeletePayment,
  editingPaymentId,
  editAmountStr,
  setEditAmountStr,
  editDateStr,
  setEditDateStr,
  editNote,
  setEditNote,
  editSyncTx,
  setEditSyncTx,
  checkingEditSync,
  editError,
  isSavingEdit,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenPaymentModal,
  isSettled = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between py-1 select-none">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('tick')
            setIsCollapsed((prev) => !prev)
          }}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'توسيع قائمة الدفعات' : 'طي قائمة الدفعات'}
          className="flex items-center gap-2 text-start cursor-pointer group py-1 select-none"
        >
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform duration-200 shrink-0',
              isCollapsed && '-rotate-90'
            )}
          />
          <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">
            سجل دفعات السداد
          </span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {payments.length}
          </span>
        </button>

        {/* Left side actions: Add Payment Button ONLY */}
        <div className="print-hide">
          {!isSettled && onOpenPaymentModal && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('impact')
                onOpenPaymentModal()
              }}
              className="press-scale inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg cursor-pointer transition-colors"
              title="تسجيل دفعة سداد جديدة"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>تسجيل دفعة</span>
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-2">

      {/* Compaction Banner */}
      {payments.length >= 90 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>وصل عدد الدفعات إلى {payments.length} (الحد الأقصى 100)</span>
          </div>
          <p className="text-amber-700 dark:text-amber-400">
            يمكنك دمج الدفعات القديمة في دفعة واحدة لفتح مساحة لدفعات جديدة دون أي تأثير على إجمالي المبلغ المسدد.
          </p>
          <div className="pt-1">
            <button
              type="button"
              disabled={isCompacting || isSavingEdit || Boolean(deletingId)}
              onClick={onCompact}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isCompacting ? 'جاري الدمج...' : 'دمج الدفعات القديمة'}
            </button>
          </div>
        </div>
      )}

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold">لا توجد أي دفعات مسجلة بعد لهذا الدين</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments
            .slice()
            .reverse()
            .map((p) => {
              const isMerged = Boolean(p.isMerged || p.id.startsWith('compacted_'))
              const formattedDate = toWesternDigits(
                format(p.date, 'd MMMM yyyy', { locale: ar })
              )
              const isDeleting = deletingId === p.id

              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col gap-2.5"
                >
                  {editingPaymentId === p.id ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={springSnappy}
                      className="w-full space-y-2.5"
                    >
                      {editError && (
                        <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50">
                          {editError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">المبلغ</label>
                          <div className="flex items-center gap-1 border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editAmountStr}
                              onChange={(e) => setEditAmountStr(toWesternDigits(e.target.value))}
                              className="w-full text-base sm:text-xs font-bold bg-transparent outline-none text-zinc-800 dark:text-zinc-100"
                              required
                            />
                            <span className="text-[10px] text-zinc-400 font-bold">{currencySymbol}</span>
                          </div>
                        </div>
                        <div className="w-full">
                          <DatePickerInput
                            label="التاريخ"
                            value={editDateStr}
                            min={debtStartStr}
                            onChange={setEditDateStr}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">الملاحظة</label>
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="w-full text-base sm:text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 outline-none"
                          placeholder="ملاحظة للدفعة..."
                        />
                      </div>
                      <div>
                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-[#E4E4E7] dark:border-[#27272A]">
                          <Toggle
                            disabled={checkingEditSync || isSavingEdit}
                            checked={editSyncTx}
                            onChange={setEditSyncTx}
                            label="ربط الدفعة بالرصيد (تأثير مالي في سجل المعاملات)"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('tick')
                            onCancelEdit()
                          }}
                          disabled={isSavingEdit}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          onClick={() => onSaveEdit(p)}
                          disabled={isSavingEdit || checkingEditSync}
                          className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSavingEdit ? 'جارٍ الحفظ...' : checkingEditSync ? 'جارٍ التحقق...' : 'حفظ التعديل'}
                        </button>
                      </div>
                    </motion.div>
                  ) : confirmDeleteId === p.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              dir="ltr"
                              className={cn(
                                'text-sm font-black tabular-nums',
                                isLent
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              )}
                            >
                              {isLent ? '+' : '-'} {formatCurrency(p.amountFils)}
                            </div>
                            {isMerged && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                                دفعات مدمجة
                              </span>
                            )}
                            {p.transactionId && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                                مرتبط بالرصيد
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                            {formattedDate}
                            {p.note ? ` • ${p.note}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-red-50/70 dark:bg-red-950/30 rounded-xl border border-red-200/80 dark:border-red-900/50 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-xs font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>تأكيد حذف الدفعة؟</span>
                        </div>

                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-[#E4E4E7] dark:border-[#27272A]">
                          <Toggle
                            checked={deletePaymentTx}
                            onChange={setDeletePaymentTx}
                            label={
                              isMerged
                                ? 'حذف المعاملات المالية المدمجة المرتبطة من سجل المعاملات أيضاً'
                                : 'حذف المعاملة المالية المرتبطة من سجل المعاملات أيضاً'
                            }
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => {
                              setConfirmDeleteId(null)
                              setDeletePaymentTx(true)
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => onDeletePayment(p.id, deletePaymentTx)}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            dir="ltr"
                            className={cn(
                              'text-sm font-black tabular-nums',
                              isLent
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            )}
                          >
                            {isLent ? '+' : '-'} {formatCurrency(p.amountFils)}
                          </div>
                          {isMerged && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                              دفعات مدمجة
                            </span>
                          )}
                          {p.transactionId && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                              مرتبط بالرصيد
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                          {formattedDate}
                          {p.note ? ` • ${p.note}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 print-hide">
                        {!isMerged && (
                          <button
                            type="button"
                            disabled={Boolean(deletingId) || isSavingEdit}
                            onClick={() => {
                              triggerHaptic('tick')
                              onStartEdit(p)
                            }}
                            className="press-scale p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="تعديل هذه الدفعة"
                            aria-label="تعديل هذه الدفعة"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={Boolean(deletingId) || isSavingEdit}
                          onClick={() => {
                            onCancelEdit()
                            setConfirmDeleteId(p.id)
                            setDeletePaymentTx(true)
                          }}
                          className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="حذف هذه الدفعة"
                          aria-label="حذف هذه الدفعة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
        </div>
      )}
    </div>
  )
}
