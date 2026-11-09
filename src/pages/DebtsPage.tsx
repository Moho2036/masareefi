import React, { useState, useMemo, useDeferredValue, useEffect, useCallback } from 'react'
import {
  HandCoins,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Scale,
  AlertCircle,
  X,
  GitMerge,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Toggle } from '../components/ui/Toggle'
import { EmptyState } from '../components/ui/EmptyState'
import { DebtCard } from '../components/debts/DebtCard'
import { DebtFormModal } from '../components/debts/DebtFormModal'
import { PaymentModal } from '../components/debts/PaymentModal'
import { PaymentHistoryModal } from '../components/debts/PaymentHistoryModal'
import { useAuth } from '../hooks/useAuth'
import { useDebts } from '../hooks/useDebts'
import { useCurrency } from '../hooks/useCurrency'
import { useToast } from '../hooks/useToast'
import { deleteDebt, checkDebtInitialTransactionExists, mergePersonDebts } from '../services/debts'
import { calculateDebtSummary, filterDebts, isDebtOverdue, groupDebtsByPerson } from '../lib/debts'
import { cn } from '../lib/cn'
import type { Debt, DebtType } from '../types'

export const DebtsPage: React.FC = () => {
  const { user } = useAuth()
  const { data: debts, loading } = useDebts()
  const { format } = useCurrency()
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

  // Handlers
  const handleOpenAdd = () => {
    setEditingDebt(null)
    setIsFormOpen(true)
  }

  const handleOpenPaymentModal = useCallback((d: Debt) => setPaymentDebtId(d.id), [])
  const handleOpenHistoryModal = useCallback((d: Debt) => setHistoryDebtId(d.id), [])

  const handleEdit = useCallback((debt: Debt) => {
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
      {/* 1. Page Header */}
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

      {/* 2. Top Summary KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-32 animate-pulse"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-28" />
                <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded w-24 my-2" />
              <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Card: مستحقات لي */}
          <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                  مستحقات لي على الآخرين
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums block mt-1">
                {format(summary.lentFils)}
              </span>
            </div>
            <div className="pt-2.5 mt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {summary.lentActiveCount === 0
                ? 'لا توجد مستحقات نشطة'
                : summary.lentActiveCount === 1
                  ? 'متبقية من شخص واحد'
                  : summary.lentActiveCount === 2
                    ? 'متبقية من شخصين'
                    : summary.lentActiveCount <= 10
                      ? `متبقية من ${summary.lentActiveCount} أشخاص`
                      : `متبقية من ${summary.lentActiveCount} شخصاً`}
            </div>
          </div>

          {/* Card: التزامات عليّ */}
          <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                  التزامات عليّ للآخرين
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400 tabular-nums block mt-1">
                {format(summary.borrowedFils)}
              </span>
            </div>
            <div className="pt-2.5 mt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {summary.borrowedActiveCount === 0
                ? 'لا توجد التزامات نشطة'
                : summary.borrowedActiveCount === 1
                  ? 'واجبة لشخص واحد'
                  : summary.borrowedActiveCount === 2
                    ? 'واجبة لشخصين'
                    : summary.borrowedActiveCount <= 10
                      ? `واجبة لـ ${summary.borrowedActiveCount} أشخاص`
                      : `واجبة لـ ${summary.borrowedActiveCount} شخصاً`}
            </div>
          </div>

          {/* Card 3: الديون المتأخرة والمستحقة قريباً */}
          <div className="bg-white dark:bg-[#121215] p-4 sm:p-5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none flex flex-col justify-between h-full sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-1">
                  {summary.overdueCount > 0 ? 'ديون متأخرة السداد' : 'استحقاقات خلال 7 أيام'}
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <span
                className={cn(
                  'text-xl sm:text-2xl font-black tabular-nums block mt-1',
                  summary.overdueCount > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : summary.upcomingCount > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-zinc-700 dark:text-zinc-300'
                )}
              >
                {summary.overdueCount > 0
                  ? format(summary.overdueFils)
                  : summary.upcomingCount > 0
                    ? format(summary.upcomingFils)
                    : format(0)}
              </span>
            </div>
            <div className="pt-2.5 mt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {summary.overdueCount > 0
                ? summary.overdueCount === 1
                  ? 'دين واحد تجاوز موعد الاستحقاق'
                  : summary.overdueCount === 2
                    ? 'دينان تجاوزا موعد الاستحقاق'
                    : summary.overdueCount <= 10
                      ? `${summary.overdueCount} ديون تجاوزت موعد الاستحقاق`
                      : `${summary.overdueCount} ديناً تجاوز موعد الاستحقاق`
                : summary.upcomingCount > 0
                  ? summary.upcomingCount === 1
                    ? 'دين واحد يحل موعده قريباً'
                    : summary.upcomingCount === 2
                      ? 'دينان يحل موعدهما قريباً'
                      : summary.upcomingCount <= 10
                        ? `${summary.upcomingCount} ديون يحل موعدها قريباً`
                        : `${summary.upcomingCount} ديناً يحل موعده قريباً`
                  : 'لا توجد ديون متأخرة'}
            </div>
          </div>
        </div>
      )}

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-[#121215] p-3.5 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs">
        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الشخص أو الملاحظة أو المبلغ..."
            className="w-full ps-10 pe-10 h-11 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-zinc-50/80 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-base sm:text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 end-0 pe-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              aria-label="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type Filter Buttons */}
        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              typeFilter === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs dark:shadow-none border border-transparent dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('lent')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              typeFilter === 'lent'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs dark:shadow-none border border-transparent dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            لي (أطلبهم)
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('borrowed')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              typeFilter === 'borrowed'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs dark:shadow-none border border-transparent dark:border-zinc-700'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            )}
          >
            عليّ (يطلبوني)
          </button>
        </div>
      </div>

      {/* 4. Secondary Status Pills */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold no-scrollbar">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            كافة الحالات ({debts.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'active'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            الديون المفتوحة ({summary.lentActiveCount + summary.borrowedActiveCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('overdue')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'overdue'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            المتأخرة عن الموعد ({overdueCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('settled')}
            className={cn(
              'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
              statusFilter === 'settled'
                ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 border-transparent shadow-2xs dark:shadow-none'
                : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
            )}
          >
            المسددة بالكامل ({summary.settledCount})
          </button>
        </div>
      </div>

      {/* 5. Smart Merge Strip (when duplicate debts of the same person & type exist) */}
      {mergeCandidates.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] text-xs">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <GitMerge className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold">توجد ديون متعددة لنفس الشخص يمكن دمجها:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mergeCandidates.map((c) => (
              <Button
                key={c.key}
                variant="outline"
                size="sm"
                onClick={() => setMergeTarget({ debts: c.debts, personName: c.personName })}
                className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>
                  {c.type === 'lent'
                    ? `دمج ديون ${c.personName} في سجل موحد`
                    : `دمج التزامات ${c.personName} في سجل موحد`}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 6. Debts Cards Grid or Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] p-5 space-y-4 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-1.5">
                    <div className="w-24 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-16 h-2.5 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  </div>
                </div>
                <div className="w-16 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="h-16 rounded-xl bg-zinc-50 dark:bg-zinc-800/80" />
              <div className="flex items-center justify-between pt-2">
                <div className="w-20 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="w-16 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredDebts.length === 0 ? (
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
          {/* Active debts grid */}
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

          {/* Settled debts collapsible archive section */}
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
      <Modal
        isOpen={Boolean(debtToDelete)}
        onClose={() => {
          setDebtToDelete(null)
          setDeleteTransactions(true)
          setHasInitTxOnDelete(false)
        }}
        title="تأكيد حذف الدين"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              هل أنت متأكد من حذف سجل الدين الخاص بـ &quot;{debtToDelete?.personName}&quot;؟ سيتم حذف كافة بياناته ودفعاته بشكل نهائي.
            </p>
          </div>

          {hasLinkedTransactions && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
              <Toggle
                id="delete-debt-txs"
                label="حذف المعاملات المالية المرتبطة بهذا الدين (أصل الدين والدفعات) من المحفظة أيضاً"
                checked={deleteTransactions}
                onChange={setDeleteTransactions}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setDebtToDelete(null)
                setDeleteTransactions(true)
                setHasInitTxOnDelete(false)
              }}
              disabled={isDeleting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'جاري الحذف...' : 'حذف الدين'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Merge Debts Modal */}
      <Modal
        isOpen={Boolean(mergeTarget)}
        onClose={() => setMergeTarget(null)}
        title="تأكيد دمج سجلات الديون"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-zinc-800 dark:text-zinc-200">
            <GitMerge className="w-5 h-5 text-blue-600 shrink-0" />
            <p className="text-sm font-semibold">
              {mergeTarget?.debts.length === 2
                ? `هل ترغب في دمج سجلي دين لـ "${mergeTarget?.personName}" في سجل دين موحد؟`
                : `هل ترغب في دمج ${mergeTarget?.debts.length} سجلات ديون لـ "${mergeTarget?.personName}" في سجل دين موحد؟`}
            </p>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            سيتم تحويل جميع السجلات والسلف ودفعات السداد السابقة إلى سجل واحد متكامل، مع الحفاظ الكامل على كافة المعاملات المالية ورصيد المحفظة.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setMergeTarget(null)}
              disabled={isMerging}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmMerge}
              disabled={isMerging}
            >
              {isMerging ? 'جاري الدمج...' : 'تأكيد الدمج الموحد'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
