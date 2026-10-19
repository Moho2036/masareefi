import React, { useState, useMemo, useEffect } from 'react'
import {
  LayoutGrid,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { CategoryForm } from '../components/CategoryForm'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useToast } from '../hooks/useToast'
import { archiveCategory, deleteCategory } from '../services/categories'
import { countByCategory } from '../lib/aggregate'
import {
  getCategoryUsageMap,
  buildUsageFromTransactions,
  mergeUsageMaps,
  saveCategoryUsageMap,
} from '../lib/categoryUsage'
import type { Category, TxType } from '../types'

export const CategoriesPage: React.FC = () => {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const { range } = useSelectedMonth()
  const { data: transactions } = useTransactions(range)
  const { showToast } = useToast()

  const [categoryType, setCategoryType] = useState<TxType>('expense')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false)
  const [catToDelete, setCatToDelete] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirmDelete = async () => {
    if (!user || !catToDelete) return
    setIsDeleting(true)
    try {
      await deleteCategory(user.uid, catToDelete.id)
      showToast('تم حذف التصنيف نهائياً', 'info')
      setCatToDelete(null)
    } catch (err) {
      console.error('Failed to delete category:', err)
      showToast(err instanceof Error ? err.message : 'تعذر حذف التصنيف', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Transaction count per category for current financial month
  const txCounts = useMemo(() => {
    return countByCategory(transactions)
  }, [transactions])

  // Track category usage frequencies in memory
  const usageMap = useMemo(() => {
    const txMap = buildUsageFromTransactions(transactions)
    return mergeUsageMaps(txMap, getCategoryUsageMap())
  }, [transactions])

  // Save merged category usage in localStorage outside render in an effect
  useEffect(() => {
    if (transactions.length > 0) {
      saveCategoryUsageMap(usageMap)
    }
  }, [transactions.length, usageMap])

  // Active categories for the selected type, sorted from most used to least used
  const activeCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === categoryType && !c.archived)
    return [...filtered].sort((a, b) => {
      const scoreA = (txCounts[a.id] || 0) * 1000 + (usageMap[a.id] || 0)
      const scoreB = (txCounts[b.id] || 0) * 1000 + (usageMap[b.id] || 0)
      if (scoreB !== scoreA) {
        return scoreB - scoreA // Highest usage first
      }
      return a.order - b.order
    })
  }, [categories, categoryType, txCounts, usageMap])

  // Archived categories for the selected type
  const archivedCategories = useMemo(() => {
    return categories.filter((c) => c.type === categoryType && c.archived)
  }, [categories, categoryType])

  const handleOpenAdd = () => {
    setEditingCategory(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat)
    setIsFormOpen(true)
  }

  const handleArchive = async (cat: Category) => {
    if (!user) return
    try {
      await archiveCategory(user.uid, cat.id, true)
      showToast('تمت أرشفة التصنيف بنجاح', 'info')
    } catch (err) {
      console.error('Failed to archive category:', err)
      showToast('تعذر أرشفة التصنيف', 'error')
    }
  }

  const handleRestore = async (cat: Category) => {
    if (!user) return
    try {
      await archiveCategory(user.uid, cat.id, false)
      showToast('تمت استعادة التصنيف بنجاح', 'success')
    } catch (err) {
      console.error('Failed to restore category:', err)
      showToast('تعذر استعادة التصنيف', 'error')
    }
  }

  const formatCount = (count: number, total = 0) => {
    if (count === 0) {
      if (total > 0) return `0 هذا الشهر (${total} إجمالاً)`
      return 'لا توجد معاملات مسجلة'
    }
    if (count === 1) return 'معاملة واحدة هذا الشهر'
    if (count === 2) return 'معاملتان هذا الشهر'
    if (count >= 3 && count <= 10) return `${count} معاملات هذا الشهر`
    return `${count} معاملة هذا الشهر`
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="التصنيفات"
          subtitle="إدارة تصنيفات المصاريف والمداخيل وتخصيص الأيقونات والألوان"
        />
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={handleOpenAdd}
          className="self-start sm:self-auto font-semibold"
        >
          تصنيف جديد
        </Button>
      </div>

      {/* Tabs: المصاريف / المداخيل */}
      <div className="flex items-center justify-start border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <SegmentedControl<TxType>
          value={categoryType}
          onChange={setCategoryType}
          options={[
            { value: 'expense', label: 'المصاريف' },
            { value: 'income', label: 'المداخيل' },
          ]}
          className="w-full sm:w-64"
        />
      </div>

      {/* Active Categories Grid */}
      {categoriesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : activeCategories.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="w-8 h-8" />}
          title="لا توجد تصنيفات نشطة"
          description={`لم تقم بإضافة أي تصنيفات لـ ${
            categoryType === 'expense' ? 'المصاريف' : 'المداخيل'
          } بعد.`}
          action={
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={handleOpenAdd}
            >
              إضافة تصنيف جديد
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeCategories.map((cat) => {
            const count = txCounts[cat.id] || 0

            return (
              <div
                key={cat.id}
                className="group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Card Top: Icon & Details */}
                <div className="flex items-start gap-3.5 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-xs"
                    style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                  >
                    {cat.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {formatCount(count, usageMap[cat.id] || 0)}
                    </p>
                  </div>
                </div>

                {/* Card Bottom: Action buttons */}
                <div className="flex items-center justify-end gap-1 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                    aria-label={`تعديل تصنيف ${cat.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(cat)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                    aria-label={`أرشفة تصنيف ${cat.name}`}
                    title="أرشفة التصنيف"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  {count === 0 && (
                    <button
                      type="button"
                      onClick={() => setCatToDelete(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      aria-label={`حذف تصنيف ${cat.name} نهائياً`}
                      title="حذف نهائي (لا توجد معاملات مرتبطة)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Collapsed Archived Section */}
      {archivedCategories.length > 0 && (
        <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setIsArchivedExpanded((prev) => !prev)}
            className="flex items-center justify-between w-full p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-400" />
              <span>التصنيفات المؤرشفة ({archivedCategories.length})</span>
            </div>
            {isArchivedExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isArchivedExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
              {archivedCategories.map((cat) => {
                const count = txCounts[cat.id] || 0
                return (
                  <div
                    key={cat.id}
                    className="bg-slate-50 dark:bg-slate-850/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 opacity-80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{cat.icon}</span>
                      <span className="font-semibold text-sm text-slate-600 dark:text-slate-300 truncate">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => handleRestore(cat)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400"
                      >
                        استعادة
                      </Button>
                      {count === 0 && (
                        <button
                          type="button"
                          onClick={() => setCatToDelete(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          aria-label={`حذف تصنيف ${cat.name} نهائياً`}
                          title="حذف نهائي"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Category Create/Edit Modal */}
      <CategoryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialCategory={editingCategory}
        defaultType={categoryType}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(catToDelete)}
        onClose={() => {
          if (!isDeleting) setCatToDelete(null)
        }}
        title="تأكيد حذف التصنيف"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              هل أنت متأكد من حذف تصنيف &quot;{catToDelete?.name}&quot; نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setCatToDelete(null)}
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
              {isDeleting ? 'جاري الحذف...' : 'حذف نهائي'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
