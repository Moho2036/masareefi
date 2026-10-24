import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  limit,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Transaction } from '../types'
import { transactionConverter } from './converters'

export function subscribeTransactions(
  uid: string,
  range: { start: Date; end: Date },
  cb: (transactions: Transaction[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
  const q = query(
    colRef,
    where('date', '>=', Timestamp.fromDate(range.start)),
    where('date', '<', Timestamp.fromDate(range.end)),
    orderBy('date', 'desc')
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      cb(items)
    },
    (err) => {
      console.error('subscribeTransactions error:', err)
      onError?.(err)
    }
  )
}

export function subscribeAllTransactions(
  uid: string,
  cb: (transactions: Transaction[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
  const q = query(colRef, orderBy('date', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      cb(items)
    },
    (err) => {
      console.error('subscribeAllTransactions error:', err)
      onError?.(err)
    }
  )
}

export async function getRecentTransactions(
  uid: string,
  limitCount = 100
): Promise<Transaction[]> {
  try {
    const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
    const q = query(colRef, orderBy('date', 'desc'), limit(limitCount))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => d.data())
  } catch (err) {
    console.error('getRecentTransactions error:', err)
    return []
  }
}

export async function addTransaction(
  uid: string,
  tx: Omit<Transaction, 'id' | 'createdAt'>
): Promise<string> {
  if (!Number.isInteger(tx.amountFils) || tx.amountFils <= 0) {
    throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }

  const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
  const docRef = await addDoc(colRef, {
    ...tx,
    id: '',
    note: typeof tx.note === 'string' ? tx.note.slice(0, 500) : '',
    createdAt: new Date(),
  })

  return docRef.id
}

export async function updateTransaction(
  uid: string,
  id: string,
  tx: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Promise<void> {
  if (tx.amountFils !== undefined) {
    if (!Number.isInteger(tx.amountFils) || tx.amountFils <= 0) {
      throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
    }
  }

  const docRef = doc(db, 'users', uid, 'transactions', id)
  const payload: Record<string, unknown> = {}

  if (tx.type !== undefined) {
    payload.type = tx.type
  }
  if (tx.amountFils !== undefined) {
    payload.amountFils = tx.amountFils
  }
  if (tx.categoryId !== undefined) {
    payload.categoryId = tx.categoryId
  }
  if (tx.date !== undefined) {
    payload.date = tx.date instanceof Date ? Timestamp.fromDate(tx.date) : tx.date
  }
  if (tx.title !== undefined) {
    payload.title = typeof tx.title === 'string' ? tx.title.trim().slice(0, 100) : ''
  }
  if (tx.note !== undefined) {
    payload.note = typeof tx.note === 'string' ? tx.note.slice(0, 500) : ''
  }
  if (tx.recurringId !== undefined) {
    payload.recurringId = tx.recurringId
  }

  if (Object.keys(payload).length > 0) {
    await updateDoc(docRef, payload)
  }
}

export async function deleteTransaction(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'transactions', id)
  await deleteDoc(docRef)
}

export async function getAllTransactions(uid: string): Promise<Transaction[]> {
  const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
  const q = query(colRef, orderBy('date', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export function subscribePriorBalance(
  uid: string,
  beforeDate: Date,
  cb: (balance: number) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
  const q = query(
    colRef,
    where('date', '<', Timestamp.fromDate(beforeDate)),
    orderBy('date', 'desc')
  )

  return onSnapshot(
    q,
    (snapshot) => {
      let balance = 0
      for (const d of snapshot.docs) {
        const tx = d.data()
        if (tx.type === 'income') {
          balance += tx.amountFils || 0
        } else if (tx.type === 'expense') {
          balance -= tx.amountFils || 0
        }
      }
      cb(balance)
    },
    (err) => {
      console.error('subscribePriorBalance error:', err)
      onError?.(err)
    }
  )
}

export async function getPriorBalance(uid: string, beforeDate: Date): Promise<number> {
  try {
    const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
    const q = query(
      colRef,
      where('date', '<', Timestamp.fromDate(beforeDate))
    )
    const snap = await getDocs(q)
    let balance = 0
    for (const d of snap.docs) {
      const tx = d.data()
      if (tx.type === 'income') {
        balance += tx.amountFils || 0
      } else if (tx.type === 'expense') {
        balance -= tx.amountFils || 0
      }
    }
    return balance
  } catch (err) {
    console.error('getPriorBalance error:', err)
    return 0
  }
}

