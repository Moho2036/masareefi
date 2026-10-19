import {
  Timestamp,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
} from 'firebase/firestore'
import type { Category, Transaction, Recurring, UserSettings, Debt, DebtPayment } from '../types'

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
    if (tx.title) {
      data.title = tx.title.trim().slice(0, 100)
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
    if (data.title) {
      tx.title = data.title
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
    if (rec.title) {
      data.title = rec.title.trim().slice(0, 100)
    }
    if (rec.endDate) {
      data.endDate =
        rec.endDate instanceof Date ? Timestamp.fromDate(rec.endDate) : rec.endDate
    }
    if (rec.circleId) {
      data.circleId = rec.circleId
    }
    if (rec.skipMonth !== undefined) {
      data.skipMonth = Math.round(rec.skipMonth)
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
    if (data.title) {
      rec.title = data.title
    }
    if (data.endDate) {
      rec.endDate =
        data.endDate instanceof Timestamp
          ? data.endDate.toDate()
          : new Date(data.endDate)
    }
    if (data.circleId) {
      rec.circleId = data.circleId
    }
    if (data.skipMonth !== undefined) {
      rec.skipMonth = Number(data.skipMonth)
    }
    return rec
  },
}

export const userSettingsConverter: FirestoreDataConverter<UserSettings> = {
  toFirestore(settings: UserSettings): DocumentData {
    const data: DocumentData = {
      displayName: (settings.displayName || '').slice(0, 100),
      currency: (settings.currency || 'JOD').trim().slice(0, 20),
      monthStartDay: Math.min(28, Math.max(1, Math.round(settings.monthStartDay || 1))),
      theme: settings.theme || 'system',
      createdAt:
        settings.createdAt instanceof Date
          ? Timestamp.fromDate(settings.createdAt)
          : (settings.createdAt ?? serverTimestamp()),
    }
    if (typeof settings.rolloverBalance === 'boolean') {
      data.rolloverBalance = settings.rolloverBalance
    }
    return data
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserSettings {
    const data = snapshot.data(options)
    return {
      uid: snapshot.id,
      displayName: data.displayName ?? '',
      currency: data.currency ?? 'JOD',
      monthStartDay: data.monthStartDay ?? 1,
      theme: data.theme ?? 'system',
      rolloverBalance: typeof data.rolloverBalance === 'boolean' ? data.rolloverBalance : false,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt
            ? new Date(data.createdAt)
            : undefined,
    }
  },
}

export const debtConverter: FirestoreDataConverter<Debt> = {
  toFirestore(debt: Debt): DocumentData {
    const data: DocumentData = {
      personName: (debt.personName || '').trim().slice(0, 100),
      type: debt.type,
      amountFils: Math.round(Number(debt.amountFils)),
      paidFils: Math.round(Number(debt.paidFils ?? 0)),
      startDate:
        debt.startDate instanceof Date ? Timestamp.fromDate(debt.startDate) : debt.startDate,
      note: typeof debt.note === 'string' ? debt.note.slice(0, 500) : '',
      settled: Boolean(debt.settled),
      payments: (debt.payments || []).map((p) => {
        const item: DocumentData = {
          id: p.id,
          amountFils: Math.round(Number(p.amountFils)),
          date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
          createdAt:
            p.createdAt instanceof Date ? Timestamp.fromDate(p.createdAt) : p.createdAt,
        }
        if (p.note) {
          item.note = p.note.slice(0, 500)
        }
        return item
      }),
      createdAt:
        debt.createdAt instanceof Date
          ? Timestamp.fromDate(debt.createdAt)
          : (debt.createdAt ?? serverTimestamp()),
    }
    if (debt.dueDate) {
      data.dueDate =
        debt.dueDate instanceof Date ? Timestamp.fromDate(debt.dueDate) : debt.dueDate
    } else {
      data.dueDate = null
    }
    return data
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): Debt {
    const data = snapshot.data(options)
    const rawPayments: Array<Record<string, unknown>> = Array.isArray(data.payments)
      ? data.payments
      : []
    const payments: DebtPayment[] = rawPayments.map((p) => ({
      id: String(p.id || ''),
      amountFils: Number(p.amountFils || 0),
      date:
        p.date instanceof Timestamp
          ? p.date.toDate()
          : p.date
            ? new Date(p.date as string | number)
            : new Date(),
      note: typeof p.note === 'string' ? p.note : undefined,
      createdAt:
        p.createdAt instanceof Timestamp
          ? p.createdAt.toDate()
          : p.createdAt
            ? new Date(p.createdAt as string | number)
            : new Date(),
    }))

    return {
      id: snapshot.id,
      personName: data.personName ?? '',
      type: data.type,
      amountFils: data.amountFils ?? 0,
      paidFils: data.paidFils ?? 0,
      startDate:
        data.startDate instanceof Timestamp
          ? data.startDate.toDate()
          : new Date(data.startDate),
      dueDate:
        data.dueDate instanceof Timestamp
          ? data.dueDate.toDate()
          : data.dueDate
            ? new Date(data.dueDate)
            : null,
      note: data.note ?? '',
      settled: Boolean(data.settled),
      payments,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt
            ? new Date(data.createdAt)
            : new Date(),
    }
  },
}

