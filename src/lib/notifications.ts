import { isBefore, startOfDay, format, differenceInDays } from 'date-fns'
import type { Debt, MoneyCircle, Recurring, UserSettings, Transaction } from '../types'
import { formatMoney } from './money'
import { getCircleCycleIndex, isOccurrenceSkipped } from './recurring'
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
  const existingTxIds = new Set((params.transactions || []).map((t) => t.id).filter(Boolean))

  const fmtAmount = (fils: number) =>
    formatMoney(fils, settings?.currency || 'JOD', {
      customDecimals: settings?.customCurrencyDecimals,
      maskAmount: Boolean(settings?.hideBalances),
      hideZeroDecimals: settings?.hideZeroDecimals ?? true,
    })

  const pushItem = (
    id: string,
    title: string,
    message: string,
    category: NotificationCategory,
    isUrgent: boolean,
    createdAt: Date = todayMidnight,
    actionPath?: string,
    actionLabel?: string
  ) => {
    items.push({
      id,
      title,
      message,
      category,
      isUrgent,
      createdAt,
      ...(actionPath ? { actionPath } : {}),
      ...(actionLabel ? { actionLabel } : {}),
    })
  }

  // 1. Debts Reminders
  if (prefs.debtReminders !== false) {
    const reminderDays = prefs.debtReminderDaysBefore ?? 3

    for (const debt of debts) {
      if (debt.settled || !debt.dueDate) continue
      const rawDue = debt.dueDate instanceof Date ? debt.dueDate : new Date(debt.dueDate)
      const dueMidnight = startOfDay(rawDue)
      if (Number.isNaN(dueMidnight.getTime())) continue

      const paidFils = debt.paidFils || 0
      const remainingFils = Math.max(0, debt.amountFils - paidFils)
      if (remainingFils <= 0) continue

      const diffDays = differenceInDays(dueMidnight, todayMidnight)
      const dueDateStr = format(dueMidnight, 'yyyy-MM-dd')
      const remainingFormatted = fmtAmount(remainingFils)

      if (isBefore(dueMidnight, todayMidnight)) {
        const msg = debt.type === 'lent'
          ? `تأخر موعد استرداد مبلغ ${remainingFormatted} من ${debt.personName} منذ تاريخ ${dueDateStr}.`
          : `تأخر موعد سداد مبلغ ${remainingFormatted} لـ ${debt.personName} منذ تاريخ ${dueDateStr}.`
        pushItem(`debt_overdue_${debt.id}_${dueDateStr}`, `دين متأخر: ${debt.personName}`, msg, 'debt', true, dueMidnight, '/debts', 'عرض الديون')
      } else if (diffDays <= reminderDays && diffDays >= 0) {
        const isToday = diffDays === 0
        const dueText = diffDays === 0 ? 'اليوم' : diffDays === 1 ? 'غداً' : diffDays === 2 ? 'خلال يومين' : diffDays <= 10 ? `خلال ${diffDays} أيام` : `خلال ${diffDays} يوماً`
        const title = isToday ? `استحقاق دين اليوم: ${debt.personName}` : `موعد استحقاق دين قادم: ${debt.personName}`
        const msg = debt.type === 'lent'
          ? `يستحق استرداد مبلغ ${remainingFormatted} من ${debt.personName} ${dueText}.`
          : `يستحق سداد مبلغ ${remainingFormatted} لـ ${debt.personName} ${dueText}.`
        pushItem(`debt_due_${debt.id}_${dueDateStr}`, title, msg, 'debt', isToday, todayMidnight, '/debts', 'عرض الديون')
      }
    }
  }

  // 2. Circles Alerts
  if (prefs.circleAlerts !== false) {
    for (const circle of circles) {
      if (circle.status === 'completed') continue

      const diffMonths = getCircleCycleIndex(circle.startDate, todayMidnight, settings?.monthStartDay) + 1
      if (diffMonths >= 1 && diffMonths <= circle.membersCount) {
        const isMyTurn =
          circle.myTurnMonth === diffMonths ||
          (circle.shareType === 'double' && circle.secondTurnMonth === diffMonths)

        if (isMyTurn) {
          const userGrossFils = circle.shareType === 'half' ? Math.round(circle.totalAmountFils / 2) : circle.totalAmountFils
          const totalFormatted = fmtAmount(userGrossFils)
          const shareLabel = circle.shareType === 'half' ? `لحصتك (${totalFormatted})` : `لمبلغ الجمعية بالكامل (${totalFormatted})`

          pushItem(`circle_turn_${circle.id}_m${diffMonths}`, `دوري في القبض: جمعية ${circle.name}`, `هذا الشهر هو موعد استلامك ${shareLabel}!`, 'circle', true, todayMidnight, '/tools?tool=circles', 'تفاصيل الجمعية')

          if (circle.recurringId) {
            pushItem(`circle_exempt_${circle.id}_m${diffMonths}`, `إعفاء قسط الجمعية: ${circle.name}`, `هذا الشهر هو دورك في جمعية ${circle.name}؛ تم إعفاؤك تلقائياً من خصم القسط الشهري.`, 'recurring', false, todayMidnight, '/tools?tool=circles', 'إيداع الصافي الآن')
          }
        }

        const userMonthlyFils =
          circle.shareType === 'half' ? Math.round(circle.monthlyAmountFils / 2) : circle.shareType === 'double' ? circle.monthlyAmountFils * 2 : circle.monthlyAmountFils

        let hasPersonalUnpaidAlert = false

        if (!isMyTurn) {
          const userMember = circle.members?.find(
            (m) => m.turnMonth === circle.myTurnMonth || (circle.shareType === 'double' && circle.secondTurnMonth !== undefined && m.turnMonth === circle.secondTurnMonth)
          )

          if (userMember) {
            const hasCircleTx = existingTxIds.has(`circle_${circle.id}_m${diffMonths}`)
            const isUnpaid = !userMember.paidMonths?.includes(diffMonths) && userMember.paymentsByMonth?.[String(diffMonths)] !== true && !hasCircleTx

            if (isUnpaid) {
              hasPersonalUnpaidAlert = true
              const isManualUnchecked = userMember.paymentsByMonth?.[String(diffMonths)] === false
              const message = isManualUnchecked
                ? `قمت بإلغاء الخصم التلقائي لقسط الشهر ${diffMonths} (${fmtAmount(userMonthlyFils)}) في جمعية ${circle.name}؛ القسط معلق حالياً وبانتظار سدادك.`
                : `لم يتم تسجيل سداد قسطك الشخصي لشهر ${diffMonths} بقيمة ${fmtAmount(userMonthlyFils)} في جمعية ${circle.name} حتى الآن.`

              pushItem(`circle_my_unpaid_${circle.id}_m${diffMonths}`, `قسط جمعية مستحق عليك: ${circle.name}`, message, 'circle', true, todayMidnight, '/tools?tool=circles', 'سداد القسط الآن')
            }
          }
        }

        // If user is manager, notify if members haven't paid this month
        if (circle.isManager && circle.members && circle.members.length > 0) {
          const unpaidMembers = circle.members.filter((m) => {
            if (m.turnMonth === diffMonths) return false
            if (circle.shareType === 'double' && circle.secondTurnMonth === diffMonths && m.turnMonth === circle.myTurnMonth) return false
            if (hasPersonalUnpaidAlert) {
              if (m.turnMonth === circle.myTurnMonth) return false
              if (circle.shareType === 'double' && circle.secondTurnMonth !== undefined && m.turnMonth === circle.secondTurnMonth) return false
            }
            if (m.paidMonths && m.paidMonths.includes(diffMonths)) return false
            if (m.paymentsByMonth && m.paymentsByMonth[String(diffMonths)]) return false
            return true
          })

          if (unpaidMembers.length > 0) {
            const count = unpaidMembers.length
            const countText = count === 1 ? 'عضو واحد لم يسدد' : count === 2 ? 'عضوان لم يسددا' : count <= 10 ? `${count} أعضاء لم يسددوا` : `${count} عضواً لم يسددوا`
            pushItem(`circle_unpaid_${circle.id}_m${diffMonths}`, `أقساط معلقة: جمعية ${circle.name}`, `يوجد ${countText} قسط هذا الشهر حتى الآن.`, 'circle', false, todayMidnight, '/tools?tool=circles', 'متابعة الجمعية')
          }
        }
      }
    }
  }

  // 3. Recurring Payments & Auto-Payments
  if (prefs.autoPayments !== false) {
    for (const rec of recurring) {
      if (!rec.active) continue

      const nextMidnight = startOfDay(rec.nextDate instanceof Date ? rec.nextDate : new Date(rec.nextDate))
      if (Number.isNaN(nextMidnight.getTime())) continue

      if (rec.endDate) {
        const endMidnight = startOfDay(rec.endDate instanceof Date ? rec.endDate : new Date(rec.endDate))
        if (nextMidnight > endMidnight) continue
      }
      if (isOccurrenceSkipped(rec, nextMidnight, settings?.monthStartDay)) continue

      const diffDays = differenceInDays(nextMidnight, todayMidnight)
      const nextDateStr = format(nextMidnight, 'yyyy-MM-dd')
      const amountFormatted = fmtAmount(rec.amountFils)

      if (rec.requireConfirmation && diffDays <= 0) {
        const msg = `دفعة ${rec.type === 'expense' ? 'المصروف' : 'الدخل'} بقيمة ${amountFormatted} مستحقة وبانتظار تأكيدك أو تعديل المبلغ.`
        pushItem(`recurring_confirm_${rec.id}_${nextDateStr}`, `مطلوب تأكيد دفعة: ${rec.title || 'معاملة دورية'}`, msg, 'recurring', true, todayMidnight, `/recurring?confirmId=${rec.id}`, 'تأكيد المبلغ وتسجيل الدفع')
        continue
      }

      if (diffDays === 0) {
        const msg = `تستحق اليوم دفعة ${rec.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${amountFormatted}.`
        pushItem(`recurring_due_today_${rec.id}_${nextDateStr}`, `استحقاق دفعة دورية: ${rec.title || 'معاملة دورية'}`, msg, 'recurring', rec.type === 'expense', todayMidnight, '/recurring', 'المعاملات الدورية')
      } else if (diffDays < 0) {
        const msg = `دفعة ${rec.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${amountFormatted} استحقت بتاريخ ${nextDateStr} ولم تُسجل بعد.`
        pushItem(`recurring_due_overdue_${rec.id}_${nextDateStr}`, `دفعة دورية متأخرة: ${rec.title || 'معاملة دورية'}`, msg, 'recurring', rec.type === 'expense', nextMidnight, '/recurring', 'المعاملات الدورية')
      } else if (diffDays > 0 && diffDays <= 7) {
        const msg = `تستحق خلال ${diffDays} يوم دفعة ${rec.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${amountFormatted}.`
        pushItem(`recurring_approaching_${rec.id}_${nextDateStr}`, `دفعة دورية قادمة: ${rec.title || 'معاملة دورية'}`, msg, 'recurring', false, todayMidnight, '/recurring', 'المعاملات الدورية')
      }
    }

    if (params.transactions && params.transactions.length > 0) {
      for (const tx of params.transactions) {
        if (!tx.recurringId) continue
        const txMidnight = startOfDay(tx.date instanceof Date ? tx.date : new Date(tx.date))
        const txDiff = differenceInDays(todayMidnight, txMidnight)
        if (txDiff >= 0 && txDiff <= 30) {
          const msg = `قام التطبيق بتسجيل دفعة ${tx.type === 'expense' ? 'مصروف' : 'دخل'} بقيمة ${fmtAmount(tx.amountFils)} تلقائياً في سجل معاملاتك.`
          pushItem(`recurring_auto_recorded_${tx.id}`, `تم تسجيل معاملة دورية تلقائياً: ${tx.title || 'معاملة دورية'}`, msg, 'recurring', false, txMidnight, '/transactions', 'عرض المعاملة')
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
      pushItem(`budget_deficit_${fiscalMonthKey}`, 'تنبيه تجاوز الميزانية (عجز مالي)', 'تجاوز إجمالي مصروفاتك الشهرية السيولة المتاحة لشهرك الحالي. يُنصح بمراجعة النفقات غير الأساسية.', 'budget', true, todayMidnight, '/reports', 'تقرير الميزانية')
    } else if (totalLiquidity > 0) {
      const spendingRatio = currentMonthSpendingFils / totalLiquidity
      if (spendingRatio >= 0.8) {
        const percent = Math.round(spendingRatio * 100)
        pushItem(`budget_warning_80_${fiscalMonthKey}`, `استهلاك ${percent}% من الميزانية المتاحة`, `لقد استهلكت ${percent}% من إجمالي الميزانية والسيولة المتاحة للشهر الحالي.`, 'budget', spendingRatio >= 0.9, todayMidnight, '/reports', 'تقرير الميزانية')
      }
    }
  }

  // 5. Daily Reminder
  if (prefs.dailyReminder === true) {
    pushItem(`daily_reminder_${todayStr}`, 'تسجيل مصاريف اليوم', 'هل قمت بتسجيل كافة فواتيرك ومصاريفك اليوم؟ حافظ على دقة سجلاتك المالية أولاً بأول.', 'system', false, todayMidnight, '/transactions', 'إضافة معاملة')
  }

  // 6. Backup Reminder
  if (settings?.lastBackupAt) {
    const lastBackupDate = new Date(settings.lastBackupAt)
    const daysSinceBackup = differenceInDays(todayMidnight, startOfDay(lastBackupDate))
    if (daysSinceBackup > 30) {
      pushItem(`backup_reminder_${todayStr.slice(0, 7)}`, 'تذكير النسخ الاحتياطي الدوري', `مضى ${daysSinceBackup} يوماً منذ آخر نسخة احتياطية لبياناتك. احرص على حفظ نسخة جديدة لحماية سجلاتك المالية.`, 'system', false, todayMidnight, '/settings', 'حفظ نسخة احتياطية')
    }
  } else if ((params.transactions?.length ?? 0) > 10) {
    pushItem(`backup_reminder_initial_${todayStr.slice(0, 7)}`, 'حفظ نسخة احتياطية لبياناتك', 'لديك سجلات مالية نشطة ولم تقم بعد بحفظ نسخة احتياطية. يُنصح بحفظ نسخة لتأمين بياناتك على جهازك.', 'system', false, todayMidnight, '/settings', 'حفظ نسخة احتياطية')
  }

  // Sort: Urgent first, then by date descending
  return items.sort((a, b) => {
    if (a.isUrgent && !b.isUrgent) return -1
    if (!a.isUrgent && b.isUrgent) return 1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}
