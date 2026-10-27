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

  it('does not overwrite existing baseer keys if already present', () => {
    localStorage.setItem('masareefi_theme', 'light')
    localStorage.setItem('baseer_theme', 'dark')
    localStorage.setItem('baseer-theme', 'dark')
    migrateLegacyStorage()
    expect(localStorage.getItem('baseer_theme')).toBe('dark')
    expect(localStorage.getItem('baseer-theme')).toBe('dark')
  })
})
