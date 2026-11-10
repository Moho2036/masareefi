import React from 'react'
import { Card } from '../ui/Card'
import { Toggle } from '../ui/Toggle'
import type { UserSettings, NotificationPrefs } from '../../types'

export interface NotificationsSectionProps {
  settings: UserSettings | null | undefined
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  settings,
  updateSettings,
  showToast,
}) => {
  const handleUpdateNotificationPref = async (updates: Partial<NotificationPrefs>) => {
    try {
      const currentPrefs: NotificationPrefs = settings?.notificationPrefs ?? {
        autoPayments: true,
        debtReminders: true,
        debtReminderDaysBefore: 3,
        circleAlerts: true,
        budgetWarnings: true,
        dailyReminder: false,
      }
      await updateSettings({
        notificationPrefs: {
          ...currentPrefs,
          ...updates,
        },
      })
      showToast('تم تحديث تفضيلات الإشعارات بنجاح', 'success')
    } catch (err) {
      console.error('Failed to update notification prefs:', err)
      showToast('تعذر تحديث تفضيلات الإشعارات', 'error')
    }
  }

  return (
    <Card
      title="مركز التنبيهات والإشعارات"
      subtitle="تخصيص الإشعارات التلقائية للتسديد، الديون، الجمعيات، والميزانية"
    >
      <div className="space-y-4 pt-2">
        {/* Auto Payments */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="pref-auto-payments" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
              تنبيهات المعاملات الدورية والتسديد التلقائي
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              إشعارك عند استحقاق الفواتير والاشتراكات الدورية أو تنفيذها تلقائياً.
            </p>
          </div>
          <Toggle
            id="pref-auto-payments"
            checked={settings?.notificationPrefs?.autoPayments ?? true}
            onChange={(checked) => handleUpdateNotificationPref({ autoPayments: checked })}
          />
        </div>

        {/* Debt Reminders */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="pref-debt-reminders" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                تذكير استحقاق الديون والقروض
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                تنبيهك قبل موعد سداد أو استرداد الديون لتفادي التأخير.
              </p>
            </div>
            <Toggle
              id="pref-debt-reminders"
              checked={settings?.notificationPrefs?.debtReminders ?? true}
              onChange={(checked) => handleUpdateNotificationPref({ debtReminders: checked })}
            />
          </div>

          {/* Reminder days selector */}
          {(settings?.notificationPrefs?.debtReminders ?? true) && (
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="text-zinc-600 dark:text-zinc-400 font-semibold">
                التنبيه قبل الموعد بـ:
              </span>
              {[
                { days: 0, label: 'في نفس اليوم' },
                { days: 1, label: 'قبل يوم' },
                { days: 3, label: 'قبل 3 أيام' },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => handleUpdateNotificationPref({ debtReminderDaysBefore: opt.days })}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    (settings?.notificationPrefs?.debtReminderDaysBefore ?? 3) === opt.days
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Money Circles Alerts */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="pref-circle-alerts" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
              تنبيهات الجمعيات وموعد القبض
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              إشعارك عند حلول دورك في الاستلام، ومتابعة الأقساط المعلقة للأعضاء إذا كنت مدير الجمعية.
            </p>
          </div>
          <Toggle
            id="pref-circle-alerts"
            checked={settings?.notificationPrefs?.circleAlerts ?? true}
            onChange={(checked) => handleUpdateNotificationPref({ circleAlerts: checked })}
          />
        </div>

        {/* Budget Warnings */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="pref-budget-warnings" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
              تحذيرات الميزانية وتجاوز الصرف
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              تنبيه ذكي عند استهلاك 80% من الميزانية أو توقع حدوث عجز في نهاية الشهر.
            </p>
          </div>
          <Toggle
            id="pref-budget-warnings"
            checked={settings?.notificationPrefs?.budgetWarnings ?? true}
            onChange={(checked) => handleUpdateNotificationPref({ budgetWarnings: checked })}
          />
        </div>

        {/* Daily Reminder */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <label htmlFor="pref-daily-reminder" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
              التذكير اليومي لتسجيل المصاريف
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              رسالة تذكير مسائية لتسجيل فواتير ومصاريف يومك للحفاظ على دقة السجلات.
            </p>
          </div>
          <Toggle
            id="pref-daily-reminder"
            checked={settings?.notificationPrefs?.dailyReminder ?? false}
            onChange={(checked) => handleUpdateNotificationPref({ dailyReminder: checked })}
          />
        </div>
      </div>
    </Card>
  )
}
