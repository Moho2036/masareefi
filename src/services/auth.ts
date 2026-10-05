import { signInWithPopup, signOut, GoogleAuthProvider, type UserCredential } from 'firebase/auth'
import { auth } from '../lib/firebase'

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export async function signOutUser(): Promise<void> {
  return signOut(auth)
}
