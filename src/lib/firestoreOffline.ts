import {
  getDoc,
  getDocs,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore'

/**
 * Checks whether an error is caused by being offline or network unavailable.
 */
function isOfflineError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const errorObj = err as { code?: string; message?: string }
  if (errorObj.code === 'unavailable') return true
  if (typeof errorObj.message === 'string') {
    const msg = errorObj.message.toLowerCase()
    if (msg.includes('offline') || msg.includes('client is offline') || msg.includes('unavailable')) {
      return true
    }
  }
  return false
}

/**
 * Safely commits a Firestore write operation.
 * Prevents UI hangings and unhandled rejections during offline state or sudden disconnection.
 */
export function commitFirestoreWrite<T>(
  writePromise: Promise<T>,
  fallbackValue?: T
): Promise<T> {
  if (!writePromise || typeof (writePromise as unknown as { then?: unknown }).then !== 'function') {
    return Promise.resolve((writePromise !== undefined ? writePromise : fallbackValue) as T)
  }

  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false

  if (isOnline) {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return writePromise
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false

      const cleanup = () => {
        window.removeEventListener('offline', handleOffline)
      }

      const handleOffline = () => {
        if (settled) return
        settled = true
        cleanup()
        writePromise.catch(() => {})
        resolve(fallbackValue as T)
      }

      window.addEventListener('offline', handleOffline)

      writePromise
        .then((val) => {
          if (!settled) {
            settled = true
            cleanup()
            resolve(val)
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true
            cleanup()
            reject(err)
          }
        })
    })
  }

  // Offline mode (navigator.onLine === false)
  writePromise.catch(() => {})
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallbackValue as T)
    }, 50)
  })

  return Promise.race([
    writePromise.finally(() => {
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }),
    timeoutPromise,
  ])
}

/**
 * Safely fetches a single document from Firestore.
 * If offline and the document is not in local cache, returns a non-existing DocumentSnapshot
 * instead of throwing an unhandled offline exception.
 */
export async function safeGetDoc<T = unknown>(
  docRef: DocumentReference<T>
): Promise<DocumentSnapshot<T>> {
  try {
    return await getDoc(docRef)
  } catch (err: unknown) {
    const isOffline =
      (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      isOfflineError(err)

    if (isOffline) {
      return {
        id: docRef?.id ?? '',
        ref: docRef,
        exists: () => false,
        data: () => undefined,
      } as unknown as DocumentSnapshot<T>
    }

    throw err
  }
}

/**
 * Safely queries documents from Firestore.
 * If offline and documents are unavailable, returns an empty QuerySnapshot instead of throwing.
 */
export async function safeGetDocs<T = unknown>(
  q: Query<T>
): Promise<QuerySnapshot<T>> {
  try {
    return await getDocs(q)
  } catch (err: unknown) {
    const isOffline =
      (typeof navigator !== 'undefined' && navigator.onLine === false) ||
      isOfflineError(err)

    if (isOffline) {
      return {
        empty: true,
        docs: [],
        size: 0,
        forEach: () => {},
        docChanges: () => [],
      } as unknown as QuerySnapshot<T>
    }

    throw err
  }
}
