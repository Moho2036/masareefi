import React, { useState } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { SegmentedControl } from './ui/SegmentedControl'
import { CategoryIcon } from './ui/CategoryIcon'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useToast } from '../hooks/useToast'
import { addCategory, updateCategory } from '../services/categories'
import { triggerHaptic } from '../lib/haptics'
import { getCategoryLucideIcon } from '../lib/categoryIcons'
import { cn } from '../lib/cn'
import type { Category, TxType } from '../types'

export interface CategoryFormProps {
  isOpen: boolean
  onClose: () => void
  initialCategory?: Category | null
  defaultType?: TxType
  onSuccess?: (newCategoryId?: string, newCategoryType?: TxType) => void
}

const COMMON_EMOJIS = [
  '🛒', '☕', '⛽', '🏠', '💡', '📱', '💊', '👕', '🎮', '📚',
  '🔁', '🎁', '➕', '🍔', '🚗', '✈️', '🎬', '🏋️', '🏥', '👶',
  '🐕', '🛠️', '🧾', '💳', '✂️', '💼', '💻', '📈', '💰', '🪙',
]

const PALETTE_COLORS = [
  '#F59E0B', '#EA580C', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1',
  '#3B82F6', '#06B6D4', '#14B8A6', '#10B981', '#059669', '#64748B',
]

interface CategoryFormContentProps {
  initialCategory?: Category | null
  defaultType: TxType
  onClose: () => void
  onSuccess?: (newCategoryId?: string, newCategoryType?: TxType) => void
}

const CategoryFormContent: React.FC<CategoryFormContentProps> = ({
  initialCategory,
  defaultType,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const { showToast } = useToast()

  const isEditing = Boolean(initialCategory)

  const [type, setType] = useState<TxType>(
    initialCategory ? initialCategory.type : defaultType
  )
  const [name, setName] = useState<string>(initialCategory?.name ?? '')
  const [icon, setIcon] = useState<string>(
    initialCategory?.icon ?? (defaultType === 'income' ? '💼' : '🛒')
  )
  const [color, setColor] = useState<string>(
    initialCategory?.color ?? (defaultType === 'income' ? '#10B981' : '#F59E0B')
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user) {
      setError('يجب تسجيل الدخول أولاً')
      return
    }

    const trimmedName = name.trim().slice(0, 40)
    if (!trimmedName) {
      setError('يرجى إدخال اسم التصنيف')
      return
    }

    const duplicateCat = categories.find(
      (c) =>
        c.type === type &&
        c.name.trim() === trimmedName &&
        (!isEditing || c.id !== initialCategory?.id)
    )

    if (duplicateCat) {
      if (duplicateCat.archived) {
        setError(
          'يوجد تصنيف مؤرشف بنفس الاسم والنوع. يمكنك استعادته من قسم التصنيفات المؤرشفة بدلاً من تكراره.'
        )
      } else {
        setError('يوجد تصنيف آخر بنفس الاسم والنوع بالفعل.')
      }
      return
    }

    const trimmedIcon = (icon.trim() || '📁').slice(0, 16)

    setSubmitting(true)
    try {
      if (isEditing && initialCategory) {
        await updateCategory(user.uid, initialCategory.id, {
          name: trimmedName,
          icon: trimmedIcon,
          color,
        })
        triggerHaptic('light')
        showToast('تم تعديل التصنيف بنجاح', 'success')
        onSuccess?.(initialCategory.id, initialCategory.type)
      } else {
        const maxOrder = categories.reduce(
          (max, c) => Math.max(max, c.order ?? 0),
          -1
        )
        const order = maxOrder + 1

        const newCatId = await addCategory(user.uid, {
          name: trimmedName,
          type,
          icon: trimmedIcon,
          color,
          archived: false,
          order,
        })
        triggerHaptic('light')
        showToast('تمت إضافة التصنيف بنجاح', 'success')
        onSuccess?.(newCatId, type)
      }

      onClose()
    } catch (err) {
      console.error('Failed to save category:', err)
      setError('تعذر حفظ التصنيف. يرجى المحاولة مجدداً.')
    } finally {
      setSubmitting(false)
    }
  }

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0))

  const isMappedIcon = Boolean(getCategoryLucideIcon(icon))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Type toggle (locked when editing) */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
          نوع التصنيف
        </label>
        {isEditing ? (
          <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            {type === 'expense' ? 'مصروف' : 'دخل'} (لا يمكن تغيير نوع التصنيف بعد إنشائه)
          </div>
        ) : (
          <SegmentedControl<TxType>
            value={type}
            onChange={(newType) => {
              setType(newType)
              if (icon === '🛒' || icon === '💼') {
                setIcon(newType === 'income' ? '💼' : '🛒')
              }
              if (color === '#F59E0B' || color === '#10B981') {
                setColor(newType === 'income' ? '#10B981' : '#F59E0B')
              }
            }}
            options={[
              { value: 'expense', label: 'مصروف' },
              { value: 'income', label: 'دخل' },
            ]}
            className="w-full"
          />
        )}
      </div>

      {/* Name input */}
      <div>
        <Input
          label="اسم التصنيف"
          placeholder="مثال: بقالة، ترفيه، وقود..."
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          maxLength={40}
          required
          autoFocus={!isTouchDevice}
        />
      </div>

      {/* Selected preview & Emoji quick-picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            الأيقونة واللون
          </label>
          {/* Visual preview pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs"
              style={{ backgroundColor: `${color}1F` }}
            >
              <CategoryIcon icon={icon} color={color} size="sm" />
            </span>
            <span>{name || 'معاينة'}</span>
          </div>
        </div>

        {/* Quick-pick Emojis Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 p-2.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] max-h-36 overflow-y-auto mb-2">
          {COMMON_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setIcon(em)}
              className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer select-none',
                icon === em && 'bg-blue-50 dark:bg-blue-950/60 ring-2 ring-blue-600'
              )}
            >
              <CategoryIcon icon={em} size="sm" />
            </button>
          ))}
        </div>

        {/* Custom Emoji Input */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 flex items-center">
            {isMappedIcon && (
              <div className="absolute inset-0 pointer-events-none flex items-center gap-2 px-3">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}1F` }}
                >
                  <CategoryIcon icon={icon} color={color} size="sm" />
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-medium">
                  أيقونة خطية مختارة (أو اكتب إيموجي مخصص...)
                </span>
              </div>
            )}
            <input
              type="text"
              value={icon}
              onChange={(e) => {
                const val = e.target.value.trim()
                if (!val) {
                  setIcon('')
                  return
                }
                const segments: string[] =
                  typeof Intl !== 'undefined' && 'Segmenter' in Intl
                    ? Array.from(
                        new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(val),
                        (s) => s.segment
                      )
                    : Array.from(val)

                if (segments.length === 0) {
                  setIcon('')
                  return
                }

                let chosen: string
                if (segments.length > 1) {
                  const newSegment = segments.find((s) => s !== icon)
                  chosen = newSegment ?? segments[segments.length - 1]
                } else {
                  chosen = segments[0]
                }

                setIcon(chosen.slice(0, 16))
              }}
              placeholder="أو اكتب/الصق إيموجي مخصص..."
              className={cn(
                'w-full px-3 py-1.5 text-xs rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-zinc-800 placeholder:text-zinc-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all',
                isMappedIcon
                  ? 'text-transparent caret-zinc-900 dark:caret-zinc-100'
                  : 'text-zinc-800 dark:text-zinc-100'
              )}
              maxLength={30}
            />
          </div>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0 font-medium">
            إيموجي مخصص
          </span>
        </div>

        {/* Color Palette */}
        <div className="flex items-center justify-between gap-1 p-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] overflow-x-auto">
          {PALETTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={cn(
                'w-6 h-6 rounded-full shrink-0 transition-transform cursor-pointer',
                color === c
                  ? 'ring-2 ring-offset-2 ring-zinc-800 dark:ring-zinc-100 scale-110'
                  : 'hover:scale-105'
              )}
              aria-label={`اختيار اللون ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 text-start rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
        >
          {submitting ? 'جاري الحفظ...' : isEditing ? 'تعديل التصنيف' : 'حفظ التصنيف'}
        </Button>
      </div>
    </form>
  )
}

export const CategoryForm: React.FC<CategoryFormProps> = ({
  isOpen,
  onClose,
  initialCategory,
  defaultType = 'expense',
  onSuccess,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
    >
      <CategoryFormContent
        key={initialCategory ? `edit-${initialCategory.id}` : `new-${defaultType}`}
        initialCategory={initialCategory}
        defaultType={defaultType}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}
