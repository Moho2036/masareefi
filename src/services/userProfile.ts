import {
  doc,
  collection,
  getDoc,
  getDocs,
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
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db, auth } from '../lib/firebase'
import type { UserSettings } from '../types'
import { userSettingsConverter } from './converters'
import { addDefaultCategoriesToBatch } from './seed'

export const DEFAULT_SETTINGS: Omit<UserSettings, 'uid' | 'createdAt'> = {
  displayName: 'مستخدم',
  currency: 'JOD',
  monthStartDay: 1,
  theme: 'system',
  rolloverBalance: true,
}

export async function ensureUserProfile(user: User): Promise<UserSettings> {
  const userRef = doc(db, 'users', user.uid).withConverter(userSettingsConverter)
  const snap = await getDoc(userRef)

  const candidateName = (user.displayName || auth?.currentUser?.displayName || '').trim()

  if (snap.exists()) {
    const data = snap.data()
    // Self-healing race condition fix:
    // If users/{uid} document already exists and has default placeholder name 'مستخدم' (or empty),
    // but the incoming user has a real non-empty displayName, update Firestore to reflect it.
    if (
      (!data.displayName || data.displayName === 'مستخدم') &&
      candidateName &&
      candidateName !== 'مستخدم'
    ) {
      const realName = candidateName.slice(0, 100)
      await updateDoc(doc(db, 'users', user.uid), { displayName: realName })
      return { ...data, displayName: realName }
    }
    return data
  }

  const rawUserDoc = doc(db, 'users', user.uid)

  // Re-verify before batch creation in case a concurrent call created the doc
  const reCheckSnap = await getDoc(userRef)
  if (reCheckSnap.exists()) {
    const existingData = reCheckSnap.data()
    if (
      (!existingData.displayName || existingData.displayName === 'مستخدم') &&
      candidateName &&
      candidateName !== 'مستخدم'
    ) {
      const realName = candidateName.slice(0, 100)
      await updateDoc(rawUserDoc, { displayName: realName })
      return { ...existingData, displayName: realName }
    }
    return existingData
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
  await batch.commit()

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
    cleanUpdates.lastBackupAt = String(partial.lastBackupAt).slice(0, 50)
  }
  if (partial.avatarColor !== undefined) {
    cleanUpdates.avatarColor = String(partial.avatarColor).slice(0, 30)
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

  const snap = await getDoc(userRef)
  if (snap.exists()) {
    if (Object.keys(cleanUpdates).length > 0) {
      await updateDoc(userRef, cleanUpdates)
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
    await setDoc(userRef, fullPayload)
  }
}

export async function hasExistingUserData(uid: string): Promise<boolean> {
  try {
    const txCol = collection(db, 'users', uid, 'transactions')
    const debtCol = collection(db, 'users', uid, 'debts')
    const recCol = collection(db, 'users', uid, 'recurring')
    const circleCol = collection(db, 'users', uid, 'circles')

    const [txSnap, debtSnap, recSnap, circleSnap] = await Promise.all([
      getDocs(query(txCol, limit(1))),
      getDocs(query(debtCol, limit(1))),
      getDocs(query(recCol, limit(1))),
      getDocs(query(circleCol, limit(1))),
    ])

    return !txSnap.empty || !debtSnap.empty || !recSnap.empty || !circleSnap.empty
  } catch (err) {
    console.error('hasExistingUserData error:', err)
    return false
  }
}

/**
 * Deletes all transactions, debts, recurring items, and circles in chunks <= 400,
 * and resets openingBalanceFils to 0, preserving categories and user settings.
 */
export async function resetUserData(uid: string): Promise<void> {
  const txCol = collection(db, 'users', uid, 'transactions')
  const debtCol = collection(db, 'users', uid, 'debts')
  const recCol = collection(db, 'users', uid, 'recurring')
  const circleCol = collection(db, 'users', uid, 'circles')

  const [txSnap, debtSnap, recSnap, circleSnap] = await Promise.all([
    getDocs(txCol),
    getDocs(debtCol),
    getDocs(recCol),
    getDocs(circleCol),
  ])

  const docsToDelete = [
    ...txSnap.docs.map((d) => d.ref),
    ...debtSnap.docs.map((d) => d.ref),
    ...recSnap.docs.map((d) => d.ref),
    ...circleSnap.docs.map((d) => d.ref),
  ]

  const CHUNK_SIZE = 400
  for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
    const chunk = docsToDelete.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const ref of chunk) {
      batch.delete(ref)
    }
    await batch.commit()
  }

  await updateUserSettings(uid, { openingBalanceFils: 0 })
}

/**
 * Deletes all subcollections (transactions, debts, recurring, circles, categories)
 * and the user profile document users/{uid}.
 */
export async function deleteUserFirestoreData(uid: string): Promise<void> {
  const txCol = collection(db, 'users', uid, 'transactions')
  const debtCol = collection(db, 'users', uid, 'debts')
  const recCol = collection(db, 'users', uid, 'recurring')
  const circleCol = collection(db, 'users', uid, 'circles')
  const catCol = collection(db, 'users', uid, 'categories')

  const [txSnap, debtSnap, recSnap, circleSnap, catSnap] = await Promise.all([
    getDocs(txCol),
    getDocs(debtCol),
    getDocs(recCol),
    getDocs(circleCol),
    getDocs(catCol),
  ])

  const docsToDelete = [
    ...txSnap.docs.map((d) => d.ref),
    ...debtSnap.docs.map((d) => d.ref),
    ...recSnap.docs.map((d) => d.ref),
    ...circleSnap.docs.map((d) => d.ref),
    ...catSnap.docs.map((d) => d.ref),
  ]

  const CHUNK_SIZE = 400
  for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
    const chunk = docsToDelete.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const ref of chunk) {
      batch.delete(ref)
    }
    await batch.commit()
  }

  await deleteDoc(doc(db, 'users', uid))
}
