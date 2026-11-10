import React from 'react'
import {
  Sun,
  Moon,
  Laptop,
  EyeOff,
  Coins,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Toggle } from '../ui/Toggle'
import type { ThemePreference, UserSettings } from '../../types'

export interface AppearanceSectionProps {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  resolvedTheme: 'light' | 'dark'
  settings: UserSettings | null | undefined
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  theme,
  setTheme,
  resolvedTheme,
  settings,
  updateSettings,
}) => {
  const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'تلقائي', icon: <Laptop className="w-4 h-4" /> },
    { value: 'light', label: 'فاتح', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'داكن', icon: <Moon className="w-4 h-4" /> },
  ]

  const handleThemeChange = async (newTheme: ThemePreference) => {
    if (newTheme === theme) return
    setTheme(newTheme)
    try {
      await updateSettings({ theme: newTheme })
    } catch (err) {
      console.error('Failed to persist theme:', err)
    }
  }

  return (
    <Card
      title="المظهر والألوان ووضع الخصوصية"
      subtitle="السمة البصرية، إخفاء الأرصدة، وترتيب التصنيفات"
    >
      <div className="space-y-5 pt-2">
        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
            السمة البصرية للتطبيق
          </label>
          <SegmentedControl<ThemePreference>
            value={theme}
            onChange={handleThemeChange}
            options={themeOptions}
            className="w-full sm:w-auto"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            الوضع الحالي النشط:{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {resolvedTheme === 'dark' ? 'داكن' : 'فاتح'}
            </span>{' '}
            {theme === 'system' && '(تلقائي حسب النظام)'}
          </p>
        </div>

        {/* Privacy Mode Toggle */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <label
              htmlFor="hide-balances-toggle"
              className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-2"
            >
              <EyeOff className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>وضع الخصوصية وإخفاء الأرقام</span>
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              إخفاء قيم الأرصدة والمبالغ برمز (•••••) في جميع الشاشات.
            </p>
          </div>
          <Toggle
            id="hide-balances-toggle"
            checked={settings?.hideBalances ?? false}
            onChange={(checked) => updateSettings({ hideBalances: checked })}
          />
        </div>

        {/* Hide Zero Decimals Toggle */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <label
              htmlFor="hide-zero-decimals-toggle"
              className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-2"
            >
              <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>إخفاء الكسور الصفرية</span>
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              إخفاء الأصفار بعد الفاصلة في المبالغ الصحيحة (عرض 50 د.أ بدلاً من 50.000 د.أ).
            </p>
          </div>
          <Toggle
            id="hide-zero-decimals-toggle"
            checked={settings?.hideZeroDecimals ?? true}
            onChange={(checked) => updateSettings({ hideZeroDecimals: checked })}
          />
        </div>

        {/* Category Sort Mode */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <label
              htmlFor="category-sort-toggle"
              className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              ترتيب التصنيفات حسب الأكثر استخداماً
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              إظهار التصنيفات الأكثر استخداماً أولاً في القوائم.
            </p>
          </div>
          <Toggle
            id="category-sort-toggle"
            checked={settings?.categorySortMode !== 'manual'}
            onChange={(checked) => updateSettings({ categorySortMode: checked ? 'usage' : 'manual' })}
          />
        </div>
      </div>
    </Card>
  )
}
