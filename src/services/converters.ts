import {
  Timestamp,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
} from 'firebase/firestore'
import type { Category, Transaction, Recurring, UserSettings } from '../types'

export const categoryConverter: FirestoreDataConverter<Category> = {
  toFirestore(cat: Category): DocumentData {
    return {
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      archived: Boolean(cat.archived),
      order: Math.max(0, Math.round(cat.order ?? 0)),
    }
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Category {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      name: data.name,
      type: data.type,
      icon: data.icon,
      color: data.color,
      archived: Boolean(data.archived),
      order: data.order ?? 0,
    }
  },
}

export const transactionConverter: FirestoreDataConverter<Transaction> = {
  toFirestore(tx: Transaction): DocumentData {
    const data: DocumentData = {
      type: tx.type,
      amountFils: Math.round(Number(tx.amountFils)),
      categoryId: tx.categoryId,
      date: tx.date instanceof Date ? Timestamp.fromDate(tx.date) : tx.date,
      note: typeof tx.note === 'string' ? tx.note.slice(0, 500) : '',
      createdAt:
        tx.createdAt instanceof Date
          ? Timestamp.fromDate(tx.createdAt)
          : (tx.createdAt ?? serverTimestamp()),
    }
    if (tx.recurringId) {
      data.recurringId = tx.recurringId
    }
    return data
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Transaction {
    const data = snapshot.data(options)
    const tx: Transaction = {
      id: snapshot.id,
      type: data.type,
      amountFils: data.amountFils,
      categoryId: data.categoryId,
      date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
      note: data.note ?? '',
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt
            ? new Date(data.createdAt)
            : new Date(),
    }
    if (data.recurringId) {
      tx.recurringId = data.recurringId
    }
    return tx
  },
}

export const recurringConverter: FirestoreDataConverter<Recurring> = {
  toFirestore(rec: Recurring): DocumentData {
    const data: DocumentData = {
      type: rec.type,
      amountFils: Math.round(Number(rec.amountFils)),
      categoryId: rec.categoryId,
      note: typeof rec.note === 'string' ? rec.note.slice(0, 500) : '',
      frequency: rec.frequency,
      startDate:
        rec.startDate instanceof Date ? Timestamp.fromDate(rec.startDate) : rec.startDate,
      nextDate:
        rec.nextDate instanceof Date ? Timestamp.fromDate(rec.nextDate) : rec.nextDate,
      active: Boolean(rec.active),
    }
    if (rec.endDate) {
      data.endDate =
        rec.endDate instanceof Date ? Timestamp.fromDate(rec.endDate) : rec.endDate
    }
    return data
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Recurring {
    const data = snapshot.data(options)
    const rec: Recurring = {
      id: snapshot.id,
      type: data.type,
      amountFils: data.amountFils,
      categoryId: data.categoryId,
      note: data.note ?? '',
      frequency: data.frequency,
      startDate:
        data.startDate instanceof Timestamp
          ? data.startDate.toDate()
          : new Date(data.startDate),
      nextDate:
        data.nextDate instanceof Timestamp
          ? data.nextDate.toDate()
          : new Date(data.nextDate),
      active: Boolean(data.active),
    }
    if (data.endDate) {
      rec.endDate =
        data.endDate instanceof Timestamp
          ? data.endDate.toDate()
          : new Date(data.endDate)
    }
    return rec
  },
}

export const userSettingsConverter: FirestoreDataConverter<UserSettings> = {
  toFirestore(settings: UserSettings): DocumentData {
    return {
      displayName: (settings.displayName || '').slice(0, 100),
      currency: 'JOD',
      monthStartDay: Math.min(28, Math.max(1, Math.round(settings.monthStartDay || 1))),
      theme: settings.theme || 'system',
      createdAt:
        settings.createdAt instanceof Date
          ? Timestamp.fromDate(settings.createdAt)
          : (settings.createdAt ?? serverTimestamp()),
    }
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserSettings {
    const data = snapshot.data(options)
    return {
      uid: snapshot.id,
      displayName: data.displayName ?? '',
      currency: data.currency ?? 'JOD',
      monthStartDay: data.monthStartDay ?? 1,
      theme: data.theme ?? 'system',
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt
            ? new Date(data.createdAt)
            : undefined,
    }
  },
}
