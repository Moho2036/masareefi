import React from 'react'
import { Modal } from '../ui/Modal'
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

  const [prevDebt, setPrevDebt] = React.useState<Debt | null>(debt)
  const [cachedDebt, setCachedDebt] = React.useState<Debt | null>(debt)

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
        />

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
