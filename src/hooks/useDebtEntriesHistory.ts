import { useState } from 'react'
import { format } from 'date-fns'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { useCurrency } from './useCurrency'
import {
  compactDebtEntries,
  addDebtEntry,
  updateDebtEntry,
  deleteDebtEntry,
} from '../services/debts'
import { parseLocalDateInput } from '../lib/dates'
import { fromFils, toFils } from '../lib/money'
import { triggerHaptic } from '../lib/haptics'
import type { Debt, DebtEntry } from '../types'

interface UseDebtEntriesHistoryProps {
  debt: Debt | null
  onSuccess?: () => void
}

export function useDebtEntriesHistory({ debt, onSuccess }: UseDebtEntriesHistoryProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { config } = useCurrency()

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

  const rawEntries: DebtEntry[] =
    debt?.entries && debt.entries.length > 0
      ? debt.entries
      : debt
        ? [
            {
              id: `base_${debt.id}`,
              amountFils: debt.amountFils,
              date: debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate),
              title: debt.type === 'lent' ? 'أصل السلفة / الدين' : 'أصل الدين المقترض',
              note: debt.note || '',
              createdAt: debt.createdAt instanceof Date ? debt.createdAt : new Date(debt.createdAt || debt.startDate),
            },
          ]
        : []

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !debt) return
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
    if (!user || !debt) return
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
    if (!user || !debt) return
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

  const resetEntriesState = () => {
    setIsAddingEntry(false)
    setEditingEntryId(null)
    setConfirmDeleteEntryId(null)
    setEntryError(null)
  }

  return {
    rawEntries,
    entryError,
    isCompactingEntries,
    handleCompactEntries,
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
    handleAddEntry,
    editingEntryId,
    setEditingEntryId,
    editEntryAmountStr,
    setEditEntryAmountStr,
    editEntryDateStr,
    setEditEntryDateStr,
    editEntryTitle,
    setEditEntryTitle,
    editEntryNote,
    setEditEntryNote,
    isSavingEditEntry,
    handleStartEditEntry,
    handleSaveEditEntry,
    confirmDeleteEntryId,
    setConfirmDeleteEntryId,
    isDeletingEntry,
    handleDeleteEntry,
    resetEntriesState,
  }
}
