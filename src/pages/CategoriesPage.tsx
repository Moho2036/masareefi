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
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { CategoryForm } from '../components/CategoryForm'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { EmptyState } from '../components/ui/EmptyState'
import { FormattedMoney } from '../components/ui/FormattedMoney'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useToast } from '../hooks/useToast'
import { useCurrency } from '../hooks/useCurrency'
import { useUserSettings } from '../hooks/useUserSettings'
import {
  archiveCategory,
  deleteCategory,
  updateCategory,
  reassignAndDeleteCategory,
} from '../services/categories'
import { useAppData } from '../context/AppDataContext'
import {
  buildUsageFromTransactions,
  syncCategoryUsageCache,
  getCategoryUsageDetails,
  sortCategoriesUnified,
} from '../lib/categoryUsage'
import { triggerHaptic } from '../lib/haptics'
import { cn } from '../lib/cn'
import type { Category, TxType } from '../types'

export const CategoriesPage: React.FC = () => {
  const { user } = useAuth()
  const { data: categories, loading: categoriesLoading } = useCategories()
  const appData = useAppData()
  const recurring = useMemo(() => appData?.recurring ?? [], [appData?.recurring])
  const moneyCircles = useMemo(() => appData?.moneyCircles ?? [], [appData?.moneyCircles])
  const { range } = useSelectedMonth()
  const { data: transactions, loading: txLoading } = useTransactions()
  const { showToast } = useToast()
  const { config: currencyConfig } = useCurrency()
  const { data: userSettings, updateSettings } = useUserSettings()

  const [categoryType, setCategoryType] = useState<TxType>('expense')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false)
  const [catToDelete, setCatToDelete] = useState<Category | null>(null)
  const [deleteMode, setDeleteMode] = useState<'archive' | 'reassign'>('archive')
  const [targetReassignCatId, setTargetReassignCatId] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [lastMovedId, setLastMovedId] = useState<string | null>(null)

  // Transaction count and total spend per category for current financial month
  const currentMonthStats = useMemo(() => {
    const stats: Record<string, { totalFils: number; count: number }> = {}
    const currentMonthTxs = transactions.filter((tx) => {
      const txTime = tx.date instanceof Date ? tx.date.getTime() : new Date(tx.date).getTime()
      return txTime >= range.start.getTime() && txTime < range.end.getTime()
    })
    for (const tx of currentMonthTxs) {
      if (!stats[tx.categoryId]) {
        stats[tx.categoryId] = { totalFils: 0, count: 0 }
      }
      stats[tx.categoryId].totalFils += tx.amountFils
      stats[tx.categoryId].count += 1
    }
    return stats
  }, [transactions, range])

  const currentMonthTxCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [catId, stat] of Object.entries(currentMonthStats)) {
      counts[catId] = stat.count
    }
    return counts
  }, [currentMonthStats])

  // Track category usage frequencies from all-time transactions (Single Source of Truth)
  const usageMap = useMemo(() => {
    return buildUsageFromTransactions(transactions)
  }, [transactions])

  const handleConfirmDelete = async () => {
    if (!user || !catToDelete) return

    // Prevent archiving or deleting the last active category of a type
    if (!catToDelete.archived) {
      const remainingActive = categories.filter(
        (c) => c.type === catToDelete.type && !c.archived
      ).length
      if (remainingActive <= 1) {
        showToast(
          'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.',
          'error'
        )
        setCatToDelete(null)
        return
      }
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

  // Save category usage in localStorage outside render in an effect (synced with all-time transactions)
  useEffect(() => {
    if (!txLoading) {
      syncCategoryUsageCache(transactions)
    }
  }, [transactions, txLoading])

  // Active categories for the selected type, sorted according to userSettings.categorySortMode
  const activeCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === categoryType && !c.archived)
    return sortCategoriesUnified(
      filtered,
      usageMap,
      userSettings?.categorySortMode || 'usage'
    )
  }, [categories, categoryType, usageMap, userSettings?.categorySortMode])

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

  const handleMoveCategory = async (cat: Category, direction: 'up' | 'down') => {
    if (!user) return
    const currentIndex = activeCategories.findIndex((c) => c.id === cat.id)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= activeCategories.length) return

    triggerHaptic('light')
    setLastMovedId(cat.id)
    setTimeout(() => {
      setLastMovedId((current) => (current === cat.id ? null : current))
    }, 600)

    // Auto-switch to manual sort mode when user explicitly moves a category
    if (userSettings?.categorySortMode !== 'manual') {
      try {
        await updateSettings({ categorySortMode: 'manual' })
      } catch (err) {
        console.error('Failed to update sort mode to manual:', err)
      }
    }

    const adjacentCat = activeCategories[targetIndex]
    let currentOrder = cat.order ?? 0
    let adjacentOrder = adjacentCat.order ?? 0

    if (currentOrder === adjacentOrder) {
      if (direction === 'up') {
        adjacentOrder = currentOrder
        currentOrder = currentOrder + 1
      } else {
        adjacentOrder = currentOrder + 1
      }
    }

    try {
      await Promise.all([
        updateCategory(user.uid, cat.id, { order: adjacentOrder }),
        updateCategory(user.uid, adjacentCat.id, { order: currentOrder }),
      ])
    } catch (err) {
      console.error('Failed to reorder category:', err)
      showToast('تعذر تغيير ترتيب التصنيف', 'error')
    }
  }

  const handleArchive = async (cat: Category) => {
    if (!user) return

    // Prevent archiving the last active category of a type
    if (!cat.archived) {
      const remainingActive = categories.filter(
        (c) => c.type === cat.type && !c.archived
      ).length
      if (remainingActive <= 1) {
        showToast(
          'لا يمكن أرشفة أو حذف آخر تصنيف نشط في هذا القسم؛ يجب بقاء تصنيف واحد نشط على الأقل.',
          'error'
        )
        return
      }
    }

    try {
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
          'تمت الأرشفة، مع العلم أن هذا التصنيف مستخدم في معاملات متكررة وجمعيات نشطة',
          'info'
        )
      } else if (isUsedInActiveRecurring) {
        showToast('تمت الأرشفة، مع العلم أن هذا التصنيف مستخدم في معاملات متكررة نشطة', 'info')
      } else if (isUsedInActiveCircle) {
        showToast('تمت الأرشفة، مع العلم أن هذا التصنيف مستخدم في جمعية مالية نشطة', 'info')
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
    const details = getCategoryUsageDetails(catId, transactions, recurring, usageMap, moneyCircles)
    const currentMonthCount = currentMonthTxCounts[catId] || 0

    if (!details.isInUse) {
      return 'غير مستخدم'
    }

    const parts: string[] = []
    if (currentMonthCount > 0) {
      if (currentMonthCount === 1) parts.push('معاملة واحدة هذا الشهر')
      else if (currentMonthCount === 2) parts.push('معاملتان هذا الشهر')
      else if (currentMonthCount <= 10) parts.push(`${currentMonthCount} معاملات هذا الشهر`)
      else parts.push(`${currentMonthCount} معاملة هذا الشهر`)
    } else if (details.txCount > 0) {
      if (details.txCount === 1) parts.push('معاملة واحدة سابقة')
      else if (details.txCount === 2) parts.push('معاملتان سابقتان')
      else if (details.txCount <= 10) parts.push(`${details.txCount} معاملات سابقة`)
      else parts.push(`${details.txCount} معاملة سابقة`)
    }

    if (details.recurringCount > 0) {
      if (details.recurringCount === 1) parts.push('معاملة متكررة مرتبطة')
      else if (details.recurringCount === 2) parts.push('معاملتان متكررتان')
      else parts.push(`${details.recurringCount} معاملات متكررة`)
    }

    if (details.circlesCount > 0) {
      if (details.circlesCount === 1) parts.push('جمعية مالية مرتبطة')
      else if (details.circlesCount === 2) parts.push('جمعيتان ماليتان')
      else parts.push(`${details.circlesCount} جمعيات مالية`)
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

      {/* Tabs: المصاريف / المداخيل & Sort Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
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
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
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

      {/* Active Categories Grid */}
      {categoriesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 bg-white dark:bg-[#121215] rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] animate-pulse"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {activeCategories.map((cat, index) => {
            return (
              <div
                key={cat.id}
                className={cn(
                  'group bg-white dark:bg-[#121215] rounded-2xl p-5 border border-[#E4E4E7] dark:border-[#27272A] shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between',
                  lastMovedId === cat.id && 'ring-2 ring-blue-500/70 scale-[1.02] shadow-md z-10'
                )}
              >
                {/* Card Top: Icon & Details */}
                <div className="flex items-start gap-3.5 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                  >
                    <CategoryIcon icon={cat.icon} color={cat.color} size="lg" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate">
                      {cat.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {currentMonthStats[cat.id]?.count > 0 ? (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <FormattedMoney
                            amountFils={currentMonthStats[cat.id].totalFils}
                            currencyCode={currencyConfig.code}
                            className="font-bold text-slate-800 dark:text-slate-100"
                          />
                          <span>•</span>
                          <span>
                            {currentMonthStats[cat.id].count === 1
                              ? 'معاملة واحدة هذا الشهر'
                              : currentMonthStats[cat.id].count === 2
                                ? 'معاملتان هذا الشهر'
                                : currentMonthStats[cat.id].count <= 10
                                  ? `${currentMonthStats[cat.id].count} معاملات هذا الشهر`
                                  : `${currentMonthStats[cat.id].count} معاملة هذا الشهر`}
                          </span>
                        </span>
                      ) : (
                        <span>{formatUsageText(cat.id)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Action buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/60">
                  {/* Reorder Buttons (Up / Down) */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveCategory(cat, 'up')}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                      aria-label={`تحريك تصنيف ${cat.name} للأعلى`}
                      title="تحريك للأعلى"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCategory(cat, 'down')}
                      disabled={index === activeCategories.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                      aria-label={`تحريك تصنيف ${cat.name} للأسفل`}
                      title="تحريك للأسفل"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Actions: Edit, Archive, Delete */}
                  <div className="flex items-center gap-1">
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
                    <button
                      type="button"
                      onClick={() => {
                        setCatToDelete(cat)
                        setDeleteMode('archive')
                        const otherCats = categories.filter(
                          (c) => c.type === cat.type && c.id !== cat.id && !c.archived
                        )
                        setTargetReassignCatId(otherCats[0]?.id || '')
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      aria-label={`حذف تصنيف ${cat.name}`}
                      title="حذف التصنيف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                return (
                  <div
                    key={cat.id}
                    className="bg-slate-50 dark:bg-slate-850/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 opacity-80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon icon={cat.icon} color={cat.color} size="md" />
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
                      <button
                        type="button"
                        onClick={() => {
                          setCatToDelete(cat)
                          setDeleteMode('archive')
                          const otherCats = categories.filter(
                            (c) => c.type === cat.type && c.id !== cat.id && !c.archived
                          )
                          setTargetReassignCatId(otherCats[0]?.id || '')
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        aria-label={`حذف تصنيف ${cat.name} نهائياً`}
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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

      {/* Smart Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(catToDelete)}
        onClose={() => {
          if (!isDeleting) setCatToDelete(null)
        }}
        title="تأكيد حذف أو أرشفة التصنيف"
      >
        {catToDelete && (
          (() => {
            const usageDetails = getCategoryUsageDetails(
              catToDelete.id,
              transactions,
              recurring,
              usageMap,
              moneyCircles
            )
            const otherActiveCats = categories.filter(
              (c) => c.type === catToDelete.type && c.id !== catToDelete.id && !c.archived
            )

            if (usageDetails.isInUse) {
              return (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div className="text-xs sm:text-sm">
                      <p className="font-bold mb-1">
                        هذا التصنيف مرتبط بسجلات مالية حالية ({formatUsageText(catToDelete.id)})
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                        لحماية دقة تقاريرك، يمكنك إما <strong>أرشفة التصنيف</strong> (لإخفائه من شاشات الإضافة مع حفظ التاريخ)، أو <strong>نقل كافة السجلات المرتبطة به</strong> إلى تصنيف بديل ثم حذفه نهائياً.
                      </p>
                    </div>
                  </div>

                  {/* Choice Selector: أرشفة أو نقل وحذف */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                      اختر الإجراء المطلوب:
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <label
                        className={cn(
                          'flex items-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer transition-all',
                          deleteMode === 'archive'
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <input
                          type="radio"
                          name="delete-action"
                          checked={deleteMode === 'archive'}
                          onChange={() => setDeleteMode('archive')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="min-w-0">
                          <div className="font-bold">أرشفة التصنيف (مستحسن)</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                            إخفاء التصنيف من شاشات الإضافة مع الإبقاء على كافة المعاملات والتقارير التاريخية دون أي تعديل.
                          </div>
                        </div>
                      </label>

                      <label
                        className={cn(
                          'flex items-center gap-2.5 p-3 rounded-xl border text-xs sm:text-sm font-semibold cursor-pointer transition-all',
                          deleteMode === 'reassign'
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <input
                          type="radio"
                          name="delete-action"
                          checked={deleteMode === 'reassign'}
                          onChange={() => setDeleteMode('reassign')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="min-w-0">
                          <div className="font-bold">نقل كافة السجلات إلى تصنيف آخر وحذفه نهائياً</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                            ترحيل جميع المعاملات والمتكررة والجمعيات المرتبطة به إلى تصنيف نشط آخر ثم حذف هذا التصنيف.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* If Reassign mode: choose target category */}
                  {deleteMode === 'reassign' && (
                    <div className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                        التصنيف البديل لنقل السجلات إليه:
                      </label>
                      {otherActiveCats.length === 0 ? (
                        <div className="text-xs text-red-500 font-semibold p-2">
                          لا توجد تصنيفات نشطة أخرى من نفس النوع لنقل السجلات إليها. يجب إضافة تصنيف نشط أولاً.
                        </div>
                      ) : (
                        <select
                          value={targetReassignCatId}
                          onChange={(e) => setTargetReassignCatId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
                        >
                          {otherActiveCats.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => setCatToDelete(null)}
                      disabled={isDeleting}
                    >
                      إلغاء
                    </Button>
                    {deleteMode === 'archive' ? (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={async () => {
                          const cat = catToDelete
                          setCatToDelete(null)
                          await handleArchive(cat)
                        }}
                        disabled={isDeleting}
                      >
                        أرشفة التصنيف
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="md"
                        onClick={handleReassignAndDelete}
                        disabled={isDeleting || otherActiveCats.length === 0 || !targetReassignCatId}
                      >
                        {isDeleting ? 'جاري نقل السجلات...' : 'نقل السجلات وحذف التصنيف'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            }

            // Normal delete for un-used category
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-semibold">
                    هل أنت متأكد من حذف تصنيف &quot;{catToDelete.name}&quot; نهائياً؟ هذا التصنيف غير مرتبط بأي معاملات، ولا يمكن التراجع عن الحذف.
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
            )
          })()
        )}
      </Modal>
    </div>
  )
}
