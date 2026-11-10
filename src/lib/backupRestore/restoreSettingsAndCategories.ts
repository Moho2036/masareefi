import {
  doc,
  Timestamp,
  serverTimestamp,
  deleteField,
  type DocumentReference,
  type DocumentSnapshot,
  type QuerySnapshot,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Category, UserSettings } from '../../types'
import { categoryConverter } from '../../services/converters'
import { MAX_AMOUNT_FILS } from '../money'
import { normalizeArabic } from '../aggregate'
import { parseDate, type RestoreMode } from './typesAndValidation'

export type BatchOp = (b: WriteBatch) => void

export function enqueueSettingsRestore(
  rawUserRef: DocumentReference,
  s: UserSettings,
  existingUserSnap: DocumentSnapshot | null,
  mode: RestoreMode,
  ops: BatchOp[]
): void {
  const userExists = Boolean(
    existingUserSnap &&
    typeof existingUserSnap.exists === 'function' &&
    existingUserSnap.exists()
  )

  const validThemes = ['system', 'light', 'dark']
  const safeTheme = validThemes.includes(s.theme as string) ? s.theme : 'system'

  const baseSettings: Record<string, unknown> = {
    displayName: (s.displayName || '').slice(0, 100),
    currency: (s.currency || 'JOD').trim().slice(0, 20),
    monthStartDay: Math.min(28, Math.max(1, Math.round(s.monthStartDay || 1))),
    theme: safeTheme,
    rolloverBalance: typeof s.rolloverBalance === 'boolean' ? s.rolloverBalance : true,
  }

  if (typeof s.onboardingCompleted === 'boolean') {
    baseSettings.onboardingCompleted = s.onboardingCompleted
  }
  if (
    s.openingBalanceFils !== undefined &&
    s.openingBalanceFils !== null &&
    Number.isFinite(Number(s.openingBalanceFils)) &&
    Number(s.openingBalanceFils) >= 0
  ) {
    baseSettings.openingBalanceFils = Math.min(MAX_AMOUNT_FILS, Math.round(Number(s.openingBalanceFils)))
  } else if (userExists && mode === 'replace') {
    baseSettings.openingBalanceFils = 0
  }
  if (typeof s.hideBalances === 'boolean') {
    baseSettings.hideBalances = s.hideBalances
  }
  if (typeof s.hideZeroDecimals === 'boolean') {
    baseSettings.hideZeroDecimals = s.hideZeroDecimals
  }
  if (s.categorySortMode === 'usage' || s.categorySortMode === 'manual') {
    baseSettings.categorySortMode = s.categorySortMode
  }

  // customCurrencyDecimals
  if (
    s.customCurrencyDecimals !== undefined &&
    s.customCurrencyDecimals !== null &&
    [0, 2, 3].includes(Number(s.customCurrencyDecimals))
  ) {
    baseSettings.customCurrencyDecimals = Number(s.customCurrencyDecimals)
  } else if (userExists && (mode === 'replace' || s.customCurrencyDecimals === null)) {
    baseSettings.customCurrencyDecimals = deleteField()
  }

  // rolloverStartDate
  if (s.rolloverStartDate) {
    try {
      baseSettings.rolloverStartDate = Timestamp.fromDate(parseDate(s.rolloverStartDate))
    } catch {
      if (userExists && mode === 'replace') {
        baseSettings.rolloverStartDate = deleteField()
      }
    }
  } else if (userExists && (mode === 'replace' || s.rolloverStartDate === null)) {
    baseSettings.rolloverStartDate = deleteField()
  }

  // avatarColor
  if (typeof s.avatarColor === 'string' && s.avatarColor.trim()) {
    baseSettings.avatarColor = s.avatarColor.trim().slice(0, 30)
  } else if (userExists && mode === 'replace') {
    baseSettings.avatarColor = deleteField()
  }

  // lastBackupAt
  if (typeof s.lastBackupAt === 'string' && s.lastBackupAt.trim()) {
    baseSettings.lastBackupAt = s.lastBackupAt.trim().slice(0, 50)
  } else if (userExists && mode === 'replace') {
    baseSettings.lastBackupAt = deleteField()
  }

  // notificationPrefs
  if (s.notificationPrefs && typeof s.notificationPrefs === 'object') {
    const np = s.notificationPrefs as Record<string, unknown>
    const cleanNotificationPrefs: Record<string, unknown> = {}
    if (typeof np.autoPayments === 'boolean') cleanNotificationPrefs.autoPayments = np.autoPayments
    if (typeof np.debtReminders === 'boolean') cleanNotificationPrefs.debtReminders = np.debtReminders
    if (typeof np.debtReminderDaysBefore === 'number' && [0, 1, 3].includes(np.debtReminderDaysBefore)) {
      cleanNotificationPrefs.debtReminderDaysBefore = np.debtReminderDaysBefore
    }
    if (typeof np.circleAlerts === 'boolean') cleanNotificationPrefs.circleAlerts = np.circleAlerts
    if (typeof np.budgetWarnings === 'boolean') cleanNotificationPrefs.budgetWarnings = np.budgetWarnings
    if (typeof np.dailyReminder === 'boolean') cleanNotificationPrefs.dailyReminder = np.dailyReminder
    if (typeof np.dailyReminderTime === 'string') cleanNotificationPrefs.dailyReminderTime = np.dailyReminderTime.slice(0, 10)

    if (Object.keys(cleanNotificationPrefs).length > 0) {
      baseSettings.notificationPrefs = cleanNotificationPrefs
    } else if (userExists && mode === 'replace') {
      baseSettings.notificationPrefs = deleteField()
    }
  } else if (userExists && mode === 'replace') {
    baseSettings.notificationPrefs = deleteField()
  }

  if (userExists) {
    ops.push((b) => b.update(rawUserRef, baseSettings))
  } else {
    const finalCreatedAt = s.createdAt ? Timestamp.fromDate(parseDate(s.createdAt)) : serverTimestamp()
    const setData = {
      ...baseSettings,
      createdAt: finalCreatedAt,
    }
    ops.push((b) => b.set(rawUserRef, setData))
  }
}

export function enqueueCategoriesRestore(
  uid: string,
  categories: Category[],
  existingCatsSnap: QuerySnapshot<Category> | null,
  mode: RestoreMode,
  ops: BatchOp[],
  categoryIdRemap: Map<string, string>
): void {
  const getCatKey = (type: string, name: string) =>
    `${type}:${normalizeArabic((name || '').trim()).toLowerCase()}`

  const existingCatsMap = new Map<string, Category>()
  const existingCatsByNameAndType = new Map<string, Category>()
  if (existingCatsSnap && existingCatsSnap.docs) {
    for (const d of existingCatsSnap.docs) {
      const c = d.data()
      existingCatsMap.set(d.id, c)
      const key = getCatKey(c.type, c.name)
      if (!existingCatsByNameAndType.has(key)) {
        existingCatsByNameAndType.set(key, c)
      }
    }
  }

  if (mode === 'replace') {
    const incomingCategoryIds = new Set(categories.map((c) => c.id).filter(Boolean))
    if (existingCatsSnap && existingCatsSnap.docs) {
      for (const existingDoc of existingCatsSnap.docs) {
        if (!incomingCategoryIds.has(existingDoc.id)) {
          ops.push((b) => b.delete(existingDoc.ref))
        }
      }
    }
  }

  const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

  for (const cat of categories) {
    if (!cat.id) continue

    if (mode === 'merge') {
      const catKey = getCatKey(cat.type || 'expense', cat.name || '')
      const matchedExisting =
        existingCatsMap.get(cat.id) ||
        existingCatsByNameAndType.get(catKey)

      if (matchedExisting) {
        categoryIdRemap.set(cat.id, matchedExisting.id)
        if (matchedExisting.id !== cat.id) {
          continue
        }
      } else {
        categoryIdRemap.set(cat.id, cat.id)
        existingCatsMap.set(cat.id, cat)
        existingCatsByNameAndType.set(catKey, cat)
      }
    }

    const catRef = doc(db, 'users', uid, 'categories', cat.id).withConverter(categoryConverter)
    const existingCat = existingCatsMap.get(cat.id)
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
}
