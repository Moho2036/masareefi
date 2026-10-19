import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { formatDateInput } from './dates'
import { db } from './firebase'
import type { Category, Transaction, Debt, Recurring, MoneyCircle, UserSettings } from '../types'
import {
  categoryConverter,
  transactionConverter,
  debtConverter,
  recurringConverter,
  userSettingsConverter,
} from '../services/converters'
import { circleConverter } from '../services/moneyCircles'

export interface MasareefiBackup {
  version: 1
  app: 'masareefi'
  exportedAt: string
  data: {
    settings?: UserSettings
    categories: Category[]
    transactions: Transaction[]
    debts: Debt[]
    recurring: Recurring[]
    circles: MoneyCircle[]
  }
}

export interface BackupValidationResult {
  valid: boolean
  error?: string
  summary?: {
    exportedAt: string
    transactionsCount: number
    categoriesCount: number
    debtsCount: number
    recurringCount: number
    circlesCount: number
    hasSettings: boolean
  }
  data?: MasareefiBackup
}

/**
 * Exports all user data across all collections into a structured JSON backup.
 */
export async function createFullBackup(uid: string): Promise<MasareefiBackup> {
  const [
    settingsSnap,
    categoriesSnap,
    transactionsSnap,
    debtsSnap,
    recurringSnap,
    circlesSnap,
  ] = await Promise.all([
    getDoc(doc(db, 'users', uid).withConverter(userSettingsConverter)),
    getDocs(collection(db, 'users', uid, 'categories').withConverter(categoryConverter)),
    getDocs(collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)),
    getDocs(collection(db, 'users', uid, 'debts').withConverter(debtConverter)),
    getDocs(collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)),
    getDocs(collection(db, 'users', uid, 'circles').withConverter(circleConverter)),
  ])

  const settings = settingsSnap.exists() ? settingsSnap.data() : undefined
  const categories = categoriesSnap.docs.map((d) => d.data())
  const transactions = transactionsSnap.docs.map((d) => d.data())
  const debts = debtsSnap.docs.map((d) => d.data())
  const recurring = recurringSnap.docs.map((d) => d.data())
  const circles = circlesSnap.docs.map((d) => d.data())

  return {
    version: 1,
    app: 'masareefi',
    exportedAt: new Date().toISOString(),
    data: {
      settings,
      categories,
      transactions,
      debts,
      recurring,
      circles,
    },
  }
}

/**
 * Triggers a browser download of the full JSON backup.
 */
export function downloadBackupFile(backup: MasareefiBackup): void {
  const jsonStr = JSON.stringify(backup, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const dateStr = formatDateInput(new Date())
  const a = document.createElement('a')
  a.href = url
  a.download = `masareefi-backup-${dateStr}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function parseDate(val: unknown): Date {
  if (val instanceof Date) return val
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

/**
 * Validates the schema and structure of an imported JSON backup file.
 */
export function validateBackup(jsonText: string): BackupValidationResult {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'الملف لا يحتوي على بيانات JSON صالحة' }
    }

    if (parsed.app !== 'masareefi') {
      return { valid: false, error: 'الملف المحدد ليس نسخة احتياطية خاصة بتطبيق مصاريفي' }
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { valid: false, error: 'هيكل البيانات داخل الملف غير صالح أو مفقود' }
    }

    const data = parsed.data as Record<string, unknown>
    const categories = Array.isArray(data.categories) ? (data.categories as Category[]) : []
    const transactions = Array.isArray(data.transactions) ? (data.transactions as Transaction[]) : []
    const debts = Array.isArray(data.debts) ? (data.debts as Debt[]) : []
    const recurring = Array.isArray(data.recurring) ? (data.recurring as Recurring[]) : []
    const circles = Array.isArray(data.circles) ? (data.circles as MoneyCircle[]) : []
    const settings = data.settings && typeof data.settings === 'object' ? (data.settings as UserSettings) : undefined

    const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString()

    const backup: MasareefiBackup = {
      version: 1,
      app: 'masareefi',
      exportedAt,
      data: {
        settings,
        categories,
        transactions,
        debts,
        recurring,
        circles,
      },
    }

    return {
      valid: true,
      summary: {
        exportedAt,
        transactionsCount: transactions.length,
        categoriesCount: categories.length,
        debtsCount: debts.length,
        recurringCount: recurring.length,
        circlesCount: circles.length,
        hasSettings: Boolean(settings),
      },
      data: backup,
    }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'تعذر قراءة ملف النسخة الاحتياطية',
    }
  }
}

/**
 * Restores a full backup into the user's Firestore collections.
 * Uses chunked writeBatch (max 400 docs per batch) and preserves original document IDs.
 */
export async function restoreBackup(uid: string, backup: MasareefiBackup): Promise<void> {
  type BatchOp = (b: WriteBatch) => void
  const ops: BatchOp[] = []

  // 1. Settings
  if (backup.data.settings) {
    const s = backup.data.settings
    const userSettingsRef = doc(db, 'users', uid).withConverter(userSettingsConverter)
    const existingSnap = await getDoc(userSettingsRef)
    let finalCreatedAt: unknown = undefined

    if (existingSnap && typeof existingSnap.exists === 'function' && existingSnap.exists()) {
      const existingData = existingSnap.data()
      if (existingData?.createdAt) {
        finalCreatedAt = existingData.createdAt
      }
    }

    if (!finalCreatedAt) {
      finalCreatedAt = s.createdAt ? parseDate(s.createdAt) : new Date()
    }

    const settingsData: UserSettings = {
      displayName: (s.displayName || '').slice(0, 100),
      currency: (s.currency || 'JOD').trim().slice(0, 20),
      monthStartDay: Math.min(28, Math.max(1, Math.round(s.monthStartDay || 1))),
      theme: s.theme || 'system',
      ...(typeof s.rolloverBalance === 'boolean' ? { rolloverBalance: s.rolloverBalance } : {}),
      createdAt: finalCreatedAt as any,
    }
    ops.push((b) => b.set(userSettingsRef, settingsData, { merge: true }))
  }

  // 2. Categories
  for (const cat of backup.data.categories) {
    if (!cat.id) continue
    const catRef = doc(db, 'users', uid, 'categories', cat.id).withConverter(categoryConverter)
    const catData: Category = {
      id: cat.id,
      name: (cat.name || '').trim().slice(0, 40),
      type: cat.type || 'expense',
      icon: (cat.icon || 'tag').slice(0, 16),
      color: cat.color || '#10b981',
      archived: Boolean(cat.archived),
      order: Math.max(0, Math.round(cat.order ?? 0)),
    }
    ops.push((b) => b.set(catRef, catData))
  }

  // 3. Transactions
  for (const tx of backup.data.transactions) {
    if (!tx.id) continue
    const txRef = doc(db, 'users', uid, 'transactions', tx.id).withConverter(transactionConverter)
    const title = typeof tx.title === 'string' && tx.title.trim() ? tx.title.trim().slice(0, 100) : undefined
    const recurringId = typeof tx.recurringId === 'string' && tx.recurringId.trim() ? tx.recurringId.trim().slice(0, 128) : undefined

    const txData: Transaction = {
      id: tx.id,
      type: tx.type || 'expense',
      amountFils: Math.round(Number(tx.amountFils || 0)),
      categoryId: tx.categoryId || '',
      date: parseDate(tx.date),
      note: typeof tx.note === 'string' ? tx.note.slice(0, 500) : '',
      createdAt: tx.createdAt ? parseDate(tx.createdAt) : new Date(),
      ...(title !== undefined ? { title } : {}),
      ...(recurringId !== undefined ? { recurringId } : {}),
    }
    ops.push((b) => b.set(txRef, txData))
  }

  // 4. Debts
  for (const d of backup.data.debts) {
    if (!d.id) continue
    const debtRef = doc(db, 'users', uid, 'debts', d.id).withConverter(debtConverter)
    const amountFils = Math.round(Number(d.amountFils || 0))
    const rawPaidFils = Math.round(Number(d.paidFils || 0))
    const paidFils = Math.max(0, Math.min(amountFils, rawPaidFils))
    const settled = paidFils === amountFils

    const payments = (d.payments || []).map((p) => {
      const item: { id: string; amountFils: number; date: Date; note?: string; createdAt: Date } = {
        id: p.id,
        amountFils: Math.round(Number(p.amountFils || 0)),
        date: parseDate(p.date),
        createdAt: p.createdAt ? parseDate(p.createdAt) : new Date(),
      }
      if (typeof p.note === 'string' && p.note.trim()) {
        item.note = p.note.trim().slice(0, 500)
      }
      return item
    })

    const debtData: Debt = {
      id: d.id,
      personName: (d.personName || '').trim().slice(0, 100),
      type: d.type || 'lent',
      amountFils,
      paidFils,
      startDate: parseDate(d.startDate),
      dueDate: d.dueDate ? parseDate(d.dueDate) : null,
      note: typeof d.note === 'string' ? d.note.slice(0, 500) : '',
      settled,
      payments,
      createdAt: d.createdAt ? parseDate(d.createdAt) : new Date(),
    }
    ops.push((b) => b.set(debtRef, debtData))
  }

  // 5. Recurring
  for (const r of backup.data.recurring) {
    if (!r.id) continue
    const recRef = doc(db, 'users', uid, 'recurring', r.id).withConverter(recurringConverter)
    const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 100) : undefined
    const circleId = typeof r.circleId === 'string' && r.circleId.trim() ? r.circleId.trim().slice(0, 128) : undefined

    const recData: Recurring = {
      id: r.id,
      type: r.type || 'expense',
      amountFils: Math.round(Number(r.amountFils || 0)),
      categoryId: r.categoryId || '',
      note: typeof r.note === 'string' ? r.note.slice(0, 500) : '',
      frequency: r.frequency || 'monthly',
      startDate: parseDate(r.startDate),
      nextDate: parseDate(r.nextDate),
      endDate: r.endDate ? parseDate(r.endDate) : null,
      active: Boolean(r.active),
      createdAt: r.createdAt ? parseDate(r.createdAt) : new Date(),
      ...(title !== undefined ? { title } : {}),
      ...(circleId !== undefined ? { circleId } : {}),
      ...(typeof r.skipMonth === 'number' && !isNaN(r.skipMonth) ? { skipMonth: Math.round(r.skipMonth) } : {}),
    }
    ops.push((b) => b.set(recRef, recData))
  }

  // 6. Circles
  for (const c of backup.data.circles) {
    if (!c.id) continue
    const circleRef = doc(db, 'users', uid, 'circles', c.id).withConverter(circleConverter)
    const recurringId = typeof c.recurringId === 'string' && c.recurringId.trim() ? c.recurringId.trim().slice(0, 128) : undefined

    const members = (c.members || []).map((m) => ({
      id: m.id,
      name: (m.name || '').trim().slice(0, 50),
      turnMonth: Math.round(m.turnMonth),
      paidMonths: (m.paidMonths || []).map(Number),
    }))

    const circleData: MoneyCircle = {
      id: c.id,
      name: (c.name || '').trim().slice(0, 100),
      monthlyAmountFils: Math.round(Number(c.monthlyAmountFils || 0)),
      membersCount: Math.round(Number(c.membersCount || 2)),
      totalAmountFils: Math.round(Number(c.totalAmountFils || 0)),
      myTurnMonth: Math.round(Number(c.myTurnMonth || 1)),
      startDate: parseDate(c.startDate),
      members,
      status: c.status || 'active',
      createdAt: c.createdAt ? parseDate(c.createdAt) : new Date(),
      ...(recurringId !== undefined ? { recurringId } : {}),
      ...(c.isManager !== undefined ? { isManager: Boolean(c.isManager) } : {}),
    }
    ops.push((b) => b.set(circleRef, circleData))
  }

  // Chunk operations into batches of <= 400 (Firestore limit is 500)
  const CHUNK_SIZE = 400
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const op of chunk) {
      op(batch)
    }
    await batch.commit()
  }
}
