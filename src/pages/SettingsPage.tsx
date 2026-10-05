import React, { useState } from 'react'
import { Sun, Moon, Laptop, DollarSign, LogOut, Download, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { signOutUser } from '../services/auth'
import type { ThemePreference } from '../types'

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { user } = useAuth()
  const { data: settings, updateSettings } = useUserSettings()
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const currentStartDay =
    selectedDay ?? (settings?.monthStartDay ? String(settings.monthStartDay) : '1')

  const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'تلقائي', icon: <Laptop className="w-4 h-4" /> },
    { value: 'light', label: 'فاتح', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'داكن', icon: <Moon className="w-4 h-4" /> },
  ]

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `يوم ${i + 1} من كل شهر`,
  }))

  const handleThemeChange = async (newTheme: ThemePreference) => {
    setTheme(newTheme)
    try {
      await updateSettings({ theme: newTheme })
    } catch (err) {
      console.error('Failed to persist theme:', err)
    }
  }

  const handleStartDayChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedDay(val)
    try {
      await updateSettings({ monthStartDay: parseInt(val, 10) })
    } catch (err) {
      console.error('Failed to persist month start day:', err)
    }
  }

  const handleSignOut = async () => {
    setLoggingOut(true)
    try {
      await signOutUser()
    } catch (err) {
      console.error('Failed to sign out:', err)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="الإعدادات"
        subtitle="تفضيلات المظهر، بداية الشهر المالي، وإدارة الحساب"
      />

      {/* Theme Settings Card */}
      <Card
        title="المظهر والألوان"
        subtitle="اختر المظهر المفضل للتطبيق أو دعه يتبع إعدادات جهازك"
      >
        <div className="space-y-4 pt-2">
          <SegmentedControl<ThemePreference>
            value={theme}
            onChange={handleThemeChange}
            options={themeOptions}
            className="w-full sm:w-auto"
          />

          <p className="text-xs text-slate-500 dark:text-slate-400">
            الوضع الحالي النشط:{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {resolvedTheme === 'dark' ? 'داكن' : 'فاتح'}
            </span>{' '}
            {theme === 'system' && '(تلقائي حسب النظام)'}
          </p>
        </div>
      </Card>

      {/* Financial Month Start Day */}
      <Card
        title="بداية الشهر المالي"
        subtitle="حدد اليوم الذي يبدأ فيه حساب دخلك ومصاريفك (مثلاً يوم استلام الراتب)"
      >
        <div className="pt-2 max-w-xs">
          <Select
            label="يوم بداية الدورة المالية"
            value={currentStartDay}
            onChange={handleStartDayChange}
            options={dayOptions}
            helperText="الافتراضي هو اليوم الأول من كل شهر (1 إلى 28)."
          />
        </div>
      </Card>

      {/* Currency Card */}
      <Card
        title="العملة الرسمية"
        subtitle="العملة المعتمدة في جميع العمليات الحسابية داخل التطبيق"
      >
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              الدينار الأردني (JOD - د.أ)
            </div>
            <div className="text-xs text-slate-400">
              1 دينار = 1000 فلس (حسابات دقيقة بدون كسور عشرية)
            </div>
          </div>
        </div>
      </Card>

      {/* PWA App Installation Card */}
      <Card
        title="تثبيت التطبيق (PWA)"
        subtitle="يمكنك تثبيت تطبيق مصاريفي على هاتفك أو حاسوبك للعمل بدون إنترنت وسرعة فائقة"
      >
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {isInstalled ? 'التطبيق مثبت حالياً' : 'تطبيق ويب تقدمي (PWA)'}
              </div>
              <div className="text-xs text-slate-400">
                {isInstalled
                  ? 'يعمل التطبيق كبرنامج مستقل مع دعم كامل للعمل بلا اتصال'
                  : 'يعمل بكامل ميزاته مباشرة من الشاشة الرئيسية دون الحاجة للمتجر'}
              </div>
            </div>
          </div>

          {isInstalled ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>مثبت على الجهاز</span>
            </div>
          ) : isInstallable ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={promptInstall}
            >
              تثبيت التطبيق على جهازك
            </Button>
          ) : (
            <span className="text-xs text-slate-400 font-medium">
              متاح للتثبيت من متصفحك عبر زر المشاركة أو القائمة
            </span>
          )}
        </div>
      </Card>

      {/* Account Info */}
      <Card title="الحساب الشخصي" subtitle="معلومات تسجيل الدخول عبر Google">
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'صورة المستخدم'}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
                {user?.displayName ? user.displayName.charAt(0) : 'م'}
              </div>
            )}
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {user?.displayName || 'مستخدم مصاريفي'}
              </div>
              <div className="text-xs text-slate-400" dir="ltr">
                {user?.email || 'بدون بريد إلكتروني'}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<LogOut className="w-4 h-4 rtl:rotate-180" />}
            onClick={handleSignOut}
            disabled={loggingOut}
          >
            {loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
