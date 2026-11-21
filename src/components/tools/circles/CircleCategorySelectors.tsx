import React from 'react'
import { Check } from 'lucide-react'
import { CategoryIcon } from '../../ui/CategoryIcon'
import { cn } from '../../../lib/cn'
import type { Category, MoneyCircle } from '../../../types'

export interface CircleCategorySelectorsProps {
  categories: Category[]
  expenseCategoryId: string
  setExpenseCategoryId: (id: string) => void
  defaultExpenseCategory?: Category
  editingCircle: MoneyCircle | null
  incomeCategoryId: string
  setIncomeCategoryId: (id: string) => void
  defaultIncomeCategory?: Category
}

export const CircleCategorySelectors: React.FC<CircleCategorySelectorsProps> = ({
  categories,
  expenseCategoryId,
  setExpenseCategoryId,
  defaultExpenseCategory,
  editingCircle,
  incomeCategoryId,
  setIncomeCategoryId,
  defaultIncomeCategory,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
          تصنيف أقساط المصاريف
        </label>
        <div className="grid grid-cols-2 gap-2 p-0.5">
          {categories
            .filter(
              (c) =>
                c.type === 'expense' &&
                (!c.archived ||
                  c.id === expenseCategoryId ||
                  (editingCircle && c.id === editingCircle.expenseCategoryId))
            )
            .map((cat) => {
              const activeExpId = expenseCategoryId || defaultExpenseCategory?.id || ''
              const isSelected = activeExpId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setExpenseCategoryId(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none min-w-0',
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 ring-2 ring-blue-600/20'
                      : 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  )}
                >
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  </span>
                  <span className="truncate flex-1">
                    {cat.name}
                    {cat.archived && (
                      <span className="text-[9px] text-zinc-400 ms-1 font-normal">(مؤرشف)</span>
                    )}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </button>
              )
            })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
          تصنيف إيداع الصافي (دخل)
        </label>
        <div className="grid grid-cols-2 gap-2 p-0.5">
          {categories
            .filter(
              (c) =>
                c.type === 'income' &&
                (!c.archived ||
                  c.id === incomeCategoryId ||
                  (editingCircle && c.id === editingCircle.incomeCategoryId))
            )
            .map((cat) => {
              const activeIncId = incomeCategoryId || defaultIncomeCategory?.id || ''
              const isSelected = activeIncId === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setIncomeCategoryId(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer select-none min-w-0',
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950 dark:bg-blue-950/50 dark:text-blue-100 ring-2 ring-blue-600/20'
                      : 'border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  )}
                >
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  </span>
                  <span className="truncate flex-1">
                    {cat.name}
                    {cat.archived && (
                      <span className="text-[9px] text-zinc-400 ms-1 font-normal">(مؤرشف)</span>
                    )}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}
