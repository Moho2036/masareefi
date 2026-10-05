import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '../lib/firebase'
import type { UserSettings } from '../types'
import { userSettingsConverter } from './converters'
import { seedDefaultCategories } from './seed'

export async function ensureUserProfile(user: User): Promise<UserSettings> {
  const userRef = doc(db, 'users', user.uid).withConverter(userSettingsConverter)
  const snap = await getDoc(userRef)

  if (snap.exists()) {
    return snap.data()
  }

  const initialSettings: UserSettings = {
    uid: user.uid,
    displayName: (user.displayName || 'مستخدم').slice(0, 100),
    currency: 'JOD',
    monthStartDay: 1,
    theme: 'system',
  }

  // Create user profile in Firestore
  await setDoc(userRef, {
    ...initialSettings,
    createdAt: new Date(), // converter will map or we can let converter use serverTimestamp
  })

  // Seed default categories
  await seedDefaultCategories(user.uid)

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
    onError
  )
}

export async function updateUserSettings(
  uid: string,
  partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>
): Promise<void> {
  const userRef = doc(db, 'users', uid)
  const payload: Record<string, unknown> = {}

  if (partial.displayName !== undefined) {
    payload.displayName = partial.displayName.slice(0, 100)
  }
  if (partial.currency !== undefined) {
    payload.currency = 'JOD'
  }
  if (partial.monthStartDay !== undefined) {
    payload.monthStartDay = Math.min(28, Math.max(1, Math.round(partial.monthStartDay)))
  }
  if (partial.theme !== undefined) {
    payload.theme = partial.theme
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(userRef, payload)
  }
}
