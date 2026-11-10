import { collection, doc } from 'firebase/firestore'
import { safeGetDoc, safeGetDocs } from '../firestoreOffline'
import { formatDateInput } from '../dates'
import { db } from '../firebase'
import type { MasareefiBackup, WorkHoursPrefsBackup } from './typesAndValidation'
import {
  categoryConverter,
  transactionConverter,
  debtConverter,
  recurringConverter,
  userSettingsConverter,
} from '../../services/converters'
import { circleConverter } from '../../services/moneyCircles'

/**
 * Exports all user data across all collections into a structured JSON backup.
 */
export async function createFullBackup(uid: string): Promise<MasareefiBackup> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('لا يمكن إنشاء نسخة احتياطية أثناء عدم الاتصال بالإنترنت')
  }

  const [
    settingsSnap,
    categoriesSnap,
    transactionsSnap,
    debtsSnap,
    recurringSnap,
    circlesSnap,
  ] = await Promise.all([
    safeGetDoc(doc(db, 'users', uid).withConverter(userSettingsConverter)),
    safeGetDocs(collection(db, 'users', uid, 'categories').withConverter(categoryConverter)),
    safeGetDocs(collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)),
    safeGetDocs(collection(db, 'users', uid, 'debts').withConverter(debtConverter)),
    safeGetDocs(collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)),
    safeGetDocs(collection(db, 'users', uid, 'circles').withConverter(circleConverter)),
  ])

  const settings = settingsSnap.exists() ? settingsSnap.data() : undefined
  const categories = categoriesSnap.docs.map((d) => d.data())
  const transactions = transactionsSnap.docs.map((d) => d.data())
  const debts = debtsSnap.docs.map((d) => d.data())
  const recurring = recurringSnap.docs.map((d) => d.data())
  const circles = circlesSnap.docs.map((d) => d.data())

  // Collect work hours calculator preferences from localStorage if available
  let workHoursPrefs: WorkHoursPrefsBackup | undefined
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const raw =
        localStorage.getItem('baseer_work_hours_prefs') ||
        localStorage.getItem('masareefi_work_hours_prefs')
      if (raw) {
        workHoursPrefs = JSON.parse(raw) as WorkHoursPrefsBackup
      }
    } catch {
      // ignore
    }
  }

  const backup: MasareefiBackup = {
    version: 1,
    app: 'baseer',
    exportedAt: new Date().toISOString(),
    data: {
      settings,
      categories,
      transactions,
      debts,
      recurring,
      circles,
      ...(workHoursPrefs ? { workHoursPrefs } : {}),
    },
  }

  return backup
}

/**
 * Triggers a browser file download of the JSON backup file.
 */
export function downloadBackupFile(backup: MasareefiBackup): void {
  const jsonString = JSON.stringify(backup, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const dateStr = formatDateInput(new Date())
  const filename = `baseer-backup-${dateStr}.json`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
