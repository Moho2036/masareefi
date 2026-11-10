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
        recurringId: 'rec-circle-1',
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

    const circleExempt = items.find((i) => i.id.startsWith('circle_exempt_c-1'))
    expect(circleExempt).toBeDefined()
    expect(circleExempt?.category).toBe('recurring')
    expect(circleExempt?.isUrgent).toBe(false)
    expect(circleExempt?.actionPath).toBe('/tools?tool=circles')
    expect(circleExempt?.actionLabel).toBe('إيداع الصافي الآن')
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

  it('generates confirmation required notification for recurring items when requireConfirmation is true', () => {
    const recurring: Recurring[] = [
      {
        id: 'rec-confirm',
        type: 'expense',
        amountFils: 45000,
        categoryId: 'cat-1',
        title: 'فاتورة المياه المتغيرة',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-01-15T00:00:00Z'),
        nextDate: new Date('2026-05-15T00:00:00Z'), // today
        active: true,
        requireConfirmation: true,
      },
    ]

    const items = generateNotifications({
      recurring,
      settings: baseSettings,
      today,
    })

    const confirmItem = items.find((i) => i.id.startsWith('recurring_confirm_rec-confirm'))
    expect(confirmItem).toBeDefined()
    expect(confirmItem?.category).toBe('recurring')
    expect(confirmItem?.isUrgent).toBe(true)
    expect(confirmItem?.actionPath).toBe('/recurring?confirmId=rec-confirm')
    expect(confirmItem?.actionLabel).toBe('تأكيد المبلغ وتسجيل الدفع')
  })

  it('generates notification for auto-recorded recurring transactions within the last 30 days', () => {
    const transactions = [
      {
        id: 'tx-recent-rec',
        type: 'expense' as const,
        amountFils: 15000,
        categoryId: 'cat-1',
        date: new Date('2026-05-10T09:00:00Z'), // 5 days ago (<= 30 days)
        title: 'اشتراك الإنترنت',
        note: '',
        createdAt: new Date('2026-05-10T09:00:00Z'),
        recurringId: 'rec-internet',
      },
      {
        id: 'tx-old-rec',
        type: 'expense' as const,
        amountFils: 10000,
        categoryId: 'cat-1',
        date: new Date('2026-04-10T09:00:00Z'), // 35 days ago (> 30 days)
        title: 'اشتراك قديم',
        note: '',
        createdAt: new Date('2026-04-10T09:00:00Z'),
        recurringId: 'rec-old',
      },
      {
        id: 'tx-manual',
        type: 'expense' as const,
        amountFils: 5000,
        categoryId: 'cat-1',
        date: new Date('2026-05-15T09:00:00Z'),
        title: 'شراء يدوي',
        note: '',
        createdAt: new Date('2026-05-15T09:00:00Z'),
      },
    ]

    const items = generateNotifications({
      settings: baseSettings,
      transactions,
      today,
    })

    const autoRec = items.find((i) => i.id === 'recurring_auto_recorded_tx-recent-rec')
    expect(autoRec).toBeDefined()
    expect(autoRec?.category).toBe('recurring')
    expect(autoRec?.isUrgent).toBe(false)
    expect(autoRec?.actionPath).toBe('/transactions')
    expect(autoRec?.actionLabel).toBe('عرض المعاملة')

    const oldRec = items.find((i) => i.id === 'recurring_auto_recorded_tx-old-rec')
    expect(oldRec).toBeUndefined()

    const manual = items.find((i) => i.id === 'recurring_auto_recorded_tx-manual')
    expect(manual).toBeUndefined()
  })

  it('generates approaching notification for recurring items due within 7 days (e.g. 5 days)', () => {
    const recurring: Recurring[] = [
      {
        id: 'rec-in-5-days',
        type: 'expense',
        amountFils: 30000,
        categoryId: 'cat-1',
        title: 'قسط اشتراك',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-01-20T00:00:00Z'),
        nextDate: new Date('2026-05-20T00:00:00Z'), // in 5 days (May 15 to May 20)
        active: true,
      },
      {
        id: 'rec-in-10-days',
        type: 'expense',
        amountFils: 30000,
        categoryId: 'cat-1',
        title: 'قسط بعيد',
        note: '',
        frequency: 'monthly',
        startDate: new Date('2026-01-25T00:00:00Z'),
        nextDate: new Date('2026-05-25T00:00:00Z'), // in 10 days (> 7 days)
        active: true,
      },
    ]

    const items = generateNotifications({
      recurring,
      settings: baseSettings,
      today,
    })

    const approaching = items.find((i) => i.id.startsWith('recurring_approaching_rec-in-5-days'))
    expect(approaching).toBeDefined()
    expect(approaching?.category).toBe('recurring')
    expect(approaching?.isUrgent).toBe(false)
    expect(approaching?.message).toContain('خلال 5 يوم')

    const farItem = items.find((i) => i.id.startsWith('recurring_approaching_rec-in-10-days'))
    expect(farItem).toBeUndefined()
  })

  it('generates budget deficit warning when spending with zero or negative liquidity', () => {
    // Zero income and negative prior balance (-50 JOD), spent 20 JOD
    const items = generateNotifications({
      settings: { ...baseSettings, rolloverBalance: true },
      today,
      currentMonthIncomeFils: 0,
      priorBalanceFils: -50000,
      currentMonthSpendingFils: 20000,
    })

    const deficit = items.find((i) => i.id.startsWith('budget_deficit'))
    expect(deficit).toBeDefined()
    expect(deficit?.isUrgent).toBe(true)
  })

  it('generates budget notification ids formatted with fiscal month key respecting monthStartDay', () => {
    // Date: Nov 27, 2026. With monthStartDay = 25, fiscal month key is '2026-11'
    const nov27 = new Date(2026, 10, 27)
    const itemsNov27 = generateNotifications({
      settings: { ...baseSettings, monthStartDay: 25 },
      today: nov27,
      currentMonthIncomeFils: 500000,
      currentMonthSpendingFils: 600000,
    })
    const deficitNov = itemsNov27.find((i) => i.id.startsWith('budget_deficit'))
    expect(deficitNov?.id).toBe('budget_deficit_2026-11')

    // Date: Dec 1, 2026. Still inside the cycle 25 Nov – 24 Dec! Fiscal key must remain '2026-11'
    const dec1 = new Date(2026, 11, 1)
    const itemsDec1 = generateNotifications({
      settings: { ...baseSettings, monthStartDay: 25 },
      today: dec1,
      currentMonthIncomeFils: 500000,
      currentMonthSpendingFils: 600000,
    })
    const deficitDec = itemsDec1.find((i) => i.id.startsWith('budget_deficit'))
    expect(deficitDec?.id).toBe('budget_deficit_2026-11')
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

  it('does NOT trigger month 2 circle alerts before the 25th when circle started on the 25th', () => {
    const circles: MoneyCircle[] = [
      {
        id: 'c-midmonth',
        name: 'جمعية التطوير',
        monthlyAmountFils: 50000,
        membersCount: 10,
        totalAmountFils: 500000,
        myTurnMonth: 2,
        startDate: new Date('2026-01-25T00:00:00Z'),
        members: [],
        status: 'active',
        createdAt: new Date(),
      },
    ]

    // On Feb 5, 2026, the circle is still in month 1 (Jan 25 - Feb 24)
    const feb5 = new Date('2026-02-05T12:00:00Z')
    const itemsFeb5 = generateNotifications({
      circles,
      settings: { ...baseSettings, monthStartDay: 25 },
      today: feb5,
    })

    const circleTurnFeb5 = itemsFeb5.find((i) => i.id.startsWith('circle_turn_c-midmonth'))
    expect(circleTurnFeb5).toBeUndefined()

    // On Feb 25, 2026, month 2 starts -> notification triggers
    const feb25 = new Date('2026-02-25T12:00:00Z')
    const itemsFeb25 = generateNotifications({
      circles,
      settings: { ...baseSettings, monthStartDay: 25 },
      today: feb25,
    })

    const circleTurnFeb25 = itemsFeb25.find((i) => i.id.startsWith('circle_turn_c-midmonth'))
    expect(circleTurnFeb25).toBeDefined()
    expect(circleTurnFeb25?.id).toBe('circle_turn_c-midmonth_m2')
  })

  it('generates urgent personal circle unpaid alert when user has not paid current month installment', () => {
    const circles: MoneyCircle[] = [
      {
        id: 'c-unpaid-1',
        name: 'جمعية التطوير',
        monthlyAmountFils: 50000,
        membersCount: 5,
        totalAmountFils: 250000,
        myTurnMonth: 3, // Not my turn this month (month 1)
        startDate: new Date('2026-01-01T00:00:00Z'),
        members: [
          { id: 'm-me', name: 'أنا', turnMonth: 3, paidMonths: [] },
          { id: 'm-1', name: 'عضو 1', turnMonth: 1, paidMonths: [] }, // recipient month 1 exempt
          { id: 'm-2', name: 'عضو 2', turnMonth: 2, paidMonths: [1] },
        ],
        status: 'active',
        createdAt: new Date(),
        isManager: true,
      },
    ]

    const jan10 = new Date('2026-01-10T12:00:00Z')
    const items = generateNotifications({
      circles,
      settings: { ...baseSettings, monthStartDay: 1 },
      today: jan10,
    })

    const personalAlert = items.find((i) => i.id === 'circle_my_unpaid_c-unpaid-1_m1')
    expect(personalAlert).toBeDefined()
    expect(personalAlert?.isUrgent).toBe(true)
    expect(personalAlert?.actionPath).toBe('/tools?tool=circles')
    expect(personalAlert?.actionLabel).toBe('سداد القسط الآن')
    expect(personalAlert?.message).toContain('لم يتم تسجيل سداد قسطك الشخصي لشهر 1 بقيمة 50 د.أ')

    // Manager alert should exclude the user (only other unpaid member without turn 1 or paidMonths)
    // Here: member 1 is turnMonth 1 (exempt), member 2 has paidMonths [1], user is turnMonth 3 and has personal alert.
    // So unpaidMembers for manager should be empty!
    const managerAlert = items.find((i) => i.id === 'circle_unpaid_c-unpaid-1_m1')
    expect(managerAlert).toBeUndefined()
  })

  it('generates customized urgent personal notification when user manually unchecked auto-payment for current month', () => {
    const circles: MoneyCircle[] = [
      {
        id: 'c-unpaid-manual',
        name: 'جمعية الأسرة',
        monthlyAmountFils: 100000,
        membersCount: 4,
        totalAmountFils: 400000,
        myTurnMonth: 2,
        startDate: new Date('2026-01-01T00:00:00Z'),
        members: [
          {
            id: 'm-me',
            name: 'أنا',
            turnMonth: 2,
            paidMonths: [],
            paymentsByMonth: { '1': false }, // explicitly unchecked
          },
        ],
        status: 'active',
        createdAt: new Date(),
      },
    ]

    const jan15 = new Date('2026-01-15T12:00:00Z')
    const items = generateNotifications({
      circles,
      settings: { ...baseSettings, monthStartDay: 1 },
      today: jan15,
    })

    const personalAlert = items.find((i) => i.id === 'circle_my_unpaid_c-unpaid-manual_m1')
    expect(personalAlert).toBeDefined()
    expect(personalAlert?.isUrgent).toBe(true)
    expect(personalAlert?.message).toContain('قمت بإلغاء الخصم التلقائي لقسط الشهر 1 (100 د.أ)')
    expect(personalAlert?.message).toContain('القسط معلق حالياً وبانتظار سدادك')
  })

  it('calculates correct installment for half and double share types in personal unpaid alert', () => {
    const circles: MoneyCircle[] = [
      {
        id: 'c-double',
        name: 'جمعية مضاعفة',
        monthlyAmountFils: 40000,
        shareType: 'double',
        secondTurnMonth: 4,
        membersCount: 6,
        totalAmountFils: 240000,
        myTurnMonth: 2,
        startDate: new Date('2026-01-01T00:00:00Z'),
        members: [
          { id: 'm-me', name: 'أنا', turnMonth: 2, paidMonths: [] },
        ],
        status: 'active',
        createdAt: new Date(),
      },
    ]

    const jan5 = new Date('2026-01-05T12:00:00Z')
    const items = generateNotifications({
      circles,
      settings: { ...baseSettings, monthStartDay: 1 },
      today: jan5,
    })

    const personalAlert = items.find((i) => i.id === 'circle_my_unpaid_c-double_m1')
    expect(personalAlert).toBeDefined()
    expect(personalAlert?.message).toContain('80 د.أ') // 40.000 * 2 = 80.000
  })

  it('generates budget deficit alert when income is zero but user has expenses', () => {
    const jan15 = new Date('2026-01-15T12:00:00Z')
    const items = generateNotifications({
      settings: { ...baseSettings, monthStartDay: 1, rolloverBalance: true },
      today: jan15,
      currentMonthIncomeFils: 0,
      priorBalanceFils: 0, // no rollover savings
      currentMonthSpendingFils: 45000, // spent 45 JOD
    })

    const deficitAlert = items.find((i) => i.id.startsWith('budget_deficit_'))
    expect(deficitAlert).toBeDefined()
    expect(deficitAlert?.isUrgent).toBe(true)
    expect(deficitAlert?.id).toBe('budget_deficit_2026-01')
  })

  it('uses fiscalMonthKey reflecting custom monthStartDay for budget alerts', () => {
    // On Jan 27, 2026 with monthStartDay: 25, we are in fiscal cycle '2026-01' (Jan 25 - Feb 24)
    const jan27 = new Date('2026-01-27T12:00:00Z')
    const items = generateNotifications({
      settings: { ...baseSettings, monthStartDay: 25, rolloverBalance: false },
      today: jan27,
      currentMonthIncomeFils: 100000,
      currentMonthSpendingFils: 95000, // 95% spent
    })

    const budgetWarning = items.find((i) => i.id.startsWith('budget_warning_80_'))
    expect(budgetWarning).toBeDefined()
    expect(budgetWarning?.id).toBe('budget_warning_80_2026-01')

    // On Feb 5, 2026 (calendar month changed, but fiscal cycle Jan 25 - Feb 24 still ongoing)
    // The id must remain 'budget_warning_80_2026-01' so read status is preserved and not duplicated!
    const feb5 = new Date('2026-02-05T12:00:00Z')
    const itemsFeb5 = generateNotifications({
      settings: { ...baseSettings, monthStartDay: 25, rolloverBalance: false },
      today: feb5,
      currentMonthIncomeFils: 100000,
      currentMonthSpendingFils: 95000,
    })
    const budgetWarningFeb5 = itemsFeb5.find((i) => i.id.startsWith('budget_warning_80_'))
    expect(budgetWarningFeb5?.id).toBe('budget_warning_80_2026-01')
  })

  it('skips debt notifications if remainingFils is 0 or dueDate is invalid', () => {
    const debts: Debt[] = [
      {
        id: 'd-zero-remaining',
        personName: 'خالد',
        type: 'borrowed',
        amountFils: 50000,
        paidFils: 50000,
        startDate: new Date('2026-04-01'),
        dueDate: new Date('2026-05-10'),
        note: '',
        settled: false, // not flagged settled, but remaining is 0
        payments: [],
        createdAt: new Date(),
      },
      {
        id: 'd-invalid-date',
        personName: 'سامي',
        type: 'lent',
        amountFils: 30000,
        paidFils: 0,
        startDate: new Date('2026-05-01'),
        dueDate: new Date('invalid-date'),
        note: '',
        settled: false,
        payments: [],
        createdAt: new Date(),
      },
    ]

    const items = generateNotifications({
      debts,
      settings: baseSettings,
      today,
    })

    expect(items.some((i) => i.id.includes('d-zero-remaining'))).toBe(false)
    expect(items.some((i) => i.id.includes('d-invalid-date'))).toBe(false)
  })

  it('skips circle unpaid alert if corresponding transaction exists in transactions', () => {
    const circles: MoneyCircle[] = [
      {
        id: 'c-tx-check',
        name: 'جمعية العمل',
        monthlyAmountFils: 50000,
        membersCount: 5,
        totalAmountFils: 250000,
        myTurnMonth: 3,
        startDate: new Date('2026-05-01T00:00:00Z'),
        members: [
          { id: 'm1', name: 'أنا', turnMonth: 3, paidMonths: [] },
        ],
        status: 'active',
        createdAt: new Date(),
      },
    ]

    // Without tx: alert is generated
    const itemsWithoutTx = generateNotifications({
      circles,
      settings: baseSettings,
      today: new Date('2026-05-10T12:00:00Z'),
      transactions: [],
    })
    expect(itemsWithoutTx.some((i) => i.id === 'circle_my_unpaid_c-tx-check_m1')).toBe(true)

    // With transaction circle_c-tx-check_m1: alert is skipped
    const itemsWithTx = generateNotifications({
      circles,
      settings: baseSettings,
      today: new Date('2026-05-10T12:00:00Z'),
      transactions: [
        {
          id: 'circle_c-tx-check_m1',
          type: 'expense',
          amountFils: 50000,
          categoryId: 'cat-1',
          date: new Date('2026-05-02'),
          note: '',
          createdAt: new Date('2026-05-02'),
        },
      ],
    })
    expect(itemsWithTx.some((i) => i.id === 'circle_my_unpaid_c-tx-check_m1')).toBe(false)
  })

  it('skips recurring notifications when occurrence is skipped or past endDate', () => {
    const recList: Recurring[] = [
      {
        id: 'rec-skipped',
        type: 'expense',
        amountFils: 25000,
        categoryId: 'cat-1',
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        nextDate: new Date('2026-05-15'), // today
        skipMonth: 5, // skipped this month
        active: true,
        note: '',
      },
      {
        id: 'rec-past-end',
        type: 'expense',
        amountFils: 15000,
        categoryId: 'cat-1',
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        nextDate: new Date('2026-05-15'),
        endDate: new Date('2026-05-01'), // ended before nextDate
        active: true,
        note: '',
      },
    ]

    const items = generateNotifications({
      recurring: recList,
      settings: baseSettings,
      today: new Date('2026-05-15T12:00:00Z'),
    })

    expect(items.some((i) => i.id.includes('rec-skipped'))).toBe(false)
    expect(items.some((i) => i.id.includes('rec-past-end'))).toBe(false)
  })
})
