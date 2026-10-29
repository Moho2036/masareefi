/**
 * One-time / on-load backward compatibility migration utility for localStorage keys.
 * Copies legacy `masareefi_*` keys to their new `baseer_*` equivalents if not already set.
 */
export function migrateLegacyStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    // 1. Theme migration
    const legacyTheme =
      localStorage.getItem('masareefi_theme') ||
      localStorage.getItem('masareefi-theme')

    if (legacyTheme && !localStorage.getItem('baseer_theme')) {
      localStorage.setItem('baseer_theme', legacyTheme)
      localStorage.setItem('baseer-theme', legacyTheme)
    }

    // 2. Work hours calculator preferences
    const legacyWorkHours = localStorage.getItem('masareefi_work_hours_prefs')
    if (legacyWorkHours && !localStorage.getItem('baseer_work_hours_prefs')) {
      localStorage.setItem('baseer_work_hours_prefs', legacyWorkHours)
    }

    // 3. Category usage map
    const legacyCategoryUsage = localStorage.getItem('masareefi_category_usage')
    if (legacyCategoryUsage && !localStorage.getItem('baseer_category_usage')) {
      localStorage.setItem('baseer_category_usage', legacyCategoryUsage)
    }

    // 4. User-scoped keys migration
    const userScopedPrefixes: { oldPrefix: string; newPrefix: string }[] = [
      {
        oldPrefix: 'masareefi_categories_seed_v2_',
        newPrefix: 'baseer_categories_seed_v2_',
      },
      {
        oldPrefix: 'masareefi_onboarding_done_',
        newPrefix: 'baseer_onboarding_done_',
      },
      {
        oldPrefix: 'masareefi_tour_shown_',
        newPrefix: 'baseer_tour_shown_',
      },
      {
        oldPrefix: 'masareefi_pin_hash_',
        newPrefix: 'baseer_pin_hash_',
      },
      {
        oldPrefix: 'masareefi_notifications_read_',
        newPrefix: 'baseer_notifications_read_',
      },
    ]

    const keysToMigrate: { oldKey: string; newKey: string }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      for (const { oldPrefix, newPrefix } of userScopedPrefixes) {
        if (key.startsWith(oldPrefix)) {
          const suffix = key.slice(oldPrefix.length)
          keysToMigrate.push({ oldKey: key, newKey: `${newPrefix}${suffix}` })
          break
        }
      }
    }

    for (const { oldKey, newKey } of keysToMigrate) {
      if (!localStorage.getItem(newKey)) {
        const val = localStorage.getItem(oldKey)
        if (val !== null) {
          localStorage.setItem(newKey, val)
        }
      }
    }
  } catch {
    // Silently handle quota or storage access errors (e.g. sandboxed iframe or private browsing)
  }
}
