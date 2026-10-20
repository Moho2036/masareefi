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
import { useAppData } from '../context/AppDataContext'
import {
  getCategoryUsageMap,
  buildUsageFromTransactions,
  mergeUsageMaps,
  saveCategoryUsageMap,
  getCategoryUsageDetails,
} from '../lib/categoryUsage'
import type { Category, TxType } from '../types'

export const CategoriesPage: React.FC = () => {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const appData = useAppData()
  const recurring = useMemo(() => appData?.recurring ?? [], [appData?.recurring])
  const { range } = useSelectedMonth()
  const { data: transactions } = useTransactions(range)
  const { showToast } = useToast()

  const [categoryType, setCategoryType] = useState<TxType>('expense')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false)
  const [catToDelete, setCatToDelete] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Transaction count per category for current financial month
  const currentMonthTxCounts = useMemo(() => {
    return countByCategory(transactions)
  }, [transactions])

  // Track category usage frequencies from localStorage + current month transactions
  const localUsageMap = useMemo(() => getCategoryUsageMap(), [])
  const usageMap = useMemo(() => {
    const txMap = buildUsageFromTransactions(transactions)
    return mergeUsageMaps(txMap, localUsageMap)
  }, [transactions, localUsageMap])

  const handleConfirmDelete = async () => {
    if (!user || !catToDelete) return
    const details = getCategoryUsageDetails(catToDelete.id, transactions, recurring, usageMap)
    if (details.isInUse) {
      showToast(
        `لا يمكن حذف هذا التصنيف نهائياً لأنه مرتبط بـ ${
          details.recurringCount > 0 ? `${details.recurringCount} معاملة متكررة و ` : ''
        }${details.txCount} معاملة مالية. يمكنك أرشفته بدلاً من ذلك.`,
        'info'
      )
      setCatToDelete(null)
      return
    }

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

  // Save merged category usage in localStorage outside render in an effect
  useEffect(() => {
    if (transactions.length > 0) {
      saveCategoryUsageMap(usageMap)
    }
  }, [transactions.length, usageMap])

  // Active categories for the selected type, sorted consistently by natural order (a.order - b.order)
  const activeCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === categoryType && !c.archived)
    return [...filtered].sort((a, b) => a.order - b.order)
  }, [categories, categoryType])

  // Archived categories for the selected type, sorted consistently by natural order (a.order - b.order)
  const archivedCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === categoryType && c.archived)
    return [...filtered].sort((a, b) => a.order - b.order)
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
      const isUsedInActiveRecurring = recurring.some(
        (r) => (r.active !== false) && r.categoryId === cat.id
      )
      await archiveCategory(user.uid, cat.id, true)
      if (isUsedInActiveRecurring) {
        showToast('تمت الأرشفة، مع العلم أن هذا التصنيف مستخدم في معاملات متكررة نشطة', 'info')
      } else {
        showToast('تمت أرشفة التصنيف بنجاح', 'info')
      }
    } catch (err) {
      console.error('Failed to archive category:', err)
      showToast(err instanceof Error ? err.message : 'تعذر أرشفة التصنيف', 'error')
    }
  }

  const handleRestore = async (cat: Category) => {
    if (!user) return
    try {
      await archiveCategory(user.uid, cat.id, false)
      showToast('تمت استعادة التصنيف بنجاح', 'success')
    } catch (err) {
      console.error('Failed to restore category:', err)
      showToast(err instanceof Error ? err.message : 'تعذر استعادة التصنيف', 'error')
    }
  }

  const formatUsageText = (catId: string) => {
    const details = getCategoryUsageDetails(catId, transactions, recurring, usageMap)
    const currentMonthCount = currentMonthTxCounts[catId] || 0

    if (!details.isInUse) {
      return 'لا توجد معاملات مسجلة (غير مستخدم)'
    }

    const parts: string[] = []
    if (currentMonthCount > 0) {
      if (currentMonthCount === 1) parts.push('معاملة واحدة هذا الشهر')
      else if (currentMonthCount === 2) parts.push('معاملتان هذا الشهر')
      else if (currentMonthCount <= 10) parts.push(`${currentMonthCount} معاملات هذا الشهر`)
      else parts.push(`${currentMonthCount} معاملة هذا الشهر`)
    } else if (details.txCount > 0) {
      parts.push(`${details.txCount} معاملة سابقة`)
    }

    if (details.recurringCount > 0) {
      if (details.recurringCount === 1) parts.push('معاملة متكررة مرتبطة')
      else if (details.recurringCount === 2) parts.push('معاملتان متكررتان')
      else parts.push(`${details.recurringCount} معاملات متكررة`)
    }

    return parts.join(' • ')
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
            const usageDetails = getCategoryUsageDetails(cat.id, transactions, recurring, usageMap)

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
                      {formatUsageText(cat.id)}
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
                  {usageDetails.isInUse ? (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-750 text-slate-400 dark:text-slate-500 font-medium select-none"
                      title="لا يمكن حذف التصنيف نهائياً لأنه مرتبط بمعاملات مالية أو متكررة. يمكنك أرشفته بدلاً من ذلك."
                    >
                      مستخدم
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCatToDelete(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      aria-label={`حذف تصنيف ${cat.name} نهائياً`}
                      title="حذف نهائي (غير مستخدم في أي معاملات)"
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
                const usageDetails = getCategoryUsageDetails(cat.id, transactions, recurring, usageMap)
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
                      {usageDetails.isInUse ? (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-medium select-none"
                          title="مرتبط بمعاملات مالية أو متكررة"
                        >
                          مستخدم
                        </span>
                      ) : (
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
        {catToDelete && getCategoryUsageDetails(catToDelete.id, transactions, recurring, usageMap).isInUse ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold mb-1">لا يمكن حذف هذا التصنيف نهائياً!</p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  تصنيف &quot;{catToDelete.name}&quot; مستخدم حالياً في سجلاتك المالية (
                  {formatUsageText(catToDelete.id)}). للحفاظ على دقة الميزانيات والتقارير المحاسبية، يمكنك أرشفته بدلاً من حذفه.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCatToDelete(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  const cat = catToDelete
                  setCatToDelete(null)
                  await handleArchive(cat)
                }}
              >
                أرشفة التصنيف بدلاً من حذفه
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </Modal>
    </div>
  )
}
