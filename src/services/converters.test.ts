import { describe, it, expect } from 'vitest'
import { Timestamp, type QueryDocumentSnapshot } from 'firebase/firestore'
import {
  categoryConverter,
  transactionConverter,
  recurringConverter,
  userSettingsConverter,
  debtConverter,
  circleConverter,
  parseFirestoreDate,
} from './converters'
import type { Category, Transaction, Recurring, UserSettings, Debt } from '../types'

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

    it('trims and slices name and icon to comply with firestore rules', () => {
      const oversizedCat: Category = {
        id: 'cat-long',
        name: '   ' + 'أ'.repeat(50) + '   ',
        type: 'expense',
        icon: '👨‍👩‍👧‍👦'.repeat(10), // long multi-codepoint emoji string
        color: '#10B981',
        archived: false,
        order: 1,
      }

      const firestoreData = categoryConverter.toFirestore(oversizedCat)

      expect(firestoreData.name.length).toBeLessThanOrEqual(40)
      expect(firestoreData.icon.length).toBeLessThanOrEqual(16)
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
      expect(data.createdAt).toBeDefined() // defaults to serverTimestamp() when undefined
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

    it('preserves createdAt in toFirestore and fromFirestore when provided', () => {
      const createdAt = new Date('2026-01-01T12:00:00Z')
      const rec: Recurring = {
        id: 'rec-created',
        type: 'expense',
        amountFils: 2000,
        categoryId: 'cat-test',
        note: 'اختبار',
        frequency: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        nextDate: new Date('2026-02-01T00:00:00Z'),
        active: true,
        createdAt,
      }

      const data = recurringConverter.toFirestore(rec) as Record<string, unknown>
      expect(data.createdAt).toBeInstanceOf(Timestamp)

      const snap = makeMockSnapshot('rec-created', {
        ...data,
      })
      const fromSnap = recurringConverter.fromFirestore(snap)
      expect(fromSnap.createdAt).toBeInstanceOf(Date)
      expect(fromSnap.createdAt?.getTime()).toBe(createdAt.getTime())
    })

    it('handles requireConfirmation and new frequencies in toFirestore and fromFirestore', () => {
      const rec: Recurring = {
        id: 'rec-conf',
        type: 'expense',
        amountFils: 15000,
        categoryId: 'cat-bills',
        note: 'فاتورة كهرباء متغيرة',
        frequency: 'biweekly',
        startDate: new Date('2026-04-01T00:00:00Z'),
        nextDate: new Date('2026-04-15T00:00:00Z'),
        active: true,
        requireConfirmation: true,
      }

      const data = recurringConverter.toFirestore(rec) as Record<string, unknown>
      expect(data.requireConfirmation).toBe(true)
      expect(data.frequency).toBe('biweekly')

      const snap = makeMockSnapshot('rec-conf', data)
      const parsed = recurringConverter.fromFirestore(snap)
      expect(parsed.requireConfirmation).toBe(true)
      expect(parsed.frequency).toBe('biweekly')
    })
  })

  describe('userSettingsConverter', () => {
    it('converts UserSettings to Firestore data clamping monthStartDay and setting currency', () => {
      const createdAt = new Date('2026-01-01T00:00:00Z')
      const settings: UserSettings = {
        uid: 'user-xyz',
        displayName: 'محمد أحمد',
        currency: 'USD',
        monthStartDay: 35, // should clamp to 28
        theme: 'dark',
        createdAt,
      }

      const data = userSettingsConverter.toFirestore(settings) as Record<string, unknown>

      expect(data.displayName).toBe('محمد أحمد')
      expect(data.currency).toBe('USD')
      expect(data.monthStartDay).toBe(28)
      expect(data.theme).toBe('dark')
      expect(data.createdAt).toBeInstanceOf(Timestamp)
      expect((data.createdAt as Timestamp).toDate().getTime()).toBe(createdAt.getTime())

      // Fallback when currency is empty
      const emptyCurrencyData = userSettingsConverter.toFirestore({
        ...settings,
        currency: '' as unknown as string,
        rolloverBalance: true,
      }) as Record<string, unknown>
      expect(emptyCurrencyData.currency).toBe('JOD')
      expect(emptyCurrencyData.rolloverBalance).toBe(true)
    })

    it('converts Firestore snapshot to UserSettings with uid and rolloverBalance', () => {
      const createdAt = new Date('2026-01-01T00:00:00Z')
      const snap = makeMockSnapshot('user-123', {
        displayName: 'سارة',
        currency: 'JOD',
        monthStartDay: 25,
        theme: 'light',
        rolloverBalance: true,
        createdAt: Timestamp.fromDate(createdAt),
      })

      const settings = userSettingsConverter.fromFirestore(snap)

      expect(settings.uid).toBe('user-123')
      expect(settings.displayName).toBe('سارة')
      expect(settings.currency).toBe('JOD')
      expect(settings.monthStartDay).toBe(25)
      expect(settings.theme).toBe('light')
      expect(settings.rolloverBalance).toBe(true)
      expect((settings.createdAt as Date)?.getTime()).toBe(createdAt.getTime())
    })

    it('handles onboardingCompleted and openingBalanceFils in toFirestore and fromFirestore', () => {
      const fullSettings: UserSettings = {
        uid: 'user-onboarded',
        displayName: 'علي',
        currency: 'AED',
        monthStartDay: 1,
        theme: 'system',
        rolloverBalance: true,
        onboardingCompleted: true,
        openingBalanceFils: 500000,
      }

      const data = userSettingsConverter.toFirestore(fullSettings) as Record<string, unknown>
      expect(data.onboardingCompleted).toBe(true)
      expect(data.openingBalanceFils).toBe(500000)

      const snap = makeMockSnapshot('user-onboarded', data)
      const parsed = userSettingsConverter.fromFirestore(snap)
      expect(parsed.onboardingCompleted).toBe(true)
      expect(parsed.openingBalanceFils).toBe(500000)
    })

    it('handles privacy, sorting, decimals, and notification preferences in toFirestore and fromFirestore', () => {
      const advancedSettings: UserSettings = {
        uid: 'user-adv',
        displayName: 'فاطمة',
        currency: 'USD',
        monthStartDay: 15,
        theme: 'dark',
        hideBalances: true,
        hideZeroDecimals: true,
        categorySortMode: 'usage',
        customCurrencyDecimals: 0,
        lastBackupAt: '2026-10-27T10:00:00.000Z',
        avatarColor: '#3b82f6',
        notificationPrefs: {
          autoPayments: true,
          debtReminders: true,
          debtReminderDaysBefore: 3,
          circleAlerts: true,
          budgetWarnings: false,
          dailyReminder: true,
          dailyReminderTime: '20:30',
        },
      }

      const data = userSettingsConverter.toFirestore(advancedSettings) as Record<string, unknown>
      expect(data.hideBalances).toBe(true)
      expect(data.hideZeroDecimals).toBe(true)
      expect(data.categorySortMode).toBe('usage')
      expect(data.customCurrencyDecimals).toBe(0)
      expect(data.lastBackupAt).toBe('2026-10-27T10:00:00.000Z')
      expect(data.avatarColor).toBe('#3b82f6')
      expect(data.notificationPrefs).toEqual({
        autoPayments: true,
        debtReminders: true,
        debtReminderDaysBefore: 3,
        circleAlerts: true,
        budgetWarnings: false,
        dailyReminder: true,
        dailyReminderTime: '20:30',
      })

      const snap = makeMockSnapshot('user-adv', data)
      const parsed = userSettingsConverter.fromFirestore(snap)
      expect(parsed.hideBalances).toBe(true)
      expect(parsed.hideZeroDecimals).toBe(true)
      expect(parsed.categorySortMode).toBe('usage')
      expect(parsed.customCurrencyDecimals).toBe(0)
      expect(parsed.notificationPrefs?.dailyReminderTime).toBe('20:30')
    })
  })

  describe('debtConverter', () => {
    it('converts Debt to Firestore data correctly', () => {
      const startDate = new Date('2026-09-15T00:00:00Z')
      const dueDate = new Date('2026-11-01T00:00:00Z')
      const createdAt = new Date('2026-09-15T12:00:00Z')
      const paymentDate = new Date('2026-10-01T10:00:00Z')

      const debt: Debt = {
        id: 'debt-1',
        personName: ' أحمد العبدلله ',
        type: 'lent',
        amountFils: 100000,
        paidFils: 30000,
        startDate,
        dueDate,
        note: 'سلفة',
        settled: false,
        payments: [
          {
            id: 'pay-1',
            amountFils: 30000,
            date: paymentDate,
            note: 'كليك',
            createdAt: paymentDate,
          },
        ],
        createdAt,
      }

      const firestoreData = debtConverter.toFirestore(debt)

      expect(firestoreData.personName).toBe('أحمد العبدلله')
      expect(firestoreData.type).toBe('lent')
      expect(firestoreData.amountFils).toBe(100000)
      expect(firestoreData.paidFils).toBe(30000)
      expect(firestoreData.settled).toBe(false)
      expect(firestoreData.note).toBe('سلفة')
      expect(firestoreData.startDate).toBeInstanceOf(Timestamp)
      expect(firestoreData.dueDate).toBeInstanceOf(Timestamp)
      expect(firestoreData.payments).toHaveLength(1)
      expect((firestoreData.payments as Array<{ id: string }>)[0].id).toBe('pay-1')
      expect((firestoreData as Record<string, unknown>).id).toBeUndefined()
    })

    it('converts Firestore snapshot to Debt correctly with null dueDate', () => {
      const startDate = new Date('2026-09-15T00:00:00Z')
      const createdAt = new Date('2026-09-15T12:00:00Z')

      const snap = makeMockSnapshot('debt-2', {
        personName: 'خالد',
        type: 'borrowed',
        amountFils: 50000,
        paidFils: 50000,
        startDate: Timestamp.fromDate(startDate),
        dueDate: null,
        note: '',
        settled: true,
        payments: [],
        createdAt: Timestamp.fromDate(createdAt),
      })

      const debt = debtConverter.fromFirestore(snap)

      expect(debt.id).toBe('debt-2')
      expect(debt.personName).toBe('خالد')
      expect(debt.type).toBe('borrowed')
      expect(debt.amountFils).toBe(50000)
      expect(debt.paidFils).toBe(50000)
      expect(debt.settled).toBe(true)
      expect(debt.dueDate).toBeNull()
      expect(debt.payments).toEqual([])
    })

    it('recalculates settled and clamps paidFils in toFirestore', () => {
      const debt: Debt = {
        id: 'debt-clamp',
        personName: 'سعيد',
        type: 'lent',
        amountFils: 40000,
        paidFils: 45000, // exceeds amountFils!
        startDate: new Date(),
        dueDate: null,
        note: '',
        settled: false, // mismatch!
        payments: [],
        createdAt: new Date(),
      }

      const firestoreData = debtConverter.toFirestore(debt)
      expect(firestoreData.paidFils).toBe(40000) // clamped to amountFils
      expect(firestoreData.settled).toBe(true) // recalculated: 40000 === 40000
    })

    it('enforces settled is false if paidFils is less than amountFils even if settled was true', () => {
      const debt: Debt = {
        id: 'debt-unsettled',
        personName: 'سعيد',
        type: 'lent',
        amountFils: 50000,
        paidFils: 20000,
        startDate: new Date(),
        dueDate: null,
        note: '',
        settled: true, // incorrect settled!
        payments: [],
        createdAt: new Date(),
      }

      const firestoreData = debtConverter.toFirestore(debt)
      expect(firestoreData.settled).toBe(false)
    })
  })

  describe('userSettingsConverter Timestamp preservation', () => {
    it('preserves exact Timestamp instance for createdAt', () => {
      const ts = Timestamp.fromDate(new Date('2026-05-01T12:34:56.789Z'))
      const settings: UserSettings = {
        displayName: 'مروان',
        currency: 'JOD',
        monthStartDay: 1,
        theme: 'light',
        createdAt: ts,
      }

      const data = userSettingsConverter.toFirestore(settings)
      expect(data.createdAt).toBe(ts)
    })
  })

  describe('optional string fields omission in converters', () => {
    it('omits empty string title and recurringId in transactionConverter', () => {
      const tx: Transaction = {
        id: 'tx-empty-fields',
        type: 'expense',
        amountFils: 1000,
        categoryId: 'cat-1',
        date: new Date(),
        note: 'ملاحظة',
        title: '   ',
        recurringId: '',
        createdAt: new Date(),
      }

      const data = transactionConverter.toFirestore(tx)
      expect(data.title).toBeUndefined()
      expect(data.recurringId).toBeUndefined()
    })

    it('omits empty string title and circleId in recurringConverter', () => {
      const rec: Recurring = {
        id: 'rec-empty-fields',
        type: 'expense',
        amountFils: 5000,
        categoryId: 'cat-1',
        note: '',
        frequency: 'monthly',
        startDate: new Date(),
        nextDate: new Date(),
        active: true,
        title: '',
        circleId: '  ',
      }

      const data = recurringConverter.toFirestore(rec)
      expect(data.title).toBeUndefined()
      expect(data.circleId).toBeUndefined()
    })

    it('serializes and deserializes skipMonths in recurringConverter', () => {
      const rec: Recurring = {
        id: 'rec-skip-months',
        type: 'expense',
        amountFils: 50000,
        categoryId: 'cat-1',
        note: 'جمعية',
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        nextDate: new Date('2026-02-01'),
        active: true,
        skipMonths: [3, 7],
      }

      const firestoreData = recurringConverter.toFirestore(rec)
      expect(firestoreData.skipMonths).toEqual([3, 7])

      const snapshot = makeMockSnapshot('rec-skip-months', {
        ...firestoreData,
        startDate: Timestamp.fromDate(rec.startDate),
        nextDate: Timestamp.fromDate(rec.nextDate),
      })
      const fromFs = recurringConverter.fromFirestore(snapshot)
      expect(fromFs.skipMonths).toEqual([3, 7])
    })

    it('serializes and deserializes entries in debtConverter', () => {
      const debt: Debt = {
        id: 'debt-entries',
        personName: 'خالد',
        type: 'lent',
        amountFils: 70000,
        paidFils: 20000,
        startDate: new Date('2026-01-01'),
        note: 'دين تجاري',
        settled: false,
        payments: [],
        createdAt: new Date('2026-01-01'),
        entries: [
          {
            id: 'entry-1',
            amountFils: 50000,
            date: new Date('2026-01-01'),
            title: 'دفعة أولى',
            note: 'سلفة أولى',
            transactionId: 'tx-1',
            createdAt: new Date('2026-01-01'),
          },
          {
            id: 'entry-2',
            amountFils: 20000,
            date: new Date('2026-02-01'),
            title: 'سلفة ثانية',
            note: 'تكاليف إضافية',
            createdAt: new Date('2026-02-01'),
          },
        ],
      }

      const firestoreData = debtConverter.toFirestore(debt)
      expect(firestoreData.entries).toHaveLength(2)
      expect(firestoreData.entries[0].amountFils).toBe(50000)
      expect(firestoreData.entries[0].title).toBe('دفعة أولى')
      expect(firestoreData.entries[0].transactionId).toBe('tx-1')
      expect(firestoreData.entries[1].amountFils).toBe(20000)

      const snapshot = makeMockSnapshot('debt-entries', {
        ...firestoreData,
        startDate: Timestamp.fromDate(debt.startDate),
        createdAt: Timestamp.fromDate(debt.createdAt),
        entries: firestoreData.entries,
      })
      const fromFs = debtConverter.fromFirestore(snapshot)
      expect(fromFs.entries).toHaveLength(2)
      expect(fromFs.entries![0].id).toBe('entry-1')
      expect(fromFs.entries![0].amountFils).toBe(50000)
      expect(fromFs.entries![0].title).toBe('دفعة أولى')
      expect(fromFs.entries![0].transactionId).toBe('tx-1')
      expect(fromFs.entries![1].id).toBe('entry-2')
    })

    it('slices payments to 100 in debtConverter.toFirestore', () => {
      const payments = Array.from({ length: 120 }, (_, i) => ({
        id: `p-${i}`,
        amountFils: 1000,
        date: new Date('2026-01-01'),
        createdAt: new Date('2026-01-01'),
        note: `دفعة ${i}`,
      }))

      const debt: Debt = {
        id: 'debt-many-payments',
        personName: 'سعيد',
        type: 'lent',
        amountFils: 150000,
        paidFils: 120000,
        startDate: new Date('2026-01-01'),
        note: '',
        settled: false,
        payments,
        createdAt: new Date('2026-01-01'),
      }

      const firestoreData = debtConverter.toFirestore(debt)
      expect(firestoreData.payments).toHaveLength(100)
    })
  })

  describe('parseFirestoreDate and timestamp robustness across converters', () => {
    it('handles plain { seconds: number } and { toDate: () => Date } objects safely', () => {
      const fixedDate = new Date('2026-05-15T12:00:00Z')
      const plainSecondsObj = { seconds: Math.floor(fixedDate.getTime() / 1000) }
      const toDateObj = { toDate: () => fixedDate }

      expect(parseFirestoreDate(plainSecondsObj).getTime()).toBe(fixedDate.getTime())
      expect(parseFirestoreDate(toDateObj).getTime()).toBe(fixedDate.getTime())
      expect(parseFirestoreDate(null, null)).toBeNull()
      expect(parseFirestoreDate(undefined, undefined)).toBeUndefined()
    })

    it('converts cached/restored plain objects in transaction, recurring, settings, and debt without Invalid Date', () => {
      const targetTime = 1770000000000
      const secondsVal = Math.floor(targetTime / 1000)
      const plainTs = { seconds: secondsVal }

      const txSnap = makeMockSnapshot('tx-plain', {
        type: 'income',
        amountFils: 5000,
        categoryId: 'cat-1',
        date: plainTs,
        createdAt: plainTs,
      })
      const tx = transactionConverter.fromFirestore(txSnap)
      expect(isNaN(tx.date.getTime())).toBe(false)
      expect(isNaN(tx.createdAt.getTime())).toBe(false)

      const recSnap = makeMockSnapshot('rec-plain', {
        type: 'expense',
        amountFils: 10000,
        categoryId: 'cat-1',
        frequency: 'monthly',
        startDate: plainTs,
        nextDate: plainTs,
        endDate: plainTs,
        createdAt: plainTs,
        active: true,
      })
      const rec = recurringConverter.fromFirestore(recSnap)
      expect(isNaN(rec.startDate.getTime())).toBe(false)
      expect(isNaN(rec.nextDate.getTime())).toBe(false)
      expect(isNaN(rec.endDate!.getTime())).toBe(false)

      const settingsSnap = makeMockSnapshot('u-plain', {
        rolloverStartDate: plainTs,
        createdAt: plainTs,
      })
      const settings = userSettingsConverter.fromFirestore(settingsSnap)
      expect(isNaN((settings.rolloverStartDate as Date).getTime())).toBe(false)
      expect(isNaN((settings.createdAt as Date).getTime())).toBe(false)

      const debtSnap = makeMockSnapshot('debt-plain', {
        personName: 'كريم',
        type: 'lent',
        amountFils: 10000,
        paidFils: 5000,
        startDate: plainTs,
        dueDate: plainTs,
        createdAt: plainTs,
        payments: [{ id: 'p1', amountFils: 5000, date: plainTs, createdAt: plainTs }],
        entries: [{ id: 'e1', amountFils: 10000, date: plainTs, createdAt: plainTs }],
      })
      const debt = debtConverter.fromFirestore(debtSnap)
      expect(isNaN(debt.startDate.getTime())).toBe(false)
      expect(isNaN(debt.dueDate!.getTime())).toBe(false)
      expect(isNaN(debt.payments[0].date.getTime())).toBe(false)
      expect(isNaN(debt.entries![0].date.getTime())).toBe(false)
    })

    it('re-exports circleConverter', () => {
      expect(circleConverter).toBeDefined()
      expect(typeof circleConverter.toFirestore).toBe('function')
      expect(typeof circleConverter.fromFirestore).toBe('function')
    })
  })
})

