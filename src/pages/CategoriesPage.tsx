import React, { useState, useMemo } from 'react'
import {
  LayoutGrid,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { CategoryForm } from '../components/CategoryForm'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useSelectedMonth } from '../hooks/useSelectedMonth'
import { useToast } from '../hooks/useToast'
import { archiveCategory } from '../services/categories'
import { countByCategory } from '../lib/aggregate'
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

  // Transaction count per category for current financial month
  const txCounts = useMemo(() => {
    return countByCategory(transactions)
  }, [transactions])

  // Active categories for the selected type
  const activeCategories = useMemo(() => {
    return categories.filter((c) => c.type === categoryType && !c.archived)
  }, [categories, categoryType])

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

  const formatCount = (count: number) => {
    if (count === 0) return 'لا توجد معاملات هذا الشهر'
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
                      {formatCount(count)}
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
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    aria-label={`أرشفة تصنيف ${cat.name}`}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
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
              {archivedCategories.map((cat) => (
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

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => handleRestore(cat)}
                    className="text-xs shrink-0 font-bold text-emerald-600 dark:text-emerald-400"
                  >
                    استعادة
                  </Button>
                </div>
              ))}
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
    </div>
  )
}
