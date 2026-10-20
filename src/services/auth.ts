import {
  signInWithPopup,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  type UserCredential,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export async function signOutUser(): Promise<void> {
  return signOut(auth)
}

export async function updateUserDisplayName(user: User, displayName: string): Promise<void> {
  return updateProfile(user, { displayName })
}
