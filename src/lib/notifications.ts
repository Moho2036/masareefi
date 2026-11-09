import { isBefore, startOfDay, format, differenceInDays } from 'date-fns'
import type { Debt, MoneyCircle, Recurring, UserSettings, Transaction } from '../types'
import { formatMoney } from './money'
import { getCircleCycleIndex } from '../services/moneyCircles'
import { getFiscalMonthKey } from './dates'

export type NotificationCategory = 'urgent' | 'recurring' | 'debt' | 'circle' | 'budget' | 'system'
export type NotificationFilter = 'all' | 'urgent' | 'recurring' | 'debt_circle' | 'unread' | 'archived'

export interface NotificationItem {
  id: string
  title: string
  message: string
  category: NotificationCategory
  isUrgent: boolean
  createdAt: Date
  actionPath?: string
  actionLabel?: string
}

export interface GenerateNotificationsParams {
  debts?: Debt[]
  circles?: MoneyCircle[]
  recurring?: Recurring[]
  settings?: UserSettings | null
  transactions?: Transaction[]
  today?: Date
  currentMonthSpendingFils?: number
  currentMonthIncomeFils?: number
  priorBalanceFils?: number
}

/**
 * Evaluates application state and generates smart, prioritized notification items.
 */
export function generateNotifications(params: GenerateNotificationsParams): NotificationItem[] {
  const {
    debts = [],
    circles = [],
    recurring = [],
    settings,
    today = new Date(),
    currentMonthSpendingFils = 0,
    currentMonthIncomeFils = 0,
    priorBalanceFils = 0,
  } = params

  const items: NotificationItem[] = []
  const todayMidnight = startOfDay(today)
  const todayStr = format(todayMidnight, 'yyyy-MM-dd')
  const prefs = settings?.notificationPrefs || {}

  const fmtAmount = (fils: number) =>
    formatMoney(fils, settings?.currency || 'JOD', {
      customDecimals: settings?.customCurrencyDecimals,
      maskAmount: Boolean(settings?.hideBalances),
      hideZeroDecimals: settings?.hideZeroDecimals ?? true,
    })

  // 1. Debts Reminders
  if (prefs.debtReminders !== false) {
    const reminderDays = prefs.debtReminderDaysBefore ?? 3

    for (const debt of debts) {
      if (debt.settled || !debt.dueDate) continue

      const dueMidnight = startOfDay(debt.dueDate)
      const diffDays = differenceInDays(dueMidnight, todayMidnight)
      const dueDateStr = format(dueMidnight, 'yyyy-MM-dd')
      const remainingFils = Math.max(0, debt.amountFils - debt.paidFils)
      const remainingFormatted = fmtAmount(remainingFils)

      if (isBefore(dueMidnight, todayMidnight)) {
        // Overdue
        items.push({
          id: `debt_overdue_${debt.id}_${dueDateStr}`,
          title: `دين متأخر: ${debt.personName}`,
          message:
            debt.type === 'lent'
              ? `تأخر موعد استرداد مبلغ ${remainingFormatted} من ${debt.personName} منذ تاريخ ${dueDateStr}.`
              : `تأخر موعد سداد مبلغ ${remainingFormatted} لـ ${debt.personName} منذ تاريخ ${dueDateStr}.`,
          category: 'debt',
          isUrgent: true,
          createdAt: dueMidnight,
          actionPath: '/debts',
          actionLabel: 'عرض الديون',
        })
      } else if (diffDays <= reminderDays && diffDays >= 0) {
        // Due today or approaching within reminder days
        const isToday = diffDays === 0
        const dueText =
          diffDays === 0
            ? 'اليوم'
            : diffDays === 1
              ? 'غداً'
              : diffDays === 2
                ? 'خلال يومين'
                : diffDays <= 10
                  ? `خلال ${diffDays} أيام`
                  : `خلال ${diffDays} يوماً`

        items.push({
          id: `debt_due_${debt.id}_${dueDateStr}`,
          title: isToday ? `استحقاق دين اليوم: ${debt.personName}` : `موعد استحقاق دين قادم: ${debt.personName}`,
          message:
            debt.type === 'lent'
              ? `يستحق استرداد مبلغ ${remainingFormatted} من ${debt.personName} ${dueText}.`
              : `يستحق سداد مبلغ ${remainingFormatted} لـ ${debt.personName} ${dueText}.`,
          category: 'debt',
          isUrgent: isToday,
          createdAt: todayMidnight,
          actionPath: '/debts',
          actionLabel: 'عرض الديون',
        })
      }
    }
  }

  // 2. Circles Alerts
  if (prefs.circleAlerts !== false) {
    for (const circle of circles) {
      if (circle.status === 'completed') continue

      // Calculate the circle's current active cycle month (1-based index)
      const diffMonths = getCircleCycleIndex(circle.startDate, todayMidnight, settings?.monthStartDay) + 1

      if (diffMonths >= 1 && diffMonths <= circle.membersCount) {
        // Active month in range
        const isMyTurn =
          circle.myTurnMonth === diffMonths ||
          (circle.shareType === 'double' && circle.secondTurnMonth === diffMonths)

        if (isMyTurn) {
          const userGrossFils =
            circle.shareType === 'half'
              ? Math.round(circle.totalAmountFils / 2)
              : circle.shareType === 'double'
                ? circle.totalAmountFils
                : circle.totalAmountFils
          const totalFormatted = fmtAmount(userGrossFils)
          const shareLabel =
            circle.shareType === 'half'
              ? `لحصتك (${totalFormatted})`
              : `لمبلغ الجمعية بالكامل (${totalFormatted})`
          items.push({
            id: `circle_turn_${circle.id}_m${diffMonths}`,
            title: `دوري في القبض: جمعية ${circle.name}`,
            message: `هذا الشهر هو موعد استلامك ${shareLabel}!`,
            category: 'circle',
            isUrgent: true,
            createdAt: todayMidnight,
            actionPath: '/tools?tool=circles',
            actionLabel: 'تفاصيل الجمعية',
          })

          if (circle.recurringId) {
            items.push({
              id: `circle_exempt_${circle.id}_m${diffMonths}`,
              title: `إعفاء قسط الجمعية: ${circle.name}`,
              message: `هذا الشهر هو دورك في جمعية ${circle.name}؛ تم إعفاؤك تلقائياً من خصم القسط الشهري.`,
              category: 'recurring',
              isUrgent: false,
              createdAt: todayMidnight,
              actionPath: '/tools?tool=circles',
              actionLabel: 'إيداع الصافي الآن',
            })
          }
        }

        const userMonthlyFils =
          circle.shareType === 'half'
            ? Math.round(circle.monthlyAmountFils / 2)
            : circle.shareType === 'double'
              ? circle.monthlyAmountFils * 2
              : circle.monthlyAmountFils

        let hasPersonalUnpaidAlert = false

        if (!isMyTurn) {
          const userMember = circle.members?.find((m) => m.turnMonth === circle.myTurnMonth)
          if (userMember) {
            const isUnpaid =
              !userMember.paidMonths?.includes(diffMonths) &&
              userMember.paymentsByMonth?.[String(diffMonths)] !== true

            if (isUnpaid) {
              hasPersonalUnpaidAlert = true
              const isManualUnchecked = userMember.paymentsByMonth?.[String(diffMonths)] === false
              const message = isManualUnchecked
                ? `قمت بإلغاء الخصم التلقائي لقسط الشهر ${diffMonths} (${fmtAmount(userMonthlyFils)}) في جمعية ${circle.name}؛ القسط معلق حالياً وبانتظار سدادك.`
                : `لم يتم تسجيل سداد قسطك الشخصي لشهر ${diffMonths} بقيمة ${fmtAmount(userMonthlyFils)} في جمعية ${circle.name} حتى الآن.`

              items.push({
                id: `circle_my_unpaid_${circle.id}_m${diffMonths}`,
                title: `قسط جمعية مستحق عليك: ${circle.name}`,
                message,
                category: 'circle',
                isUrgent: true,
                createdAt: todayMidnight,
                actionPath: '/tools?tool=circles',
                actionLabel: 'سداد القسط الآن',
              })
            }
          }
        }

        // If user is manager, notify if members haven't paid this month
        if (circle.isManager && circle.members && circle.members.length > 0) {
          const unpaidMembers = circle.members.filter((m) => {
            if (m.turnMonth === diffMonths) return false // recipient of the month is exempt
            if (
              circle.shareType === 'double' &&
              circle.secondTurnMonth === diffMonths &&
              m.turnMonth === circle.myTurnMonth
            ) {
              return false
            }
            if (hasPersonalUnpaidAlert && m.turnMonth === circle.myTurnMonth) {
              return false
            }
            if (m.paidMonths && m.paidMonths.includes(diffMonths)) return false
            if (m.paymentsByMonth && m.paymentsByMonth[String(diffMonths)]) return false
            return true
          })

          if (unpaidMembers.length > 0) {
            const count = unpaidMembers.length
            const countText =
              count === 1
                ? 'عضو واحد لم يسدد'
                : count === 2
                  ? 'عضوان لم يسددا'
                  : count <= 10
                    ? `${count} أعضاء لم يسددوا`
                    : `${count} عضواً لم يسددوا`
            items.push({
              id: `circle_unpaid_${circle.id}_m${diffMonths}`,
              title: `أقساط معلقة: جمعية ${circle.name}`,
              message: `يوجد ${countText} قسط هذا الشهر حتى الآن.`,
              category: 'circle',
              isUrgent: false,
              createdAt: todayMidnight,
              actionPath: '/tools?tool=circles',
              actionLabel: 'متابعة الجمعية',
            })
          }
        }
      }
    }
  }

  // 3. Recurring Payments & Auto-Payments
  if (prefs.autoPayments !== false) {
    for (const rec of recurring) {
      if (!rec.active) continue

      const nextMidnight = startOfDay(rec.nextDate)
      const diffDays = differenceInDays(nextMidnight, todayMidnight)
      const nextDateStr = format(nextMidnight, 'yyyy-MM-dd')
      const amountFormatted = fmtAmount(rec.amountFils)

      if (rec.requireConfirmation && diffDays <= 0) {
        items.push({
          id: `recurring_confirm_${rec.id}_${nextDateStr}`,
          title: `مطلوب تأكيد دفعة: ${rec.title || 'معاملة دورية'}`,
          message: `دفعة ${rec.type === 'expense' ? 'المصروف' : 'الدخل'} بقيمة ${amountFormatted} مستحقة وبانتظار تأكيدك أو تعديل المبلغ.`,
          category: 'recurring',
          isUrgent: true,
          createdAt: todayMidnight,
          actionPath: `/recurring?confirmId=${rec.id}`,
          actionLabel: 'تأكيد المبلغ وتسجيل الدفع',
        })
        continue
      }

      if (diffDays === 0) {
        items.push({
          id: `recurring_due_today_${rec.id}_${nextDateStr}`,
          title: `استحقاق دفعة دورية: ${rec.title || 'معاملة دورية'}`,
          message: `تستحق اليوم دفعة ${rec.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${amountFormatted}.`,
          category: 'recurring',
          isUrgent: rec.type === 'expense',
          createdAt: todayMidnight,
          actionPath: '/recurring',
          actionLabel: 'المعاملات الدورية',
        })
      } else if (diffDays < 0) {
        items.push({
          id: `recurring_due_overdue_${rec.id}_${nextDateStr}`,
          title: `دفعة دورية متأخرة: ${rec.title || 'معاملة دورية'}`,
          message: `دفعة ${rec.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${amountFormatted} استحقت بتاريخ ${nextDateStr} ولم تُسجل بعد.`,
          category: 'recurring',
          isUrgent: rec.type === 'expense',
          createdAt: nextMidnight,
          actionPath: '/recurring',
          actionLabel: 'المعاملات الدورية',
        })
      } else if (diffDays > 0 && diffDays <= 7) {
        items.push({
          id: `recurring_approaching_${rec.id}_${nextDateStr}`,
          title: `دفعة دورية قادمة: ${rec.title || 'معاملة دورية'}`,
          message: `تستحق خلال ${diffDays} يوم دفعة ${rec.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${amountFormatted}.`,
          category: 'recurring',
          isUrgent: false,
          createdAt: todayMidnight,
          actionPath: '/recurring',
          actionLabel: 'المعاملات الدورية',
        })
      }
    }

    // Auto-recorded recurring transactions alert for recently recorded items (within last 30 days)
    if (params.transactions && params.transactions.length > 0) {
      for (const tx of params.transactions) {
        if (!tx.recurringId) continue
        const txMidnight = startOfDay(tx.date instanceof Date ? tx.date : new Date(tx.date))
        const txDiff = differenceInDays(todayMidnight, txMidnight)
        if (txDiff >= 0 && txDiff <= 30) {
          items.push({
            id: `recurring_auto_recorded_${tx.id}`,
            title: `تم تسجيل معاملة دورية تلقائياً: ${tx.title || 'معاملة دورية'}`,
            message: `قام التطبيق بتسجيل دفعة ${tx.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${fmtAmount(tx.amountFils)} تلقائياً في سجل معاملاتك.`,
            category: 'recurring',
            isUrgent: false,
            createdAt: txMidnight,
            actionPath: '/transactions',
            actionLabel: 'عرض المعاملة',
          })
        }
      }
    }
  }

  // 4. Budget & Spending Warnings
  if (prefs.budgetWarnings !== false) {
    const rolloverEnabled = settings?.rolloverBalance ?? true
    const monthStartDay = settings?.monthStartDay ?? 1
    const fiscalMonthKey = getFiscalMonthKey(today, monthStartDay)
    const totalLiquidity = currentMonthIncomeFils + (rolloverEnabled ? priorBalanceFils : 0)

    if (currentMonthSpendingFils > 0 && currentMonthSpendingFils > totalLiquidity) {
      // Deficit: spending exceeds available liquidity (including when totalLiquidity <= 0 or deficit starting state)
      items.push({
        id: `budget_deficit_${fiscalMonthKey}`,
        title: 'تنبيه تجاوز الميزانية (عجز مالي)',
        message: 'تجاوز إجمالي مصروفاتك الشهرية السيولة المتاحة لشهرك الحالي. يُنصح بمراجعة النفقات غير الأساسية.',
        category: 'budget',
        isUrgent: true,
        createdAt: todayMidnight,
        actionPath: '/reports',
        actionLabel: 'تقرير الميزانية',
      })
    } else if (totalLiquidity > 0) {
      const spendingRatio = currentMonthSpendingFils / totalLiquidity
      if (spendingRatio >= 0.8) {
        const percent = Math.round(spendingRatio * 100)
        items.push({
          id: `budget_warning_80_${fiscalMonthKey}`,
          title: `استهلاك ${percent}% من الميزانية المتاحة`,
          message: `لقد استهلكت ${percent}% من إجمالي الميزانية والسيولة المتاحة للشهر الحالي.`,
          category: 'budget',
          isUrgent: spendingRatio >= 0.9,
          createdAt: todayMidnight,
          actionPath: '/reports',
          actionLabel: 'تقرير الميزانية',
        })
      }
    }
  }

  // 5. Daily Reminder
  if (prefs.dailyReminder === true) {
    items.push({
      id: `daily_reminder_${todayStr}`,
      title: 'تسجيل مصاريف اليوم',
      message: 'هل قمت بتسجيل كافة فواتيرك ومصاريفك اليوم؟ حافظ على دقة سجلاتك المالية أولاً بأول.',
      category: 'system',
      isUrgent: false,
      createdAt: todayMidnight,
      actionPath: '/transactions',
      actionLabel: 'إضافة معاملة',
    })
  }

  // 6. Backup Reminder
  if (settings?.lastBackupAt) {
    const lastBackupDate = new Date(settings.lastBackupAt)
    const daysSinceBackup = differenceInDays(todayMidnight, startOfDay(lastBackupDate))
    if (daysSinceBackup > 30) {
      items.push({
        id: `backup_reminder_${todayStr.slice(0, 7)}`,
        title: 'تذكير النسخ الاحتياطي الدوري',
        message: `مضى ${daysSinceBackup} يوماً منذ آخر نسخة احتياطية لبياناتك. احرص على حفظ نسخة جديدة لحماية سجلاتك المالية.`,
        category: 'system',
        isUrgent: false,
        createdAt: todayMidnight,
        actionPath: '/settings',
        actionLabel: 'حفظ نسخة احتياطية',
      })
    }
  } else if ((params.transactions?.length ?? 0) > 10) {
    items.push({
      id: `backup_reminder_initial_${todayStr.slice(0, 7)}`,
      title: 'حفظ نسخة احتياطية لبياناتك',
      message: 'لديك سجلات مالية نشطة ولم تقم بعد بحفظ نسخة احتياطية. يُنصح بحفظ نسخة لتأمين بياناتك على جهازك.',
      category: 'system',
      isUrgent: false,
      createdAt: todayMidnight,
      actionPath: '/settings',
      actionLabel: 'حفظ نسخة احتياطية',
    })
  }

  // Sort: Urgent first, then by date descending
  return items.sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1
    if (!a.isUrgent && b.isUrgent) return 1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}
