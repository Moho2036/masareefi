import React from 'react'
import { AlertCircle } from 'lucide-react'
import { CategoryForm } from './CategoryForm'
import { TransactionLockBanners } from './transactions/TransactionLockBanners'
import { TransactionAmountSection } from './transactions/TransactionAmountSection'
import { TransactionCategoryGrid } from './transactions/TransactionCategoryGrid'
import { TransactionDetailsSection } from './transactions/TransactionDetailsSection'
import { TransactionActionsBar } from './transactions/TransactionActionsBar'
import { useTransactionFormState } from './transactions/useTransactionFormState'
import { formatDateInput } from '../lib/dates'
import type { Transaction, TxType } from '../types'

export interface TransactionFormProps {
  initialTransaction?: Transaction | null
  duplicateFrom?: Transaction | null
  initialType?: TxType
  isSourceDeleted?: boolean
  onClose: () => void
  onSuccess?: () => void
  onDuplicate?: (tx: Transaction) => void
  onDirtyChange?: (isDirty: boolean) => void
}

export const TransactionForm: React.FC<TransactionFormProps> = (props) => {
  const {
    isEditing,
    lockStatus,
    isLockedTransaction,
    isLinkedToDebtPayment,
    circleInstallmentMonth,
    linkedCircleInstallment,
    isActualDuplicate,
    amountInputRef,
    type,
    setType,
    amountStr,
    setAmountStr,
    setCategoryId,
    isBrowsingDifferentMonth,
    range,
    dateStr,
    setDateStr,
    title,
    setTitle,
    note,
    setNote,
    showNoteField,
    setShowNoteField,
    isRecurring,
    setIsRecurring,
    recurringFrequency,
    setRecurringFrequency,
    showExtraFrequencyDropdown,
    setShowExtraFrequencyDropdown,
    hasEndDate,
    setHasEndDate,
    endDateStr,
    setEndDateStr,
    scheduleNextIfPast,
    setScheduleNextIfPast,
    isCategoriesExpanded,
    setIsCategoriesExpanded,
    isCreateCatOpen,
    setIsCreateCatOpen,
    error,
    setError,
    submitting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleting,
    categoriesLoading,
    availableCategories,
    displayedCategories,
    activeCategoryId,
    isSelectedCategoryMissing,
    forecast,
    titleSuggestions,
    currencyConfig,
    handleSubmit,
    handleSaveAndAddAnother,
    handleDelete,
    handleDuplicateCurrent,
  } = useTransactionFormState(props)

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
      <TransactionLockBanners
        lockStatus={lockStatus}
        isSourceDeleted={props.isSourceDeleted}
        linkedCircleInstallment={linkedCircleInstallment}
        circleInstallmentMonth={circleInstallmentMonth}
        onClose={props.onClose}
      />

      <TransactionAmountSection
        type={type}
        onTypeChange={(newType) => {
          setType(newType)
          setCategoryId('')
          setError(null)
        }}
        typeDisabled={isLockedTransaction || isLinkedToDebtPayment}
        amountStr={amountStr}
        onAmountChange={setAmountStr}
        amountInputRef={amountInputRef}
        isLockedTransaction={isLockedTransaction}
        isEditing={isEditing}
        isTouchDevice={isTouchDevice}
        currencyConfig={currencyConfig}
        error={error}
        forecast={forecast}
        onClearError={() => setError(null)}
      />

      <TransactionCategoryGrid
        categoriesLoading={categoriesLoading}
        availableCategories={availableCategories}
        displayedCategories={displayedCategories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={setCategoryId}
        isSelectedCategoryMissing={isSelectedCategoryMissing}
        isCategoriesExpanded={isCategoriesExpanded}
        onToggleExpand={() => setIsCategoriesExpanded((prev) => !prev)}
        onOpenCreateCategory={() => setIsCreateCatOpen(true)}
        onClearError={() => setError(null)}
      />

      <TransactionDetailsSection
        dateStr={dateStr}
        onDateChange={setDateStr}
        isLockedTransaction={isLockedTransaction}
        isBrowsingDifferentMonth={isBrowsingDifferentMonth}
        rangeStartFormatted={formatDateInput(range.start)}
        title={title}
        onTitleChange={setTitle}
        titleSuggestions={titleSuggestions}
        onSelectTitleSuggestion={(s) => {
          setTitle(s.title)
          if (s.categoryId && availableCategories.some((c) => c.id === s.categoryId)) {
            setCategoryId(s.categoryId)
          }
        }}
        showNoteField={showNoteField}
        onShowNoteField={() => setShowNoteField(true)}
        onHideNoteField={() => setShowNoteField(false)}
        note={note}
        onNoteChange={setNote}
        isEditing={isEditing}
        isRecurring={isRecurring}
        onRecurringChange={setIsRecurring}
        recurringFrequency={recurringFrequency}
        onRecurringFrequencyChange={setRecurringFrequency}
        showExtraFrequencyDropdown={showExtraFrequencyDropdown}
        onToggleExtraFrequencyDropdown={() => setShowExtraFrequencyDropdown((prev) => !prev)}
        onCloseExtraFrequencyDropdown={() => setShowExtraFrequencyDropdown(false)}
        hasEndDate={hasEndDate}
        onHasEndDateChange={setHasEndDate}
        endDateStr={endDateStr}
        onEndDateChange={setEndDateStr}
        scheduleNextIfPast={scheduleNextIfPast}
        onScheduleNextIfPastChange={setScheduleNextIfPast}
      />

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3 text-start rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-semibold"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <TransactionActionsBar
        isEditing={isEditing}
        isLockedTransaction={isLockedTransaction}
        isLinkedToDebtPayment={isLinkedToDebtPayment}
        isActualDuplicate={isActualDuplicate}
        showDeleteConfirm={showDeleteConfirm}
        onShowDeleteConfirm={setShowDeleteConfirm}
        submitting={submitting}
        deleting={deleting}
        onClose={props.onClose}
        onDelete={handleDelete}
        onSaveAndAddAnother={handleSaveAndAddAnother}
        onDuplicateCurrent={handleDuplicateCurrent}
      />

      {isCreateCatOpen && (
        <CategoryForm
          isOpen={isCreateCatOpen}
          onClose={() => setIsCreateCatOpen(false)}
          defaultType={type}
          onSuccess={(newCatId, newCatType) => {
            if (newCatId) {
              if (newCatType && newCatType !== type && !isLockedTransaction && !isLinkedToDebtPayment) {
                setType(newCatType)
              }
              setCategoryId(newCatId)
            }
            setIsCreateCatOpen(false)
          }}
        />
      )}
    </form>
  )
}
