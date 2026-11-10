import React from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import { useCurrency } from '../../hooks/useCurrency'
import { useDebtEntriesHistory } from '../../hooks/useDebtEntriesHistory'
import { useDebtPaymentsHistory } from '../../hooks/useDebtPaymentsHistory'
import { getDebtRemainingFils, formatDebtAccountStatement } from '../../lib/debts'
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
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  debt,
  onSuccess,
}) => {
  const { showToast } = useToast()
  const { format: formatCurrency, config } = useCurrency()

  const entriesState = useDebtEntriesHistory({ debt, onSuccess })
  const paymentsState = useDebtPaymentsHistory({ debt, onSuccess })

  const handleClose = () => {
    entriesState.resetEntriesState()
    paymentsState.resetPaymentsState()
    onClose()
  }

  if (!debt) return null

  const remainingFils = getDebtRemainingFils(debt)
  const isLent = debt.type === 'lent'

  const handleCopyStatement = async () => {
    try {
      const text = formatDebtAccountStatement(debt, config.symbol, config.decimals)
      await navigator.clipboard.writeText(text)
      showToast('تم نسخ كشف الحساب بنجاح', 'success')
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      showToast('فشل نسخ كشف الحساب', 'error')
    }
  }

  const handleWhatsAppShare = () => {
    const text = formatDebtAccountStatement(debt, config.symbol, config.decimals)
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleNativeShare = async () => {
    if (!canShare) return
    try {
      const text = formatDebtAccountStatement(debt, config.symbol, config.decimals)
      await navigator.share({
        title: `كشف حساب — ${debt.personName}`,
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
      title={`سجل الحركات وكشف الحساب — ${debt.personName}`}
    >
      {/* Interactive Modal Content (Hidden when printing) */}
      <div className="space-y-4 print:hidden">
        <DebtHistoryActionBar
          debt={debt}
          remainingFils={remainingFils}
          isLent={isLent}
          canShare={canShare}
          onCopyStatement={handleCopyStatement}
          onWhatsAppShare={handleWhatsAppShare}
          onNativeShare={handleNativeShare}
          onPrint={handlePrint}
        />

        <DebtHistoryEntriesSection
          rawEntries={entriesState.rawEntries}
          hasExplicitEntries={Boolean(debt.entries && debt.entries.length > 0)}
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

        <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 print-hide">
          <Button
            type="button"
            variant="outline"
            className="w-full font-bold"
            onClick={handleClose}
          >
            إغلاق
          </Button>
        </div>
      </div>

      {/* Formal Printable Statement Report (Visible ONLY when printing) */}
      <DebtPrintReport
        debt={debt}
        entries={entriesState.rawEntries}
        payments={paymentsState.payments}
        remainingFils={remainingFils}
        isLent={isLent}
        currencySymbol={config.symbol}
      />
    </Modal>
  )
}
