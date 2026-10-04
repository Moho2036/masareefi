import React, { useState } from 'react'
import { Sun, Moon, Laptop, DollarSign, LogOut } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { useTheme } from '../hooks/useTheme'
import type { ThemePreference } from '../types'

export const SettingsPage: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [startDay, setStartDay] = useState('1')

  const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'تلقائي', icon: <Laptop className="w-4 h-4" /> },
    { value: 'light', label: 'فاتح', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'داكن', icon: <Moon className="w-4 h-4" /> },
  ]

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `يوم ${i + 1} من كل شهر`,
  }))

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
            onChange={setTheme}
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
            value={startDay}
            onChange={(e) => setStartDay(e.target.value)}
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

      {/* Account Info */}
      <Card title="الحساب الشخصي" subtitle="معلومات تسجيل الدخول عبر Google">
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold">
              م
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                مستخدم تجريبي
              </div>
              <div className="text-xs text-slate-400">user@example.com</div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<LogOut className="w-4 h-4 rtl:rotate-180" />}
            disabled
          >
            تسجيل الخروج (المرحلة 2)
          </Button>
        </div>
      </Card>
    </div>
  )
}
