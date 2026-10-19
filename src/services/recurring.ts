import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Recurring } from '../types'
import { recurringConverter } from './converters'
import { calculateDueOccurrences, getDeterministicTxId } from '../lib/recurring'

export function subscribeRecurring(
  uid: string,
  cb: (recurring: Recurring[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      cb(items)
    },
    (err) => {
      console.error('subscribeRecurring error:', err)
      onError?.(err)
    }
  )
}

export async function addRecurring(
  uid: string,
  rec: Omit<Recurring, 'id'>
): Promise<string> {
  if (!Number.isInteger(rec.amountFils) || rec.amountFils <= 0) {
    throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }

  const colRef = collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)
  const docRef = await addDoc(colRef, {
    ...rec,
    id: '',
    note: typeof rec.note === 'string' ? rec.note.slice(0, 500) : '',
  })

  return docRef.id
}

export async function updateRecurring(
  uid: string,
  id: string,
  rec: Partial<Omit<Recurring, 'id'>>
): Promise<void> {
  if (rec.amountFils !== undefined) {
    if (!Number.isInteger(rec.amountFils) || rec.amountFils <= 0) {
      throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
    }
  }

  const docRef = doc(db, 'users', uid, 'recurring', id)
  const payload: Record<string, unknown> = {}

  if (rec.type !== undefined) {
    payload.type = rec.type
  }
  if (rec.amountFils !== undefined) {
    payload.amountFils = rec.amountFils
  }
  if (rec.categoryId !== undefined) {
    payload.categoryId = rec.categoryId
  }
  if (rec.note !== undefined) {
    payload.note = typeof rec.note === 'string' ? rec.note.slice(0, 500) : ''
  }
  if (rec.frequency !== undefined) {
    payload.frequency = rec.frequency
  }
  if (rec.startDate !== undefined) {
    payload.startDate =
      rec.startDate instanceof Date ? Timestamp.fromDate(rec.startDate) : rec.startDate
  }
  if (rec.nextDate !== undefined) {
    payload.nextDate =
      rec.nextDate instanceof Date ? Timestamp.fromDate(rec.nextDate) : rec.nextDate
  }
  if (rec.active !== undefined) {
    payload.active = Boolean(rec.active)
  }

  // Handle optional fields with deleteField() when unset, undefined, or null
  if ('title' in rec) {
    if (rec.title === undefined || rec.title === null || (typeof rec.title === 'string' && rec.title.trim() === '')) {
      payload.title = deleteField()
    } else {
      payload.title = rec.title.trim().slice(0, 100)
    }
  }

  if ('endDate' in rec) {
    if (rec.endDate === undefined || rec.endDate === null) {
      payload.endDate = deleteField()
    } else {
      payload.endDate =
        rec.endDate instanceof Date ? Timestamp.fromDate(rec.endDate) : rec.endDate
    }
  }

  if ('circleId' in rec) {
    if (rec.circleId === undefined || rec.circleId === null || rec.circleId === '') {
      payload.circleId = deleteField()
    } else {
      payload.circleId = rec.circleId
    }
  }

  if ('skipMonth' in rec) {
    if (rec.skipMonth === undefined || rec.skipMonth === null) {
      payload.skipMonth = deleteField()
    } else {
      payload.skipMonth = Math.round(rec.skipMonth)
    }
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(docRef, payload)
  }
}

export async function deleteRecurring(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'recurring', id)
  await deleteDoc(docRef)
}

/**
 * Checks for all due recurring transactions up to `today`,
 * creates idempotent transactions with deterministic IDs, and updates recurring items.
 * Returns the number of new transactions created.
 */
export async function processDueRecurring(
  uid: string,
  today: Date = new Date()
): Promise<number> {
  const endOfToday = new Date(today.getTime())
  endOfToday.setHours(23, 59, 59, 999)

  const colRef = collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)
  const q = query(
    colRef,
    where('active', '==', true),
    where('nextDate', '<=', Timestamp.fromDate(endOfToday))
  )

  const snap = await getDocs(q)
  if (snap.empty) {
    return 0
  }

  let createdCount = 0
  let batchHasWrites = false
  const batch = writeBatch(db)

  for (const docSnap of snap.docs) {
    const rec = docSnap.data()
    const { dates, newNextDate, shouldDeactivate } = calculateDueOccurrences(rec, endOfToday)

    if (dates.length > 0) {
      for (const occDate of dates) {
        const txId = getDeterministicTxId(rec.id, occDate)
        const txRef = doc(db, 'users', uid, 'transactions', txId)
        const txSnap = await getDoc(txRef)

        if (!txSnap.exists()) {
          const newTxData: Record<string, unknown> = {
            type: rec.type,
            amountFils: rec.amountFils,
            categoryId: rec.categoryId,
            date: Timestamp.fromDate(occDate),
            note: typeof rec.note === 'string' ? rec.note.slice(0, 500) : '',
            recurringId: rec.id,
            createdAt: serverTimestamp(),
          }
          if (rec.title) {
            newTxData.title = rec.title.slice(0, 100)
          }
          batch.set(txRef, newTxData)
          createdCount++
        }
      }
    }

    const recRef = doc(db, 'users', uid, 'recurring', rec.id)
    const updatePayload: Record<string, unknown> = {
      nextDate: Timestamp.fromDate(newNextDate),
    }
    if (shouldDeactivate) {
      updatePayload.active = false
    }
    batch.update(recRef, updatePayload)
    batchHasWrites = true
  }

  if (batchHasWrites) {
    await batch.commit()
  }

  return createdCount
}
