import React, { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { RecurringForm } from '../components/RecurringForm'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useToast } from '../hooks/useToast'
import { updateRecurring, deleteRecurring } from '../services/recurring'
import { calculateMonthlyEquivalent } from '../lib/recurring'
import { formatJOD, formatSigned } from '../lib/money'
import { toWesternDigits } from '../lib/dates'
import { cn } from '../lib/cn'
import type { Recurring, Frequency } from '../types'

export const RecurringPage: React.FC = () => {
  const { user } = useAuth()
  const { data: recurringItems, loading: recurringLoading } = useRecurring()
  const { data: categories } = useCategories()
  const { showToast } = useToast()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Recurring | null>(null)
  const [itemToDelete, setItemToDelete] = useState<Recurring | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Map categoryId to Category
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  // Monthly equivalents
  const monthlyStats = useMemo(() => {
    return calculateMonthlyEquivalent(recurringItems)
  }, [recurringItems])

  const handleToggleActive = async (item: Recurring) => {
    if (!user) return
    const newActive = !item.active
    try {
      await updateRecurring(user.uid, item.id, { active: newActive })
      showToast(
        newActive
          ? 'تم تفعيل المعاملة المتكررة'
          : 'تم إيقاف المعاملة المتكررة مؤقتاً',
        'info'
      )
    } catch (err) {
      console.error('Failed to toggle recurring item:', err)
      showToast('تعذر تغيير حالة المعاملة', 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!user || !itemToDelete) return
    setDeleting(true)
    try {
      await deleteRecurring(user.uid, itemToDelete.id)
      showToast('تم حذف المعاملة المتكررة بنجاح', 'info')
      setItemToDelete(null)
    } catch (err) {
      console.error('Failed to delete recurring item:', err)
      showToast('تعذر حذف المعاملة', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const frequencyLabels: Record<Frequency, string> = {
    weekly: 'أسبوعي',
    monthly: 'شهري',
    yearly: 'سنوي',
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="المعاملات المتكررة"
          subtitle="جدولة المصاريف والمداخيل الدورية كالراتب والإيجار والاشتراكات"
        />
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={() => {
            setEditingItem(null)
            setIsFormOpen(true)
          }}
          className="self-start sm:self-auto font-semibold"
        >
          إضافة متكررة
        </Button>
      </div>

      {/* KPI Cards: Monthly Income & Expense */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Income Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">
              مداخيل ثابتة شهرياً
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {formatJOD(monthlyStats.monthlyIncome)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
            ↑
          </div>
        </div>

        {/* Expense Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">
              مصاريف ثابتة شهرياً
            </span>
            <span className="text-2xl sm:text-3xl font-black text-red-500 dark:text-red-400">
              {formatJOD(monthlyStats.monthlyExpense)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-lg">
            ↓
          </div>
        </div>
      </div>

      {/* Recurring Items Grid */}
      {recurringLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : recurringItems.length === 0 ? (
        <EmptyState
          icon={<RefreshCw className="w-8 h-8" />}
          title="لا توجد معاملات متكررة"
          description="أضف التزاماتك الثابتة (رواتب، إيجار، اشتراكات) ليقوم التطبيق بتسجيلها تلقائياً عند حلول موعدها."
          action={
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => {
                setEditingItem(null)
                setIsFormOpen(true)
              }}
            >
              إضافة أول معاملة متكررة
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recurringItems.map((item) => {
            const cat = categoryMap.get(item.categoryId)
            const icon = cat?.icon ?? '➕'
            const color = cat?.color ?? '#94A3B8'
            const name = cat?.name ?? 'غير مصنف'
            const isExpense = item.type === 'expense'

            const nextDateFormatted = toWesternDigits(
              format(
                item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate),
                'd LLLL yyyy',
                { locale: ar }
              )
            )

            return (
              <div
                key={item.id}
                className={cn(
                  'group rounded-2xl p-5 border transition-all flex flex-col justify-between',
                  item.active
                    ? 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md'
                    : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                )}
              >
                {/* Top Row: Category + Frequency Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${color}25` }}
                    >
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100 block truncate">
                        {name}
                      </span>
                      {item.note ? (
                        <p className="text-xs text-slate-400 dark:text-slate-400 truncate">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!item.active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                        متوقفة مؤقتاً
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-amber-900/40">
                      {frequencyLabels[item.frequency]}
                    </span>
                  </div>
                </div>

                {/* Middle: Amount in large bold text */}
                <div className="my-2">
                  <div
                    className={cn(
                      'text-xl sm:text-2xl font-black select-none',
                      isExpense
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {formatSigned(item.amountFils, item.type)}
                  </div>
                </div>

                {/* Bottom Row: Next date, Active toggle, Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 truncate">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">الموعد القادم: {nextDateFormatted}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle button */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      role="switch"
                      aria-checked={item.active}
                      aria-label={item.active ? 'إيقاف مؤقت' : 'تفعيل'}
                      className={cn(
                        'w-9 h-5 rounded-full transition-colors relative cursor-pointer',
                        item.active
                          ? 'bg-emerald-500 dark:bg-emerald-600'
                          : 'bg-slate-300 dark:bg-slate-600'
                      )}
                    >
                      <span
                        className={cn(
                          'w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform shadow-xs',
                          item.active ? 'end-0.5' : 'start-0.5'
                        )}
                      />
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item)
                        setIsFormOpen(true)
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      aria-label="تعديل المعاملة المتكررة"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      aria-label="حذف المعاملة المتكررة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recurring Form Modal */}
      <RecurringForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialRecurring={editingItem}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="تأكيد حذف المعاملة المتكررة"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              هل أنت متأكد من حذف هذه المعاملة المتكررة؟ لن يتم إنشاء أي معاملات مستقبلية منها.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setItemToDelete(null)}
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
              {deleting ? 'جاري الحذف...' : 'حذف المعاملة المتكررة'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
