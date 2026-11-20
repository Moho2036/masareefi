import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { useUserSettings } from '../hooks/useUserSettings'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useToast } from '../hooks/useToast'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { SelectedMonthContext } from '../hooks/useSelectedMonth'
import { signOutUser } from '../services/auth'
import { createFullBackup, downloadBackupFile } from '../lib/backupRestore'
import {
  ProfileSection,
  AppearanceSection,
  FinancialCycleSection,
  CurrencySection,
  NotificationsSection,
  SecuritySection,
  PWAInstallSection,
  AboutBaseerSection,
  BackupExportSection,
  DangerZoneSection,
} from '../components/settings'

export const SettingsPage: React.FC = () => {
  let navigate: (to: string) => void = () => {}
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigate = useNavigate()
  } catch {
    navigate = (to: string) => {
      if (typeof window !== 'undefined') {
        window.location.assign(to)
      }
    }
  }

  const { theme, setTheme, resolvedTheme } = useTheme()
  const { user } = useAuth()
  const uid = user?.uid
  const isOnline = useOnlineStatus()
  const { data: settings, updateSettings } = useUserSettings()
  const { data: categories = [] } = useCategories()
  const { data: recurring = [] } = useRecurring()
  const { data: moneyCircles = [] } = useMoneyCircles()
  const { showToast } = useToast()
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall()
  const selectedMonth = useContext(SelectedMonthContext)
  const refreshData = selectedMonth?.refreshData

  const activeCurrency = settings?.currency || 'JOD'

  const effectiveDisplayName = settings?.displayName?.trim() || user?.displayName?.trim() || 'مستخدم بَصير'
  const [displayNameInput, setDisplayNameInput] = useState(
    settings?.displayName?.trim() || user?.displayName?.trim() || ''
  )
  const [prevDisplayName, setPrevDisplayName] = useState(settings?.displayName)
  if (settings?.displayName !== prevDisplayName) {
    setPrevDisplayName(settings?.displayName)
    setDisplayNameInput(settings?.displayName?.trim() || user?.displayName?.trim() || '')
  }

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showReauthModal, setShowReauthModal] = useState(false)
  const [exportingJson, setExportingJson] = useState(false)

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

  const handleDownloadBackup = async () => {
    if (!user) return
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      showToast('يجب الاتصال بالإنترنت لإتمام تنزيل النسخة الاحتياطية', 'error')
      return
    }
    setExportingJson(true)
    try {
      const backup = await createFullBackup(user.uid)
      downloadBackupFile(backup)
      await updateSettings({ lastBackupAt: new Date().toISOString() })
      showToast('تم تنزيل النسخة الاحتياطية الشاملة بنجاح', 'success')
    } catch (err) {
      console.error('Failed to export full backup:', err)
      showToast('تعذر إنشاء النسخة الاحتياطية', 'error')
    } finally {
      setExportingJson(false)
    }
  }

  const handleRestartTour = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (uid) {
          localStorage.removeItem(`baseer_tour_shown_${uid}`)
          localStorage.removeItem(`masareefi_tour_shown_${uid}`)
        }
        localStorage.removeItem('baseer_tour_completed')
        localStorage.removeItem('has_seen_dashboard_tour')
        localStorage.removeItem('baseer_tour_shown')
        localStorage.removeItem('masareefi_tour_shown')
      }
      showToast('تمت إعادة ضبط الجولة بنجاح، جاري بدء الجولة...', 'info')
      navigate('/')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('baseer-start-tour'))
      }
    } catch (err) {
      console.error('Failed to restart tour:', err)
      showToast('تعذر إعادة ضبط الجولة', 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <PageHeader
        title="الإعدادات"
        subtitle="تخصيص الحساب، السمة، العملة، الأمان، وإدارة النسخ الاحتياطية"
      />

      <ProfileSection
        user={user}
        settings={settings}
        updateSettings={updateSettings}
        showToast={showToast}
        onOpenPasswordModal={() => setShowPasswordModal(true)}
        onSignOut={handleSignOut}
        loggingOut={loggingOut}
        displayNameInput={displayNameInput}
        setDisplayNameInput={setDisplayNameInput}
        effectiveDisplayName={effectiveDisplayName}
      />

      <AppearanceSection
        theme={theme}
        setTheme={setTheme}
        resolvedTheme={resolvedTheme}
        settings={settings}
        updateSettings={updateSettings}
      />

      <FinancialCycleSection
        uid={uid}
        settings={settings}
        updateSettings={updateSettings}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        categories={categories}
        activeCurrency={activeCurrency}
        showToast={showToast}
        refreshData={refreshData}
      />

      <CurrencySection
        activeCurrency={activeCurrency}
        settings={settings}
        updateSettings={updateSettings}
        showToast={showToast}
      />

      <NotificationsSection
        settings={settings}
        updateSettings={updateSettings}
        showToast={showToast}
      />

      <SecuritySection
        user={user}
        effectiveDisplayName={effectiveDisplayName}
        showPasswordModal={showPasswordModal}
        setShowPasswordModal={setShowPasswordModal}
        onOpenReauthModal={() => setShowReauthModal(true)}
        showToast={showToast}
      />

      <PWAInstallSection
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        promptInstall={promptInstall}
      />

      <BackupExportSection
        user={user}
        settings={settings}
        categories={categories}
        recurring={recurring}
        moneyCircles={moneyCircles}
        activeCurrency={activeCurrency}
        isOnline={isOnline}
        updateSettings={updateSettings}
        showToast={showToast}
        refreshData={refreshData}
        onDisplayNameRestored={setDisplayNameInput}
      />

      <DangerZoneSection
        user={user}
        isOnline={isOnline}
        exportingJson={exportingJson}
        onDownloadBackup={handleDownloadBackup}
        showToast={showToast}
        refreshData={refreshData}
        showReauthModal={showReauthModal}
        setShowReauthModal={setShowReauthModal}
      />

      <AboutBaseerSection onRestartTour={handleRestartTour} />
    </div>
  )
}
export default SettingsPage
