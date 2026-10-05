import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Category } from '../types'
import { categoryConverter } from './converters'

export function subscribeCategories(
  uid: string,
  cb: (categories: Category[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'categories').withConverter(categoryConverter)
  const q = query(colRef, orderBy('order', 'asc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const categories = snapshot.docs.map((d) => d.data())
      cb(categories)
    },
    onError
  )
}

export async function addCategory(
  uid: string,
  category: Omit<Category, 'id'>
): Promise<string> {
  const colRef = collection(db, 'users', uid, 'categories').withConverter(categoryConverter)
  const docRef = await addDoc(colRef, {
    ...category,
    id: '', // converter ignores id and writes document fields
  })
  return docRef.id
}

export async function updateCategory(
  uid: string,
  id: string,
  data: Partial<Omit<Category, 'id' | 'type'>>
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'categories', id)
  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) {
    payload.name = data.name.trim().slice(0, 40)
  }
  if (data.icon !== undefined) {
    payload.icon = data.icon.slice(0, 16)
  }
  if (data.color !== undefined) {
    payload.color = data.color
  }
  if (data.archived !== undefined) {
    payload.archived = Boolean(data.archived)
  }
  if (data.order !== undefined) {
    payload.order = Math.max(0, Math.round(data.order))
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(docRef, payload)
  }
}

export async function archiveCategory(
  uid: string,
  id: string,
  archived: boolean = true
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'categories', id)
  await updateDoc(docRef, { archived })
}
