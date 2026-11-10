import { parseLocalDateInput } from '../dates'
import { MAX_AMOUNT_FILS } from '../money'
import type {
  Category,
  Transaction,
  Debt,
  DebtPayment,
  DebtEntry,
  Recurring,
  Frequency,
  MoneyCircle,
  UserSettings,
} from '../../types'

export type RestoreMode = 'merge' | 'replace'

export interface RestoreOptions {
  mode?: RestoreMode
}

export interface WorkHoursPrefsBackup {
  currencyCode?: string; salary?: string; isCustomSalary?: boolean; itemPrice?: string
  isCustomItemPrice?: boolean; dailyHours?: string; workDays?: string; workDaysMode?: 'month' | 'week'; itemName?: string
}

export interface MasareefiBackup {
  version: 1
  app: 'baseer' | 'masareefi'
  exportedAt: string
  data: {
    settings?: UserSettings; categories: Category[]; transactions: Transaction[]
    debts: Debt[]; recurring: Recurring[]; circles: MoneyCircle[]; workHoursPrefs?: WorkHoursPrefsBackup
  }
}

export interface BackupValidationResult {
  valid: boolean
  error?: string
  summary?: {
    exportedAt: string; transactionsCount: number; categoriesCount: number
    debtsCount: number; recurringCount: number; circlesCount: number; hasSettings: boolean
  }
  data?: MasareefiBackup
}

export function parseDate(val: unknown): Date {
  if (val instanceof Date && !isNaN(val.getTime())) return val
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return parseLocalDateInput(trimmed)
    const d = new Date(val); if (!isNaN(d.getTime())) return d
  } else if (typeof val === 'number') {
    const d = new Date(val); if (!isNaN(d.getTime())) return d
  } else if (val && typeof val === 'object') {
    if ('toDate' in val && typeof (val as { toDate: () => unknown }).toDate === 'function') {
      const d = (val as { toDate: () => unknown }).toDate()
      if (d instanceof Date && !isNaN(d.getTime())) return d
    }
    if ('seconds' in val && typeof (val as { seconds: unknown }).seconds === 'number') {
      const d = new Date((val as { seconds: number }).seconds * 1000)
      if (!isNaN(d.getTime())) return d
    }
  }
  return new Date()
}

export function sanitizeDebtPayment(raw: unknown): DebtPayment | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<DebtPayment>
  const amountFils = Math.min(MAX_AMOUNT_FILS, Math.round(Number(p.amountFils || 0)))
  if (amountFils <= 0) return null

  const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const note = typeof p.note === 'string' && p.note.trim() ? p.note.trim().slice(0, 500) : 'دفعة سداد'
  const txId = typeof p.transactionId === 'string' && p.transactionId.trim() ? p.transactionId.trim() : undefined
  const mergedTxIds = Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.length > 0
    ? p.mergedTransactionIds.filter(Boolean).map(String)
    : undefined

  return {
    id,
    amountFils,
    date: parseDate(p.date),
    note,
    createdAt: p.createdAt ? parseDate(p.createdAt) : new Date(),
    ...(txId ? { transactionId: txId } : {}),
    ...(p.isMerged ? { isMerged: true } : {}),
    ...(mergedTxIds ? { mergedTransactionIds: mergedTxIds } : {}),
  }
}

export function sanitizeDebtEntry(raw: unknown): DebtEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Partial<DebtEntry>
  const amountFils = Math.min(MAX_AMOUNT_FILS, Math.round(Number(e.amountFils || 0)))
  if (amountFils <= 0) return null

  const id = typeof e.id === 'string' && e.id.trim() ? e.id.trim() : `e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const title = typeof e.title === 'string' && e.title.trim() ? e.title.trim().slice(0, 100) : undefined
  const txId = typeof e.transactionId === 'string' && e.transactionId.trim() ? e.transactionId.trim().slice(0, 128) : undefined
  const mergedTxIds = Array.isArray(e.mergedTransactionIds) && e.mergedTransactionIds.length > 0
    ? e.mergedTransactionIds.filter(Boolean).map(String)
    : undefined

  return {
    id,
    amountFils,
    date: parseDate(e.date),
    note: typeof e.note === 'string' ? e.note.slice(0, 500) : '',
    createdAt: e.createdAt ? parseDate(e.createdAt) : new Date(),
    ...(title ? { title } : {}),
    ...(txId ? { transactionId: txId } : {}),
    ...(e.isMerged ? { isMerged: true } : {}),
    ...(mergedTxIds ? { mergedTransactionIds: mergedTxIds } : {}),
  }
}

export function sanitizeDebt(raw: unknown): Debt | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<Debt>
  if (!d.id || typeof d.id !== 'string') return null
  const amountFils = Math.min(MAX_AMOUNT_FILS, Math.round(Number(d.amountFils || 0)))
  if (amountFils <= 0) return null

  const payments = (Array.isArray(d.payments) ? d.payments : [])
    .map(sanitizeDebtPayment)
    .filter((p): p is DebtPayment => p !== null)
    .slice(0, 100)
  const paymentsSum = payments.reduce((sum, p) => sum + p.amountFils, 0)
  const paidFils = Math.max(0, Math.min(amountFils, Math.max(Math.round(Number(d.paidFils || 0)), paymentsSum)))

  const entries = (Array.isArray(d.entries) ? d.entries : [])
    .map(sanitizeDebtEntry)
    .filter((e): e is DebtEntry => e !== null)
    .slice(0, 100)

  return {
    id: d.id.trim(),
    personName: (d.personName || '').trim().slice(0, 100) || 'شخص',
    type: d.type === 'borrowed' ? 'borrowed' : 'lent',
    amountFils,
    paidFils,
    startDate: parseDate(d.startDate),
    dueDate: d.dueDate ? parseDate(d.dueDate) : null,
    note: typeof d.note === 'string' ? d.note.slice(0, 500) : '',
    settled: paidFils === amountFils,
    payments,
    createdAt: d.createdAt ? parseDate(d.createdAt) : new Date(),
    ...(entries.length > 0 ? { entries } : {}),
  }
}

export function sanitizeRecurring(raw: unknown, categoryIdRemap?: Map<string, string>): Recurring | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<Recurring>
  if (!r.id || typeof r.id !== 'string') return null
  const amountFils = Math.min(MAX_AMOUNT_FILS, Math.round(Number(r.amountFils || 0)))
  if (amountFils <= 0) return null

  const rawCatId = typeof r.categoryId === 'string' ? r.categoryId : ''
  const finalCatId = categoryIdRemap?.get(rawCatId) || rawCatId

  const skipMonth = r.skipMonth !== undefined && r.skipMonth !== null && Number.isFinite(Number(r.skipMonth)) && Math.round(Number(r.skipMonth)) >= 1 && Math.round(Number(r.skipMonth)) <= 50
    ? Math.round(Number(r.skipMonth))
    : undefined

  const skipMonths = Array.isArray(r.skipMonths) && r.skipMonths.length > 0
    ? r.skipMonths.map(Number).filter((m) => Number.isFinite(m) && m >= 1 && m <= 50).slice(0, 10)
    : undefined

  const validFreqs = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly']
  const safeFreq = validFreqs.includes(r.frequency as string) ? (r.frequency as Frequency) : 'monthly'

  return {
    id: r.id.trim(),
    type: r.type === 'income' ? 'income' : 'expense',
    amountFils,
    categoryId: finalCatId,
    note: typeof r.note === 'string' ? r.note.slice(0, 500) : '',
    frequency: safeFreq,
    startDate: parseDate(r.startDate),
    nextDate: parseDate(r.nextDate),
    endDate: r.endDate ? parseDate(r.endDate) : null,
    active: Boolean(r.active),
    createdAt: r.createdAt ? parseDate(r.createdAt) : new Date(),
    ...(typeof r.title === 'string' && r.title.trim() ? { title: r.title.trim().slice(0, 100) } : {}),
    ...(typeof r.circleId === 'string' && r.circleId.trim() ? { circleId: r.circleId.trim().slice(0, 128) } : {}),
    ...(skipMonth !== undefined ? { skipMonth } : {}),
    ...(skipMonths !== undefined ? { skipMonths } : {}),
    ...(typeof r.requireConfirmation === 'boolean' ? { requireConfirmation: r.requireConfirmation } : {}),
  }
}

export function resolveOrphanCategories(
  categories: Category[],
  transactions: Transaction[],
  recurring: Recurring[],
  circles: MoneyCircle[] = []
): Category[] {
  const existingCatMap = new Map<string, Category>()
  for (const c of categories) {
    if (c && typeof c === 'object' && typeof c.id === 'string' && c.id.trim()) {
      existingCatMap.set(c.id.trim(), c)
    }
  }

  const updatedCategories = [...existingCatMap.values()]

  const ensureCategory = (catId: string, txType: 'expense' | 'income') => {
    const trimmedId = (catId || '').trim()
    if (!trimmedId) return ''
    if (existingCatMap.has(trimmedId)) return trimmedId

    const fallbackCat: Category = {
      id: trimmedId,
      name: txType === 'income' ? 'دخل عام (مسترد)' : 'مصاريف عامة (مستردة)',
      type: txType,
      icon: txType === 'income' ? '💰' : '📁',
      color: txType === 'income' ? '#10B981' : '#64748B',
      archived: false,
      order: 999,
    }
    existingCatMap.set(trimmedId, fallbackCat)
    updatedCategories.push(fallbackCat)
    return trimmedId
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

  for (const c of circles) {
    const expCatId = typeof c?.expenseCategoryId === 'string' ? c.expenseCategoryId.trim() : ''
    if (expCatId) ensureCategory(expCatId, 'expense')
    const incCatId = typeof c?.incomeCategoryId === 'string' ? c.incomeCategoryId.trim() : ''
    if (incCatId) ensureCategory(incCatId, 'income')
    const catId = typeof c?.categoryId === 'string' ? c.categoryId.trim() : ''
    if (catId) ensureCategory(catId, 'expense')
  }

  return updatedCategories
}

export function validateBackup(jsonText: string): BackupValidationResult {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'الملف لا يحتوي على بيانات JSON صالحة' }
    }

    if (parsed.app !== 'baseer' && parsed.app !== 'masareefi') {
      return { valid: false, error: 'الملف المحدد ليس نسخة احتياطية خاصة بتطبيق بَصير' }
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
    const rawSettings = data.settings && typeof data.settings === 'object' ? (data.settings as UserSettings) : undefined
    const validSettings = rawSettings
      ? {
          ...rawSettings,
          ...(typeof rawSettings.avatarColor === 'string' ? { avatarColor: rawSettings.avatarColor.slice(0, 30) } : {}),
        }
      : undefined

    const validCategories = categories.filter((c) => Boolean(c && typeof c === 'object' && c.id))
    const validTransactions = transactions.filter(
      (t) => Boolean(t && typeof t === 'object' && t.id && Math.round(Number(t.amountFils || 0)) > 0)
    )
    const validDebts = debts.map(sanitizeDebt).filter((d): d is Debt => d !== null)
    const validRecurring = recurring.map((r) => sanitizeRecurring(r)).filter((r): r is Recurring => r !== null)
    const validCircles = circles.filter(
      (c) => Boolean(c && typeof c === 'object' && c.id && Math.round(Number(c.monthlyAmountFils || 0)) > 0)
    )

    let workHoursPrefs: WorkHoursPrefsBackup | undefined
    if (data.workHoursPrefs && typeof data.workHoursPrefs === 'object') {
      const p = data.workHoursPrefs as Record<string, unknown>
      workHoursPrefs = {
        ...(typeof p.currencyCode === 'string' ? { currencyCode: p.currencyCode.slice(0, 20) } : {}), ...(typeof p.salary === 'string' ? { salary: p.salary.slice(0, 30) } : {}),
        ...(typeof p.isCustomSalary === 'boolean' ? { isCustomSalary: p.isCustomSalary } : {}), ...(typeof p.itemPrice === 'string' ? { itemPrice: p.itemPrice.slice(0, 30) } : {}),
        ...(typeof p.isCustomItemPrice === 'boolean' ? { isCustomItemPrice: p.isCustomItemPrice } : {}), ...(typeof p.dailyHours === 'string' ? { dailyHours: p.dailyHours.slice(0, 10) } : {}),
        ...(typeof p.workDays === 'string' ? { workDays: p.workDays.slice(0, 10) } : {}), ...(p.workDaysMode === 'month' || p.workDaysMode === 'week' ? { workDaysMode: p.workDaysMode } : {}),
        ...(typeof p.itemName === 'string' ? { itemName: p.itemName.slice(0, 100) } : {}),
      }
    }

    const resolvedCategories = resolveOrphanCategories(validCategories, validTransactions, validRecurring, validCircles)
    const exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString()

    const backup: MasareefiBackup = {
      version: 1,
      app: parsed.app === 'masareefi' ? 'masareefi' : 'baseer',
      exportedAt,
      data: {
        settings: validSettings,
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
        hasSettings: Boolean(validSettings),
      },
      data: backup,
    }
  } catch {
    return {
      valid: false,
      error: 'ملف النسخة الاحتياطية غير صالح أو تالف (تعذر قراءة أو تحليل محتوى JSON)',
    }
  }
}
