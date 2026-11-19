import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useToast } from '../../hooks/useToast'
import { useCurrency } from '../../hooks/useCurrency'
import { useDebtEntriesHistory } from '../../hooks/useDebtEntriesHistory'
import { useDebtPaymentsHistory } from '../../hooks/useDebtPaymentsHistory'
import { getDebtRemainingFils, formatDebtAccountStatement } from '../../lib/debts'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'
import { DebtHistoryActionBar } from './history/DebtHistoryActionBar'
import { DebtHistoryEntriesSection } from './history/DebtHistoryEntriesSection'
import { DebtHistoryPaymentsSection } from './history/DebtHistoryPaymentsSection'
import { DebtPrintReport } from './history/DebtPrintReport'
import type { Debt } from '../../types'

export interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onSuccess?: () => void
  onEdit?: (debt: Debt) => void
  onDelete?: (debt: Debt) => void
  onOpenPaymentModal?: (debt: Debt) => void
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  debt,
  onSuccess,
  onEdit,
  onDelete,
  onOpenPaymentModal,
}) => {
  const { showToast } = useToast()
  const { format: formatCurrency, config } = useCurrency()

  const [prevDebt, setPrevDebt] = useState<Debt | null>(debt)
  const [cachedDebt, setCachedDebt] = useState<Debt | null>(debt)
  const [isEntriesOpen, setIsEntriesOpen] = useState(true)
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(true)

  if (debt !== prevDebt) {
    setPrevDebt(debt)
    if (debt) {
      setCachedDebt(debt)
    }
  }
  const activeDebt = debt ?? cachedDebt

  const entriesState = useDebtEntriesHistory({ debt: activeDebt, onSuccess })
  const paymentsState = useDebtPaymentsHistory({ debt: activeDebt, onSuccess })

  const handleClose = () => {
    onClose()
  }

  if (!activeDebt) return null

  const remainingFils = getDebtRemainingFils(activeDebt)
  const isLent = activeDebt.type === 'lent'
  const truncatedPersonName = activeDebt.personName.length > 25
    ? `${activeDebt.personName.slice(0, 24)}...`
    : activeDebt.personName

  const handleCopyStatement = async () => {
    try {
      const text = formatDebtAccountStatement(activeDebt, config.symbol, config.decimals)
      await navigator.clipboard.writeText(text)
      showToast('تم نسخ كشف الحساب بنجاح', 'success')
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      showToast('فشل نسخ كشف الحساب', 'error')
    }
  }

  const handleWhatsAppShare = () => {
    const text = formatDebtAccountStatement(activeDebt, config.symbol, config.decimals)
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleNativeShare = async () => {
    if (!canShare) return
    try {
      const text = formatDebtAccountStatement(activeDebt, config.symbol, config.decimals)
      await navigator.share({
        title: `كشف حساب — ${activeDebt.personName}`,
        text,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error('Native share failed:', err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`سجل الحركات وكشف الحساب — ${truncatedPersonName}`}
    >
      {/* Interactive Modal Content (Hidden when printing) */}
      <div className="space-y-4 print:hidden">
        <DebtHistoryActionBar
          debt={activeDebt}
          remainingFils={remainingFils}
          isLent={isLent}
          canShare={canShare}
          onCopyStatement={handleCopyStatement}
          onWhatsAppShare={handleWhatsAppShare}
          onNativeShare={handleNativeShare}
          onPrint={handlePrint}
          onEdit={onEdit ? () => onEdit(activeDebt) : undefined}
          onDelete={onDelete ? () => onDelete(activeDebt) : undefined}
        />

        {/* ACCORDION 1: سجل السلف والديون المسجلة */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-[#121215]">
          <div
            onClick={() => {
              triggerHaptic('tick')
              setIsEntriesOpen((prev) => !prev)
            }}
            className="p-3.5 bg-zinc-50/90 dark:bg-zinc-900/90 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition"
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-zinc-400 transition-transform duration-200',
                  isEntriesOpen && 'rotate-180'
                )}
              />
              <span className="font-extrabold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200">
                سجل السلف والديون المسجلة ({entriesState.rawEntries.length})
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('impact')
                setIsEntriesOpen(true)
                entriesState.setIsAddingEntry(true)
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition cursor-pointer"
            >
              + إضافة سلفة
            </button>
          </div>
          {isEntriesOpen && (
            <div className="p-3.5">
              <DebtHistoryEntriesSection
                rawEntries={entriesState.rawEntries}
                hasExplicitEntries={Boolean(activeDebt.entries && activeDebt.entries.length > 0)}
                entryError={entriesState.entryError}
                isCompactingEntries={entriesState.isCompactingEntries}
                onCompactEntries={entriesState.handleCompactEntries}
                isAddingEntry={entriesState.isAddingEntry}
                setIsAddingEntry={entriesState.setIsAddingEntry}
                newEntryAmountStr={entriesState.newEntryAmountStr}
                setNewEntryAmountStr={entriesState.setNewEntryAmountStr}
                newEntryDateStr={entriesState.newEntryDateStr}
                setNewEntryDateStr={entriesState.setNewEntryDateStr}
                newEntryTitle={entriesState.newEntryTitle}
                setNewEntryTitle={entriesState.setNewEntryTitle}
                newEntryNote={entriesState.newEntryNote}
                setNewEntryNote={entriesState.setNewEntryNote}
                newEntrySync={entriesState.newEntrySync}
                setNewEntrySync={entriesState.setNewEntrySync}
                isSavingEntry={entriesState.isSavingEntry}
                onAddEntry={entriesState.handleAddEntry}
                editingEntryId={entriesState.editingEntryId}
                editEntryAmountStr={entriesState.editEntryAmountStr}
                setEditEntryAmountStr={entriesState.setEditEntryAmountStr}
                editEntryDateStr={entriesState.editEntryDateStr}
                setEditEntryDateStr={entriesState.setEditEntryDateStr}
                editEntryTitle={entriesState.editEntryTitle}
                setEditEntryTitle={entriesState.setEditEntryTitle}
                editEntryNote={entriesState.editEntryNote}
                setEditEntryNote={entriesState.setEditEntryNote}
                isSavingEditEntry={entriesState.isSavingEditEntry}
                onStartEditEntry={entriesState.handleStartEditEntry}
                onCancelEditEntry={() => entriesState.setEditingEntryId(null)}
                onSaveEditEntry={entriesState.handleSaveEditEntry}
                confirmDeleteEntryId={entriesState.confirmDeleteEntryId}
                setConfirmDeleteEntryId={entriesState.setConfirmDeleteEntryId}
                isDeletingEntry={entriesState.isDeletingEntry}
                onDeleteEntry={entriesState.handleDeleteEntry}
                currencySymbol={config.symbol}
                formatCurrency={formatCurrency}
              />
            </div>
          )}
        </div>

        {/* ACCORDION 2: سجل دفعات السداد */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-[#121215]">
          <div
            onClick={() => {
              triggerHaptic('tick')
              setIsPaymentsOpen((prev) => !prev)
            }}
            className="p-3.5 bg-zinc-50/90 dark:bg-zinc-900/90 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition"
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-zinc-400 transition-transform duration-200',
                  isPaymentsOpen && 'rotate-180'
                )}
              />
              <span className="font-extrabold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200">
                سجل دفعات السداد المسجلة ({paymentsState.payments.length})
              </span>
            </div>
            {onOpenPaymentModal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  triggerHaptic('impact')
                  onOpenPaymentModal(activeDebt)
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer"
              >
                + تسجيل دفعة
              </button>
            )}
          </div>
          {isPaymentsOpen && (
            <div className="p-3.5">
              <DebtHistoryPaymentsSection
                payments={paymentsState.payments}
                isLent={isLent}
                debtStartStr={paymentsState.debtStartStr}
                currencySymbol={config.symbol}
                formatCurrency={formatCurrency}
                isCompacting={paymentsState.isCompacting}
                onCompact={paymentsState.handleCompact}
                deletingId={paymentsState.deletingId}
                confirmDeleteId={paymentsState.confirmDeleteId}
                setConfirmDeleteId={paymentsState.setConfirmDeleteId}
                deletePaymentTx={paymentsState.deletePaymentTx}
                setDeletePaymentTx={paymentsState.setDeletePaymentTx}
                onDeletePayment={paymentsState.handleDeletePayment}
                editingPaymentId={paymentsState.editingPaymentId}
                editAmountStr={paymentsState.editAmountStr}
                setEditAmountStr={paymentsState.setEditAmountStr}
                editDateStr={paymentsState.editDateStr}
                setEditDateStr={paymentsState.setEditDateStr}
                editNote={paymentsState.editNote}
                setEditNote={paymentsState.setEditNote}
                editSyncTx={paymentsState.editSyncTx}
                setEditSyncTx={paymentsState.setEditSyncTx}
                checkingEditSync={paymentsState.checkingEditSync}
                editError={paymentsState.editError}
                isSavingEdit={paymentsState.isSavingEdit}
                onStartEdit={paymentsState.handleStartEdit}
                onCancelEdit={paymentsState.handleCancelEdit}
                onSaveEdit={paymentsState.handleSaveEdit}
              />
            </div>
          )}
        </div>
      </div>

      {/* Formal Printable Statement Report (Visible ONLY when printing) */}
      <DebtPrintReport
        debt={activeDebt}
        entries={entriesState.rawEntries}
        payments={paymentsState.payments}
        remainingFils={remainingFils}
        isLent={isLent}
        currencySymbol={config.symbol}
      />
    </Modal>
  )
}
