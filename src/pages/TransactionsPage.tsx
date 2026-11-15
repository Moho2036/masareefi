import React, { useState } from 'react'
import { Plus, Download, Printer } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { FormattedMoney } from '../components/ui/FormattedMoney'
import { formatFinancialMonthLabel, toWesternDigits } from '../lib/dates'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useTransactionsData } from '../hooks/useTransactionsData'
import { TransactionRowItem } from '../components/transactions/TransactionRowItem'
import { TransactionFilterToolbar } from '../components/transactions/TransactionFilterToolbar'
import { TransactionDeleteModal } from '../components/transactions/TransactionDeleteModal'
import { DayGroupedTransactionList } from '../components/transactions/DayGroupedTransactionList'
import type { Transaction } from '../types'

export const TransactionsPage: React.FC = () => {
  const {
    range,
    userSettings,
    allMonths,
    setAllMonths,
    isCustomDateRange,
    setIsCustomDateRange,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    filterType,
    setFilterType,
    query,
    setQuery,
    sortBy,
    setSortBy,
    selectedSource,
    setSelectedSource,
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
    relevantCategories,
    isFilterActive,
    handleResetFilters,
    rawTransactions,
    txLoading,
    filteredTransactions,
    totals,
    categoryMap,
    debtLookup,
    circleIdsSet,
    circleRecurringIdsSet,
    dayGroups,
    displayedTransactions,
    paginatedTransactions,
    totalPages,
    safeCurrentPage,
    handlePageChange,
    transactionListRef,
    today,
    isPrinting,
    txToDelete,
    setTxToDelete,
    deleting,
    linkedDebtPayment,
    linkedDebtInit,
    linkedDebtEntry,
    circleInstallmentToDelete,
    handleDeleteConfirm,
    handleExportCsv,
    openAdd,
    openEdit,
    openDuplicate,
    setCurrentPage,
  } = useTransactionsData()

  const [swipedTxId, setSwipedTxId] = useState<string | null>(null)

  const renderTransactionRow = (tx: Transaction, showDateBadge = false) => {
    const cat = categoryMap.get(tx.categoryId)
    const isDebtInitOrEntry = tx.id.startsWith('debt_init_') || tx.id.startsWith('debt_entry_')
    const rawName = cat?.name ?? 'غير مصنف'
    const name = isDebtInitOrEntry && rawName === 'سداد الديون والأقساط' ? 'الديون والسلف' : rawName
    const isExpense = tx.type === 'expense'
    const hasTitle = Boolean(tx.title?.trim())
    const hasNote = Boolean(tx.note?.trim())
    const primaryLabel = tx.title?.trim() || tx.note?.trim() || name
    const showCategoryInSub = hasTitle || hasNote
    const showNoteInSub = hasTitle && hasNote && tx.note?.trim() !== tx.title?.trim()

    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const txTime = tx.createdAt ? (tx.createdAt instanceof Date ? tx.createdAt : new Date(tx.createdAt)) : txDate
    const timeDisplay = toWesternDigits(formatDate(txTime, 'hh:mm a', { locale: ar }))

    const linkedPaymentItem = debtLookup.paymentByTxIdMap.get(tx.id)
    const isMergedDebtPayment = Boolean(linkedPaymentItem?.payment?.isMerged)
    const isDebtInit = tx.id.startsWith('debt_init_')
    const debtId = isDebtInit ? tx.id.replace('debt_init_', '') : null
    const isDebtExists = Boolean((debtId && debtLookup.debtIdsSet.has(debtId)) || debtLookup.entryTxIdsSet.has(tx.id))
    const isDebtEntry = tx.id.startsWith('debt_entry_')
    const isDebtEntryExists = Boolean(isDebtEntry && debtLookup.entryTxIdsSet.has(tx.id))
    const isCirclePayout = tx.id.startsWith('circle_payout_')
    const circleId = isCirclePayout ? tx.id.replace('circle_payout_', '') : null
    const isCircleExists = Boolean(isCirclePayout && circleId && circleIdsSet.has(circleId))
    const isLockedDebt = (isDebtInit && isDebtExists) || isDebtEntryExists || isMergedDebtPayment
    const isLockedCircle = isCirclePayout && isCircleExists
    const isSystemLinked = tx.id.startsWith('debt_') || tx.id.startsWith('circle_') || Boolean(tx.note?.includes('تسوية رصيد'))

    return (
      <TransactionRowItem
        key={tx.id}
        tx={tx}
        showDateBadge={showDateBadge}
        cat={cat}
        isExpense={isExpense}
        primaryLabel={primaryLabel}
        timeDisplay={timeDisplay}
        name={name}
        showCategoryInSub={showCategoryInSub}
        showNoteInSub={showNoteInSub}
        isLockedDebt={isLockedDebt}
        isLockedCircle={isLockedCircle}
        isMergedDebtPayment={isMergedDebtPayment}
        isSystemLinked={isSystemLinked}
        circleRecurringIdsSet={circleRecurringIdsSet}
        openEdit={openEdit}
        openDuplicate={openDuplicate}
        setTxToDelete={setTxToDelete}
        isSwipedOpen={swipedTxId === tx.id}
        onSwipeChange={(isOpen) => setSwipedTxId(isOpen ? tx.id : null)}
      />
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-up min-w-0 overflow-x-clip">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="المعاملات" subtitle="سجل كامل بجميع المصاريف والمداخيل وتفاصيلها" />
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap print-hide">
          <Button
            type="button"
            variant="outline"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
            disabled={filteredTransactions.length === 0}
            className="font-semibold text-xs sm:text-sm"
          >
            طباعة / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
            disabled={filteredTransactions.length === 0}
            className="font-semibold text-xs sm:text-sm"
          >
            تصدير CSV
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={() => openAdd('expense')}
            className="hidden lg:inline-flex font-semibold"
          >
            إضافة معاملة
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start print:block min-w-0">
        <TransactionFilterToolbar
          filterType={filterType}
          onFilterTypeChange={(val) => {
            setFilterType(val)
            setSelectedCategories([])
          }}
          query={query}
          onQueryChange={setQuery}
          sortBy={sortBy}
          onSortByChange={(val) => {
            setSortBy(val)
            setCurrentPage(1)
          }}
          allMonths={allMonths}
          onToggleAllMonths={() => {
            setAllMonths((prev) => {
              const next = !prev
              if (next) setIsCustomDateRange(false)
              return next
            })
            setCurrentPage(1)
          }}
          isCustomDateRange={isCustomDateRange}
          onToggleCustomDateRange={() => {
            setIsCustomDateRange((prev) => {
              const next = !prev
              if (next) setAllMonths(false)
              return next
            })
            setCurrentPage(1)
          }}
          customDateFrom={customDateFrom}
          onCustomDateFromChange={(val) => {
            setCustomDateFrom(val)
            setCurrentPage(1)
          }}
          customDateTo={customDateTo}
          onCustomDateToChange={(val) => {
            setCustomDateTo(val)
            setCurrentPage(1)
          }}
          selectedSource={selectedSource}
          onSelectedSourceChange={(val) => {
            setSelectedSource(val)
            setCurrentPage(1)
          }}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
          onClearCategories={() => {
            setSelectedCategories([])
            setCurrentPage(1)
          }}
          relevantCategories={relevantCategories}
          isFilterActive={isFilterActive}
          onResetFilters={handleResetFilters}
          filteredCount={filteredTransactions.length}
          totals={totals}
        />

        <div className="lg:col-span-8 print:w-full space-y-4 min-w-0">
          <div className="hidden print:block mb-4 p-4 border border-zinc-300 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-extrabold text-zinc-900">تقرير المعاملات المالية</h1>
              <span className="text-xs text-zinc-600 font-medium">
                {allMonths ? 'كافة الأشهر' : formatFinancialMonthLabel(range, userSettings?.monthStartDay || 1)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs border-t border-zinc-200 pt-2 font-medium">
              <div>إجمالي المداخيل: <strong className="text-emerald-600"><FormattedMoney amountFils={totals.income} /></strong></div>
              <div>إجمالي المصاريف: <strong className="text-red-600"><FormattedMoney amountFils={totals.expense} /></strong></div>
              <div>صافي الرصيد: <strong className={totals.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}><FormattedMoney amountFils={totals.balance} withSign="auto" /></strong></div>
            </div>
          </div>

          <DayGroupedTransactionList
            loading={txLoading}
            rawTransactionsCount={rawTransactions.length}
            paginatedTransactions={paginatedTransactions}
            displayedTransactions={displayedTransactions}
            dayGroups={dayGroups}
            sortBy={sortBy}
            isFilterActive={isFilterActive}
            allMonths={allMonths}
            onResetFilters={handleResetFilters}
            onOpenAdd={() => openAdd('expense')}
            renderRow={renderTransactionRow}
            isPrinting={isPrinting}
            totalPages={totalPages}
            currentPage={safeCurrentPage}
            onPageChange={handlePageChange}
            filteredCount={filteredTransactions.length}
            listRef={transactionListRef}
            today={today}
          />
        </div>
      </div>

      <TransactionDeleteModal
        txToDelete={txToDelete}
        onClose={() => setTxToDelete(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
        linkedDebtPayment={linkedDebtPayment}
        linkedDebtInit={linkedDebtInit}
        linkedDebtEntry={linkedDebtEntry}
        circleInstallmentToDelete={circleInstallmentToDelete}
      />
    </div>
  )
}
