import { describe, it, expect } from 'vitest'
import { Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore'
import {
  categoryConverter,
  transactionConverter,
  recurringConverter,
  userSettingsConverter,
} from './converters'
import type { Category, Transaction, Recurring, UserSettings } from '../types'

function makeMockSnapshot<T extends Record<string, unknown>>(
  id: string,
  data: T
): QueryDocumentSnapshot {
  return {
    id,
    data: () => data,
  } as unknown as QueryDocumentSnapshot
}

describe('converters', () => {
  describe('categoryConverter', () => {
    it('converts Category to Firestore data without id', () => {
      const cat: Category = {
        id: 'cat-123',
        name: 'طعام وبقالة',
        type: 'expense',
        icon: '🛒',
        color: '#F59E0B',
        archived: false,
        order: 2,
      }

      const firestoreData = categoryConverter.toFirestore(cat)

      expect(firestoreData).toEqual({
        name: 'طعام وبقالة',
        type: 'expense',
        icon: '🛒',
        color: '#F59E0B',
        archived: false,
        order: 2,
      })
      expect((firestoreData as Record<string, unknown>).id).toBeUndefined()
    })

    it('converts Firestore snapshot to Category with id', () => {
      const snap = makeMockSnapshot('cat-abc', {
        name: 'راتب',
        type: 'income',
        icon: '💼',
        color: '#10B981',
        archived: false,
        order: 0,
      })

      const cat = categoryConverter.fromFirestore(snap)

      expect(cat).toEqual({
        id: 'cat-abc',
        name: 'راتب',
        type: 'income',
        icon: '💼',
        color: '#10B981',
        archived: false,
        order: 0,
      })
    })
  })

  describe('transactionConverter', () => {
    it('converts Transaction to Firestore data mapping Date to Timestamp and omitting id', () => {
      const date = new Date('2026-03-15T10:00:00Z')
      const createdAt = new Date('2026-03-15T10:05:00Z')

      const tx: Transaction = {
        id: 'tx-1',
        type: 'expense',
        amountFils: 2500,
        categoryId: 'cat-food',
        date,
        note: 'غداء عمل',
        createdAt,
      }

      const data = transactionConverter.toFirestore(tx) as Record<string, unknown>

      expect(data.id).toBeUndefined()
      expect(data.type).toBe('expense')
      expect(data.amountFils).toBe(2500)
      expect(data.categoryId).toBe('cat-food')
      expect(data.note).toBe('غداء عمل')
      expect(data.date).toBeInstanceOf(Timestamp)
      expect((data.date as Timestamp).toDate().getTime()).toBe(date.getTime())
      expect(data.createdAt).toBeInstanceOf(Timestamp)
      expect((data.createdAt as Timestamp).toDate().getTime()).toBe(createdAt.getTime())
      expect(data.recurringId).toBeUndefined()
    })

    it('includes recurringId when provided', () => {
      const tx: Transaction = {
        id: 'tx-2',
        type: 'income',
        amountFils: 1000000,
        categoryId: 'cat-salary',
        date: new Date('2026-04-01T00:00:00Z'),
        note: 'راتب شهري',
        recurringId: 'rec-monthly-salary',
        createdAt: new Date('2026-04-01T00:00:00Z'),
      }

      const data = transactionConverter.toFirestore(tx) as Record<string, unknown>
      expect(data.recurringId).toBe('rec-monthly-salary')
    })

    it('converts Firestore snapshot to Transaction mapping Timestamp to Date', () => {
      const date = new Date('2026-03-15T12:00:00Z')
      const createdAt = new Date('2026-03-15T12:01:00Z')

      const snap = makeMockSnapshot('tx-999', {
        type: 'expense',
        amountFils: 4500,
        categoryId: 'cat-fuel',
        date: Timestamp.fromDate(date),
        note: 'بنزين',
        recurringId: 'rec-1',
        createdAt: Timestamp.fromDate(createdAt),
      })

      const tx = transactionConverter.fromFirestore(snap)

      expect(tx.id).toBe('tx-999')
      expect(tx.type).toBe('expense')
      expect(tx.amountFils).toBe(4500)
      expect(tx.categoryId).toBe('cat-fuel')
      expect(tx.note).toBe('بنزين')
      expect(tx.recurringId).toBe('rec-1')
      expect(tx.date).toBeInstanceOf(Date)
      expect(tx.date.getTime()).toBe(date.getTime())
      expect(tx.createdAt).toBeInstanceOf(Date)
      expect(tx.createdAt.getTime()).toBe(createdAt.getTime())
    })
  })

  describe('recurringConverter', () => {
    it('converts Recurring to Firestore data mapping Dates to Timestamps and omitting id/createdAt', () => {
      const startDate = new Date('2026-01-01T00:00:00Z')
      const nextDate = new Date('2026-02-01T00:00:00Z')
      const endDate = new Date('2026-12-31T00:00:00Z')

      const rec: Recurring = {
        id: 'rec-sub',
        type: 'expense',
        amountFils: 10000,
        categoryId: 'cat-rent',
        note: 'إيجار شقة',
        frequency: 'monthly',
        startDate,
        nextDate,
        endDate,
        active: true,
      }

      const data = recurringConverter.toFirestore(rec) as Record<string, unknown>

      expect(data.id).toBeUndefined()
      expect(data.createdAt).toBeUndefined()
      expect(data.type).toBe('expense')
      expect(data.amountFils).toBe(10000)
      expect(data.categoryId).toBe('cat-rent')
      expect(data.note).toBe('إيجار شقة')
      expect(data.frequency).toBe('monthly')
      expect(data.active).toBe(true)
      expect(data.startDate).toBeInstanceOf(Timestamp)
      expect((data.startDate as Timestamp).toDate().getTime()).toBe(startDate.getTime())
      expect(data.nextDate).toBeInstanceOf(Timestamp)
      expect((data.nextDate as Timestamp).toDate().getTime()).toBe(nextDate.getTime())
      expect(data.endDate).toBeInstanceOf(Timestamp)
      expect((data.endDate as Timestamp).toDate().getTime()).toBe(endDate.getTime())
    })

    it('omits endDate when undefined in toFirestore', () => {
      const rec: Recurring = {
        id: 'rec-sub2',
        type: 'expense',
        amountFils: 5000,
        categoryId: 'cat-sub',
        note: 'اشتراك إنترنت',
        frequency: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        nextDate: new Date('2026-02-01T00:00:00Z'),
        active: true,
      }

      const data = recurringConverter.toFirestore(rec) as Record<string, unknown>
      expect('endDate' in data).toBe(false)
    })

    it('converts Firestore snapshot to Recurring mapping Timestamps to Dates', () => {
      const startDate = new Date('2026-01-01T00:00:00Z')
      const nextDate = new Date('2026-02-01T00:00:00Z')

      const snap = makeMockSnapshot('rec-55', {
        type: 'income',
        amountFils: 850000,
        categoryId: 'cat-work',
        note: 'عقد استشاري',
        frequency: 'monthly',
        startDate: Timestamp.fromDate(startDate),
        nextDate: Timestamp.fromDate(nextDate),
        active: true,
      })

      const rec = recurringConverter.fromFirestore(snap)

      expect(rec.id).toBe('rec-55')
      expect(rec.type).toBe('income')
      expect(rec.amountFils).toBe(850000)
      expect(rec.frequency).toBe('monthly')
      expect(rec.startDate.getTime()).toBe(startDate.getTime())
      expect(rec.nextDate.getTime()).toBe(nextDate.getTime())
      expect(rec.endDate).toBeUndefined()
      expect(rec.active).toBe(true)
    })
  })

  describe('userSettingsConverter', () => {
    it('converts UserSettings to Firestore data clamping monthStartDay and setting currency', () => {
      const createdAt = new Date('2026-01-01T00:00:00Z')
      const settings: UserSettings = {
        uid: 'user-xyz',
        displayName: 'محمد أحمد',
        currency: 'USD', // should enforce 'JOD'
        monthStartDay: 35, // should clamp to 28
        theme: 'dark',
        createdAt,
      }

      const data = userSettingsConverter.toFirestore(settings) as Record<string, unknown>

      expect(data.displayName).toBe('محمد أحمد')
      expect(data.currency).toBe('JOD')
      expect(data.monthStartDay).toBe(28)
      expect(data.theme).toBe('dark')
      expect(data.createdAt).toBeInstanceOf(Timestamp)
      expect((data.createdAt as Timestamp).toDate().getTime()).toBe(createdAt.getTime())
    })

    it('converts Firestore snapshot to UserSettings with uid', () => {
      const createdAt = new Date('2026-01-01T00:00:00Z')
      const snap = makeMockSnapshot('user-123', {
        displayName: 'سارة',
        currency: 'JOD',
        monthStartDay: 25,
        theme: 'light',
        createdAt: Timestamp.fromDate(createdAt),
      })

      const settings = userSettingsConverter.fromFirestore(snap)

      expect(settings.uid).toBe('user-123')
      expect(settings.displayName).toBe('سارة')
      expect(settings.currency).toBe('JOD')
      expect(settings.monthStartDay).toBe(25)
      expect(settings.theme).toBe('light')
      expect(settings.createdAt?.getTime()).toBe(createdAt.getTime())
    })
  })
})
