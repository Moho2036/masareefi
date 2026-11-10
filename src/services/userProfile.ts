import {
  doc,
  collection,
  query,
  limit,
  setDoc,
  writeBatch,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  deleteField,
  Timestamp,
  type Unsubscribe,
  type DocumentReference,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db, auth } from '../lib/firebase'
import type { UserSettings } from '../types'
import { userSettingsConverter } from './converters'
import { addDefaultCategoriesToBatch, markCategoriesSeedUpgraded } from './seed'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../lib/firestoreOffline'
import { MAX_AMOUNT_FILS } from '../lib/money'

export const DEFAULT_SETTINGS: Omit<UserSettings, 'uid' | 'createdAt'> = {
  displayName: 'مستخدم',
  currency: 'JOD',
  monthStartDay: 1,
  theme: 'system',
  rolloverBalance: true,
}

async function selfHealDisplayName(
  uid: string,
  existingData: UserSettings,
  candidateName: string
): Promise<UserSettings> {
  if (
    (!existingData.displayName || existingData.displayName === 'مستخدم') &&
    candidateName &&
    candidateName !== 'مستخدم'
  ) {
    const realName = candidateName.slice(0, 100)
    await commitFirestoreWrite(updateDoc(doc(db, 'users', uid), { displayName: realName }))
    return { ...existingData, displayName: realName }
  }
  return existingData
}

export async function ensureUserProfile(user: User): Promise<UserSettings> {
  const userRef = doc(db, 'users', user.uid).withConverter(userSettingsConverter)
  const snap = await safeGetDoc(userRef)
  const candidateName = (user.displayName || auth?.currentUser?.displayName || '').trim()

  if (snap.exists()) {
    return selfHealDisplayName(user.uid, snap.data(), candidateName)
  }

  const rawUserDoc = doc(db, 'users', user.uid)

  // Re-verify before batch creation in case a concurrent call created the doc
  const reCheckSnap = await safeGetDoc(userRef)
  if (reCheckSnap.exists()) {
    return selfHealDisplayName(user.uid, reCheckSnap.data(), candidateName)
  }

  const effectiveDisplayName = (candidateName || DEFAULT_SETTINGS.displayName).slice(0, 100)

  const initialSettings: UserSettings = {
    uid: user.uid,
    displayName: effectiveDisplayName,
    currency: DEFAULT_SETTINGS.currency,
    monthStartDay: DEFAULT_SETTINGS.monthStartDay,
    theme: DEFAULT_SETTINGS.theme,
    rolloverBalance: true,
  }

  // Atomically create user profile document AND seed default categories in ONE writeBatch
  const batch = writeBatch(db)
  batch.set(rawUserDoc, {
    displayName: initialSettings.displayName,
    currency: initialSettings.currency,
    monthStartDay: initialSettings.monthStartDay,
    theme: initialSettings.theme,
    rolloverBalance: true,
    createdAt: serverTimestamp(),
  })
  addDefaultCategoriesToBatch(batch, user.uid)
  await commitFirestoreWrite(batch.commit())
  markCategoriesSeedUpgraded(user.uid)

  return initialSettings
}

export function subscribeUserSettings(
  uid: string,
  cb: (settings: UserSettings | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const userRef = doc(db, 'users', uid).withConverter(userSettingsConverter)
  return onSnapshot(
    userRef,
    (snap) => {
      cb(snap.exists() ? snap.data() : null)
    },
    (err) => {
      console.error('subscribeUserSettings error:', err)
      onError?.(err)
    }
  )
}

export async function updateUserSettings(
  uid: string,
  partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>
): Promise<void> {
  const userRef = doc(db, 'users', uid)
  const cleanUpdates: Record<string, unknown> = {}
  const deletedFields = new Set<string>()

  if (partial.displayName !== undefined) {
    cleanUpdates.displayName = partial.displayName.slice(0, 100)
  }
  if (partial.currency !== undefined) {
    cleanUpdates.currency = (partial.currency || 'JOD').trim().slice(0, 20)
  }
  if (partial.monthStartDay !== undefined) {
    cleanUpdates.monthStartDay = Math.min(28, Math.max(1, Math.round(partial.monthStartDay)))
  }
  if (partial.theme !== undefined) {
    cleanUpdates.theme = partial.theme
  }
  if (partial.rolloverBalance !== undefined) {
    cleanUpdates.rolloverBalance = Boolean(partial.rolloverBalance)
  }
  if (partial.onboardingCompleted !== undefined) {
    cleanUpdates.onboardingCompleted = Boolean(partial.onboardingCompleted)
  }
  if (
    partial.openingBalanceFils !== undefined &&
    partial.openingBalanceFils !== null &&
    Number.isFinite(Number(partial.openingBalanceFils)) &&
    Number(partial.openingBalanceFils) >= 0
  ) {
    if (Math.round(Number(partial.openingBalanceFils)) > MAX_AMOUNT_FILS) {
      throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
    }
    cleanUpdates.openingBalanceFils = Math.round(Number(partial.openingBalanceFils))
  }
  if (partial.hideBalances !== undefined) {
    cleanUpdates.hideBalances = Boolean(partial.hideBalances)
  }
  if (partial.hideZeroDecimals !== undefined) {
    cleanUpdates.hideZeroDecimals = Boolean(partial.hideZeroDecimals)
  }
  if (partial.categorySortMode === 'usage' || partial.categorySortMode === 'manual') {
    cleanUpdates.categorySortMode = partial.categorySortMode
  }
  if ('customCurrencyDecimals' in partial) {
    if (partial.customCurrencyDecimals === null || partial.customCurrencyDecimals === undefined) {
      cleanUpdates.customCurrencyDecimals = deleteField()
      deletedFields.add('customCurrencyDecimals')
    } else if ([0, 2, 3].includes(Number(partial.customCurrencyDecimals))) {
      cleanUpdates.customCurrencyDecimals = Number(partial.customCurrencyDecimals)
    }
  }
  if ('rolloverStartDate' in partial) {
    if (partial.rolloverStartDate === null || partial.rolloverStartDate === undefined) {
      cleanUpdates.rolloverStartDate = deleteField()
      deletedFields.add('rolloverStartDate')
    } else if (partial.rolloverStartDate instanceof Timestamp) {
      cleanUpdates.rolloverStartDate = partial.rolloverStartDate
    } else if (partial.rolloverStartDate instanceof Date) {
      cleanUpdates.rolloverStartDate = Timestamp.fromDate(partial.rolloverStartDate)
    } else if (typeof partial.rolloverStartDate === 'string') {
      const parsed = new Date(partial.rolloverStartDate)
      if (!isNaN(parsed.getTime())) {
        cleanUpdates.rolloverStartDate = Timestamp.fromDate(parsed)
      }
    }
  }
  if (partial.lastBackupAt !== undefined) {
    const val = typeof partial.lastBackupAt === 'string' ? partial.lastBackupAt.trim().slice(0, 50) : ''
    if (val) {
      cleanUpdates.lastBackupAt = val
    } else {
      cleanUpdates.lastBackupAt = deleteField()
      deletedFields.add('lastBackupAt')
    }
  }
  if (partial.avatarColor !== undefined) {
    const val = typeof partial.avatarColor === 'string' ? partial.avatarColor.trim().slice(0, 30) : ''
    if (val) {
      cleanUpdates.avatarColor = val
    } else {
      cleanUpdates.avatarColor = deleteField()
      deletedFields.add('avatarColor')
    }
  }
  if (partial.notificationPrefs !== undefined) {
    if (partial.notificationPrefs && typeof partial.notificationPrefs === 'object') {
      const prefs: Record<string, unknown> = {}
      if (typeof partial.notificationPrefs.autoPayments === 'boolean') {
        prefs.autoPayments = partial.notificationPrefs.autoPayments
      }
      if (typeof partial.notificationPrefs.debtReminders === 'boolean') {
        prefs.debtReminders = partial.notificationPrefs.debtReminders
      }
      if (
        partial.notificationPrefs.debtReminderDaysBefore !== undefined &&
        [0, 1, 3].includes(Number(partial.notificationPrefs.debtReminderDaysBefore))
      ) {
        prefs.debtReminderDaysBefore = Number(partial.notificationPrefs.debtReminderDaysBefore)
      }
      if (typeof partial.notificationPrefs.circleAlerts === 'boolean') {
        prefs.circleAlerts = partial.notificationPrefs.circleAlerts
      }
      if (typeof partial.notificationPrefs.budgetWarnings === 'boolean') {
        prefs.budgetWarnings = partial.notificationPrefs.budgetWarnings
      }
      if (typeof partial.notificationPrefs.dailyReminder === 'boolean') {
        prefs.dailyReminder = partial.notificationPrefs.dailyReminder
      }
      if (typeof partial.notificationPrefs.dailyReminderTime === 'string') {
        prefs.dailyReminderTime = partial.notificationPrefs.dailyReminderTime.slice(0, 10)
      }
      cleanUpdates.notificationPrefs = prefs
    }
  }

  // Ensure createdAt is never passed in updates
  delete (cleanUpdates as Record<string, unknown>).createdAt

  const snap = await safeGetDoc(userRef)
  if (snap.exists()) {
    if (Object.keys(cleanUpdates).length > 0) {
      await commitFirestoreWrite(updateDoc(userRef, cleanUpdates))
    }
  } else {
    const payloadUpdates = { ...cleanUpdates }
    for (const field of deletedFields) {
      delete payloadUpdates[field]
    }
    const fullPayload = {
      ...DEFAULT_SETTINGS,
      ...payloadUpdates,
      createdAt: serverTimestamp(),
    }
    await commitFirestoreWrite(setDoc(userRef, fullPayload))
  }
}

export async function hasExistingUserData(uid: string): Promise<boolean> {
  try {
    const snaps = await Promise.all(
      ['transactions', 'debts', 'recurring', 'circles'].map((col) =>
        safeGetDocs(query(collection(db, 'users', uid, col), limit(1)))
      )
    )
    return snaps.some((s) => !s.empty)
  } catch (err) {
    console.error('hasExistingUserData error:', err)
    return false
  }
}

async function deleteCollectionDocsInChunks(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
    await commitFirestoreWrite(batch.commit())
  }
}

const getSubcollectionDocs = (uid: string, cols: string[]) =>
  Promise.all(cols.map((c) => safeGetDocs(collection(db, 'users', uid, c))))

/**
 * Deletes all transactions, debts, recurring items, and circles in chunks <= 400,
 * and resets openingBalanceFils to 0 and rolloverStartDate to null, preserving categories and user settings.
 */
export async function resetUserData(uid: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('baseer-bulk-op-start'))
  }
  try {
    const snaps = await getSubcollectionDocs(uid, ['transactions', 'debts', 'recurring', 'circles'])
    await deleteCollectionDocsInChunks(snaps.flatMap((s) => s.docs.map((d) => d.ref)))

    await updateUserSettings(uid, { openingBalanceFils: 0, rolloverStartDate: null })

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      ;['baseer_category_usage', 'masareefi_category_usage'].forEach((k) => localStorage.removeItem(k))
      ;['history', 'read', 'dismissed', 'deleted'].forEach((s) => {
        localStorage.removeItem(`baseer_notifications_${s}_${uid}`)
        localStorage.removeItem(`masareefi_notifications_${s}_${uid}`)
      })
      window.dispatchEvent(new CustomEvent('baseer-notifications-sync'))
    }
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baseer-bulk-op-end'))
    }
  }
}

/**
 * Deletes all subcollections (transactions, debts, recurring, circles, categories)
 * and the user profile document users/{uid}.
 */
export async function deleteUserFirestoreData(uid: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('baseer-bulk-op-start'))
  }
  try {
    const snaps = await getSubcollectionDocs(uid, ['transactions', 'debts', 'recurring', 'circles', 'categories'])
    await deleteCollectionDocsInChunks(snaps.flatMap((s) => s.docs.map((d) => d.ref)))
    await commitFirestoreWrite(deleteDoc(doc(db, 'users', uid)))
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baseer-bulk-op-end'))
    }
  }
}
