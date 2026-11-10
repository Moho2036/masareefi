import React from 'react'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import { Input } from '../ui/Input'
import { DatePickerInput } from '../ui/DatePickerInput'
import { Toggle } from '../ui/Toggle'
import { parseLocalDateInput } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Frequency } from '../../types'

export interface TransactionDetailsSectionProps {
  dateStr: string
  onDateChange: (val: string) => void
  isLockedTransaction: boolean
  isBrowsingDifferentMonth: boolean
  rangeStartFormatted: string
  title: string
  onTitleChange: (val: string) => void
  titleSuggestions: { title: string; categoryId?: string }[]
  onSelectTitleSuggestion: (suggestion: { title: string; categoryId?: string }) => void
  showNoteField: boolean
  onShowNoteField: () => void
  onHideNoteField: () => void
  note: string
  onNoteChange: (val: string) => void
  isEditing: boolean
  isRecurring: boolean
  onRecurringChange: (val: boolean) => void
  recurringFrequency: Frequency
  onRecurringFrequencyChange: (f: Frequency) => void
  showExtraFrequencyDropdown: boolean
  onToggleExtraFrequencyDropdown: () => void
  onCloseExtraFrequencyDropdown: () => void
  hasEndDate: boolean
  onHasEndDateChange: (val: boolean) => void
  endDateStr: string
  onEndDateChange: (val: string) => void
  scheduleNextIfPast: boolean
  onScheduleNextIfPastChange: (val: boolean) => void
}

export const TransactionDetailsSection: React.FC<TransactionDetailsSectionProps> = ({
  dateStr,
  onDateChange,
  isLockedTransaction,
  isBrowsingDifferentMonth,
  rangeStartFormatted,
  title,
  onTitleChange,
  titleSuggestions,
  onSelectTitleSuggestion,
  showNoteField,
  onShowNoteField,
  onHideNoteField,
  note,
  onNoteChange,
  isEditing,
  isRecurring,
  onRecurringChange,
  recurringFrequency,
  onRecurringFrequencyChange,
  showExtraFrequencyDropdown,
  onToggleExtraFrequencyDropdown,
  onCloseExtraFrequencyDropdown,
  hasEndDate,
  onHasEndDateChange,
  endDateStr,
  onEndDateChange,
  scheduleNextIfPast,
  onScheduleNextIfPastChange,
}) => {
  return (
    <div className="space-y-3.5">
      {/* Date Picker */}
      <div>
        <DatePickerInput
          id="tx-date"
          label="التاريخ"
          value={dateStr}
          onChange={(val) => {
            if (isLockedTransaction) return
            onDateChange(val)
          }}
          required
          disabled={isLockedTransaction}
          readOnly={isLockedTransaction}
          showQuickButtons
        />
        {isBrowsingDifferentMonth && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              تم ضبط التاريخ تلقائياً على بداية الشهر المالي المتصفح حالياً ({rangeStartFormatted})
            </span>
          </p>
        )}
      </div>

      {/* Description / Title Input */}
      <div>
        <Input
          type="text"
          label="الوصف / العنوان (اختياري)"
          placeholder="مثال: فاتورة كهرباء، مشتريات تموينية..."
          value={title}
          onChange={(e) => {
            if (isLockedTransaction) return
            onTitleChange(e.target.value)
          }}
          maxLength={100}
          disabled={isLockedTransaction}
          readOnly={isLockedTransaction}
        />
        {titleSuggestions.length > 0 && !isLockedTransaction && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 px-0.5">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium select-none">
              اقتراحات سريعة:
            </span>
            {titleSuggestions.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => onSelectTitleSuggestion(s)}
                className="text-[11px] px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 border border-[#E4E4E7] dark:border-[#27272A] transition-colors cursor-pointer"
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Note and Recurring Section */}
      {!showNoteField && !isLockedTransaction ? (
        !isEditing ? (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onShowNoteField}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>+ إضافة ملاحظة تفصيلية</span>
            </button>
            <Toggle
              checked={isRecurring}
              onChange={onRecurringChange}
              label="جعلها معاملة متكررة"
              className="gap-2.5"
            />
          </div>
        ) : (
          <div className="pt-1">
            <button
              type="button"
              onClick={onShowNoteField}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>+ إضافة ملاحظة تفصيلية</span>
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
                ملاحظة تفصيلية (اختياري)
              </label>
              {!note.trim() && (
                <button
                  type="button"
                  onClick={onHideNoteField}
                  className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  طي
                </button>
              )}
            </div>
            <Input
              type="text"
              placeholder="مثال: غداء مع الأصدقاء"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              maxLength={500}
            />
          </div>
          {!isEditing && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Toggle
                checked={isRecurring}
                onChange={onRecurringChange}
                label="جعلها معاملة متكررة"
                className="gap-2.5"
              />
            </div>
          )}
        </div>
      )}

      {/* Recurring Options (only for new transactions when isRecurring is true) */}
      {!isEditing && isRecurring && (
        <div className="space-y-3 pe-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400">
              دورية التكرار
            </label>
            <div
              role="radiogroup"
              className="grid grid-cols-4 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]"
            >
              <button
                type="button"
                role="radio"
                aria-checked={recurringFrequency === 'weekly'}
                onClick={() => {
                  onRecurringFrequencyChange('weekly')
                  onCloseExtraFrequencyDropdown()
                }}
                className={cn(
                  'py-1.5 text-xs font-bold rounded-lg transition-all',
                  recurringFrequency === 'weekly'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                أسبوعي
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={recurringFrequency === 'monthly'}
                onClick={() => {
                  onRecurringFrequencyChange('monthly')
                  onCloseExtraFrequencyDropdown()
                }}
                className={cn(
                  'py-1.5 text-xs font-bold rounded-lg transition-all',
                  recurringFrequency === 'monthly'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                شهري
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={recurringFrequency === 'yearly'}
                onClick={() => {
                  onRecurringFrequencyChange('yearly')
                  onCloseExtraFrequencyDropdown()
                }}
                className={cn(
                  'py-1.5 text-xs font-bold rounded-lg transition-all',
                  recurringFrequency === 'yearly'
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                سنوي
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={['daily', 'biweekly', 'quarterly', 'semiannual'].includes(
                  recurringFrequency
                )}
                onClick={onToggleExtraFrequencyDropdown}
                className={cn(
                  'py-1.5 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-0.5',
                  ['daily', 'biweekly', 'quarterly', 'semiannual'].includes(recurringFrequency)
                    ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                <span className="truncate">
                  {recurringFrequency === 'daily'
                    ? 'يومي'
                    : recurringFrequency === 'biweekly'
                      ? 'أسبوعين'
                      : recurringFrequency === 'quarterly'
                        ? 'ربع سنوي'
                        : recurringFrequency === 'semiannual'
                          ? 'نصف سنوي'
                          : 'أخرى'}
                </span>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </button>
            </div>

            {/* Dropdown menu for extra frequencies */}
            {showExtraFrequencyDropdown && (
              <div className="mt-2 p-1.5 bg-white dark:bg-[#121215] rounded-xl border border-[#E4E4E7] dark:border-[#27272A] shadow-lg grid grid-cols-2 gap-1.5">
                {[
                  { value: 'daily' as Frequency, label: 'يومي' },
                  { value: 'biweekly' as Frequency, label: 'كل أسبوعين' },
                  { value: 'quarterly' as Frequency, label: 'ربع سنوي (3 أشهر)' },
                  { value: 'semiannual' as Frequency, label: 'نصف سنوي (6 أشهر)' },
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      onRecurringFrequencyChange(f.value)
                      onCloseExtraFrequencyDropdown()
                    }}
                    className={cn(
                      'px-2.5 py-2 text-xs font-bold rounded-lg text-start flex items-center justify-between transition-colors',
                      recurringFrequency === f.value
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                    )}
                  >
                    <span>{f.label}</span>
                    {recurringFrequency === f.value && (
                      <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* End date toggle + picker */}
          <div className="pt-1 space-y-2">
            <Toggle
              checked={hasEndDate}
              onChange={onHasEndDateChange}
              label="تحديد تاريخ انتهاء للتكرار"
            />
            {hasEndDate && (
              <DatePickerInput
                id="rec-end-date"
                label="تاريخ الانتهاء"
                value={endDateStr}
                onChange={onEndDateChange}
                required
              />
            )}
          </div>

          {/* Past date schedule notice */}
          {parseLocalDateInput(dateStr) < new Date(new Date().setHours(0, 0, 0, 0)) && (
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-[#E4E4E7] dark:border-[#27272A] text-[11px] text-zinc-600 dark:text-zinc-300 flex items-center justify-between gap-2">
              <span>تاريخ المعاملة في الماضي؛ سيتم تلقائياً جدولة الاستحقاق القادم من اليوم</span>
              <Toggle
                checked={scheduleNextIfPast}
                onChange={onScheduleNextIfPastChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
