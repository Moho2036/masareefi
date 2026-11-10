import React, { useState } from 'react'
import { Info } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { SegmentedControl } from './ui/SegmentedControl'
import { CategoryForm } from './CategoryForm'
import { RecurringFrequencySelector } from './recurring/RecurringFrequencySelector'
import { RecurringCategoryPicker } from './recurring/RecurringCategoryPicker'
import { RecurringCircleLinkSection } from './recurring/RecurringCircleLinkSection'
import { RecurringDatesSection } from './recurring/RecurringDatesSection'
import {
  useRecurringFormState,
  type RecurringSubmitPayload,
} from './recurring/useRecurringFormState'
import { toFils } from '../lib/money'
import { toWesternDigits } from '../lib/dates'
import { cn } from '../lib/cn'
import type { Recurring, TxType } from '../types'

export type { RecurringSubmitPayload }

export interface RecurringFormProps {
  isOpen: boolean
  onClose: () => void
  initialRecurring?: Recurring | null
  defaultType?: TxType
  onSuccess?: () => void
  onSubmit?: (payload: RecurringSubmitPayload) => Promise<void> | void
}

interface RecurringFormContentProps {
  initialRecurring?: Recurring | null
  defaultType: TxType
  onClose: () => void
  onSuccess?: () => void
  onSubmit?: (payload: RecurringSubmitPayload) => Promise<void> | void
  onDirtyChange?: (isDirty: boolean) => void
}

const typeOptions: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'دخل' },
]

const RecurringFormContent: React.FC<RecurringFormContentProps> = ({
  initialRecurring,
  defaultType,
  onClose,
  onSuccess,
  onSubmit,
  onDirtyChange,
}) => {
  const {
    type,
    setType,
    amountStr,
    setAmountStr,
    setCategoryId,
    frequency,
    setFrequency,
    startDateStr,
    setStartDateStr,
    hasEndDate,
    setHasEndDate,
    endDateStr,
    setEndDateStr,
    title,
    setTitle,
    note,
    setNote,
    scheduleNextIfPast,
    setScheduleNextIfPast,
    error,
    setError,
    submitting,
    availableCircles,
    circleId,
    skipMonth,
    skipMonths,
    requireConfirmation,
    setRequireConfirmation,
    showExtraDropdown,
    setShowExtraDropdown,
    isCircleLinked,
    hasSelectedCircle,
    isCategoriesExpanded,
    setIsCategoriesExpanded,
    isCreateCatOpen,
    setIsCreateCatOpen,
    categoriesLoading,
    availableCategories,
    activeCategoryId,
    displayedCategories,
    handleCircleChange,
    handleSubmit,
    isEditing,
    currencyConfig,
  } = useRecurringFormState({
    initialRecurring,
    defaultType,
    onClose,
    onSuccess,
    onSubmit,
    onDirtyChange,
  })

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {hasSelectedCircle && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            تاريخ البدء، تاريخ الانتهاء، التكرار الشهري، وشهر الإعفاء يتم ضبطها وإدارتها تلقائياً بناءً على إعدادات الجمعية المالية المختارة
          </span>
        </div>
      )}

      <div>
        <SegmentedControl<TxType>
          value={type}
          onChange={(newType) => {
            setType(newType)
            setCategoryId('')
            setError(null)
          }}
          options={typeOptions}
          disabled={hasSelectedCircle}
          className="w-full"
        />
      </div>

      <div>
        <label
          htmlFor="rec-amount"
          className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1"
        >
          المبلغ
        </label>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border transition-all',
            error && amountStr && toFils(amountStr, currencyConfig.decimals) <= 0
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-[#E4E4E7] dark:border-[#27272A] focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20'
          )}
        >
          <input
            id="rec-amount"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => {
              setAmountStr(toWesternDigits(e.target.value))
              setError(null)
            }}
            placeholder={currencyConfig.decimals === 3 ? '0.000' : '0.00'}
            className="w-full bg-transparent text-2xl lg:text-3xl font-black text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none"
            autoFocus={!isEditing && !isTouchDevice}
          />
          <span className="text-base font-bold text-zinc-500 dark:text-zinc-400 select-none pe-1">
            {currencyConfig.symbol}
          </span>
        </div>
      </div>

      <RecurringCategoryPicker
        categoriesLoading={categoriesLoading}
        availableCategories={availableCategories}
        displayedCategories={displayedCategories}
        activeCategoryId={activeCategoryId}
        isCategoriesExpanded={isCategoriesExpanded}
        onToggleExpand={() => setIsCategoriesExpanded((prev) => !prev)}
        onSelectCategory={(id) => {
          setCategoryId(id)
          setError(null)
        }}
        onOpenCreateCategory={() => setIsCreateCatOpen(true)}
      />

      <div>
        <Input
          type="text"
          label="عنوان المعاملة (اختياري)"
          placeholder="مثال: اشتراك نت، قسط سيارة..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
        />
      </div>

      <RecurringFrequencySelector
        frequency={frequency}
        onChange={setFrequency}
        disabled={hasSelectedCircle}
        showExtraDropdown={showExtraDropdown}
        setShowExtraDropdown={setShowExtraDropdown}
      />

      {type === 'expense' && availableCircles.length > 0 && (
        <RecurringCircleLinkSection
          availableCircles={availableCircles}
          circleId={circleId}
          isCircleLinked={isCircleLinked}
          skipMonth={skipMonth}
          skipMonths={skipMonths}
          onChangeCircle={handleCircleChange}
        />
      )}

      <RecurringDatesSection
        startDateStr={startDateStr}
        setStartDateStr={setStartDateStr}
        hasEndDate={hasEndDate}
        setHasEndDate={setHasEndDate}
        endDateStr={endDateStr}
        setEndDateStr={setEndDateStr}
        scheduleNextIfPast={scheduleNextIfPast}
        setScheduleNextIfPast={setScheduleNextIfPast}
        requireConfirmation={requireConfirmation}
        setRequireConfirmation={setRequireConfirmation}
        note={note}
        setNote={setNote}
        hasSelectedCircle={hasSelectedCircle}
        isEditing={isEditing}
      />

      {error && (
        <div
          role="alert"
          className="p-3 text-start rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-semibold"
        >
          {error}
        </div>
      )}

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
          {submitting ? 'جاري الحفظ...' : isEditing ? 'تعديل المعاملة' : 'حفظ'}
        </Button>
      </div>

      {isCreateCatOpen && (
        <CategoryForm
          isOpen={isCreateCatOpen}
          onClose={() => setIsCreateCatOpen(false)}
          defaultType={type}
          onSuccess={(newCatId, newCatType) => {
            if (newCatId) {
              if (newCatType && newCatType !== type && !isEditing && !hasSelectedCircle) {
                setType(newCatType)
              }
              setCategoryId(newCatId)
            }
            setIsCreateCatOpen(false)
          }}
        />
      )}
    </form>
  )
}

export const RecurringForm: React.FC<RecurringFormProps> = ({
  isOpen,
  onClose,
  initialRecurring,
  defaultType = 'expense',
  onSuccess,
  onSubmit,
}) => {
  const [isDirty, setIsDirty] = useState(false)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRecurring ? 'تعديل المعاملة المتكررة' : 'إضافة معاملة متكررة'}
      closeOnBackdropClick={!isDirty && !initialRecurring}
    >
      <RecurringFormContent
        key={initialRecurring ? `edit-${initialRecurring.id}` : `new-${defaultType}`}
        initialRecurring={initialRecurring}
        defaultType={defaultType}
        onClose={onClose}
        onSuccess={onSuccess}
        onSubmit={onSubmit}
        onDirtyChange={setIsDirty}
      />
    </Modal>
  )
}
