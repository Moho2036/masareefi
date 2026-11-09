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
  deleteField,
  getDocs,
  limit,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { MAX_AMOUNT_FILS } from '../lib/money'
import type { Transaction } from '../types'
import { transactionConverter } from './converters'
import { commitFirestoreWrite } from '../lib/firestoreOffline'

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
  if (tx.amountFils > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const sanitizedTx: Omit<Transaction, 'id' | 'createdAt'> = {
    ...tx,
    note: typeof tx.note === 'string' ? tx.note.slice(0, 500) : '',
  }

  const trimmedTitle = typeof tx.title === 'string' ? tx.title.trim() : ''
  if (trimmedTitle) {
    sanitizedTx.title = trimmedTitle.slice(0, 100)
  } else {
    delete sanitizedTx.title
  }

  const trimmedRecId = typeof tx.recurringId === 'string' ? tx.recurringId.trim() : ''
  if (trimmedRecId) {
    sanitizedTx.recurringId = trimmedRecId.slice(0, 128)
  } else {
    delete sanitizedTx.recurringId
  }

  const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
  const docRef = await commitFirestoreWrite(
    addDoc(colRef, {
      ...sanitizedTx,
      id: '',
      createdAt: new Date(),
    }),
    { id: 'offline_tx_' + Date.now() } as never
  )

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
    if (tx.amountFils > MAX_AMOUNT_FILS) {
      throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
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
    const trimmedTitle = typeof tx.title === 'string' ? tx.title.trim() : ''
    if (trimmedTitle === '') {
      payload.title = deleteField()
    } else {
      payload.title = trimmedTitle.slice(0, 100)
    }
  }
  if (tx.note !== undefined) {
    payload.note = typeof tx.note === 'string' ? tx.note.slice(0, 500) : ''
  }
  if (tx.recurringId !== undefined) {
    const trimmedRecId = typeof tx.recurringId === 'string' ? tx.recurringId.trim() : ''
    if (trimmedRecId === '') {
      payload.recurringId = deleteField()
    } else {
      payload.recurringId = trimmedRecId.slice(0, 128)
    }
  }

  if (Object.keys(payload).length > 0) {
    await commitFirestoreWrite(updateDoc(docRef, payload))
  }
}

export async function deleteTransaction(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'transactions', id)
  await commitFirestoreWrite(deleteDoc(docRef))
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
  onError?: (err: Error) => void,
  afterDate?: Date | null
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)
  const constraints = [
    where('date', '<', Timestamp.fromDate(beforeDate)),
  ]
  if (afterDate) {
    constraints.push(where('date', '>=', Timestamp.fromDate(afterDate)))
  }
  const q = query(
    colRef,
    ...constraints,
    orderBy('date', 'desc')
  )

  return onSnapshot(
    q,
    (snapshot) => {
      let balance = 0
      for (const d of snapshot.docs) {
        const tx = d.data()
        if (typeof tx.amountFils !== 'number' || !Number.isFinite(tx.amountFils)) {
          continue
        }
        if (tx.type === 'income') {
          balance += tx.amountFils
        } else if (tx.type === 'expense') {
          balance -= tx.amountFils
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


