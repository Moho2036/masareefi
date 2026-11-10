import {
  doc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { Debt, DebtPayment, DebtEntry } from '../../types'
import { debtConverter } from '../converters'
import { commitFirestoreWrite, safeGetDoc } from '../../lib/firestoreOffline'
import {
  toTimestamp,
  serializePayment,
  serializeDebtEntry,
  generatePaymentId,
  type CompactDebtPaymentsResult,
  type CompactDebtEntriesResult,
} from './typesAndHelpers'

export interface CompactedPaymentsListResult {
  payments: DebtPayment[]
  mergedCount: number
  mergedAmountFils: number
}

export interface CompactedEntriesListResult {
  entries: DebtEntry[]
  mergedCount: number
  mergedAmountFils: number
}

export function buildCompactedPaymentsList(
  payments: DebtPayment[],
  keepCount = 10
): CompactedPaymentsListResult {
  if (!Array.isArray(payments) || payments.length <= keepCount) {
    return { payments: payments || [], mergedCount: 0, mergedAmountFils: 0 }
  }

  const toKeep = payments.slice(-keepCount)
  const toMerge = payments.slice(0, -keepCount)
  const mergedCount = toMerge.reduce((count, p) => {
    if (p.isMerged && typeof p.note === 'string') {
      const match = p.note.match(/\((\d+)\s*دفعة\)/)
      return count + (match ? parseInt(match[1], 10) : 1)
    }
    return count + 1
  }, 0)
  const mergedAmountFils = toMerge.reduce((sum, p) => sum + p.amountFils, 0)

  const lastMergedPayment = toMerge[toMerge.length - 1]
  const mergedDate =
    lastMergedPayment.date instanceof Date
      ? lastMergedPayment.date
      : new Date(lastMergedPayment.date)

  const mergedTxIds: string[] = []
  for (const p of toMerge) {
    if (p.transactionId && typeof p.transactionId === 'string' && p.transactionId.trim()) {
      const trimmed = p.transactionId.trim()
      if (!mergedTxIds.includes(trimmed)) {
        mergedTxIds.push(trimmed)
      }
    } else if (!p.isMerged && p.id) {
      const defaultTxId = `debt_pay_${p.id}`
      if (!mergedTxIds.includes(defaultTxId)) {
        mergedTxIds.push(defaultTxId)
      }
    }
    if (Array.isArray(p.mergedTransactionIds)) {
      for (const mId of p.mergedTransactionIds) {
        if (mId && typeof mId === 'string' && mId.trim() && !mergedTxIds.includes(mId.trim())) {
          mergedTxIds.push(mId.trim())
        }
      }
    }
  }

  const genericNotes = new Set([
    'دفعة سداد',
    'دفعة استرداد دين',
    'دفعة سداد دين',
    'استرداد دفعة دين',
    'سداد دفعة دين',
  ])
  const customNotes: string[] = []
  for (const p of toMerge) {
    if (p.note && typeof p.note === 'string') {
      const trimmed = p.note.trim()
      if (trimmed && !genericNotes.has(trimmed)) {
        const cleaned = trimmed
          .replace(/^رصيد دفعات سابقة مدمجة \(\d+\s*دفعة\):?\s*/, '')
          .trim()
        if (cleaned && !customNotes.includes(cleaned)) {
          customNotes.push(cleaned)
        }
      }
    }
  }
  const baseMergedNote = `رصيد دفعات سابقة مدمجة (${mergedCount} دفعة)`
  const finalMergedNote =
    customNotes.length > 0
      ? `${baseMergedNote}: ${customNotes.join(' ، ')}`.slice(0, 500)
      : baseMergedNote

  const consolidatedPayment: DebtPayment = {
    id: `compacted_${generatePaymentId()}`,
    amountFils: mergedAmountFils,
    date: mergedDate,
    note: finalMergedNote,
    createdAt: new Date(),
    isMerged: true,
    mergedTransactionIds: mergedTxIds,
  }

  return {
    payments: [consolidatedPayment, ...toKeep],
    mergedCount,
    mergedAmountFils,
  }
}

export function buildCompactedEntriesList(
  entries: DebtEntry[],
  debtId: string,
  keepCount = 10
): CompactedEntriesListResult {
  if (!Array.isArray(entries) || entries.length <= keepCount) {
    return { entries: entries || [], mergedCount: 0, mergedAmountFils: 0 }
  }

  const toKeep = entries.slice(-keepCount)
  const toMerge = entries.slice(0, -keepCount)
  const mergedCount = toMerge.reduce((count, e) => {
    if (e.isMerged && typeof e.title === 'string') {
      const match = e.title.match(/\((\d+)\s*سلفة\)/)
      return count + (match ? parseInt(match[1], 10) : 1)
    }
    return count + 1
  }, 0)
  const mergedAmountFils = toMerge.reduce((sum, e) => sum + e.amountFils, 0)

  const lastMergedEntry = toMerge[toMerge.length - 1]
  const mergedDate =
    lastMergedEntry.date instanceof Date
      ? lastMergedEntry.date
      : new Date(lastMergedEntry.date)

  const mergedTxIds: string[] = []
  for (const e of toMerge) {
    if (e.transactionId && typeof e.transactionId === 'string' && e.transactionId.trim()) {
      const trimmed = e.transactionId.trim()
      if (!mergedTxIds.includes(trimmed)) {
        mergedTxIds.push(trimmed)
      }
    } else if (!e.isMerged && e.id) {
      const defaultTxId =
        e.id === `entry_${debtId}` || e.id === `entry_base_${debtId}`
          ? `debt_init_${debtId}`
          : e.id.startsWith('entry_base_')
            ? `debt_init_${e.id.replace('entry_base_', '')}`
            : `debt_entry_${e.id}`
      if (defaultTxId && !mergedTxIds.includes(defaultTxId)) {
        mergedTxIds.push(defaultTxId)
      }
    }
    if (Array.isArray(e.mergedTransactionIds)) {
      for (const mId of e.mergedTransactionIds) {
        if (mId && typeof mId === 'string' && mId.trim() && !mergedTxIds.includes(mId.trim())) {
          mergedTxIds.push(mId.trim())
        }
      }
    }
  }

  const genericTitles = new Set([
    'سلفة إضافية',
    'سلفة',
    'دفعة سلفة',
  ])
  const customNotes: string[] = []
  for (const e of toMerge) {
    const rawText = (e.title || e.note || '').trim()
    if (rawText && !genericTitles.has(rawText)) {
      const cleaned = rawText
        .replace(/^رصيد سلف سابقة مدمجة \(\d+\s*سلفة\):?\s*/, '')
        .trim()
      if (cleaned && !customNotes.includes(cleaned)) {
        customNotes.push(cleaned)
      }
    }
  }
  const baseMergedTitle = `رصيد سلف سابقة مدمجة (${mergedCount} سلفة)`
  const finalMergedNote =
    customNotes.length > 0
      ? `رصيد مدمج: ${customNotes.join(' ، ')}`.slice(0, 500)
      : `رصيد مدمج لـ ${mergedCount} سلفة سابقة`

  const consolidatedEntry: DebtEntry = {
    id: `compacted_entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amountFils: mergedAmountFils,
    date: mergedDate,
    title: baseMergedTitle,
    note: finalMergedNote,
    createdAt: new Date(),
    isMerged: true,
    mergedTransactionIds: mergedTxIds,
  }

  return {
    entries: [consolidatedEntry, ...toKeep],
    mergedCount,
    mergedAmountFils,
  }
}

export async function compactDebtPayments(
  uid: string,
  debtId: string
): Promise<CompactDebtPaymentsResult> {
  const docRef = doc(db, 'users', uid, 'debts', debtId).withConverter(debtConverter)
  const snap = await safeGetDoc(docRef)
  if (!snap.exists() || !snap.data()) {
    throw new Error('سجل الدين غير موجود')
  }

  const debt = snap.data()!
  const payments = debt.payments || []

  // If 10 or fewer payments, compaction is not required
  if (payments.length <= 10) {
    return { mergedCount: 0, mergedAmountFils: 0 }
  }

  const { payments: newPayments, mergedCount, mergedAmountFils } = buildCompactedPaymentsList(payments, 10)
  const serializedPayments = newPayments.map(serializePayment)

  const batch = writeBatch(db)
  batch.update(docRef, {
    payments: serializedPayments,
  })

  await commitFirestoreWrite(batch.commit())
  return { mergedCount, mergedAmountFils }
}

export async function compactDebtEntries(
  uid: string,
  debtId: string
): Promise<CompactDebtEntriesResult> {
  const docRef = doc(db, 'users', uid, 'debts', debtId).withConverter(debtConverter)
  const snap = await safeGetDoc(docRef)
  if (!snap.exists() || !snap.data()) {
    throw new Error('سجل الدين غير موجود')
  }

  const debt = snap.data()!
  const entries = debt.entries || []

  // If 10 or fewer entries, compaction is not required
  if (entries.length <= 10) {
    return { mergedCount: 0, mergedAmountFils: 0 }
  }

  const { entries: newEntries, mergedCount, mergedAmountFils } = buildCompactedEntriesList(entries, debtId, 10)
  const serializedEntries = newEntries.map(serializeDebtEntry)

  const batch = writeBatch(db)
  batch.update(docRef, {
    entries: serializedEntries,
  })

  await commitFirestoreWrite(batch.commit())
  return { mergedCount, mergedAmountFils }
}

export async function mergePersonDebts(
  uid: string,
  debtsToMerge: Debt[]
): Promise<string> {
  if (!Array.isArray(debtsToMerge) || debtsToMerge.length < 2) {
    throw new Error('يجب اختيار دينين على الأقل للدمج')
  }

  const firstType = debtsToMerge[0].type
  const allSameType = debtsToMerge.every((d) => d.type === firstType)
  if (!allSameType) {
    throw new Error('لا يمكن دمج ديون من نوعين مختلفين (لي وعليّ) معاً')
  }

  // Sort by startDate ascending to pick the primary (oldest) debt
  const sorted = [...debtsToMerge].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  )
  const primaryDebt = sorted[0]
  const secondaryDebts = sorted.slice(1)

  // Collect and consolidate entries
  const consolidatedEntries: DebtEntry[] = []
  for (const d of sorted) {
    if (Array.isArray(d.entries) && d.entries.length > 0) {
      for (const e of d.entries) {
        consolidatedEntries.push({ ...e })
      }
    } else {
      const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${d.id}`)
      const initTxSnap = await safeGetDoc(initTxRef)
      const hasInitTx = Boolean(initTxSnap && typeof initTxSnap.exists === 'function' && initTxSnap.exists())

      consolidatedEntries.push({
        id: `entry_base_${d.id}`,
        amountFils: d.amountFils,
        date: d.startDate instanceof Date ? d.startDate : new Date(d.startDate),
        title: `أصل دين: ${d.personName}`,
        note: d.note || '',
        transactionId: hasInitTx ? `debt_init_${d.id}` : undefined,
        createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt || d.startDate),
      })
    }
  }
  consolidatedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Collect and consolidate payments
  const consolidatedPayments: DebtPayment[] = []
  for (const d of sorted) {
    if (Array.isArray(d.payments)) {
      for (const p of d.payments) {
        consolidatedPayments.push({ ...p })
      }
    }
  }
  consolidatedPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Consolidate notes
  const notesSet = new Set<string>()
  for (const d of sorted) {
    if (d.note && d.note.trim()) {
      notesSet.add(d.note.trim())
    }
  }
  const combinedNote = Array.from(notesSet).join(' | ').slice(0, 500)

  const totalAmountFils = sorted.reduce((sum, d) => sum + d.amountFils, 0)
  const totalPaidFils = sorted.reduce((sum, d) => sum + (d.paidFils || 0), 0)
  const settled = totalPaidFils === totalAmountFils

  const fallbackDueDate = sorted
    .filter((d) => !d.settled && d.dueDate)
    .map((d) => (d.dueDate instanceof Date ? d.dueDate : new Date(d.dueDate!)))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null
  const effectiveDueDate =
    !primaryDebt.settled && primaryDebt.dueDate ? primaryDebt.dueDate : fallbackDueDate

  let finalPayments = consolidatedPayments
  if (consolidatedPayments.length > 100) {
    finalPayments = buildCompactedPaymentsList(consolidatedPayments, 10).payments
  }

  let finalEntries = consolidatedEntries
  if (consolidatedEntries.length > 100) {
    finalEntries = buildCompactedEntriesList(consolidatedEntries, primaryDebt.id, 99).entries
  }

  const batch = writeBatch(db)

  const primaryRef = doc(db, 'users', uid, 'debts', primaryDebt.id).withConverter(debtConverter)
  batch.update(primaryRef, {
    amountFils: totalAmountFils,
    paidFils: totalPaidFils,
    settled,
    dueDate: effectiveDueDate ? toTimestamp(effectiveDueDate) : null,
    note: combinedNote,
    payments: finalPayments.map(serializePayment),
    entries: finalEntries.map(serializeDebtEntry),
  })

  // Delete secondary debt documents
  for (const secondary of secondaryDebts) {
    const secRef = doc(db, 'users', uid, 'debts', secondary.id).withConverter(debtConverter)
    batch.delete(secRef)
  }

  await commitFirestoreWrite(batch.commit())
  return primaryDebt.id
}
