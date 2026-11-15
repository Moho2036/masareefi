import React, { useState, useMemo, useDeferredValue, useEffect, useCallback } from 'react'
import {
  HandCoins,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { DebtCard } from '../components/debts/DebtCard'
import { DebtFormModal } from '../components/debts/DebtFormModal'
import { PaymentModal } from '../components/debts/PaymentModal'
import { PaymentHistoryModal } from '../components/debts/PaymentHistoryModal'
import { DebtsSummaryCards } from '../components/debts/DebtsSummaryCards'
import { DebtsFilterBar } from '../components/debts/DebtsFilterBar'
import { DebtDeleteModal } from '../components/debts/DebtDeleteModal'
import { DebtsMergeModal } from '../components/debts/DebtsMergeModal'
import { DebtsMergeBanner } from '../components/debts/DebtsMergeBanner'
import { motion, AnimatePresence } from 'motion/react'
import { filterCrossFadeVariants, filterTransition, isTestEnv } from '../lib/motionTokens'
import { triggerHaptic } from '../lib/haptics'
import { useAuth } from '../hooks/useAuth'

const PresenceWrapper = isTestEnv ? React.Fragment : AnimatePresence
const MotionDiv = isTestEnv ? 'div' : motion.div
import { useDebts } from '../hooks/useDebts'
import { useToast } from '../hooks/useToast'
import { deleteDebt, checkDebtInitialTransactionExists, mergePersonDebts } from '../services/debts'
import { calculateDebtSummary, filterDebts, isDebtOverdue, groupDebtsByPerson } from '../lib/debts'
import type { Debt, DebtType } from '../types'

export const DebtsPage: React.FC = () => {
  const { user } = useAuth()
  const { data: debts, loading } = useDebts()
  const { showToast } = useToast()

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null)
  const [historyDebtId, setHistoryDebtId] = useState<string | null>(null)

  const paymentDebt = useMemo(() => {
    if (!paymentDebtId) return null
    return debts.find((d) => d.id === paymentDebtId) ?? null
  }, [debts, paymentDebtId])

  const historyDebt = useMemo(() => {
    if (!historyDebtId) return null
    return debts.find((d) => d.id === historyDebtId) ?? null
  }, [debts, historyDebtId])

  // Filters state
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [typeFilter, setTypeFilter] = useState<'all' | DebtType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'settled' | 'overdue'>('all')

  // Summary KPIs
  const summary = useMemo(() => {
    return calculateDebtSummary(debts)
  }, [debts])

  const overdueCount = useMemo(() => {
    return debts.filter((d) => isDebtOverdue(d)).length
  }, [debts])

  // Filtered debts (using deferredSearch to prevent keyboard freeze on mobile)
  const filteredDebts = useMemo(() => {
    return filterDebts(debts, {
      type: typeFilter,
      status: statusFilter,
      search: deferredSearch,
    })
  }, [debts, typeFilter, statusFilter, deferredSearch])

  // Collapsible archive for settled debts when viewing all with no active search
  const [userToggledSettled, setUserToggledSettled] = useState<boolean | null>(null)
  const isArchiveMode = statusFilter === 'all' && !deferredSearch.trim()
  const activeDebts = useMemo(
    () => (isArchiveMode ? filteredDebts.filter((d) => !d.settled) : filteredDebts),
    [isArchiveMode, filteredDebts]
  )
  const settledDebts = useMemo(
    () => (isArchiveMode ? filteredDebts.filter((d) => d.settled) : []),
    [isArchiveMode, filteredDebts]
  )
  const isSettledExpanded =
    userToggledSettled !== null ? userToggledSettled : settledDebts.length <= 3

  // Grouped debts by person
  const groupedDebts = useMemo(() => {
    return groupDebtsByPerson(filteredDebts)
  }, [filteredDebts])

  // Smart merge candidates: any group with > 1 debt of the same type
  const mergeCandidates = useMemo(() => {
    const candidates: Array<{
      key: string
      personName: string
      type: DebtType
      debts: Debt[]
    }> = []

    groupedDebts.forEach((group) => {
      const lentDebts = group.debts.filter((d) => d.type === 'lent')
      if (lentDebts.length > 1) {
        candidates.push({
          key: `${group.personKey}-lent`,
          personName: group.canonicalName,
          type: 'lent',
          debts: lentDebts,
        })
      }
      const borrowedDebts = group.debts.filter((d) => d.type === 'borrowed')
      if (borrowedDebts.length > 1) {
        candidates.push({
          key: `${group.personKey}-borrowed`,
          personName: group.canonicalName,
          type: 'borrowed',
          debts: borrowedDebts,
        })
      }
    })

    return candidates
  }, [groupedDebts])

  const [mergeTarget, setMergeTarget] = useState<{ debts: Debt[]; personName: string } | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  const handleConfirmMerge = async () => {
    if (!user?.uid || !mergeTarget) return
    setIsMerging(true)
    try {
      await mergePersonDebts(user.uid, mergeTarget.debts)
      showToast(`تم دمج ديون ${mergeTarget.personName} في سجل موحد بنجاح`, 'success')
      setMergeTarget(null)
    } catch (err) {
      console.error('Merge debts failed:', err)
      showToast(err instanceof Error ? err.message : 'فشل دمج الديون', 'error')
    } finally {
      setIsMerging(false)
    }
  }

  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasInitTxOnDelete, setHasInitTxOnDelete] = useState(false)

  useEffect(() => {
    if (!debtToDelete || !user?.uid) {
      return
    }
    let cancelled = false
    checkDebtInitialTransactionExists(user.uid, debtToDelete.id, debtToDelete)
      .then((exists) => {
        if (!cancelled) setHasInitTxOnDelete(exists)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [debtToDelete, user?.uid])

  const hasLinkedTransactions = Boolean(
    debtToDelete && (
      hasInitTxOnDelete ||
      (debtToDelete.payments && debtToDelete.payments.length > 0) ||
      (debtToDelete.paidFils || 0) > 0
    )
  )

  const handleOpenAdd = () => {
    triggerHaptic('impact')
    setEditingDebt(null)
    setIsFormOpen(true)
  }

  const handleOpenPaymentModal = useCallback((d: Debt) => {
    triggerHaptic('tick')
    setPaymentDebtId(d.id)
  }, [])
  const handleOpenHistoryModal = useCallback((d: Debt) => {
    triggerHaptic('tick')
    setHistoryDebtId(d.id)
  }, [])

  const handleEdit = useCallback((debt: Debt) => {
    triggerHaptic('tick')
    setEditingDebt(debt)
    setIsFormOpen(true)
  }, [])

  const handleDelete = useCallback((debt: Debt) => {
    setDebtToDelete(debt)
    setDeleteTransactions(true)
    setHasInitTxOnDelete(false)
    if (user?.uid) {
      checkDebtInitialTransactionExists(user.uid, debt.id, debt)
        .then((exists) => setHasInitTxOnDelete(exists))
        .catch(() => {})
    }
  }, [user])

  const handleConfirmDelete = async () => {
    if (!user || !debtToDelete) return
    setIsDeleting(true)
    try {
      await deleteDebt(user.uid, debtToDelete.id, { deleteTransactions })
      showToast('تم حذف الدين بنجاح', 'info')
      setDebtToDelete(null)
      setDeleteTransactions(false)
      setHasInitTxOnDelete(false)
    } catch (err) {
      console.error('Failed to delete debt:', err)
      showToast('تعذر حذف الدين', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="الديون والالتزامات"
        subtitle="متابعة دقيقة للأموال المستحقة لك والالتزامات الواجب عليك سدادها للآخرين"
        actions={
          <Button
            variant="primary"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>إضافة دين</span>
          </Button>
        }
      />

      <DebtsSummaryCards
        summary={summary}
        loading={loading}
      />

      <DebtsFilterBar
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalCount={debts.length}
        activeCount={summary.lentActiveCount + summary.borrowedActiveCount}
        overdueCount={overdueCount}
        settledCount={summary.settledCount}
      />

      <DebtsMergeBanner
        candidates={mergeCandidates}
        onSelectCandidate={setMergeTarget}
      />

      <PresenceWrapper {...(isTestEnv ? {} : { mode: 'wait' })}>
        <MotionDiv
          key={`${typeFilter}-${statusFilter}-${isArchiveMode ? 'archive' : 'flat'}`}
          {...(isTestEnv
            ? {}
            : {
                variants: filterCrossFadeVariants,
                initial: 'initial',
                animate: 'animate',
                exit: 'exit',
                transition: filterTransition,
              })}
        >
          {filteredDebts.length === 0 ? (
            <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-8 shadow-2xs">
              <EmptyState
                icon={<HandCoins className="w-7 h-7" />}
                title={
                  search || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'لا توجد نتائج مطابقة لبحثك'
                    : 'لا توجد أي ديون مسجلة بعد'
                }
                description={
                  search || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية'
                    : 'يمكنك البدء بتسجيل مبالغ أقرضتها للآخرين أو استدنتها لمتابعتها بسهولة ودقة'
                }
                action={
                  search || typeFilter !== 'all' || statusFilter !== 'all' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('')
                        setTypeFilter('all')
                        setStatusFilter('all')
                      }}
                      icon={<X className="w-4 h-4" />}
                    >
                      مسح البحث
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={handleOpenAdd}>
                      إضافة دين جديد
                    </Button>
                  )
                }
              />
            </div>
          ) : isArchiveMode ? (
            <div className="space-y-6">
              {activeDebts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeDebts.map((debt) => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      onOpenPaymentModal={handleOpenPaymentModal}
                      onOpenHistoryModal={handleOpenHistoryModal}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-6 text-center shadow-2xs dark:shadow-none">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    لا توجد ديون أو التزامات نشطة حالياً.
                  </p>
                </div>
              )}

              {settledDebts.length > 0 && (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setUserToggledSettled(!isSettledExpanded)}
                    className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors cursor-pointer select-none border border-[#E4E4E7]/60 dark:border-[#27272A]"
                    aria-expanded={isSettledExpanded}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>الديون المسددة سابقاً ({settledDebts.length})</span>
                    </div>
                    {isSettledExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </button>
                  {isSettledExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-slide-down">
                      {settledDebts.map((debt) => (
                        <DebtCard
                          key={debt.id}
                          debt={debt}
                          onOpenPaymentModal={handleOpenPaymentModal}
                          onOpenHistoryModal={handleOpenHistoryModal}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDebts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  onOpenPaymentModal={handleOpenPaymentModal}
                  onOpenHistoryModal={handleOpenHistoryModal}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </MotionDiv>
      </PresenceWrapper>

      {/* Form Modal (Add / Edit) */}
      <DebtFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingDebt(null)
        }}
        initialDebt={editingDebt}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={Boolean(paymentDebtId && paymentDebt)}
        onClose={() => setPaymentDebtId(null)}
        debt={paymentDebt}
      />

      {/* Payment History Modal */}
      <PaymentHistoryModal
        isOpen={Boolean(historyDebtId && historyDebt)}
        onClose={() => setHistoryDebtId(null)}
        debt={historyDebt}
      />

      {/* Delete Debt Confirmation Modal */}
      <DebtDeleteModal
        debtToDelete={debtToDelete}
        onClose={() => {
          setDebtToDelete(null)
          setDeleteTransactions(true)
          setHasInitTxOnDelete(false)
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        hasLinkedTransactions={hasLinkedTransactions}
        deleteTransactions={deleteTransactions}
        setDeleteTransactions={setDeleteTransactions}
      />

      {/* Merge Debts Modal */}
      <DebtsMergeModal
        mergeTarget={mergeTarget}
        onClose={() => setMergeTarget(null)}
        onConfirm={handleConfirmMerge}
        isMerging={isMerging}
      />
    </div>
  )
}
