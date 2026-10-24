import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
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
import { syncCategoryUsageCache } from './categoryUsage'

export type RestoreMode = 'merge' | 'replace'

export interface RestoreOptions {
  mode?: RestoreMode
}

export interface WorkHoursPrefsBackup {
  currencyCode?: string
  salary?: string
  isCustomSalary?: boolean
  itemPrice?: string
  isCustomItemPrice?: boolean
  dailyHours?: string
  workDays?: string
  itemName?: string
}

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
    workHoursPrefs?: WorkHoursPrefsBackup
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

  let workHoursPrefs: WorkHoursPrefsBackup | undefined
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const rawPrefs = localStorage.getItem('masareefi_work_hours_prefs')
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs)
        if (parsed && typeof parsed === 'object') {
          workHoursPrefs = parsed
        }
      }
    } catch {
      // ignore
    }
  }

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
      ...(workHoursPrefs ? { workHoursPrefs } : {}),
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

export function parseDate(val: unknown): Date {
  if (val instanceof Date && !isNaN(val.getTime())) return val
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  if (
    val &&
    typeof val === 'object' &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    const d = (val as { toDate: () => Date }).toDate()
    if (d instanceof Date && !isNaN(d.getTime())) return d
  }
  if (
    val &&
    typeof val === 'object' &&
    'seconds' in val &&
    typeof (val as { seconds: number }).seconds === 'number'
  ) {
    const d = new Date((val as { seconds: number }).seconds * 1000)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

/**
 * Ensures that every transaction and recurring rule has a corresponding valid Category.
 * If a categoryId is missing or points to a non-existent category, a fallback category
 * is generated and added to the categories list so no orphan transactions are created.
 */
export function resolveOrphanCategories(
  categories: Category[],
  transactions: Transaction[],
  recurring: Recurring[]
): Category[] {
  const existingCatMap = new Map<string, Category>()
  for (const c of categories) {
    if (c && typeof c === 'object' && c.id) {
      existingCatMap.set(c.id, c)
    }
  }

  const updatedCategories = [...existingCatMap.values()]

  const ensureCategory = (catId: string, txType: 'expense' | 'income') => {
    if (existingCatMap.has(catId)) return catId

    const fallbackCat: Category = {
      id: catId,
      name: txType === 'income' ? 'دخل عام (مسترد)' : 'مصاريف عامة (مستردة)',
      type: txType,
      icon: txType === 'income' ? '💰' : '📁',
      color: txType === 'income' ? '#10B981' : '#64748B',
      archived: false,
      order: 999,
    }
    existingCatMap.set(catId, fallbackCat)
    updatedCategories.push(fallbackCat)
    return catId
  }

  for (const tx of transactions) {
    if (tx && tx.id) {
      const type = tx.type === 'income' ? 'income' : 'expense'
      const rawCatId = typeof tx.categoryId === 'string' ? tx.categoryId.trim() : ''
      const targetCatId = rawCatId || `cat_fallback_${type}`
      tx.categoryId = targetCatId
      ensureCategory(targetCatId, type)
    }
  }

  for (const rec of recurring) {
    if (rec && rec.id) {
      const type = rec.type === 'income' ? 'income' : 'expense'
      const rawCatId = typeof rec.categoryId === 'string' ? rec.categoryId.trim() : ''
      const targetCatId = rawCatId || `cat_fallback_${type}`
      rec.categoryId = targetCatId
      ensureCategory(targetCatId, type)
    }
  }

  return updatedCategories
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

    // Filter valid records (matching criteria in restoreBackup)
    const validCategories = categories.filter((c) => Boolean(c && typeof c === 'object' && c.id))
    const validTransactions = transactions.filter(
      (t) => Boolean(t && typeof t === 'object' && t.id && Math.round(Number(t.amountFils || 0)) > 0)
    )
    const validDebts = debts
      .filter((d) => Boolean(d && typeof d === 'object' && d.id && Math.round(Number(d.amountFils || 0)) > 0))
      .map((d) => {
        const amountFils = Math.round(Number(d.amountFils || 0))
        const rawPaidFils = Math.round(Number(d.paidFils || 0))
        const payments = (Array.isArray(d.payments) ? d.payments : [])
          .filter((p) => Boolean(p && typeof p === 'object' && Math.round(Number(p.amountFils || 0)) > 0))
          .map((p) => ({
            ...p,
            id: p.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            amountFils: Math.round(Number(p.amountFils || 0)),
            note: typeof p.note === 'string' && p.note.trim() ? p.note.trim().slice(0, 500) : 'دفعة سداد',
          }))
          .slice(0, 100)

        const paymentsSum = payments.reduce((sum, p) => sum + p.amountFils, 0)
        const paidFils = Math.max(0, Math.min(amountFils, Math.max(rawPaidFils, paymentsSum)))
        const settled = paidFils === amountFils

        return {
          ...d,
          amountFils,
          paidFils,
          settled,
          payments,
        }
      })

    const validRecurring = recurring
      .filter(
        (r) => Boolean(r && typeof r === 'object' && r.id && Math.round(Number(r.amountFils || 0)) > 0)
      )
      .map((r) => {
        const item = { ...r }
        if (
          item.skipMonth !== undefined &&
          item.skipMonth !== null &&
          Number.isFinite(Number(item.skipMonth)) &&
          Math.round(Number(item.skipMonth)) >= 1 &&
          Math.round(Number(item.skipMonth)) <= 50
        ) {
          item.skipMonth = Math.round(Number(item.skipMonth))
        } else {
          delete item.skipMonth
        }
        return item
      })

    const validCircles = circles.filter(
      (c) => Boolean(c && typeof c === 'object' && c.id && Math.round(Number(c.monthlyAmountFils || 0)) > 0)
    )

    let workHoursPrefs: WorkHoursPrefsBackup | undefined
    if (data.workHoursPrefs && typeof data.workHoursPrefs === 'object') {
      const p = data.workHoursPrefs as Record<string, unknown>
      workHoursPrefs = {
        ...(typeof p.currencyCode === 'string' ? { currencyCode: p.currencyCode.slice(0, 20) } : {}),
        ...(typeof p.salary === 'string' ? { salary: p.salary.slice(0, 30) } : {}),
        ...(typeof p.isCustomSalary === 'boolean' ? { isCustomSalary: p.isCustomSalary } : {}),
        ...(typeof p.itemPrice === 'string' ? { itemPrice: p.itemPrice.slice(0, 30) } : {}),
        ...(typeof p.isCustomItemPrice === 'boolean' ? { isCustomItemPrice: p.isCustomItemPrice } : {}),
        ...(typeof p.dailyHours === 'string' ? { dailyHours: p.dailyHours.slice(0, 10) } : {}),
        ...(typeof p.workDays === 'string' ? { workDays: p.workDays.slice(0, 10) } : {}),
        ...(typeof p.itemName === 'string' ? { itemName: p.itemName.slice(0, 100) } : {}),
      }
    }

    // Resolve orphan categories so every transaction and recurring item is backed by a valid category
    const resolvedCategories = resolveOrphanCategories(
      validCategories,
      validTransactions,
      validRecurring
    )

    const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString()

    const backup: MasareefiBackup = {
      version: 1,
      app: 'masareefi',
      exportedAt,
      data: {
        settings,
        categories: resolvedCategories,
        transactions: validTransactions,
        debts: validDebts,
        recurring: validRecurring,
        circles: validCircles,
        ...(workHoursPrefs ? { workHoursPrefs } : {}),
      },
    }

    return {
      valid: true,
      summary: {
        exportedAt,
        transactionsCount: validTransactions.length,
        categoriesCount: resolvedCategories.length,
        debtsCount: validDebts.length,
        recurringCount: validRecurring.length,
        circlesCount: validCircles.length,
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
export async function restoreBackup(
  uid: string,
  backup: MasareefiBackup,
  optionsOrMode: RestoreMode | RestoreOptions = 'merge'
): Promise<void> {
  if (!backup || !backup.data || typeof backup.data !== 'object') {
    throw new Error('بيانات النسخة الاحتياطية غير صالحة أو مفقودة')
  }

  // Restore work hours calculator preferences to localStorage if present
  if (
    backup.data.workHoursPrefs &&
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined'
  ) {
    try {
      localStorage.setItem(
        'masareefi_work_hours_prefs',
        JSON.stringify(backup.data.workHoursPrefs)
      )
    } catch {
      // ignore
    }
  }

  // Pre-validation and orphan category resolution:
  // Ensures every transaction/recurring rule maps to an existing category
  // before starting any deletion or writing in Firestore.
  const resolvedCategories = resolveOrphanCategories(
    backup.data.categories || [],
    backup.data.transactions || [],
    backup.data.recurring || []
  )
  backup.data.categories = resolvedCategories

  const mode: RestoreMode =
    typeof optionsOrMode === 'string'
      ? optionsOrMode
      : optionsOrMode?.mode || 'merge'

  type BatchOp = (b: WriteBatch) => void
  const ops: BatchOp[] = []

  const rawUserRef = doc(db, 'users', uid)

  // Query existing docs in parallel to minimize round-trip latency
  const [
    existingUserSnap,
    existingCatsSnap,
    existingTxsSnap,
    existingDebtsSnap,
    existingRecSnap,
    existingCirclesSnap,
  ] = await Promise.all([
    backup.data.settings ? getDoc(rawUserRef) : Promise.resolve(null),
    getDocs(collection(db, 'users', uid, 'categories').withConverter(categoryConverter)),
    getDocs(collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)),
    getDocs(collection(db, 'users', uid, 'debts').withConverter(debtConverter)),
    getDocs(collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)),
    getDocs(collection(db, 'users', uid, 'circles').withConverter(circleConverter)),
  ])

  // 1. Settings
  if (backup.data.settings) {
    const s = backup.data.settings
    const userExists = Boolean(
      existingUserSnap &&
      typeof existingUserSnap.exists === 'function' &&
      existingUserSnap.exists()
    )

    const baseSettings = {
      displayName: (s.displayName || '').slice(0, 100),
      currency: (s.currency || 'JOD').trim().slice(0, 20),
      monthStartDay: Math.min(28, Math.max(1, Math.round(s.monthStartDay || 1))),
      theme: s.theme || 'system',
      rolloverBalance: typeof s.rolloverBalance === 'boolean' ? s.rolloverBalance : true,
    }

    if (userExists) {
      // Document exists: use update without createdAt to preserve original nanosecond precision
      // and satisfy firestore.rules strict fieldUnchanged('createdAt') rule
      ops.push((b) => b.update(rawUserRef, baseSettings))
    } else {
      // Document does not exist: create document with createdAt
      const finalCreatedAt = s.createdAt ? Timestamp.fromDate(parseDate(s.createdAt)) : serverTimestamp()
      const setData = {
        ...baseSettings,
        createdAt: finalCreatedAt,
      }
      ops.push((b) => b.set(rawUserRef, setData))
    }
  }

  // 2. Categories
  const existingCatsMap = new Map<string, Category>()
  if (existingCatsSnap && existingCatsSnap.docs) {
    for (const d of existingCatsSnap.docs) {
      existingCatsMap.set(d.id, d.data())
    }
  }

  // Remappings from deleted existingCat.id -> targetRestoredCat.id
  const categoryIdRemap = new Map<string, string>()

  if (mode === 'replace') {
    try {
      syncCategoryUsageCache(backup.data.transactions || [])
    } catch {
      // ignore
    }

    const incomingCategoryIds = new Set(backup.data.categories.map((c) => c.id).filter(Boolean))

    if (existingCatsSnap && existingCatsSnap.docs) {
      for (const existingDoc of existingCatsSnap.docs) {
        if (!incomingCategoryIds.has(existingDoc.id)) {
          ops.push((b) => b.delete(existingDoc.ref))
        }
      }
    }
  }

  // 3. Stale documents cleanup for transactions, debts, recurring, and circles (in replace mode only)
  if (mode === 'replace') {
    const incomingTxIds = new Set(backup.data.transactions.map((t) => t.id).filter(Boolean))
    if (existingTxsSnap && existingTxsSnap.docs) {
      for (const d of existingTxsSnap.docs) {
        if (!incomingTxIds.has(d.id)) {
          ops.push((b) => b.delete(d.ref))
        }
      }
    }

    const incomingDebtIds = new Set(backup.data.debts.map((d) => d.id).filter(Boolean))
    if (existingDebtsSnap && existingDebtsSnap.docs) {
      for (const d of existingDebtsSnap.docs) {
        if (!incomingDebtIds.has(d.id)) {
          ops.push((b) => b.delete(d.ref))
        }
      }
    }

    const incomingRecIds = new Set(backup.data.recurring.map((r) => r.id).filter(Boolean))
    if (existingRecSnap && existingRecSnap.docs) {
      for (const d of existingRecSnap.docs) {
        if (!incomingRecIds.has(d.id)) {
          ops.push((b) => b.delete(d.ref))
        }
      }
    }

    const incomingCircleIds = new Set(backup.data.circles.map((c) => c.id).filter(Boolean))
    if (existingCirclesSnap && existingCirclesSnap.docs) {
      for (const d of existingCirclesSnap.docs) {
        if (!incomingCircleIds.has(d.id)) {
          ops.push((b) => b.delete(d.ref))
        }
      }
    }
  }

  const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

  // Write Categories
  for (const cat of backup.data.categories) {
    if (!cat.id) continue
    const catRef = doc(db, 'users', uid, 'categories', cat.id).withConverter(categoryConverter)
    const existingCat = existingCatsMap.get(cat.id)
    // Prevent changing type if category already exists with this ID in Firestore (firestore.rules requires fieldUnchanged('type'))
    const safeType = existingCat ? existingCat.type : (cat.type || 'expense')
    const safeIcon = (typeof cat.icon === 'string' && cat.icon.trim() ? cat.icon.trim() : '📁').slice(0, 16)
    const safeColor = typeof cat.color === 'string' && HEX_COLOR_REGEX.test(cat.color.trim())
      ? cat.color.trim()
      : '#10B981'

    const catData: Category = {
      id: cat.id,
      name: (cat.name || '').trim().slice(0, 40) || 'تصنيف',
      type: safeType,
      icon: safeIcon,
      color: safeColor,
      archived: Boolean(cat.archived),
      order: Math.max(0, Math.round(cat.order ?? 0)),
    }
    ops.push((b) => b.set(catRef, catData))
  }

  // Write Transactions (validate amountFils > 0)
  for (const tx of backup.data.transactions) {
    if (!tx.id) continue
    const amountFils = Math.round(Number(tx.amountFils || 0))
    if (amountFils <= 0) continue

    const txRef = doc(db, 'users', uid, 'transactions', tx.id).withConverter(transactionConverter)
    const title = typeof tx.title === 'string' && tx.title.trim() ? tx.title.trim().slice(0, 100) : undefined
    const recurringId = typeof tx.recurringId === 'string' && tx.recurringId.trim() ? tx.recurringId.trim().slice(0, 128) : undefined

    const rawCatId = tx.categoryId || ''
    const finalCatId = categoryIdRemap.get(rawCatId) || rawCatId

    const txData: Transaction = {
      id: tx.id,
      type: tx.type === 'income' ? 'income' : 'expense',
      amountFils,
      categoryId: finalCatId,
      date: parseDate(tx.date),
      note: typeof tx.note === 'string' ? tx.note.slice(0, 500) : '',
      createdAt: tx.createdAt ? parseDate(tx.createdAt) : new Date(),
      ...(title !== undefined ? { title } : {}),
      ...(recurringId !== undefined ? { recurringId } : {}),
    }
    ops.push((b) => b.set(txRef, txData))
  }

  // Write Debts (validate amountFils > 0 and payments amountFils > 0)
  for (const d of backup.data.debts) {
    if (!d.id) continue
    const amountFils = Math.round(Number(d.amountFils || 0))
    if (amountFils <= 0) continue

    const debtRef = doc(db, 'users', uid, 'debts', d.id).withConverter(debtConverter)
    const rawPaidFils = Math.round(Number(d.paidFils || 0))

    const payments = (d.payments || [])
      .map((p) => {
        const pAmount = Math.round(Number(p.amountFils || 0))
        if (pAmount <= 0) return null
        const item: { id: string; amountFils: number; date: Date; note: string; transactionId?: string; createdAt: Date } = {
          id: p.id || `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          amountFils: pAmount,
          date: parseDate(p.date),
          createdAt: p.createdAt ? parseDate(p.createdAt) : new Date(),
          note:
            typeof p.note === 'string' && p.note.trim()
              ? p.note.trim().slice(0, 500)
              : 'دفعة سداد',
          transactionId:
            typeof p.transactionId === 'string' && p.transactionId.trim()
              ? p.transactionId.trim()
              : undefined,
        }
        return item
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .slice(0, 100)

    const paymentsSum = payments.reduce((sum, p) => sum + p.amountFils, 0)
    const paidFils = Math.max(0, Math.min(amountFils, Math.max(rawPaidFils, paymentsSum)))
    const settled = paidFils === amountFils

    const debtData: Debt = {
      id: d.id,
      personName: (d.personName || '').trim().slice(0, 100) || 'شخص',
      type: d.type === 'borrowed' ? 'borrowed' : 'lent',
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

  // Write Recurring (validate amountFils > 0)
  for (const r of backup.data.recurring) {
    if (!r.id) continue
    const amountFils = Math.round(Number(r.amountFils || 0))
    if (amountFils <= 0) continue

    const recRef = doc(db, 'users', uid, 'recurring', r.id).withConverter(recurringConverter)
    const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 100) : undefined
    const circleId = typeof r.circleId === 'string' && r.circleId.trim() ? r.circleId.trim().slice(0, 128) : undefined

    const rawCatId = r.categoryId || ''
    const finalCatId = categoryIdRemap.get(rawCatId) || rawCatId

    const skipMonth =
      r.skipMonth !== undefined &&
      r.skipMonth !== null &&
      Number.isFinite(Number(r.skipMonth)) &&
      Math.round(Number(r.skipMonth)) >= 1 &&
      Math.round(Number(r.skipMonth)) <= 50
        ? Math.round(Number(r.skipMonth))
        : undefined

    const recData: Recurring = {
      id: r.id,
      type: r.type === 'income' ? 'income' : 'expense',
      amountFils,
      categoryId: finalCatId,
      note: typeof r.note === 'string' ? r.note.slice(0, 500) : '',
      frequency: r.frequency || 'monthly',
      startDate: parseDate(r.startDate),
      nextDate: parseDate(r.nextDate),
      endDate: r.endDate ? parseDate(r.endDate) : null,
      active: Boolean(r.active),
      createdAt: r.createdAt ? parseDate(r.createdAt) : new Date(),
      ...(title !== undefined ? { title } : {}),
      ...(circleId !== undefined ? { circleId } : {}),
      ...(skipMonth !== undefined ? { skipMonth } : {}),
    }
    ops.push((b) => b.set(recRef, recData))
  }

  // Write Circles (validate monthlyAmountFils > 0 and totalAmountFils = monthlyAmountFils * membersCount)
  for (const c of backup.data.circles) {
    if (!c.id) continue
    const monthlyAmountFils = Math.round(Number(c.monthlyAmountFils || 0))
    if (monthlyAmountFils <= 0) continue

    const membersCount = Math.max(2, Math.min(50, Math.round(Number(c.membersCount || 2))))
    const totalAmountFils = monthlyAmountFils * membersCount
    if (totalAmountFils <= 0) continue

    const circleRef = doc(db, 'users', uid, 'circles', c.id).withConverter(circleConverter)
    const recurringId = typeof c.recurringId === 'string' && c.recurringId.trim() ? c.recurringId.trim().slice(0, 128) : undefined

    const myTurnMonth = Math.max(1, Math.min(membersCount, Math.round(Number(c.myTurnMonth || 1))))

    const members = (c.members || []).map((m) => ({
      id: m.id,
      name: (m.name || '').trim().slice(0, 50),
      turnMonth: Math.round(m.turnMonth),
      paidMonths: (m.paidMonths || []).map(Number),
    }))

    const circleData: MoneyCircle = {
      id: c.id,
      name: (c.name || '').trim().slice(0, 100) || 'جمعية',
      monthlyAmountFils,
      membersCount,
      totalAmountFils,
      myTurnMonth,
      startDate: parseDate(c.startDate),
      members,
      status: c.status === 'completed' ? 'completed' : 'active',
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

export const restoreBackupData = restoreBackup

