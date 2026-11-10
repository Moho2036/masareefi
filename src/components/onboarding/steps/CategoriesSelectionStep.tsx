import React, { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { addCategory } from '../../../services/categories'
import type { Category } from '../../../types'

export interface CategoriesSelectionStepProps {
  uid?: string
  activeCategories: Category[]
  deselectedCategoryIds: string[]
  onToggleCategory: (cat: Category) => void
  categoryWarning: string | null
}

export const CategoriesSelectionStep: React.FC<CategoriesSelectionStepProps> = ({
  uid,
  activeCategories,
  deselectedCategoryIds,
  onToggleCategory,
  categoryWarning,
}) => {
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false)
  const [newCatName, setNewCatName] = useState<string>('')
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense')
  const [newCatColor, setNewCatColor] = useState<string>('#2563eb')
  const [creatingCategory, setCreatingCategory] = useState<boolean>(false)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div>
        <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
          اختر التصنيفات التي تهمك
        </h3>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          انقر على التصنيف لإلغائه أو تفعيله (سيتم أرشفة غير المحدد تلقائياً ويمكنك استعادته في أي وقت).
        </p>
      </div>

      {categoryWarning && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
          {categoryWarning}
        </div>
      )}

      <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
        {activeCategories.map((cat) => {
          const isSelected = !deselectedCategoryIds.includes(cat.id)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggleCategory(cat)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 opacity-60'
              }`}
            >
              <CategoryIcon icon={cat.icon} color={isSelected ? cat.color : undefined} size="sm" />
              <span>{cat.name}</span>
              {isSelected ? (
                <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : (
                <X className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* Add Custom Category Form */}
      {!showAddCategory ? (
        <button
          type="button"
          onClick={() => setShowAddCategory(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
        >
          <span>+ تصنيف مخصص</span>
        </button>
      ) : (
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">إضافة تصنيف جديد</span>
            <button
              type="button"
              onClick={() => {
                setShowAddCategory(false)
                setNewCatName('')
              }}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
            >
              إلغاء
            </button>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="اسم التصنيف (مثال: صالة رياضية)"
              className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewCatType('expense')}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold border cursor-pointer ${
                  newCatType === 'expense'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                مصروف
              </button>
              <button
                type="button"
                onClick={() => setNewCatType('income')}
                className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold border cursor-pointer ${
                  newCatType === 'income'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                دخل
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCatColor(c)}
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                    newCatColor === c ? 'border-zinc-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              disabled={!newCatName.trim() || creatingCategory}
              onClick={async () => {
                if (!uid || !newCatName.trim()) return
                setCreatingCategory(true)
                try {
                  await addCategory(uid, {
                    name: newCatName.trim(),
                    type: newCatType,
                    icon: newCatType === 'expense' ? 'tag' : 'wallet',
                    color: newCatColor,
                    archived: false,
                    order: activeCategories.length + 1,
                  })
                  setNewCatName('')
                  setShowAddCategory(false)
                } catch (err) {
                  console.error('Failed to add category:', err)
                } finally {
                  setCreatingCategory(false)
                }
              }}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {creatingCategory ? 'جاري الإضافة...' : 'حفظ التصنيف'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
