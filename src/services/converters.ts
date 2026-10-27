import {
  Timestamp,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type DocumentData,
} from 'firebase/firestore'
import type { Category, Transaction, Recurring, UserSettings, Debt, DebtPayment, DebtEntry } from '../types'

export const categoryConverter: FirestoreDataConverter<Category> = {
  toFirestore(cat: Category): DocumentData {
    const name = (typeof cat.name === 'string' ? cat.name.trim() : '').slice(0, 40)
    const icon = (typeof cat.icon === 'string' ? cat.icon.trim() : '📁').slice(0, 16)
    return {
      name: name || 'تصنيف',
      type: cat.type,
      icon: icon || '📁',
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
    if (typeof tx.title === 'string' && tx.title.trim()) {
      data.title = tx.title.trim().slice(0, 100)
    }
    if (typeof tx.recurringId === 'string' && tx.recurringId.trim()) {
      data.recurringId = tx.recurringId.trim().slice(0, 128)
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
    if (rec.createdAt) {
      data.createdAt =
        rec.createdAt instanceof Date ? Timestamp.fromDate(rec.createdAt) : rec.createdAt
    }
    if (typeof rec.title === 'string' && rec.title.trim()) {
      data.title = rec.title.trim().slice(0, 100)
    }
    if (rec.endDate) {
      data.endDate =
        rec.endDate instanceof Date ? Timestamp.fromDate(rec.endDate) : rec.endDate
    }
    if (typeof rec.circleId === 'string' && rec.circleId.trim()) {
      data.circleId = rec.circleId.trim().slice(0, 128)
    }
    if (
      rec.skipMonth !== undefined &&
      rec.skipMonth !== null &&
      Number.isFinite(Number(rec.skipMonth)) &&
      Math.round(Number(rec.skipMonth)) >= 1 &&
      Math.round(Number(rec.skipMonth)) <= 50
    ) {
      data.skipMonth = Math.round(Number(rec.skipMonth))
    }
    if (Array.isArray(rec.skipMonths) && rec.skipMonths.length > 0) {
      data.skipMonths = rec.skipMonths
        .map(Number)
        .filter((m) => Number.isFinite(m) && m >= 1 && m <= 50)
        .slice(0, 10)
    }
    if (rec.requireConfirmation !== undefined) {
      data.requireConfirmation = Boolean(rec.requireConfirmation)
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
    if (data.createdAt) {
      rec.createdAt =
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : new Date(data.createdAt)
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
    if (
      data.skipMonth !== undefined &&
      data.skipMonth !== null &&
      Number.isFinite(Number(data.skipMonth)) &&
      Math.round(Number(data.skipMonth)) >= 1 &&
      Math.round(Number(data.skipMonth)) <= 50
    ) {
      rec.skipMonth = Math.round(Number(data.skipMonth))
    }
    if (Array.isArray(data.skipMonths) && data.skipMonths.length > 0) {
      rec.skipMonths = data.skipMonths
        .map(Number)
        .filter((m) => Number.isFinite(m) && m >= 1 && m <= 50)
        .slice(0, 10)
    }
    if (data.requireConfirmation !== undefined) {
      rec.requireConfirmation = Boolean(data.requireConfirmation)
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
        settings.createdAt instanceof Timestamp
          ? settings.createdAt
          : settings.createdAt instanceof Date
            ? Timestamp.fromDate(settings.createdAt)
            : settings.createdAt && typeof settings.createdAt === 'object' && ('seconds' in settings.createdAt || 'toDate' in settings.createdAt)
              ? settings.createdAt
              : (settings.createdAt ?? serverTimestamp()),
    }
    if (typeof settings.rolloverBalance === 'boolean') {
      data.rolloverBalance = settings.rolloverBalance
    }
    if (typeof settings.onboardingCompleted === 'boolean') {
      data.onboardingCompleted = settings.onboardingCompleted
    }
    if (
      settings.openingBalanceFils !== undefined &&
      settings.openingBalanceFils !== null &&
      Number.isFinite(Number(settings.openingBalanceFils)) &&
      Number(settings.openingBalanceFils) >= 0
    ) {
      data.openingBalanceFils = Math.round(Number(settings.openingBalanceFils))
    }
    if (typeof settings.hideBalances === 'boolean') {
      data.hideBalances = settings.hideBalances
    }
    if (typeof settings.hideZeroDecimals === 'boolean') {
      data.hideZeroDecimals = settings.hideZeroDecimals
    }
    if (settings.categorySortMode === 'usage' || settings.categorySortMode === 'manual') {
      data.categorySortMode = settings.categorySortMode
    }
    if (
      settings.customCurrencyDecimals !== undefined &&
      settings.customCurrencyDecimals !== null &&
      [0, 2, 3].includes(Number(settings.customCurrencyDecimals))
    ) {
      data.customCurrencyDecimals = Number(settings.customCurrencyDecimals)
    }
    if (settings.rolloverStartDate !== undefined && settings.rolloverStartDate !== null) {
      if (settings.rolloverStartDate instanceof Timestamp) {
        data.rolloverStartDate = settings.rolloverStartDate
      } else if (settings.rolloverStartDate instanceof Date) {
        data.rolloverStartDate = Timestamp.fromDate(settings.rolloverStartDate)
      } else if (typeof settings.rolloverStartDate === 'string') {
        const parsed = new Date(settings.rolloverStartDate)
        if (!isNaN(parsed.getTime())) {
          data.rolloverStartDate = Timestamp.fromDate(parsed)
        }
      }
    }
    if (typeof settings.lastBackupAt === 'string') {
      data.lastBackupAt = settings.lastBackupAt.slice(0, 50)
    }
    if (typeof settings.avatarColor === 'string' && settings.avatarColor.trim()) {
      data.avatarColor = settings.avatarColor.trim().slice(0, 30)
    }
    if (settings.notificationPrefs && typeof settings.notificationPrefs === 'object') {
      const prefs: Record<string, unknown> = {}
      if (typeof settings.notificationPrefs.autoPayments === 'boolean') {
        prefs.autoPayments = settings.notificationPrefs.autoPayments
      }
      if (typeof settings.notificationPrefs.debtReminders === 'boolean') {
        prefs.debtReminders = settings.notificationPrefs.debtReminders
      }
      if (
        settings.notificationPrefs.debtReminderDaysBefore !== undefined &&
        [0, 1, 3].includes(Number(settings.notificationPrefs.debtReminderDaysBefore))
      ) {
        prefs.debtReminderDaysBefore = Number(settings.notificationPrefs.debtReminderDaysBefore)
      }
      if (typeof settings.notificationPrefs.circleAlerts === 'boolean') {
        prefs.circleAlerts = settings.notificationPrefs.circleAlerts
      }
      if (typeof settings.notificationPrefs.budgetWarnings === 'boolean') {
        prefs.budgetWarnings = settings.notificationPrefs.budgetWarnings
      }
      if (typeof settings.notificationPrefs.dailyReminder === 'boolean') {
        prefs.dailyReminder = settings.notificationPrefs.dailyReminder
      }
      if (typeof settings.notificationPrefs.dailyReminderTime === 'string') {
        prefs.dailyReminderTime = settings.notificationPrefs.dailyReminderTime.slice(0, 10)
      }
      data.notificationPrefs = prefs
    }
    return data
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserSettings {
    const data = snapshot.data(options)
    const settings: UserSettings = {
      uid: snapshot.id,
      displayName: data.displayName ?? '',
      currency: data.currency ?? 'JOD',
      monthStartDay: data.monthStartDay ?? 1,
      theme: data.theme ?? 'system',
      rolloverBalance: typeof data.rolloverBalance === 'boolean' ? data.rolloverBalance : true,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : data.createdAt
            ? new Date(data.createdAt)
            : undefined,
    }
    if (typeof data.onboardingCompleted === 'boolean') {
      settings.onboardingCompleted = data.onboardingCompleted
    }
    if (
      data.openingBalanceFils !== undefined &&
      data.openingBalanceFils !== null &&
      typeof data.openingBalanceFils === 'number'
    ) {
      settings.openingBalanceFils = data.openingBalanceFils
    }
    if (typeof data.hideBalances === 'boolean') {
      settings.hideBalances = data.hideBalances
    }
    if (typeof data.hideZeroDecimals === 'boolean') {
      settings.hideZeroDecimals = data.hideZeroDecimals
    }
    if (data.categorySortMode === 'usage' || data.categorySortMode === 'manual') {
      settings.categorySortMode = data.categorySortMode
    }
    if (typeof data.customCurrencyDecimals === 'number') {
      settings.customCurrencyDecimals = data.customCurrencyDecimals
    }
    if (data.rolloverStartDate) {
      settings.rolloverStartDate =
        data.rolloverStartDate instanceof Timestamp
          ? data.rolloverStartDate.toDate()
          : new Date(data.rolloverStartDate)
    }
    if (typeof data.lastBackupAt === 'string') {
      settings.lastBackupAt = data.lastBackupAt
    }
    if (typeof data.avatarColor === 'string') {
      settings.avatarColor = data.avatarColor
    }
    if (data.notificationPrefs && typeof data.notificationPrefs === 'object') {
      settings.notificationPrefs = { ...data.notificationPrefs }
    }
    return settings
  },
}

export const debtConverter: FirestoreDataConverter<Debt> = {
  toFirestore(debt: Debt): DocumentData {
    const amountFils = Math.round(Number(debt.amountFils))
    const rawPaid = Math.round(Number(debt.paidFils ?? 0))
    const paidFils = Math.max(0, Math.min(amountFils, rawPaid))
    const settled = paidFils === amountFils

    const data: DocumentData = {
      personName: (debt.personName || '').trim().slice(0, 100),
      type: debt.type,
      amountFils,
      paidFils,
      startDate:
        debt.startDate instanceof Date ? Timestamp.fromDate(debt.startDate) : debt.startDate,
      note: typeof debt.note === 'string' ? debt.note.slice(0, 500) : '',
      settled,
      payments: (debt.payments || []).map((p) => {
        const item: DocumentData = {
          id: p.id,
          amountFils: Math.round(Number(p.amountFils)),
          date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
          createdAt:
            p.createdAt instanceof Date ? Timestamp.fromDate(p.createdAt) : p.createdAt,
          note:
            typeof p.note === 'string' && p.note.trim()
              ? p.note.trim().slice(0, 500)
              : 'دفعة سداد',
        }
        if (p.transactionId && typeof p.transactionId === 'string' && p.transactionId.trim()) {
          item.transactionId = p.transactionId.trim()
        }
        if (p.isMerged) {
          item.isMerged = true
        }
        if (Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.length > 0) {
          item.mergedTransactionIds = p.mergedTransactionIds.filter(Boolean)
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
    if (Array.isArray(debt.entries) && debt.entries.length > 0) {
      data.entries = debt.entries.slice(0, 100).map((e) => {
        const item: DocumentData = {
          id: String(e.id || ''),
          amountFils: Math.round(Number(e.amountFils || 0)),
          date: e.date instanceof Date ? Timestamp.fromDate(e.date) : e.date,
          note: typeof e.note === 'string' ? e.note.slice(0, 500) : '',
          createdAt:
            e.createdAt instanceof Date ? Timestamp.fromDate(e.createdAt) : e.createdAt,
        }
        if (typeof e.title === 'string' && e.title.trim()) {
          item.title = e.title.trim().slice(0, 100)
        }
        if (typeof e.transactionId === 'string' && e.transactionId.trim()) {
          item.transactionId = e.transactionId.trim().slice(0, 128)
        }
        return item
      })
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
      transactionId:
        typeof p.transactionId === 'string' && p.transactionId.trim()
          ? p.transactionId.trim()
          : undefined,
      createdAt:
        p.createdAt instanceof Timestamp
          ? p.createdAt.toDate()
          : p.createdAt
            ? new Date(p.createdAt as string | number)
            : new Date(),
      ...(p.isMerged ? { isMerged: true } : {}),
      ...(Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.length > 0
        ? { mergedTransactionIds: (p.mergedTransactionIds as unknown[]).map(String) }
        : {}),
    }))

    const rawEntries: Array<Record<string, unknown>> = Array.isArray(data.entries)
      ? data.entries
      : []
    const entries: DebtEntry[] = rawEntries.map((e) => ({
      id: String(e.id || ''),
      amountFils: Number(e.amountFils || 0),
      date:
        e.date instanceof Timestamp
          ? e.date.toDate()
          : e.date
            ? new Date(e.date as string | number)
            : new Date(),
      title: typeof e.title === 'string' && e.title.trim() ? e.title.trim() : undefined,
      note: typeof e.note === 'string' ? e.note : '',
      transactionId:
        typeof e.transactionId === 'string' && e.transactionId.trim()
          ? e.transactionId.trim()
          : undefined,
      createdAt:
        e.createdAt instanceof Timestamp
          ? e.createdAt.toDate()
          : e.createdAt
            ? new Date(e.createdAt as string | number)
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
      ...(entries.length > 0 ? { entries } : {}),
    }
  },
}

