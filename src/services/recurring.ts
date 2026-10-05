import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Recurring } from '../types'
import { recurringConverter } from './converters'

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
    onError
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
  if (rec.endDate !== undefined) {
    payload.endDate =
      rec.endDate === null
        ? null
        : rec.endDate instanceof Date
          ? Timestamp.fromDate(rec.endDate)
          : rec.endDate
  }
  if (rec.active !== undefined) {
    payload.active = Boolean(rec.active)
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(docRef, payload)
  }
}

export async function deleteRecurring(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'recurring', id)
  await deleteDoc(docRef)
}
