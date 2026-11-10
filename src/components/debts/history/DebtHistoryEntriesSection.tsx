import React from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Plus, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { DatePickerInput } from '../../ui/DatePickerInput'
import { Toggle } from '../../ui/Toggle'
import { toWesternDigits } from '../../../lib/dates'
import type { DebtEntry } from '../../../types'

export interface DebtHistoryEntriesSectionProps {
  rawEntries: DebtEntry[]
  hasExplicitEntries: boolean
  entryError: string | null
  isCompactingEntries: boolean
  onCompactEntries: () => void
  isAddingEntry: boolean
  setIsAddingEntry: React.Dispatch<React.SetStateAction<boolean>>
  newEntryAmountStr: string
  setNewEntryAmountStr: (val: string) => void
  newEntryDateStr: string
  setNewEntryDateStr: (val: string) => void
  newEntryTitle: string
  setNewEntryTitle: (val: string) => void
  newEntryNote: string
  setNewEntryNote: (val: string) => void
  newEntrySync: boolean
  setNewEntrySync: (val: boolean) => void
  isSavingEntry: boolean
  onAddEntry: (e: React.FormEvent) => void
  editingEntryId: string | null
  editEntryAmountStr: string
  setEditEntryAmountStr: (val: string) => void
  editEntryDateStr: string
  setEditEntryDateStr: (val: string) => void
  editEntryTitle: string
  setEditEntryTitle: (val: string) => void
  editEntryNote: string
  setEditEntryNote: (val: string) => void
  isSavingEditEntry: boolean
  onStartEditEntry: (entry: DebtEntry) => void
  onCancelEditEntry: () => void
  onSaveEditEntry: (entryId: string) => void
  confirmDeleteEntryId: string | null
  setConfirmDeleteEntryId: (id: string | null) => void
  isDeletingEntry: boolean
  onDeleteEntry: (entryId: string) => void
  currencySymbol: string
  formatCurrency: (fils: number) => string
}

export const DebtHistoryEntriesSection: React.FC<DebtHistoryEntriesSectionProps> = ({
  rawEntries,
  hasExplicitEntries,
  entryError,
  isCompactingEntries,
  onCompactEntries,
  isAddingEntry,
  setIsAddingEntry,
  newEntryAmountStr,
  setNewEntryAmountStr,
  newEntryDateStr,
  setNewEntryDateStr,
  newEntryTitle,
  setNewEntryTitle,
  newEntryNote,
  setNewEntryNote,
  newEntrySync,
  setNewEntrySync,
  isSavingEntry,
  onAddEntry,
  editingEntryId,
  editEntryAmountStr,
  setEditEntryAmountStr,
  editEntryDateStr,
  setEditEntryDateStr,
  editEntryTitle,
  setEditEntryTitle,
  editEntryNote,
  setEditEntryNote,
  isSavingEditEntry,
  onStartEditEntry,
  onCancelEditEntry,
  onSaveEditEntry,
  confirmDeleteEntryId,
  setConfirmDeleteEntryId,
  isDeletingEntry,
  onDeleteEntry,
  currencySymbol,
  formatCurrency,
}) => {
  return (
    <div className="space-y-2.5 pt-1 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-200">
          تفاصيل السلف وأصل الديون المسجلة ({rawEntries.length})
        </h3>
        <button
          type="button"
          onClick={() => setIsAddingEntry((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer print-hide"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة سلفة جديدة على هذا الحساب</span>
        </button>
      </div>

      {entryError && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-900/50">
          {entryError}
        </div>
      )}

      {/* Compaction Warning Banner for Entries */}
      {hasExplicitEntries && rawEntries.length >= 90 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5 print-hide">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>وصل عدد السلف إلى {rawEntries.length} (الحد الأقصى 100)</span>
          </div>
          <p className="text-amber-700 dark:text-amber-400">
            يمكنك دمج السلف القديمة في سلفة واحدة لفتح مساحة لسلف جديدة دون أي تأثير على إجمالي أصل الدين.
          </p>
          <div className="pt-1">
            <button
              type="button"
              disabled={isCompactingEntries || isSavingEditEntry || Boolean(confirmDeleteEntryId)}
              onClick={onCompactEntries}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {isCompactingEntries ? 'جاري الدمج...' : 'دمج السلف القديمة'}
            </button>
          </div>
        </div>
      )}

      {/* Inline Add Entry Form */}
      {isAddingEntry && (
        <form onSubmit={onAddEntry} noValidate className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2.5 print-hide">
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
            تسجيل سلفة إضافية جديدة لنفس الشخص
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">المبلغ المطلوب إضافته</label>
              <div className="flex items-center gap-1 border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800">
                <input
                  type="text"
                  inputMode="decimal"
                  value={newEntryAmountStr}
                  placeholder="0.000"
                  onChange={(e) => setNewEntryAmountStr(toWesternDigits(e.target.value))}
                  className="w-full text-xs font-bold bg-transparent outline-none text-zinc-800 dark:text-zinc-100"
                  required
                />
                <span className="text-[10px] text-zinc-400 font-bold">{currencySymbol}</span>
              </div>
            </div>
            <div>
              <DatePickerInput
                label="تاريخ السلفة"
                value={newEntryDateStr}
                onChange={setNewEntryDateStr}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">العنوان أو السبب (اختياري)</label>
              <input
                type="text"
                value={newEntryTitle}
                onChange={(e) => setNewEntryTitle(e.target.value)}
                className="w-full text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 outline-none"
                placeholder="مثال: سلفة تكاليف السفر..."
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">ملاحظات إضافية (اختياري)</label>
              <input
                type="text"
                value={newEntryNote}
                onChange={(e) => setNewEntryNote(e.target.value)}
                className="w-full text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 outline-none"
                placeholder="تفاصيل إضافية..."
              />
            </div>
          </div>
          <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-[#E4E4E7] dark:border-[#27272A]">
            <Toggle
              label="خصم/إيداع مبلغ السلفة من الرصيد كمعاملة مالية"
              checked={newEntrySync}
              onChange={setNewEntrySync}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingEntry(false)}
              disabled={isSavingEntry}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSavingEntry}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50"
            >
              {isSavingEntry ? 'جاري الحفظ...' : 'حفظ السلفة'}
            </button>
          </div>
        </form>
      )}

      {/* Entries list */}
      <div className="space-y-2">
        {rawEntries.map((e, idx) => {
          const formattedDate = toWesternDigits(format(new Date(e.date), 'd MMMM yyyy', { locale: ar }))
          const isEditingThis = editingEntryId === e.id
          const isConfirmDelete = confirmDeleteEntryId === e.id

          if (isEditingThis) {
            return (
              <div key={e.id} className="p-3 rounded-xl bg-white dark:bg-zinc-800 border border-blue-500/40 dark:border-blue-500/50 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">المبلغ</label>
                    <div className="flex items-center gap-1 border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editEntryAmountStr}
                        onChange={(ev) => setEditEntryAmountStr(toWesternDigits(ev.target.value))}
                        className="w-full text-xs font-bold bg-transparent outline-none text-zinc-800 dark:text-zinc-100"
                        required
                      />
                      <span className="text-[10px] text-zinc-400 font-bold">{currencySymbol}</span>
                    </div>
                  </div>
                  <div>
                    <DatePickerInput
                      label="التاريخ"
                      value={editEntryDateStr}
                      onChange={setEditEntryDateStr}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editEntryTitle}
                    onChange={(ev) => setEditEntryTitle(ev.target.value)}
                    placeholder="العنوان أو سبب السلفة..."
                    className="text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 outline-none"
                  />
                  <input
                    type="text"
                    value={editEntryNote}
                    onChange={(ev) => setEditEntryNote(ev.target.value)}
                    placeholder="ملاحظة السلفة..."
                    className="text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50">
                  <button
                    type="button"
                    onClick={onCancelEditEntry}
                    disabled={isSavingEditEntry}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => onSaveEditEntry(e.id)}
                    disabled={isSavingEditEntry}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEditEntry ? 'جاري الحفظ...' : 'حفظ التعديل'}
                  </button>
                </div>
              </div>
            )
          }

          if (isConfirmDelete) {
            return (
              <div key={e.id} className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/60 space-y-2">
                <span className="text-xs font-bold text-red-700 dark:text-red-400 block">
                  هل أنت متأكد من حذف هذه السلفة بقيمة ({formatCurrency(e.amountFils)})؟
                </span>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteEntryId(null)}
                    disabled={isDeletingEntry}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteEntry(e.id)}
                    disabled={isDeletingEntry}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingEntry ? 'جاري الحذف...' : 'تأكيد الحذف'}
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={e.id} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                    {e.title || `سلفة #${idx + 1}`}
                  </span>
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                    ({formatCurrency(e.amountFils)})
                  </span>
                  {(e.isMerged || e.id.startsWith('compacted_entry_')) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] font-semibold">
                      سلف مدمجة
                    </span>
                  )}
                  {e.transactionId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] font-semibold">
                      مرتبط بالرصيد
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                  {formattedDate} {e.note ? `• ${e.note}` : ''}
                </div>
              </div>
              {hasExplicitEntries && (
                <div className="flex items-center gap-1 shrink-0 print-hide">
                  {!e.isMerged && !e.id.startsWith('compacted_entry_') && (
                    <button
                      type="button"
                      onClick={() => onStartEditEntry(e)}
                      className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
                      title="تعديل السلفة"
                      aria-label="تعديل السلفة"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {rawEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteEntryId(e.id)}
                      className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg cursor-pointer"
                      title="حذف السلفة"
                      aria-label="حذف السلفة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
