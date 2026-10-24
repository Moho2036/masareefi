import {
  signInWithPopup,
  signOut,
  updateProfile,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  type UserCredential,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { updateUserSettings } from './userProfile'

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
    await updateUserSettings(cred.user.uid, { displayName: trimmedName })
  }
  return cred
}

export async function signOutUser(): Promise<void> {
  return signOut(auth)
}

export async function updateUserDisplayName(user: User, displayName: string): Promise<void> {
  return updateProfile(user, { displayName })
}
