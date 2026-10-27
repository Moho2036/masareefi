import {
  signInWithPopup,
  signOut,
  updateProfile,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser,
  GoogleAuthProvider,
  type UserCredential,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { ensureUserProfile, updateUserSettings } from './userProfile'

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const trimmedName = displayName.trim().slice(0, 100)
  if (trimmedName) {
    await updateProfile(cred.user, { displayName: trimmedName })
  }
  await ensureUserProfile(cred.user)
  if (trimmedName) {
    await updateUserSettings(cred.user.uid, { displayName: trimmedName })
  }
  return cred
}

export async function signOutUser(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('baseer_work_hours_prefs')
      window.localStorage.removeItem('masareefi_work_hours_prefs')
      window.localStorage.removeItem('baseer_category_usage')
      window.localStorage.removeItem('masareefi_category_usage')
    }
  } catch (e) {
    console.warn('Failed to clear local storage on sign out:', e)
  }
  return signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email.trim())
}

export async function updateUserDisplayName(user: User, displayName: string): Promise<void> {
  return updateProfile(user, { displayName })
}

export async function sendUserEmailVerification(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('لا يوجد مستخدم مسجل الدخول حالياً')
  return sendEmailVerification(user)
}

export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('لا يوجد مستخدم مسجل الدخول حالياً')
  const cred = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, cred)
  return updatePassword(user, newPassword)
}

export async function reauthenticateCurrentPassword(password: string): Promise<void> {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('لا يوجد مستخدم مسجل الدخول حالياً')
  const cred = EmailAuthProvider.credential(user.email, password)
  await reauthenticateWithCredential(user, cred)
}

export async function reauthenticateCurrentGoogle(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('لا يوجد مستخدم مسجل الدخول حالياً')
  const provider = new GoogleAuthProvider()
  await reauthenticateWithPopup(user, provider)
}

export async function deleteUserAccount(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('لا يوجد مستخدم مسجل الدخول حالياً')
  return deleteUser(user)
}
