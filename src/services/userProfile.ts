import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../lib/firebase'
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

  if (snap.exists()) {
    return snap.data()
  }

  const initialSettings: UserSettings = {
    uid: user.uid,
    displayName: (user.displayName || DEFAULT_SETTINGS.displayName).slice(0, 100),
    currency: DEFAULT_SETTINGS.currency,
    monthStartDay: DEFAULT_SETTINGS.monthStartDay,
    theme: DEFAULT_SETTINGS.theme,
    rolloverBalance: true,
  }

  // Atomically create user profile document AND seed default categories in ONE writeBatch
  const batch = writeBatch(db)
  const rawUserDoc = doc(db, 'users', user.uid)
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

  // Ensure createdAt is never passed in updates
  delete (cleanUpdates as Record<string, unknown>).createdAt

  const snap = await getDoc(userRef)
  if (snap.exists()) {
    if (Object.keys(cleanUpdates).length > 0) {
      await updateDoc(userRef, cleanUpdates)
    }
  } else {
    const fullPayload = {
      ...DEFAULT_SETTINGS,
      ...cleanUpdates,
      createdAt: serverTimestamp(),
    }
    await setDoc(userRef, fullPayload)
  }
}
