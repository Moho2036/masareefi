import React from 'react'
import { DatePickerInput } from '../ui/DatePickerInput'
import { Toggle } from '../ui/Toggle'
import { Input } from '../ui/Input'
import { parseLocalDateInput } from '../../lib/dates'

export interface RecurringDatesSectionProps {
  startDateStr: string
  setStartDateStr: (val: string) => void
  hasEndDate: boolean
  setHasEndDate: (val: boolean) => void
  endDateStr: string
  setEndDateStr: (val: string) => void
  scheduleNextIfPast: boolean
  setScheduleNextIfPast: (val: boolean) => void
  requireConfirmation: boolean
  setRequireConfirmation: (val: boolean) => void
  note: string
  setNote: (val: string) => void
  hasSelectedCircle: boolean
  isEditing: boolean
}

export const RecurringDatesSection: React.FC<RecurringDatesSectionProps> = ({
  startDateStr,
  setStartDateStr,
  hasEndDate,
  setHasEndDate,
  endDateStr,
  setEndDateStr,
  scheduleNextIfPast,
  setScheduleNextIfPast,
  requireConfirmation,
  setRequireConfirmation,
  note,
  setNote,
  hasSelectedCircle,
  isEditing,
}) => {
  const isStartDatePast =
    parseLocalDateInput(startDateStr) < new Date(new Date().setHours(0, 0, 0, 0))

  return (
    <div className="space-y-4">
      {/* Dates: Start Date & Optional End Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DatePickerInput
          id="rec-start-date"
          label="تاريخ البداية"
          value={startDateStr}
          onChange={setStartDateStr}
          disabled={hasSelectedCircle}
          required
        />

        {hasEndDate ? (
          <DatePickerInput
            id="rec-end-date"
            label="تاريخ الانتهاء"
            value={endDateStr}
            onChange={setEndDateStr}
            disabled={hasSelectedCircle}
            required={hasEndDate}
          />
        ) : null}
      </div>

      {!isEditing && !hasSelectedCircle && isStartDatePast && (
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A]">
          <Toggle
            checked={scheduleNextIfPast}
            onChange={setScheduleNextIfPast}
            label="تاريخ البداية في الماضي"
            description="جدولة الاستحقاق القادم من تاريخ اليوم فصاعداً دون تسجيل دفعات سابقة بأثر رجعي"
          />
        </div>
      )}

      {/* Checkbox toggle for end date */}
      <div>
        <Toggle
          checked={hasEndDate}
          onChange={setHasEndDate}
          disabled={hasSelectedCircle}
          label="تحديد تاريخ انتهاء"
          description="تتوقف المعاملة المتكررة تلقائياً بعد هذا التاريخ"
        />
      </div>

      {/* Require Confirmation Toggle */}
      <div>
        <Toggle
          checked={requireConfirmation}
          onChange={setRequireConfirmation}
          label="طلب تأكيد الدفعة يدوياً قبل التسجيل"
          description="تنبيهك لمراجعة أو تعديل المبلغ قبل تسجيله"
        />
      </div>

      {/* Note Input */}
      <div>
        <Input
          type="text"
          label="ملاحظة (اختياري)"
          placeholder="مثال: اشتراك نت، قسط شهري..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>
    </div>
  )
}
