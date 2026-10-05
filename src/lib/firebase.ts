import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-masareefi.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-masareefi',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-masareefi.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:demo',
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)

let firestoreInstance
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  })
} catch {
  firestoreInstance = getFirestore(app)
}

export const db = firestoreInstance

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  const g = globalThis as unknown as { __EMULATORS_CONNECTED__?: boolean }
  if (!g.__EMULATORS_CONNECTED__) {
    g.__EMULATORS_CONNECTED__ = true
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    } catch {
      // Ignored if already connected (e.g. HMR)
    }
    try {
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
    } catch {
      // Ignored if already connected (e.g. HMR)
    }
  }
}
