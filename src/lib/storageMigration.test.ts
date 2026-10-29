import { describe, it, expect, beforeEach } from 'vitest'
import { migrateLegacyStorage } from './storageMigration'

describe('migrateLegacyStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates theme from masareefi_theme to baseer_theme and baseer-theme', () => {
    localStorage.setItem('masareefi_theme', 'dark')
    migrateLegacyStorage()
    expect(localStorage.getItem('baseer_theme')).toBe('dark')
    expect(localStorage.getItem('baseer-theme')).toBe('dark')
  })

  it('migrates work hours preferences from masareefi_work_hours_prefs to baseer_work_hours_prefs', () => {
    localStorage.setItem('masareefi_work_hours_prefs', JSON.stringify({ salary: '500' }))
    migrateLegacyStorage()
    expect(localStorage.getItem('baseer_work_hours_prefs')).toBe(JSON.stringify({ salary: '500' }))
  })

  it('migrates category usage from masareefi_category_usage to baseer_category_usage', () => {
    localStorage.setItem('masareefi_category_usage', JSON.stringify({ cat1: 5 }))
    migrateLegacyStorage()
    expect(localStorage.getItem('baseer_category_usage')).toBe(JSON.stringify({ cat1: 5 }))
  })

  it('migrates categories seed v2 keys per uid', () => {
    localStorage.setItem('masareefi_categories_seed_v2_user123', 'true')
    migrateLegacyStorage()
    expect(localStorage.getItem('baseer_categories_seed_v2_user123')).toBe('true')
  })

  it('migrates additional user-scoped keys (onboarding_done, tour_shown, pin_hash, notifications_read) per uid', () => {
    localStorage.setItem('masareefi_onboarding_done_u1', 'true')
    localStorage.setItem('masareefi_tour_shown_u1', 'true')
    localStorage.setItem('masareefi_pin_hash_u1', 'hash123')
    localStorage.setItem('masareefi_notifications_read_u1', JSON.stringify(['n1']))

    migrateLegacyStorage()

    expect(localStorage.getItem('baseer_onboarding_done_u1')).toBe('true')
    expect(localStorage.getItem('baseer_tour_shown_u1')).toBe('true')
    expect(localStorage.getItem('baseer_pin_hash_u1')).toBe('hash123')
    expect(localStorage.getItem('baseer_notifications_read_u1')).toBe(JSON.stringify(['n1']))
  })

  it('does not overwrite existing baseer user-scoped keys if already present', () => {
    localStorage.setItem('masareefi_onboarding_done_u1', 'old_val')
    localStorage.setItem('baseer_onboarding_done_u1', 'new_val')
    localStorage.setItem('masareefi_pin_hash_u1', 'old_hash')
    localStorage.setItem('baseer_pin_hash_u1', 'new_hash')

    migrateLegacyStorage()

    expect(localStorage.getItem('baseer_onboarding_done_u1')).toBe('new_val')
    expect(localStorage.getItem('baseer_pin_hash_u1')).toBe('new_hash')
  })

  it('does not overwrite existing baseer keys if already present', () => {
    localStorage.setItem('masareefi_theme', 'light')
    localStorage.setItem('baseer_theme', 'dark')
    localStorage.setItem('baseer-theme', 'dark')
    migrateLegacyStorage()
    expect(localStorage.getItem('baseer_theme')).toBe('dark')
    expect(localStorage.getItem('baseer-theme')).toBe('dark')
  })
})
