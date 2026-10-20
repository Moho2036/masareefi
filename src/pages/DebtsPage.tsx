import React, { useState, useMemo, useDeferredValue } from 'react'
import {
  HandCoins,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Scale,
  AlertCircle,
  Info,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { DebtCard } from '../components/debts/DebtCard'
import { DebtFormModal } from '../components/debts/DebtFormModal'
import { PaymentModal } from '../components/debts/PaymentModal'
import { PaymentHistoryModal } from '../components/debts/PaymentHistoryModal'
import { useAuth } from '../hooks/useAuth'
import { useDebts } from '../hooks/useDebts'
import { useCurrency } from '../hooks/useCurrency'
import { useToast } from '../hooks/useToast'
import { deleteDebt } from '../services/debts'
import { calculateDebtSummary, filterDebts } from '../lib/debts'
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

  // Filtered debts (using deferredSearch to prevent keyboard freeze on mobile)
  const filteredDebts = useMemo(() => {
    return filterDebts(debts, {
      type: typeFilter,
      status: statusFilter,
      search: deferredSearch,
    })
  }, [debts, typeFilter, statusFilter, deferredSearch])

  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)
  const [deleteTransactions, setDeleteTransactions] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Handlers
  const handleOpenAdd = () => {
    setEditingDebt(null)
    setIsFormOpen(true)
  }

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt)
    setIsFormOpen(true)
  }

  const handleDelete = (debt: Debt) => {
    setDebtToDelete(debt)
    setDeleteTransactions(false)
  }

  const handleConfirmDelete = async () => {
    if (!user || !debtToDelete) return
    setIsDeleting(true)
    try {
      await deleteDebt(user.uid, debtToDelete.id, { deleteTransactions })
      showToast('تم حذف الدين بنجاح', 'info')
      setDebtToDelete(null)
      setDeleteTransactions(false)
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

      {/* Subtle Explanatory Note */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
        <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          دفتر الديون مخصص لتتبع الحقوق والالتزامات بشكل مستقل ولا يخصم أو يضيف تلقائياً إلى رصيد المعاملات الشهرية.
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Card: مستحقات لي */}
        <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">
              مستحقات لي على الآخرين
            </span>
            <span className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {format(summary.lentFils)}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block mt-1">
              {summary.lentActiveCount === 0
                ? 'لا توجد مستحقات نشطة'
                : `متبقية من ${summary.lentActiveCount} ${summary.lentActiveCount === 1 ? 'شخص' : 'أشخاص'}`}
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Card: التزامات عليّ */}
        <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">
              التزامات عليّ للآخرين
            </span>
            <span className="text-lg sm:text-2xl font-black text-red-500 dark:text-red-400">
              {format(summary.borrowedFils)}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block mt-1">
              {summary.borrowedActiveCount === 0
                ? 'لا توجد التزامات نشطة'
                : `واجبة لـ ${summary.borrowedActiveCount} ${summary.borrowedActiveCount === 1 ? 'شخص' : 'أشخاص'}`}
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Card: صافي المركز المالي */}
        <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">
              صافي الفارق (لك - عليك)
            </span>
            <span
              className={cn(
                'text-lg sm:text-2xl font-black',
                summary.netFils >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500 dark:text-red-400'
              )}
            >
              {summary.netFils >= 0 ? '+' : ''}
              {format(summary.netFils)}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block mt-1">
              {summary.netFils > 0
                ? 'فائض مستحق لصالحك'
                : summary.netFils < 0
                  ? 'عجز مستحق عليك'
                  : 'متعادل تماماً'}
            </span>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الشخص أو الملاحظة..."
            className="w-full ps-10 pe-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-700/60 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
              typeFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
                ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            عليّ (يطلبوني)
          </button>
        </div>
      </div>

      {/* 4. Secondary Status Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
            statusFilter === 'all'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
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
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
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
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-400'
              : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          )}
        >
          المتأخرة عن الموعد
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('settled')}
          className={cn(
            'px-3 py-1.5 rounded-xl border transition-colors cursor-pointer shrink-0',
            statusFilter === 'settled'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          )}
        >
          المسددة بالكامل ({summary.settledCount})
        </button>
      </div>

      {/* 5. Debts Cards Grid or Empty State */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-sm font-semibold animate-pulse">جارٍ تحميل بيانات الديون...</p>
        </div>
      ) : filteredDebts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 p-8 shadow-xs">
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
              <Button variant="primary" onClick={handleOpenAdd}>
                إضافة دين جديد
              </Button>
            }
          />
        </div>

      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDebts.map((debt) => (
            <DebtCard
              key={debt.id}
              debt={debt}
              onOpenPaymentModal={(d) => setPaymentDebtId(d.id)}
              onOpenHistoryModal={(d) => setHistoryDebtId(d.id)}
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
          setDeleteTransactions(false)
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

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
            <label
              htmlFor="delete-debt-txs"
              className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none"
            >
              حذف معاملات السداد المسجلة سابقاً لهذا الدين من سجل المعاملات
            </label>
            <input
              id="delete-debt-txs"
              type="checkbox"
              checked={deleteTransactions}
              onChange={(e) => setDeleteTransactions(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setDebtToDelete(null)
                setDeleteTransactions(false)
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
    </div>
  )
}
