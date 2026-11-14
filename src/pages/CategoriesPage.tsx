import React, { useState, useMemo, useEffect } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { CategoryForm } from '../components/CategoryForm'
import { EmptyState } from '../components/ui/EmptyState'
import { CategoryItemRow } from '../components/categories/CategoryItemRow'
import { ArchivedCategoriesSection } from '../components/categories/ArchivedCategoriesSection'
import { ArchiveCategoryModal } from '../components/categories/ArchiveCategoryModal'
import { DeleteCategoryModal } from '../components/categories/DeleteCategoryModal'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useToast } from '../hooks/useToast'
import { useCurrency } from '../hooks/useCurrency'
import { useUserSettings } from '../hooks/useUserSettings'
import {
  archiveCategory,
  deleteCategory,
  reassignAndDeleteCategory,
  reorderCategories,
} from '../services/categories'
import { useAppData } from '../context/AppDataContext'
import {
  buildUsageFromTransactions,
  syncCategoryUsageCache,
  sortCategoriesUnified,
} from '../lib/categoryUsage'
import {
  calculateCategoryMonthStats,
  calculateCategoryUsageDetails,
  getLinkedCommitmentsText,
  formatUsageText,
  EMPTY_USAGE_DETAILS,
} from '../components/categories/categoryUsageHelpers'
import { getFinancialMonthRange } from '../lib/dates'
import { triggerHaptic } from '../lib/haptics'
import type { Category, TxType } from '../types'

export const CategoriesPage: React.FC<{ referenceDate?: Date }> = ({ referenceDate }) => {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const appData = useAppData()
  const recurring = useMemo(() => appData?.recurring ?? [], [appData?.recurring])
  const moneyCircles = useMemo(() => appData?.moneyCircles ?? [], [appData?.moneyCircles])
  const { data: transactions, loading: txLoading } = useTransactions()
  const { showToast } = useToast()
  const { config: currencyConfig } = useCurrency()
  const { data: userSettings, updateSettings } = useUserSettings()

  const [categoryType, setCategoryType] = useState<TxType>('expense')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false)
  const [catToArchive, setCatToArchive] = useState<Category | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [catToDelete, setCatToDelete] = useState<Category | null>(null)
  const [deleteMode, setDeleteMode] = useState<'archive' | 'reassign'>('archive')
  const [targetReassignCatId, setTargetReassignCatId] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [lastMovedId, setLastMovedId] = useState<string | null>(null)

  const monthStartDay = userSettings?.monthStartDay ?? 1
  const currentFinancialRange = useMemo(() => {
    return getFinancialMonthRange(referenceDate ?? new Date(), monthStartDay)
  }, [referenceDate, monthStartDay])

  const currentMonthStats = useMemo(() => {
    return calculateCategoryMonthStats(transactions, currentFinancialRange)
  }, [transactions, currentFinancialRange])

  const currentMonthTxCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [catId, stat] of Object.entries(currentMonthStats)) {
      counts[catId] = stat.count
    }
    return counts
  }, [currentMonthStats])

  const usageMap = useMemo(() => {
    return buildUsageFromTransactions(transactions)
  }, [transactions])

  const usageDetailsByCategory = useMemo(() => {
    return calculateCategoryUsageDetails(categories, usageMap, recurring, moneyCircles)
  }, [categories, usageMap, recurring, moneyCircles])

  const canArchiveOrDelete = (cat: Category): boolean => {
    if (cat.archived) return true
    const remainingActive = categories.filter((c) => c.type === cat.type && !c.archived).length
    if (remainingActive <= 1) {
      showToast('لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.', 'error')
      return false
    }
    return true
  }

  const handleConfirmDelete = async () => {
    if (!user || !catToDelete) return
    if (!canArchiveOrDelete(catToDelete)) {
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

  const handleReassignAndDelete = async () => {
    if (!user || !catToDelete) return
    if (!targetReassignCatId) {
      showToast('يرجى اختيار التصنيف البديل لنقل السجلات إليه', 'error')
      return
    }

    setIsDeleting(true)
    try {
      await reassignAndDeleteCategory(user.uid, catToDelete.id, targetReassignCatId)
      showToast('تم نقل كافة السجلات وحذف التصنيف نهائياً بنجاح', 'success')
      setCatToDelete(null)
    } catch (err) {
      console.error('Failed to reassign and delete category:', err)
      showToast(err instanceof Error ? err.message : 'تعذر نقل السجلات وحذف التصنيف', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (!txLoading) {
      syncCategoryUsageCache(transactions)
    }
  }, [transactions, txLoading])

  const activeCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === categoryType && !c.archived)
    return sortCategoriesUnified(
      filtered,
      usageMap,
      userSettings?.categorySortMode || 'usage'
    )
  }, [categories, categoryType, usageMap, userSettings?.categorySortMode])

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

  const handleMoveCategory = async (cat: Category, direction: 'up' | 'down') => {
    if (!user) return
    const currentIndex = activeCategories.findIndex((c) => c.id === cat.id)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= activeCategories.length) return

    triggerHaptic('tick')
    setLastMovedId(cat.id)
    setTimeout(() => {
      setLastMovedId((current) => (current === cat.id ? null : current))
    }, 600)

    if (userSettings?.categorySortMode !== 'manual') {
      try {
        await updateSettings({ categorySortMode: 'manual' })
      } catch (err) {
        console.error('Failed to update sort mode to manual:', err)
      }
    }

    const reordered = [...activeCategories]
    const temp = reordered[currentIndex]
    reordered[currentIndex] = reordered[targetIndex]
    reordered[targetIndex] = temp

    try {
      await reorderCategories(user.uid, reordered.map((item) => item.id))
    } catch (err) {
      console.error('Failed to reorder category:', err)
      showToast('تعذر تغيير ترتيب التصنيف', 'error')
    }
  }

  const handleRequestArchive = (cat: Category) => {
    if (!user || !canArchiveOrDelete(cat)) return
    setCatToArchive(cat)
  }

  const handleArchive = async (cat: Category) => {
    if (!user || !canArchiveOrDelete(cat)) return

    try {
      setIsArchiving(true)
      const isUsedInActiveRecurring = recurring.some(
        (r) => (r.active !== false) && r.categoryId === cat.id
      )
      const isUsedInActiveCircle = moneyCircles.some(
        (c) =>
          c.status === 'active' &&
          (c.expenseCategoryId === cat.id ||
            c.incomeCategoryId === cat.id ||
            c.categoryId === cat.id)
      )

      await archiveCategory(user.uid, cat.id, true)
      if (isUsedInActiveRecurring && isUsedInActiveCircle) {
        showToast(
          'تمت أرشفة التصنيف. تنبيه: لا يزال هذا التصنيف مستخدماً في معاملات متكررة وجمعيات نشطة.',
          'info'
        )
      } else if (isUsedInActiveRecurring) {
        showToast(
          'تمت أرشفة التصنيف. تنبيه: لا يزال هذا التصنيف مستخدماً في معاملات متكررة نشطة.',
          'info'
        )
      } else if (isUsedInActiveCircle) {
        showToast(
          'تمت أرشفة التصنيف. تنبيه: لا يزال هذا التصنيف مستخدماً في جمعية مالية نشطة.',
          'info'
        )
      } else {
        showToast('تمت أرشفة التصنيف بنجاح', 'info')
      }
    } catch (err) {
      console.error('Failed to archive category:', err)
      showToast(err instanceof Error ? err.message : 'تعذر أرشفة التصنيف', 'error')
    } finally {
      setIsArchiving(false)
      setCatToArchive(null)
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

  const getLinkedText = (catId: string) => getLinkedCommitmentsText(catId, usageDetailsByCategory)
  const getUsageText = (catId: string) => formatUsageText(catId, usageDetailsByCategory, currentMonthTxCounts)

  return (
    <div className="space-y-6">
      <PageHeader
        title="التصنيفات"
        subtitle="إدارة تصنيفات المصاريف والمداخيل وتخصيص الأيقونات والألوان"
        actions={
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            onClick={handleOpenAdd}
            className="font-semibold"
          >
            تصنيف جديد
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <SegmentedControl<TxType>
          value={categoryType}
          onChange={setCategoryType}
          options={[
            { value: 'expense', label: 'المصاريف' },
            { value: 'income', label: 'المداخيل' },
          ]}
          className="w-full sm:w-64"
        />

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            الترتيب:
          </span>
          <SegmentedControl<'usage' | 'manual'>
            value={userSettings?.categorySortMode || 'usage'}
            onChange={(mode) => {
              updateSettings({ categorySortMode: mode })
            }}
            options={[
              { value: 'usage', label: 'تلقائي (الاستخدام)' },
              { value: 'manual', label: 'يدوي (مخصص)' },
            ]}
            className="text-xs"
          />
        </div>
      </div>

      {categoriesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none animate-pulse"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeCategories.map((cat, index) => (
            <CategoryItemRow
              key={cat.id}
              cat={cat}
              index={index}
              totalCount={activeCategories.length}
              isManualSort={userSettings?.categorySortMode === 'manual'}
              currencyCode={currencyConfig.code}
              currentMonthStats={currentMonthStats[cat.id]}
              linkedCommitmentsText={getLinkedText(cat.id)}
              usageText={getUsageText(cat.id)}
              isLastMoved={lastMovedId === cat.id}
              onMove={handleMoveCategory}
              onEdit={handleOpenEdit}
              onArchive={handleRequestArchive}
              onDelete={(c) => {
                setCatToDelete(c)
                setDeleteMode('archive')
                const otherCats = categories.filter(
                  (other) => other.type === c.type && other.id !== c.id && !other.archived
                )
                setTargetReassignCatId(otherCats[0]?.id || '')
              }}
            />
          ))}
        </div>
      )}

      <ArchivedCategoriesSection
        archivedCategories={archivedCategories}
        isArchivedExpanded={isArchivedExpanded}
        onToggleExpand={() => setIsArchivedExpanded((prev) => !prev)}
        onRestore={handleRestore}
        onEdit={handleOpenEdit}
        onDelete={(c) => {
          setCatToDelete(c)
          setDeleteMode('reassign')
          const otherCats = categories.filter(
            (other) => other.type === c.type && other.id !== c.id && !other.archived
          )
          setTargetReassignCatId(otherCats[0]?.id || '')
        }}
      />

      <CategoryForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialCategory={editingCategory}
        defaultType={categoryType}
      />

      <ArchiveCategoryModal
        catToArchive={catToArchive}
        onClose={() => {
          if (!isArchiving) setCatToArchive(null)
        }}
        onConfirm={handleArchive}
        isArchiving={isArchiving}
        linkedCommitmentsText={catToArchive ? getLinkedText(catToArchive.id) : null}
      />

      <DeleteCategoryModal
        catToDelete={catToDelete}
        onClose={() => {
          if (!isDeleting) setCatToDelete(null)
        }}
        categories={categories}
        usageDetails={catToDelete ? usageDetailsByCategory[catToDelete.id] || EMPTY_USAGE_DETAILS : EMPTY_USAGE_DETAILS}
        usageText={catToDelete ? getUsageText(catToDelete.id) : ''}
        deleteMode={deleteMode}
        setDeleteMode={setDeleteMode}
        targetReassignCatId={targetReassignCatId}
        setTargetReassignCatId={setTargetReassignCatId}
        isDeleting={isDeleting}
        onConfirmDelete={handleConfirmDelete}
        onReassignAndDelete={handleReassignAndDelete}
        onArchive={async (cat) => {
          setCatToDelete(null)
          await handleArchive(cat)
        }}
      />
    </div>
  )
}
