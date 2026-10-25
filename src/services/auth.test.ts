import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  resetPassword,
  updateUserDisplayName,
} from './auth'
import * as userProfileService from './userProfile'
import * as firebaseAuth from 'firebase/auth'

import type { UserCredential, User } from 'firebase/auth'

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'u-current' } },
}))

const mockUserCredential = {
  user: { uid: 'u-123', displayName: null } as unknown as User,
} as unknown as UserCredential

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('./userProfile', () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({}),
  updateUserSettings: vi.fn().mockResolvedValue(undefined),
}))

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('signInWithGoogle calls signInWithPopup', async () => {
    vi.mocked(firebaseAuth.signInWithPopup).mockResolvedValueOnce(mockUserCredential)
    const result = await signInWithGoogle()
    expect(firebaseAuth.signInWithPopup).toHaveBeenCalledTimes(1)
    expect(result).toBe(mockUserCredential)
  })

  it('signInWithEmail calls signInWithEmailAndPassword', async () => {
    vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValueOnce(mockUserCredential)
    const result = await signInWithEmail('test@example.com', 'secret')
    expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'secret'
    )
    expect(result).toBe(mockUserCredential)
  })

  it('signUpWithEmail creates user, updates profile, calls ensureUserProfile and updates settings', async () => {
    const cred = { user: { uid: 'u-signup', displayName: null } as unknown as User } as unknown as UserCredential
    vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValueOnce(cred)
    vi.mocked(firebaseAuth.updateProfile).mockResolvedValueOnce(undefined)

    const result = await signUpWithEmail('new@example.com', 'pass123', '  أحمد محمود  ')

    expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'new@example.com',
      'pass123'
    )
    expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(cred.user, { displayName: 'أحمد محمود' })
    expect(userProfileService.ensureUserProfile).toHaveBeenCalledWith(cred.user)
    expect(userProfileService.updateUserSettings).toHaveBeenCalledWith('u-signup', {
      displayName: 'أحمد محمود',
    })
    expect(result).toBe(cred)
  })

  it('signOutUser clears masareefi local storage keys and calls signOut', async () => {
    localStorage.setItem('masareefi_work_hours_prefs', JSON.stringify({ hourlyWage: 5 }))
    localStorage.setItem('masareefi_category_usage', JSON.stringify({ cat1: 10 }))
    localStorage.setItem('other_app_key', 'keep_me')
    vi.mocked(firebaseAuth.signOut).mockResolvedValueOnce(undefined)

    await signOutUser()

    expect(localStorage.getItem('masareefi_work_hours_prefs')).toBeNull()
    expect(localStorage.getItem('masareefi_category_usage')).toBeNull()
    expect(localStorage.getItem('other_app_key')).toBe('keep_me')
    expect(firebaseAuth.signOut).toHaveBeenCalledTimes(1)
  })

  it('resetPassword trims email and calls sendPasswordResetEmail', async () => {
    vi.mocked(firebaseAuth.sendPasswordResetEmail).mockResolvedValueOnce(undefined)

    await resetPassword('  user@example.com  ')

    expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'user@example.com'
    )
  })

  it('updateUserDisplayName calls updateProfile', async () => {
    const user = { uid: 'u-name' } as unknown as User
    vi.mocked(firebaseAuth.updateProfile).mockResolvedValueOnce(undefined)

    await updateUserDisplayName(user, 'اسم جديد')

    expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(user, { displayName: 'اسم جديد' })
  })
})
