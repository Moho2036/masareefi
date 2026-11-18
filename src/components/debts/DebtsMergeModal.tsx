import React from 'react'
import { format } from 'date-fns'
import { GitMerge } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { FormattedMoney } from '../ui/FormattedMoney'
import { getDebtRemainingFils } from '../../lib/debts'
import { toWesternDigits } from '../../lib/dates'
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
  const debts = mergeTarget?.debts ?? []
  const totalAmountFils = debts.reduce((sum, d) => sum + d.amountFils, 0)
  const totalRemainingFils = debts.reduce((sum, d) => sum + getDebtRemainingFils(d), 0)

  return (
    <Modal
      isOpen={Boolean(mergeTarget)}
      onClose={onClose}
      hideCloseButton={true}
      title="تأكيد دمج سجلات الديون"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-zinc-800 dark:text-zinc-200">
          <GitMerge className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-sm font-semibold">
            {debts.length === 2
              ? `هل ترغب في دمج سجلي دين لـ "${mergeTarget?.personName}" في سجل دين موحد؟`
              : `هل ترغب في دمج ${debts.length} سجلات ديون لـ "${mergeTarget?.personName}" في سجل دين موحد؟`}
          </p>
        </div>

        {/* Detailed breakdown of candidate debts (DEBT-04) */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
            السجلات المراد دمجها ({debts.length}):
          </span>
          <div className="max-h-48 overflow-y-auto space-y-2 pe-1">
            {debts.map((d, idx) => {
              const rem = getDebtRemainingFils(d)
              const dDate = d.startDate instanceof Date ? d.startDate : new Date(d.startDate)
              const dateStr = toWesternDigits(format(dDate, 'yyyy/MM/dd'))
              return (
                <div
                  key={d.id || idx}
                  className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {d.note || `سجل دين ${idx + 1}`}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">({dateStr})</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>الأصل: </span>
                      <span className="font-semibold tabular-nums"><FormattedMoney amountFils={d.amountFils} /></span>
                      {d.paidFils ? (
                        <>
                          <span className="mx-1">•</span>
                          <span>المسدد: </span>
                          <span className="font-semibold tabular-nums"><FormattedMoney amountFils={d.paidFils} /></span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <span className="text-[10px] text-zinc-400 block">المتبقي</span>
                    <span className="font-black text-sm text-zinc-900 dark:text-zinc-100 tabular-nums">
                      <FormattedMoney amountFils={rem} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Unified Total Strip */}
          <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-700 dark:text-zinc-300">الإجمالي بعد الدمج:</span>
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                الأصل: <FormattedMoney amountFils={totalAmountFils} />
              </span>
              <span className="text-zinc-900 dark:text-zinc-100 font-black">
                المتبقي: <FormattedMoney amountFils={totalRemainingFils} />
              </span>
            </div>
          </div>
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
