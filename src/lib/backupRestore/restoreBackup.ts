import {
  collection,
  doc,
  writeBatch,
} from 'firebase/firestore'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../firestoreOffline'
import { db } from '../firebase'
import {
  categoryConverter,
  transactionConverter,
  debtConverter,
  recurringConverter,
} from '../../services/converters'
import { circleConverter } from '../../services/moneyCircles'
import {
  syncCategoryUsageCache,
  mergeAndSaveUsage,
  buildUsageFromTransactions,
} from '../categoryUsage'
import {
  resolveOrphanCategories,
  type MasareefiBackup,
  type RestoreMode,
  type RestoreOptions,
} from './typesAndValidation'
import {
  enqueueSettingsRestore,
  enqueueCategoriesRestore,
  type BatchOp,
} from './restoreSettingsAndCategories'
import {
  enqueueTransactionsRestore,
  enqueueDebtsRestore,
  enqueueRecurringRestore,
  enqueueCirclesRestore,
} from './restoreRecords'

/**
 * Restores a full backup into the user's Firestore collections.
 * Uses chunked writeBatch (max 400 docs per batch) and preserves original document IDs.
 */
export async function restoreBackup(
  uid: string,
  backup: MasareefiBackup,
  optionsOrMode: RestoreMode | RestoreOptions = 'merge'
): Promise<void> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('baseer-bulk-op-start'))
  }
  try {
    if (!backup || !backup.data || typeof backup.data !== 'object') {
      throw new Error('بيانات النسخة الاحتياطية غير صالحة أو مفقودة')
    }

    // Restore work hours calculator preferences to localStorage if present
    if (
      backup.data.workHoursPrefs &&
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    ) {
      try {
        const payload = JSON.stringify(backup.data.workHoursPrefs)
        localStorage.setItem('baseer_work_hours_prefs', payload)
        localStorage.setItem('masareefi_work_hours_prefs', payload)
      } catch {
        // ignore
      }
    }

    // Pre-validation and orphan category resolution:
    // Ensures every transaction/recurring rule maps to an existing category
    // before starting any deletion or writing in Firestore.
    const resolvedCategories = resolveOrphanCategories(
      backup.data.categories || [],
      backup.data.transactions || [],
      backup.data.recurring || [],
      backup.data.circles || []
    )
    backup.data.categories = resolvedCategories

    const mode: RestoreMode =
      typeof optionsOrMode === 'string'
        ? optionsOrMode
        : optionsOrMode?.mode || 'merge'

    const ops: BatchOp[] = []
    const rawUserRef = doc(db, 'users', uid)

    // Query existing docs in parallel to minimize round-trip latency
    const [
      existingUserSnap,
      existingCatsSnap,
      existingTxsSnap,
      existingDebtsSnap,
      existingRecSnap,
      existingCirclesSnap,
    ] = await Promise.all([
      backup.data.settings ? safeGetDoc(rawUserRef) : Promise.resolve(null),
      safeGetDocs(collection(db, 'users', uid, 'categories').withConverter(categoryConverter)),
      safeGetDocs(collection(db, 'users', uid, 'transactions').withConverter(transactionConverter)),
      safeGetDocs(collection(db, 'users', uid, 'debts').withConverter(debtConverter)),
      safeGetDocs(collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)),
      safeGetDocs(collection(db, 'users', uid, 'circles').withConverter(circleConverter)),
    ])

    // 1. Settings
    if (backup.data.settings) {
      enqueueSettingsRestore(rawUserRef, backup.data.settings, existingUserSnap, mode, ops)
    }

    // 2. Categories
    const categoryIdRemap = new Map<string, string>()

    if (mode === 'replace') {
      try {
        syncCategoryUsageCache(backup.data.transactions || [])
      } catch {
        // ignore
      }
    } else if (mode === 'merge') {
      try {
        mergeAndSaveUsage(buildUsageFromTransactions(backup.data.transactions || []))
      } catch {
        // ignore
      }
    }

    enqueueCategoriesRestore(
      uid,
      backup.data.categories,
      existingCatsSnap,
      mode,
      ops,
      categoryIdRemap
    )

    // 3. Stale documents cleanup for transactions, debts, recurring, and circles (in replace mode only)
    if (mode === 'replace') {
      const incomingTxIds = new Set(backup.data.transactions.map((t) => t.id).filter(Boolean))
      if (existingTxsSnap && existingTxsSnap.docs) {
        for (const d of existingTxsSnap.docs) {
          if (!incomingTxIds.has(d.id)) {
            ops.push((b) => b.delete(d.ref))
          }
        }
      }

      const incomingDebtIds = new Set(backup.data.debts.map((d) => d.id).filter(Boolean))
      if (existingDebtsSnap && existingDebtsSnap.docs) {
        for (const d of existingDebtsSnap.docs) {
          if (!incomingDebtIds.has(d.id)) {
            ops.push((b) => b.delete(d.ref))
          }
        }
      }

      const incomingRecIds = new Set(backup.data.recurring.map((r) => r.id).filter(Boolean))
      if (existingRecSnap && existingRecSnap.docs) {
        for (const d of existingRecSnap.docs) {
          if (!incomingRecIds.has(d.id)) {
            ops.push((b) => b.delete(d.ref))
          }
        }
      }

      const incomingCircleIds = new Set(backup.data.circles.map((c) => c.id).filter(Boolean))
      if (existingCirclesSnap && existingCirclesSnap.docs) {
        for (const d of existingCirclesSnap.docs) {
          if (!incomingCircleIds.has(d.id)) {
            ops.push((b) => b.delete(d.ref))
          }
        }
      }
    }

    // 4. Transactions
    enqueueTransactionsRestore(uid, backup.data.transactions, categoryIdRemap, ops)

    // 5. Debts
    enqueueDebtsRestore(uid, backup.data.debts, ops)

    // 6. Recurring
    enqueueRecurringRestore(uid, backup.data.recurring, categoryIdRemap, ops)

    // 7. Circles
    enqueueCirclesRestore(uid, backup.data.circles, categoryIdRemap, ops)

    // Chunk operations into batches of <= 400 (Firestore limit is 500)
    const CHUNK_SIZE = 400
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const chunk = ops.slice(i, i + CHUNK_SIZE)
      const batch = writeBatch(db)
      for (const op of chunk) {
        op(batch)
      }
      await commitFirestoreWrite(batch.commit())
    }
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('baseer-bulk-op-end'))
    }
  }
}
