import React from 'react'
import { format } from 'date-fns'
import { AlertCircle, Info } from 'lucide-react'
import { Input } from '../ui/Input'
import { DatePickerInput } from '../ui/DatePickerInput'
import { Toggle } from '../ui/Toggle'
import { toFils } from '../../lib/money'
import { toWesternDigits } from '../../lib/dates'
import { cn } from '../../lib/cn'
import type { Debt, DebtType } from '../../types'

export interface DebtFormFieldsProps {
  isEditing: boolean
  initialDebt?: Debt | null
  type: DebtType
  setType: (type: DebtType) => void
  personName: string
  setPersonName: (name: string) => void
  personSuggestions: string[]
  amountStr: string
  setAmountStr: (val: string) => void
  hasMultipleEntries: boolean
  initialPaidStr: string
  setInitialPaidStr: (val: string) => void
  startDateStr: string
  setStartDateStr: (val: string) => void
  hasDueDate: boolean
  setHasDueDate: (val: boolean) => void
  dueDateStr: string
  setDueDateStr: (val: string) => void
  note: string
  setNote: (val: string) => void
  syncTransaction: boolean
  setSyncTransaction: (val: boolean) => void
  setSyncManuallyToggled: (val: boolean) => void
  checkingSync: boolean
  loading: boolean
  isPastDebt: boolean
  config: { decimals: number; symbol: string }
  formatCurrency: (fils: number) => string
}

export const DebtFormFields: React.FC<DebtFormFieldsProps> = ({
  isEditing,
  initialDebt,
  type,
  setType,
  personName,
  setPersonName,
  personSuggestions,
  amountStr,
  setAmountStr,
  hasMultipleEntries,
  initialPaidStr,
  setInitialPaidStr,
  startDateStr,
  setStartDateStr,
  hasDueDate,
  setHasDueDate,
  dueDateStr,
  setDueDateStr,
  note,
  setNote,
  syncTransaction,
  setSyncTransaction,
  setSyncManuallyToggled,
  checkingSync,
  loading,
  isPastDebt,
  config,
  formatCurrency,
}) => {
  return (
    <>
      {/* 1. Type Selector (Segmented control) */}
      <div>
        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
          نوع الدين
        </label>
        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-[#E4E4E7] dark:border-[#27272A] gap-1 w-full">
          <button
            type="button"
            disabled={isEditing && (initialDebt?.payments?.length ?? 0) > 0}
            onClick={() => setType('lent')}
            className={cn(
              'flex-1 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5',
              type === 'lent'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              isEditing && (initialDebt?.payments?.length ?? 0) > 0
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer'
            )}
          >
            <span>مستحق لي (بذمة الآخرين)</span>
          </button>
          <button
            type="button"
            disabled={isEditing && (initialDebt?.payments?.length ?? 0) > 0}
            onClick={() => setType('borrowed')}
            className={cn(
              'flex-1 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1.5',
              type === 'borrowed'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200',
              isEditing && (initialDebt?.payments?.length ?? 0) > 0
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer'
            )}
          >
            <span>التزام عليّ (للآخرين)</span>
          </button>
        </div>
        {isEditing && (initialDebt?.payments?.length ?? 0) > 0 && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium">
            لا يمكن تغيير اتجاه الدين بعد تسجيل دفعات سداد عليه حفاظاً على سلامة الحسابات.
          </p>
        )}
        {isEditing && (initialDebt?.payments?.length ?? 0) === 0 && type !== initialDebt?.type && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-semibold">
            تنبيه: تغيير نوع الدين سيقلب طبيعة الحركة المالية في المحفظة (من مصروف إلى دخل أو العكس).
          </p>
        )}
      </div>

      {/* 2. Person Name */}
      <div>
        <Input
          label="اسم الشخص"
          placeholder="مثال: أحمد العبدلله"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          required
          maxLength={100}
        />
        {!isEditing && personSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[11px] text-zinc-400 select-none">اقتراحات:</span>
            {personSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setPersonName(name)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer font-medium"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Amount Input in JOD */}
      <div>
        <label htmlFor="debt-total-amount" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
          المبلغ الكلي
        </label>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]',
            hasMultipleEntries
              ? 'opacity-60 bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed'
              : 'focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20'
          )}
        >
          <input
            id="debt-total-amount"
            type="text"
            inputMode="decimal"
            placeholder={config.decimals === 3 ? '0.000' : '0.00'}
            value={amountStr}
            onChange={(e) => setAmountStr(toWesternDigits(e.target.value))}
            disabled={hasMultipleEntries}
            readOnly={hasMultipleEntries}
            className={cn(
              'w-full bg-transparent text-2xl font-black text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none tabular-nums',
              hasMultipleEntries && 'cursor-not-allowed'
            )}
            required
          />
          <span className="text-base font-bold text-zinc-500 dark:text-zinc-400 select-none pe-1">
            {config.symbol}
          </span>
        </div>
        {hasMultipleEntries && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span>يتكون هذا الدين من عدة سلف مجمعة؛ لتعديل المبالغ يرجى إدارة السلف من نافذة سجل الحركات وكشف الحساب.</span>
          </p>
        )}
        {isEditing &&
          initialDebt &&
          !hasMultipleEntries &&
          (initialDebt.paidFils || 0) > 0 &&
          toFils(amountStr, config.decimals) > 0 &&
          toFils(amountStr, config.decimals) < (initialDebt.paidFils || 0) && (
            <p className="text-xs text-red-500 dark:text-red-400 font-semibold mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                لا يمكن أن يكون إجمالي الدين أقل من المبلغ المسدد بالفعل ({formatCurrency(initialDebt.paidFils)})
              </span>
            </p>
          )}
      </div>

      {/* 3b. Pre-paid Amount (for new debts) */}
      {!isEditing && (
        <div>
          <label htmlFor="pre-paid-input" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">
            المبلغ المسدد مسبقاً من هذا الدين (اختياري)
          </label>
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
            <input
              id="pre-paid-input"
              type="text"
              inputMode="decimal"
              placeholder={config.decimals === 3 ? '0.000' : '0.00'}
              value={initialPaidStr}
              onChange={(e) => setInitialPaidStr(toWesternDigits(e.target.value))}
              className="w-full bg-transparent text-base font-bold font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none tabular-nums"
            />
            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 select-none pe-1">
              {config.symbol}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            سجل المبلغ المسدد مسبقاً إذا كان الدين قديماً لتوثيق تاريخه وسداده دون التأثير على سيولة اليوم.
          </p>
        </div>
      )}

      {/* 4. Start Date */}
      <div>
        <DatePickerInput
          label="تاريخ الدين"
          value={startDateStr}
          onChange={(val) => setStartDateStr(val)}
          required
        />
      </div>

      {/* 5. Due Date Toggle */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <Toggle
          label="تحديد موعد استحقاق"
          description="تنبيه عند حلول موعد السداد المتفق عليه"
          checked={hasDueDate}
          onChange={(val) => {
            setHasDueDate(val)
            if (val && !dueDateStr) {
              setDueDateStr(format(new Date(), 'yyyy-MM-dd'))
            }
          }}
        />

        {hasDueDate && (
          <div className="pt-2">
            <DatePickerInput
              label="تاريخ الاستحقاق"
              value={dueDateStr}
              onChange={(val) => setDueDateStr(val)}
              required={hasDueDate}
            />
          </div>
        )}
      </div>

      {/* 6. Note */}
      <div>
        <Input
          label="ملاحظات وتفاصيل (اختياري)"
          placeholder="مثال: سبب السلفة، طريقة التسليم..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* 7. Accounting Sync Toggle */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <Toggle
          checked={syncTransaction}
          onChange={(val) => {
            setSyncManuallyToggled(true)
            setSyncTransaction(val)
          }}
          disabled={checkingSync || loading}
          label={
            type === 'lent'
              ? 'خصم المبلغ من الرصيد الحالي تلقائياً'
              : 'إضافة المبلغ للرصيد الحالي (استلمت المبلغ نقداً)'
          }
          description="يربط مبلغ أصل الدين برصيد محفظتك كمعاملة مالية (دفعات السداد تُدار بشكل مستقل)."
        />
        {isPastDebt && !syncTransaction && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1 font-medium pt-1 border-t border-amber-200/40 dark:border-amber-900/40">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>بما أن هذا دين سابق، تم إيقاف خصم أصل الدين من سيولة اليوم تلقائياً (ويمكنك تفعيله إن أردت).</span>
          </p>
        )}
      </div>
    </>
  )
}
