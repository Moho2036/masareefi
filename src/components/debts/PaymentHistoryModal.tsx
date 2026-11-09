import React, { useState } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  Trash2,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Plus,
  Share2,
  MessageSquare,
  Copy,
  Printer,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { DatePickerInput } from '../ui/DatePickerInput'
import { Toggle } from '../ui/Toggle'
import { FormattedMoney } from '../ui/FormattedMoney'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import {
  deleteDebtPayment,
  updateDebtPayment,
  checkDebtPaymentTransactionExists,
  compactDebtPayments,
  compactDebtEntries,
  addDebtEntry,
  updateDebtEntry,
  deleteDebtEntry,
} from '../../services/debts'
import { useCurrency } from '../../hooks/useCurrency'
import { getDebtRemainingFils, formatDebtAccountStatement } from '../../lib/debts'
import { toWesternDigits, parseLocalDateInput } from '../../lib/dates'
import { fromFils, toFils } from '../../lib/money'
import { triggerHaptic } from '../../lib/haptics'
import { cn } from '../../lib/cn'
import type { Debt, DebtPayment, DebtEntry } from '../../types'

export interface PaymentHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  debt: Debt | null
  onSuccess?: () => void
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  debt,
  onSuccess,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { format: formatCurrency, config } = useCurrency()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletePaymentTx, setDeletePaymentTx] = useState(true)

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [editAmountStr, setEditAmountStr] = useState('')
  const [editDateStr, setEditDateStr] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSyncTx, setEditSyncTx] = useState(true)
  const [checkingEditSync, setCheckingEditSync] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isCompacting, setIsCompacting] = useState(false)

  // Entry management state
  const [isAddingEntry, setIsAddingEntry] = useState(false)
  const [newEntryAmountStr, setNewEntryAmountStr] = useState('')
  const [newEntryDateStr, setNewEntryDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [newEntryTitle, setNewEntryTitle] = useState('')
  const [newEntryNote, setNewEntryNote] = useState('')
  const [newEntrySync, setNewEntrySync] = useState(true)
  const [isSavingEntry, setIsSavingEntry] = useState(false)
  const [entryError, setEntryError] = useState<string | null>(null)

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editEntryAmountStr, setEditEntryAmountStr] = useState('')
  const [editEntryDateStr, setEditEntryDateStr] = useState('')
  const [editEntryTitle, setEditEntryTitle] = useState('')
  const [editEntryNote, setEditEntryNote] = useState('')
  const [isSavingEditEntry, setIsSavingEditEntry] = useState(false)
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null)
  const [isDeletingEntry, setIsDeletingEntry] = useState(false)
  const [isCompactingEntries, setIsCompactingEntries] = useState(false)

  const handleClose = () => {
    setConfirmDeleteId(null)
    setDeletePaymentTx(true)
    setEditingPaymentId(null)
    setEditSyncTx(true)
    setCheckingEditSync(false)
    setEditError(null)
    setIsAddingEntry(false)
    setEditingEntryId(null)
    setConfirmDeleteEntryId(null)
    setEntryError(null)
    onClose()
  }

  if (!debt) return null

  const remainingFils = getDebtRemainingFils(debt)
  const payments = debt.payments || []
  const isLent = debt.type === 'lent'
  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const debtStartStr = format(debtStartDate, 'yyyy-MM-dd')

  const handleDeletePayment = async (paymentId: string, deleteTx: boolean = true) => {
    if (!user) return

    setDeletingId(paymentId)
    try {
      await deleteDebtPayment(user.uid, debt, paymentId, { deleteTransaction: deleteTx })
      showToast('تم حذف الدفعة وتحديث الرصيد', 'success')
      setConfirmDeleteId(null)
      setDeletePaymentTx(true)
      onSuccess?.()
    } catch (err) {
      console.error('Error deleting payment:', err)
      showToast(err instanceof Error ? err.message : 'فشل حذف الدفعة', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleStartEdit = (p: DebtPayment) => {
    setConfirmDeleteId(null)
    setEditingPaymentId(p.id)
    setEditAmountStr(String(fromFils(p.amountFils)))
    const pDate = p.date instanceof Date ? p.date : new Date(p.date)
    setEditDateStr(format(pDate, 'yyyy-MM-dd'))
    setEditNote(p.note || '')
    setEditError(null)

    const isSynced = Boolean(p.transactionId)
    setEditSyncTx(isSynced)

    if (user && !p.transactionId) {
      setCheckingEditSync(true)
      checkDebtPaymentTransactionExists(user.uid, debt, p)
        .then((exists) => {
          setEditSyncTx(exists)
        })
        .catch(() => {})
        .finally(() => {
          setCheckingEditSync(false)
        })
    } else {
      setCheckingEditSync(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingPaymentId(null)
    setEditSyncTx(true)
    setCheckingEditSync(false)
    setEditError(null)
  }

  const handleSaveEdit = async (p: DebtPayment) => {
    if (!user) return
    let amountFils = toFils(editAmountStr, config.decimals)
    if (amountFils <= 0) {
      setEditError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    const previousPaymentsSum = payments.reduce((acc, item) => acc + item.amountFils, 0)
    const untrackedPaidFils = Math.max(0, (debt.paidFils || 0) - previousPaymentsSum)
    const otherPaymentsTotal = payments
      .filter((item) => item.id !== p.id)
      .reduce((sum, item) => sum + item.amountFils, 0)
    const maxAllowed = Math.max(0, debt.amountFils - (otherPaymentsTotal + untrackedPaidFils))

    const maxTolerance = config.decimals === 0 ? 500 : config.decimals === 2 ? 5 : 0
    const roundedMaxStr = fromFils(maxAllowed).toFixed(config.decimals)
    const inputStr = toWesternDigits(editAmountStr.trim())
    if (maxTolerance > 0 && amountFils > maxAllowed) {
      const diff = amountFils - maxAllowed
      if (diff <= maxTolerance || inputStr === roundedMaxStr) {
        amountFils = maxAllowed
      }
    }

    if (amountFils > maxAllowed) {
      setEditError(`مبلغ الدفعة لا يمكن أن يتجاوز الحد الأقصى المتاح للتعديل (${formatCurrency(maxAllowed)})`)
      return
    }

    const date = parseLocalDateInput(editDateStr)
    const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
    const paymentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    if (paymentDay < debtStartDay) {
      setEditError('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
      return
    }

    setIsSavingEdit(true)
    setEditError(null)
    try {
      await updateDebtPayment(user.uid, debt, p.id, {
        amountFils,
        date,
        note: editNote.trim(),
        syncTransaction: editSyncTx,
      })
      triggerHaptic('light')
      showToast('تم تعديل الدفعة وتحديث الرصيد', 'success')
      setEditingPaymentId(null)
      onSuccess?.()
    } catch (err) {
      console.error('Error updating debt payment:', err)
      setEditError(err instanceof Error ? err.message : 'فشل تعديل الدفعة')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleCompact = async () => {
    if (!user || !debt) return
    setIsCompacting(true)
    try {
      const result = await compactDebtPayments(user.uid, debt.id)
      if (result.mergedCount > 0) {
        showToast(`تم دمج ${result.mergedCount} دفعة قديمة بنجاح`, 'success')
        onSuccess?.()
      } else {
        showToast('لا توجد دفعات كافية للدمج', 'info')
      }
    } catch (err) {
      console.error('Failed to compact payments:', err)
      showToast(err instanceof Error ? err.message : 'فشل دمج الدفعات', 'error')
    } finally {
      setIsCompacting(false)
    }
  }

  const handleCompactEntries = async () => {
    if (!user || !debt) return
    setIsCompactingEntries(true)
    try {
      const result = await compactDebtEntries(user.uid, debt.id)
      if (result.mergedCount > 0) {
        showToast(`تم دمج ${result.mergedCount} سلفة قديمة بنجاح`, 'success')
        onSuccess?.()
      } else {
        showToast('لا توجد سلف كافية للدمج', 'info')
      }
    } catch (err) {
      console.error('Failed to compact entries:', err)
      showToast(err instanceof Error ? err.message : 'فشل دمج السلف', 'error')
    } finally {
      setIsCompactingEntries(false)
    }
  }

  const rawEntries: DebtEntry[] =
    debt.entries && debt.entries.length > 0
      ? debt.entries
      : [
          {
            id: `base_${debt.id}`,
            amountFils: debt.amountFils,
            date: debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate),
            title: debt.type === 'lent' ? 'أصل السلفة / الدين' : 'أصل الدين المقترض',
            note: debt.note || '',
            createdAt: debt.createdAt instanceof Date ? debt.createdAt : new Date(debt.createdAt || debt.startDate),
          },
        ]

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const amountFils = toFils(newEntryAmountStr, config.decimals)
    if (amountFils <= 0) {
      setEntryError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    setIsSavingEntry(true)
    setEntryError(null)
    try {
      const date = parseLocalDateInput(newEntryDateStr)
      await addDebtEntry(
        user.uid,
        debt,
        {
          amountFils,
          date,
          title: newEntryTitle.trim() || undefined,
          note: newEntryNote.trim() || undefined,
        },
        { syncTransaction: newEntrySync }
      )
      triggerHaptic('light')
      showToast('تمت إضافة السلفة وتحديث إجمالي الدين بنجاح', 'success')
      setIsAddingEntry(false)
      setNewEntryAmountStr('')
      setNewEntryTitle('')
      setNewEntryNote('')
      onSuccess?.()
    } catch (err) {
      console.error('Error adding debt entry:', err)
      setEntryError(err instanceof Error ? err.message : 'فشل إضافة السلفة')
    } finally {
      setIsSavingEntry(false)
    }
  }

  const handleStartEditEntry = (entry: DebtEntry) => {
    setEditingEntryId(entry.id)
    setEditEntryAmountStr(String(fromFils(entry.amountFils)))
    const eDate = entry.date instanceof Date ? entry.date : new Date(entry.date)
    setEditEntryDateStr(format(eDate, 'yyyy-MM-dd'))
    setEditEntryTitle(entry.title || '')
    setEditEntryNote(entry.note || '')
    setConfirmDeleteEntryId(null)
    setEntryError(null)
  }

  const handleSaveEditEntry = async (entryId: string) => {
    if (!user) return
    const amountFils = toFils(editEntryAmountStr, config.decimals)
    if (amountFils <= 0) {
      setEntryError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      return
    }

    setIsSavingEditEntry(true)
    setEntryError(null)
    try {
      const date = parseLocalDateInput(editEntryDateStr)
      await updateDebtEntry(user.uid, debt, entryId, {
        amountFils,
        date,
        title: editEntryTitle.trim() || undefined,
        note: editEntryNote.trim() || undefined,
      })
      triggerHaptic('light')
      showToast('تم تحديث السلفة بنجاح', 'success')
      setEditingEntryId(null)
      onSuccess?.()
    } catch (err) {
      console.error('Error updating debt entry:', err)
      setEntryError(err instanceof Error ? err.message : 'فشل تحديث السلفة')
    } finally {
      setIsSavingEditEntry(false)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return
    setIsDeletingEntry(true)
    try {
      await deleteDebtEntry(user.uid, debt, entryId)
      showToast('تم حذف السلفة وتحديث إجمالي الدين', 'success')
      setConfirmDeleteEntryId(null)
      onSuccess?.()
    } catch (err) {
      console.error('Error deleting debt entry:', err)
      showToast(err instanceof Error ? err.message : 'فشل حذف السلفة', 'error')
    } finally {
      setIsDeletingEntry(false)
    }
  }

  const handleCopyStatement = async () => {
    try {
      const text = formatDebtAccountStatement(debt, config.symbol, config.decimals)
      await navigator.clipboard.writeText(text)
      showToast('تم نسخ كشف الحساب بنجاح', 'success')
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      showToast('فشل نسخ كشف الحساب', 'error')
    }
  }

  const handleWhatsAppShare = () => {
    const text = formatDebtAccountStatement(debt, config.symbol, config.decimals)
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleNativeShare = async () => {
    if (!canShare) return
    try {
      const text = formatDebtAccountStatement(debt, config.symbol, config.decimals)
      await navigator.share({
        title: `كشف حساب — ${debt.personName}`,
        text,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error('Native share failed:', err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`سجل الحركات وكشف الحساب — ${debt.personName}`}
    >
      <div className="space-y-4">
        {/* Summary Card */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] grid grid-cols-3 divide-x divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] text-center">
          <div>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المبلغ الكلي</span>
            <span className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200 tabular-nums">
              <FormattedMoney amountFils={debt.amountFils} />
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المسدد حتى الآن</span>
            <span className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-200 tabular-nums">
              <FormattedMoney amountFils={debt.paidFils || 0} />
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-0.5">المتبقي</span>
            <span
              className={cn(
                'text-xs sm:text-sm font-black tabular-nums',
                isLent
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              <FormattedMoney amountFils={remainingFils} />
            </span>
          </div>
        </div>

        {/* Share Account Statement Strip */}
        <div className={cn('grid gap-2 print-hide', canShare ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
          <button
            type="button"
            onClick={handleCopyStatement}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>نسخ للحافظة</span>
          </button>
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>إرسال عبر واتساب</span>
          </button>
          {canShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>مشاركة الكشف</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>طباعة الكشف</span>
          </button>
        </div>

        {/* SECTION 1: Entries (أصل الديون والسلف) */}
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
          {(debt.entries?.length ?? 0) >= 90 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5 print-hide">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  وصل عدد السلف إلى {debt.entries?.length ?? 0} (الحد الأقصى 100)
                </span>
              </div>
              <p className="text-amber-700 dark:text-amber-400">
                يمكنك دمج السلف القديمة في سلفة واحدة لفتح مساحة لسلف جديدة دون أي تأثير على إجمالي أصل الدين.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  disabled={isCompactingEntries || isSavingEditEntry || Boolean(confirmDeleteEntryId)}
                  onClick={handleCompactEntries}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCompactingEntries ? 'جاري الدمج...' : 'دمج السلف القديمة'}
                </button>
              </div>
            </div>
          )}

          {/* Inline Add Entry Form */}
          {isAddingEntry && (
            <form onSubmit={handleAddEntry} noValidate className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2.5 print-hide">
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
                    <span className="text-[10px] text-zinc-400 font-bold">{config.symbol}</span>
                  </div>
                </div>
                <div>
                  <DatePickerInput
                    label="تاريخ السلفة"
                    value={newEntryDateStr}
                    onChange={(val) => setNewEntryDateStr(val)}
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
                          <span className="text-[10px] text-zinc-400 font-bold">{config.symbol}</span>
                        </div>
                      </div>
                      <div>
                        <DatePickerInput
                          label="التاريخ"
                          value={editEntryDateStr}
                          onChange={(val) => setEditEntryDateStr(val)}
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
                        onClick={() => setEditingEntryId(null)}
                        disabled={isSavingEditEntry}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditEntry(e.id)}
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
                        onClick={() => handleDeleteEntry(e.id)}
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
                  {debt.entries && debt.entries.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0 print-hide">
                      {!e.isMerged && !e.id.startsWith('compacted_entry_') && (
                        <button
                          type="button"
                          onClick={() => handleStartEditEntry(e)}
                          className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
                          title="تعديل السلفة"
                          aria-label="تعديل السلفة"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(debt.entries?.length ?? 0) > 1 && (
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

        {/* SECTION 2: Payments (سجل دفعات السداد) */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-200">
              سجل دفعات السداد ({payments.length})
            </h3>
          </div>

        {/* Compaction Banner */}
        {payments.length >= 90 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                وصل عدد الدفعات إلى {payments.length} (الحد الأقصى 100)
              </span>
            </div>
            <p className="text-amber-700 dark:text-amber-400">
              يمكنك دمج الدفعات القديمة في دفعة واحدة لفتح مساحة لدفعات جديدة دون أي تأثير على إجمالي المبلغ المسدد.
            </p>
            <div className="pt-1">
              <button
                type="button"
                disabled={isCompacting || isSavingEdit || Boolean(deletingId)}
                onClick={handleCompact}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCompacting ? 'جاري الدمج...' : 'دمج الدفعات القديمة'}
              </button>
            </div>
          </div>
        )}

        {/* Payments List */}
        {payments.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">لا توجد أي دفعات مسجلة بعد لهذا الدين</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments
              .slice()
              .reverse()
              .map((p) => {
                const isMerged = Boolean(p.isMerged || p.id.startsWith('compacted_'))
                const formattedDate = toWesternDigits(
                  format(p.date, 'd MMMM yyyy', { locale: ar })
                )
                const isDeleting = deletingId === p.id

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col gap-2.5"
                  >
                    {editingPaymentId === p.id ? (
                      <div className="w-full space-y-2.5">
                        {editError && (
                          <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/50">
                            {editError}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">المبلغ</label>
                            <div className="flex items-center gap-1 border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editAmountStr}
                                onChange={(e) => setEditAmountStr(toWesternDigits(e.target.value))}
                                className="w-full text-xs font-bold bg-transparent outline-none text-zinc-800 dark:text-zinc-100"
                                required
                              />
                              <span className="text-[10px] text-zinc-400 font-bold">{config.symbol}</span>
                            </div>
                          </div>
                          <div className="w-full">
                            <DatePickerInput
                              label="التاريخ"
                              value={editDateStr}
                              min={debtStartStr}
                              onChange={(val) => setEditDateStr(val)}
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">الملاحظة</label>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 outline-none"
                            placeholder="ملاحظة للدفعة..."
                          />
                        </div>
                        <div>
                          <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-[#E4E4E7] dark:border-[#27272A]">
                            <Toggle
                              disabled={checkingEditSync || isSavingEdit}
                              checked={editSyncTx}
                              onChange={setEditSyncTx}
                              label="ربط الدفعة بالرصيد (تأثير مالي في سجل المعاملات)"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(p)}
                            disabled={isSavingEdit || checkingEditSync}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingEdit ? 'جارٍ الحفظ...' : checkingEditSync ? 'جارٍ التحقق...' : 'حفظ التعديل'}
                          </button>
                        </div>
                      </div>
                    ) : confirmDeleteId === p.id ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  'text-sm font-black tabular-nums',
                                  isLent
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                )}
                              >
                                {isLent ? '+' : '-'} {formatCurrency(p.amountFils)}
                              </div>
                              {isMerged && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                                  دفعات مدمجة
                                </span>
                              )}
                              {p.transactionId && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                                  مرتبط بالرصيد
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                              {formattedDate}
                              {p.note ? ` • ${p.note}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-red-50/70 dark:bg-red-950/30 rounded-xl border border-red-200/80 dark:border-red-900/50 space-y-2.5">
                          <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 text-xs font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>تأكيد حذف الدفعة؟</span>
                          </div>

                          <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-[#E4E4E7] dark:border-[#27272A]">
                            <Toggle
                              checked={deletePaymentTx}
                              onChange={setDeletePaymentTx}
                              label={
                                isMerged
                                  ? 'حذف المعاملات المالية المدمجة المرتبطة من سجل المعاملات أيضاً'
                                  : 'حذف المعاملة المالية المرتبطة من سجل المعاملات أيضاً'
                              }
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => {
                                setConfirmDeleteId(null)
                                setDeletePaymentTx(true)
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeletePayment(p.id, deletePaymentTx)}
                              className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isDeleting ? 'جاري الحذف...' : 'تأكيد الحذف'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'text-sm font-black tabular-nums',
                                isLent
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              )}
                            >
                              {isLent ? '+' : '-'} {formatCurrency(p.amountFils)}
                            </div>
                            {isMerged && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                                دفعات مدمجة
                              </span>
                            )}
                            {p.transactionId && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] shrink-0">
                                مرتبط بالرصيد
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                            {formattedDate}
                            {p.note ? ` • ${p.note}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 print-hide">
                          {!isMerged && (
                            <button
                              type="button"
                              disabled={Boolean(deletingId) || isSavingEdit}
                              onClick={() => handleStartEdit(p)}
                              className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title="تعديل هذه الدفعة"
                              aria-label="تعديل هذه الدفعة"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(deletingId) || isSavingEdit}
                            onClick={() => {
                              setEditingPaymentId(null)
                              setConfirmDeleteId(p.id)
                              setDeletePaymentTx(true)
                            }}
                            className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="حذف هذه الدفعة"
                            aria-label="حذف هذه الدفعة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
        </div>

        <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 print-hide">
          <Button
            type="button"
            variant="outline"
            className="w-full font-bold"
            onClick={handleClose}
          >
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  )
}
