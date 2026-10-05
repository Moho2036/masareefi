import React, { useState, useMemo } from 'react'
import {
  ArrowLeftRight,
  Search,
  Plus,
  Pencil,
  Trash2,
  Calendar,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { MonthSelector } from '../components/ui/MonthSelector'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useTransactionModal } from '../hooks/useTransactionModal'
import { useToast } from '../hooks/useToast'
import { deleteTransaction } from '../services/transactions'
import { formatDayHeader } from '../lib/dates'
import { formatJOD, formatSigned } from '../lib/money'
import { filterTransactions, sumByType, groupByDay } from '../lib/aggregate'
import { cn } from '../lib/cn'
import type { Transaction, TxType } from '../types'

export const TransactionsPage: React.FC = () => {
  const { user } = useAuth()
  const { range } = useSelectedMonth()
  const { data: rawTransactions, loading: txLoading } = useTransactions(range)
  const { data: categories } = useCategories()
  const { openAdd, openEdit } = useTransactionModal()
  const { showToast } = useToast()

  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState<TxType | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Map categoryId to Category for O(1) lookups
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  // Options for Category Select
  const categoryOptions = useMemo(() => {
    const relevant = categories.filter((c) =>
      filterType === 'all' ? true : c.type === filterType
    )
    return [
      { value: 'all', label: 'كل التصنيفات' },
      ...relevant.map((c) => ({
        value: c.id,
        label: `${c.icon} ${c.name}`,
      })),
    ]
  }, [categories, filterType])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return filterTransactions(rawTransactions, {
      query,
      type: filterType,
      categoryId: selectedCategory,
    })
  }, [rawTransactions, query, filterType, selectedCategory])

  // Summary totals for filtered set
  const totals = useMemo(() => {
    return sumByType(filteredTransactions)
  }, [filteredTransactions])

  // Grouped by day
  const today = useMemo(() => new Date(), [])
  const dayGroups = useMemo(() => {
    return groupByDay(filteredTransactions)
  }, [filteredTransactions])

  const handleDeleteConfirm = async () => {
    if (!user || !txToDelete) return
    setDeleting(true)
    try {
      await deleteTransaction(user.uid, txToDelete.id)
      showToast('تم حذف المعاملة بنجاح', 'info')
      setTxToDelete(null)
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      showToast('تعذر حذف المعاملة', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="المعاملات"
          subtitle="سجل كامل بجميع المصاريف والمداخيل وتفاصيلها"
        />
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={() => openAdd('expense')}
          className="self-start sm:self-auto font-semibold"
        >
          إضافة معاملة
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في العنوان أو الملاحظات..."
            className="w-full ps-10 pe-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        {/* Month Selector */}
        <div className="shrink-0">
          <MonthSelector />
        </div>

        {/* Type Toggle: الكل / مصاريف / مداخيل */}
        <div className="shrink-0">
          <SegmentedControl<TxType | 'all'>
            value={filterType}
            onChange={(val) => {
              setFilterType(val)
              setSelectedCategory('all')
            }}
            options={[
              { value: 'all', label: 'الكل' },
              { value: 'expense', label: 'مصاريف' },
              { value: 'income', label: 'مداخيل' },
            ]}
          />
        </div>

        {/* Category Select */}
        <div className="shrink-0 min-w-44">
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={categoryOptions}
            className="w-full"
          />
        </div>
      </div>

      {/* Summary Strip Card */}
      <div className="grid grid-cols-2 gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            ↑
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">إجمالي المداخيل</div>
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              {formatJOD(totals.income)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-s border-slate-100 dark:border-slate-700 ps-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
            ↓
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">إجمالي المصاريف</div>
            <div className="text-base sm:text-lg font-black text-red-500 dark:text-red-400">
              {formatJOD(totals.expense)}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {txLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : dayGroups.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="w-8 h-8" />}
          title={
            query || filterType !== 'all' || selectedCategory !== 'all'
              ? 'لا توجد معاملات مطابقة للفلترة'
              : 'لا توجد معاملات لهذا الشهر'
          }
          description="ابدأ بتسجيل مصاريفك أو مداخيلك لمتابعة ميزانيتك أولاً بأول."
          action={
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => openAdd('expense')}
            >
              إضافة أول معاملة
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {dayGroups.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Day Header */}
              <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDayHeader(group.date, today)}</span>
              </div>

              {/* Transactions in this day */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs divide-y divide-slate-100 dark:divide-slate-700/50 overflow-hidden">
                {group.transactions.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId)
                  const icon = cat?.icon ?? '➕'
                  const color = cat?.color ?? '#94A3B8'
                  const name = cat?.name ?? 'غير مصنف'
                  const isExpense = tx.type === 'expense'

                  return (
                    <div
                      key={tx.id}
                      onClick={() => openEdit(tx)}
                      className="group flex items-center justify-between p-3.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                    >
                      {/* Right side: Emoji circle + Category Name + Note */}
                      <div className="flex items-center gap-3 min-w-0 flex-1 pe-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          {icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                              {tx.title || name}
                            </span>
                            {tx.recurringId && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold shrink-0">
                                متكررة
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400 truncate mt-0.5">
                            {tx.title ? (
                              <>
                                <span className="font-medium text-slate-500 dark:text-slate-400">{name}</span>
                                {tx.note ? <span>•</span> : null}
                              </>
                            ) : null}
                            {tx.note ? <span>{tx.note}</span> : null}
                          </div>
                        </div>
                      </div>

                      {/* Left side: Amount Pill & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Amount Pill */}
                        <div
                          className={cn(
                            'font-bold text-xs sm:text-sm px-3 py-1.5 rounded-xl select-none',
                            isExpense
                              ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          )}
                        >
                          {formatSigned(tx.amountFils, tx.type)}
                        </div>

                        {/* Action Buttons (visible on hover on desktop, always clickable) */}
                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(tx)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                            aria-label="تعديل المعاملة"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setTxToDelete(tx)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                            aria-label="حذف المعاملة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        title="تأكيد حذف المعاملة"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            هل أنت متأكد من رغبتك في حذف هذه المعاملة؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setTxToDelete(null)}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'جاري الحذف...' : 'حذف المعاملة'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
