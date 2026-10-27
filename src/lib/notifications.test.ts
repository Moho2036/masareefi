import { describe, it, expect } from 'vitest'
import { generateNotifications } from './notifications'
import type { Debt, MoneyCircle, Recurring, UserSettings } from '../types'

describe('notifications engine', () => {
  const baseSettings: UserSettings = {
    displayName: 'سارة',
    currency: 'JOD',
    monthStartDay: 1,
    theme: 'dark',
    notificationPrefs: {
      autoPayments: true,
      debtReminders: true,
      debtReminderDaysBefore: 3,
      circleAlerts: true,
      budgetWarnings: true,
      dailyReminder: true,
    },
  }

  const today = new Date('2026-05-15T12:00:00Z')

  it('generates overdue and upcoming debt reminders', () => {
    const debts: Debt[] = [
      {
        id: 'd-overdue',
        personName: 'خالد',
        type: 'borrowed',
        amountFils: 50000,
        paidFils: 0,
        startDate: new Date('2026-04-01T00:00:00Z'),
        dueDate: new Date('2026-05-10T00:00:00Z'), // 5 days ago
        note: '',
        settled: false,
        payments: [],
        createdAt: new Date(),
      },
      {
        id: 'd-upcoming',
        personName: 'سامي',
        type: 'lent',
        amountFils: 30000,
        paidFils: 0,
        startDate: new Date('2026-05-01T00:00:00Z'),
        dueDate: new Date('2026-05-17T00:00:00Z'), // in 2 days
        note: '',
        settled: false,
        payments: [],
        createdAt: new Date(),
      },
      {
        id: 'd-settled',
        personName: 'عمر',
        type: 'borrowed',
        amountFils: 20000,
        paidFils: 20000,
        startDate: new Date('2026-04-01T00:00:00Z'),
        dueDate: new Date('2026-05-10T00:00:00Z'),
        note: '',
        settled: true,
        payments: [],
        createdAt: new Date(),
      },
    ]

    const items = generateNotifications({
      debts,
      settings: baseSettings,
      today,
    })

    const overdue = items.find((i) => i.id.startsWith('debt_overdue_d-overdue'))
    expect(overdue).toBeDefined()
    expect(overdue?.isUrgent).toBe(true)

    const upcoming = items.find((i) => i.id.startsWith('debt_due_d-upcoming'))
    expect(upcoming).toBeDefined()
    expect(upcoming?.isUrgent).toBe(false)

    const settled = items.find((i) => i.id.includes('d-settled'))
    expect(settled).toBeUndefined()
  })

  it('respects notificationPrefs.debtReminders = false', () => {
    const debts: Debt[] = [
      {
        id: 'd-1',
        personName: 'خالد',
        type: 'borrowed',
        amountFils: 50000,
        paidFils: 0,
        startDate: new Date('2026-04-01T00:00:00Z'),
        dueDate: new Date('2026-05-10T00:00:00Z'),
        note: '',
        settled: false,
        payments: [],
        createdAt: new Date(),
      },
    ]

    const items = generateNotifications({
      debts,
      settings: {
        ...baseSettings,
        notificationPrefs: {
          ...baseSettings.notificationPrefs,
          debtReminders: false,
        },
      },
      today,
    })

    expect(items.some((i) => i.category === 'debt')).toBe(false)
  })

  it('generates circle turn notification when current month matches user turn', () => {
    const circles: MoneyCircle[] = [
      {
        id: 'c-1',
        name: 'جمعية العمل',
        monthlyAmountFils: 100000,
        membersCount: 10,
        totalAmountFils: 1000000,
        myTurnMonth: 5, // Month 5 of circle
        startDate: new Date('2026-01-01T00:00:00Z'), // Jan = 1, Feb = 2, Mar = 3, Apr = 4, May = 5
        members: [],
        status: 'active',
        createdAt: new Date(),
      },
    ]

    const items = generateNotifications({
      circles,
      settings: baseSettings,
      today, // May 2026
    })

    const circleTurn = items.find((i) => i.id.startsWith('circle_turn_c-1'))
    expect(circleTurn).toBeDefined()
    expect(circleTurn?.isUrgent).toBe(true)
    expect(circleTurn?.message).toContain('استلامك لمبلغ الجمعية بالكامل')
  })

  it('generates recurring payment notification when due today or upcoming', () => {
    const recurring: Recurring[] = [
      {
        id: 'rec-today',
        type: 'expense',
        amountFils: 25000,
        categoryId: 'cat-1',
        title: 'فاتورة الكهرباء',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-01-15T00:00:00Z'),
        nextDate: new Date('2026-05-15T00:00:00Z'), // today
        active: true,
      },
    ]

    const items = generateNotifications({
      recurring,
      settings: baseSettings,
      today,
    })

    const recDue = items.find((i) => i.id.startsWith('recurring_due_today_rec-today'))
    expect(recDue).toBeDefined()
    expect(recDue?.category).toBe('recurring')
    expect(recDue?.isUrgent).toBe(true)
  })

  it('generates budget deficit and spending percentage warnings', () => {
    // 1. Deficit: Spending 600 JOD with 500 JOD income
    const deficitItems = generateNotifications({
      settings: baseSettings,
      today,
      currentMonthIncomeFils: 500000,
      currentMonthSpendingFils: 600000,
    })

    const deficit = deficitItems.find((i) => i.id.startsWith('budget_deficit'))
    expect(deficit).toBeDefined()
    expect(deficit?.isUrgent).toBe(true)

    // 2. 80%+ warning: Spending 420 JOD out of 500 JOD income (84%)
    const warningItems = generateNotifications({
      settings: baseSettings,
      today,
      currentMonthIncomeFils: 500000,
      currentMonthSpendingFils: 420000,
    })

    const warning = warningItems.find((i) => i.id.startsWith('budget_warning_80'))
    expect(warning).toBeDefined()
    expect(warning?.title).toContain('84%')
  })

  it('generates daily reminder when enabled', () => {
    const items = generateNotifications({
      settings: {
        ...baseSettings,
        notificationPrefs: {
          dailyReminder: true,
        },
      },
      today,
    })

    const daily = items.find((i) => i.id.startsWith('daily_reminder'))
    expect(daily).toBeDefined()
    expect(daily?.category).toBe('system')
  })

  it('generates backup reminder when lastBackupAt is older than 30 days or never backed up with > 10 transactions', () => {
    // 1. lastBackupAt is 35 days ago
    const oldBackupDate = new Date('2026-04-10T12:00:00Z')
    const itemsOld = generateNotifications({
      settings: {
        ...baseSettings,
        lastBackupAt: oldBackupDate.toISOString(),
      },
      today,
    })
    const reminderOld = itemsOld.find((i) => i.id.startsWith('backup_reminder'))
    expect(reminderOld).toBeDefined()
    expect(reminderOld?.actionPath).toBe('/settings')

    // 2. No lastBackupAt but > 10 transactions
    const mockTxs = Array.from({ length: 12 }, (_, i) => ({
      id: `tx-${i}`,
      type: 'expense' as const,
      amountFils: 1000,
      categoryId: 'cat-1',
      date: today,
      title: `معاملة ${i}`,
      note: '',
      createdAt: today,
    }))
    const itemsInitial = generateNotifications({
      settings: {
        ...baseSettings,
        lastBackupAt: undefined,
      },
      transactions: mockTxs,
      today,
    })
    const reminderInitial = itemsInitial.find((i) => i.id.startsWith('backup_reminder_initial'))
    expect(reminderInitial).toBeDefined()
    expect(reminderInitial?.actionPath).toBe('/settings')

    // 3. Recent backup (5 days ago) - no backup reminder
    const recentBackupDate = new Date('2026-05-10T12:00:00Z')
    const itemsRecent = generateNotifications({
      settings: {
        ...baseSettings,
        lastBackupAt: recentBackupDate.toISOString(),
      },
      today,
    })
    const reminderRecent = itemsRecent.find((i) => i.id.startsWith('backup_reminder'))
    expect(reminderRecent).toBeUndefined()
  })
})
