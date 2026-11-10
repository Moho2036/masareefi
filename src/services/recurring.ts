import {
  collection,
  doc,
  query,
  where,
  writeBatch,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteField,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { MAX_AMOUNT_FILS } from '../lib/money'
import type { Recurring, MoneyCircle } from '../types'
import { recurringConverter } from './converters'
import { calculateDueOccurrences, getDeterministicTxId, advanceDateWithTargetDay, isOccurrenceSkipped } from '../lib/recurring'
import { getCircleCycleIndex, circleConverter } from './moneyCircles'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../lib/firestoreOffline'

export function subscribeRecurring(
  uid: string,
  cb: (recurring: Recurring[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)

  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      cb(items)
    },
    (err) => {
      console.error('subscribeRecurring error:', err)
      onError?.(err)
    }
  )
}

export async function addRecurring(
  uid: string,
  rec: Omit<Recurring, 'id'>
): Promise<string> {
  if (!Number.isInteger(rec.amountFils) || rec.amountFils <= 0) {
    throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }
  if (rec.amountFils > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const colRef = collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)
  const docRef = await commitFirestoreWrite(
    addDoc(colRef, {
      ...rec,
      id: '',
      note: typeof rec.note === 'string' ? rec.note.slice(0, 500) : '',
      ...(typeof rec.requireConfirmation === 'boolean' ? { requireConfirmation: rec.requireConfirmation } : {}),
    }),
    { id: 'offline_rec_' + Date.now() } as never
  )

  return docRef.id
}

export async function updateRecurring(
  uid: string,
  id: string,
  rec: Partial<Omit<Recurring, 'id'>>
): Promise<void> {
  if (rec.amountFils !== undefined) {
    if (!Number.isInteger(rec.amountFils) || rec.amountFils <= 0) {
      throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
    }
    if (rec.amountFils > MAX_AMOUNT_FILS) {
      throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
    }
  }

  const docRef = doc(db, 'users', uid, 'recurring', id)
  const payload: Record<string, unknown> = {}

  if (rec.type !== undefined) {
    payload.type = rec.type
  }
  if (rec.amountFils !== undefined) {
    payload.amountFils = rec.amountFils
  }
  if (rec.categoryId !== undefined) {
    payload.categoryId = rec.categoryId
  }
  if (rec.note !== undefined) {
    payload.note = typeof rec.note === 'string' ? rec.note.slice(0, 500) : ''
  }
  if (rec.frequency !== undefined) {
    payload.frequency = rec.frequency
  }
  if (rec.startDate !== undefined) {
    payload.startDate =
      rec.startDate instanceof Date ? Timestamp.fromDate(rec.startDate) : rec.startDate
  }
  if (rec.nextDate !== undefined) {
    payload.nextDate =
      rec.nextDate instanceof Date ? Timestamp.fromDate(rec.nextDate) : rec.nextDate
  }
  if (rec.active !== undefined) {
    payload.active = Boolean(rec.active)
  }

  // Handle optional fields with deleteField() when unset, undefined, or null
  if ('title' in rec) {
    if (rec.title === undefined || rec.title === null || (typeof rec.title === 'string' && rec.title.trim() === '')) {
      payload.title = deleteField()
    } else {
      payload.title = rec.title.trim().slice(0, 100)
    }
  }

  if ('endDate' in rec) {
    if (rec.endDate === undefined || rec.endDate === null) {
      payload.endDate = deleteField()
    } else {
      payload.endDate =
        rec.endDate instanceof Date ? Timestamp.fromDate(rec.endDate) : rec.endDate
    }
  }

  if ('circleId' in rec) {
    if (rec.circleId === undefined || rec.circleId === null || rec.circleId === '') {
      payload.circleId = deleteField()
    } else {
      payload.circleId = rec.circleId
    }
  }

  if ('skipMonth' in rec) {
    if (rec.skipMonth === undefined || rec.skipMonth === null) {
      payload.skipMonth = deleteField()
    } else {
      payload.skipMonth = Math.round(rec.skipMonth)
    }
  }

  if ('skipMonths' in rec) {
    if (!Array.isArray(rec.skipMonths) || rec.skipMonths.length === 0) {
      payload.skipMonths = deleteField()
    } else {
      payload.skipMonths = rec.skipMonths
        .map(Number)
        .filter((m) => Number.isFinite(m) && m >= 1 && m <= 50)
        .slice(0, 10)
    }
  }

  if ('requireConfirmation' in rec) {
    if (rec.requireConfirmation === undefined || rec.requireConfirmation === null) {
      payload.requireConfirmation = deleteField()
    } else {
      payload.requireConfirmation = Boolean(rec.requireConfirmation)
    }
  }

  if (Object.keys(payload).length > 0) {
    await commitFirestoreWrite(updateDoc(docRef, payload))
  }
}

export async function deleteRecurring(uid: string, id: string): Promise<void> {
  const docRef = doc(db, 'users', uid, 'recurring', id)
  const batch = writeBatch(db)
  batch.delete(docRef)

  try {
    const snap = await safeGetDoc(docRef)
    let linkedCircleId: string | undefined
    if (snap.exists()) {
      const data = snap.data()
      if (data.circleId && typeof data.circleId === 'string') {
        linkedCircleId = data.circleId
      }
    }

    if (linkedCircleId) {
      batch.update(doc(db, 'users', uid, 'circles', linkedCircleId), {
        recurringId: deleteField(),
      })
    }

    // Also clean up any circle referencing this recurringId
    const circlesCol = collection(db, 'users', uid, 'circles')
    const q = query(circlesCol, where('recurringId', '==', id))
    const circleSnap = await safeGetDocs(q)
    for (const cDoc of circleSnap.docs) {
      if (cDoc.id !== linkedCircleId) {
        batch.update(cDoc.ref, { recurringId: deleteField() })
      }
    }
  } catch (err) {
    console.error('Failed to unlink recurring from circles:', err)
  }

  await commitFirestoreWrite(batch.commit())
}

/**
 * Checks for all due recurring transactions up to `today`,
 * creates idempotent transactions with deterministic IDs, and updates recurring items.
 * If a recurring rule is linked to a money circle, it also automatically marks the user's
 * installment for the corresponding cycle month as paid in the circle.
 * Returns the number of new transactions created.
 */
/**
 * Advances the next occurrence date past skipped occurrences and computes whether the rule should deactivate.
 */
function computeNextActiveOccurrence(
  rec: Recurring,
  fromDate: Date,
  monthStartDay?: number
): { newNextDate: Date; shouldDeactivate: boolean } {
  const occDate = fromDate instanceof Date ? fromDate : new Date(fromDate)
  const startDate = rec.startDate instanceof Date ? rec.startDate : new Date(rec.startDate)
  const targetDay = startDate.getDate()
  let newNextDate = advanceDateWithTargetDay(occDate, rec.frequency, targetDay)
  let skipGuard = 50
  while (isOccurrenceSkipped(rec, newNextDate, monthStartDay) && skipGuard-- > 0) {
    newNextDate = advanceDateWithTargetDay(newNextDate, rec.frequency, targetDay)
  }

  const endOfEndDate = rec.endDate
    ? new Date(rec.endDate instanceof Date ? rec.endDate.getTime() : new Date(rec.endDate).getTime())
    : null
  if (endOfEndDate) {
    endOfEndDate.setHours(23, 59, 59, 999)
  }
  const shouldDeactivate = Boolean(endOfEndDate && newNextDate > endOfEndDate)

  return { newNextDate, shouldDeactivate }
}

/**
 * Marks the circle cycle as paid for the user member(s) (supporting both myTurnMonth and double-share secondTurnMonth).
 * Returns true if any member record was updated.
 */
function markCircleCyclePaidForUser(circle: MoneyCircle, cycleIndex: number): boolean {
  const isExemptCycle =
    cycleIndex === circle.myTurnMonth ||
    (circle.shareType === 'double' && cycleIndex === circle.secondTurnMonth)

  if (cycleIndex < 1 || cycleIndex > circle.membersCount || isExemptCycle) {
    return false
  }

  const isUserMemberMatch = (m: { turnMonth: number }) =>
    m.turnMonth === circle.myTurnMonth ||
    (circle.shareType === 'double' &&
      circle.secondTurnMonth !== undefined &&
      m.turnMonth === circle.secondTurnMonth)

  const userMembers = (circle.members || []).filter(isUserMemberMatch)
  if (userMembers.length === 0) {
    return false
  }

  let modified = false
  for (const userMember of userMembers) {
    if (!Array.isArray(userMember.paidMonths)) {
      userMember.paidMonths = []
    }
    if (!userMember.paymentsByMonth) {
      userMember.paymentsByMonth = {}
    }

    const wasPaid =
      userMember.paidMonths.includes(cycleIndex) ||
      userMember.paymentsByMonth[String(cycleIndex)] === true

    if (!wasPaid) {
      userMember.paidMonths = [...userMember.paidMonths, cycleIndex]
      userMember.paymentsByMonth[String(cycleIndex)] = true
      modified = true
    }
  }

  return modified
}

export async function processDueRecurring(
  uid: string,
  today: Date = new Date(),
  monthStartDay?: number
): Promise<number> {
  const endOfToday = new Date(today.getTime())
  endOfToday.setHours(23, 59, 59, 999)

  const colRef = collection(db, 'users', uid, 'recurring').withConverter(recurringConverter)
  const q = query(
    colRef,
    where('active', '==', true),
    where('nextDate', '<=', Timestamp.fromDate(endOfToday))
  )

  const snap = await safeGetDocs(q)
  if (snap.empty) {
    return 0
  }

  interface PendingTx {
    txId: string
    txRef: ReturnType<typeof doc>
    circleManualTxRef?: ReturnType<typeof doc>
    occDate: Date
    rec: Recurring
    cycleIndex?: number
  }

  // Pre-fetch any linked circles for recurring items to prevent deductions on completed circles or double deduction
  const circleIds = Array.from(
    new Set(
      snap.docs
        .map((d) => d.data().circleId)
        .filter((cid): cid is string => typeof cid === 'string' && cid.trim().length > 0)
    )
  )

  const effectiveMonthStartDay = monthStartDay ?? 1

  const circleDocs = await Promise.all(
    circleIds.map((cid) =>
      safeGetDoc(doc(db, 'users', uid, 'circles', cid).withConverter(circleConverter))
    )
  )
  const circleMap = new Map<string, MoneyCircle>()
  for (const cDoc of circleDocs) {
    if (cDoc?.exists?.()) {
      circleMap.set(cDoc.id, cDoc.data())
    }
  }

  const pendingTxs: PendingTx[] = []
  const recurringUpdates: { recRef: ReturnType<typeof doc>; payload: Record<string, unknown> }[] = []

  for (const docSnap of snap.docs) {
    const rec = docSnap.data()
    const recRef = doc(db, 'users', uid, 'recurring', rec.id)

    // If confirmation is required, skip automatic generation and do not advance nextDate
    if (rec.requireConfirmation) {
      continue
    }

    // Defense-in-depth: If linked to a completed circle, immediately deactivate recurring rule and skip
    if (rec.circleId && circleMap.has(rec.circleId)) {
      const circle = circleMap.get(rec.circleId)!
      if (circle.status === 'completed') {
        recurringUpdates.push({ recRef, payload: { active: false } })
        continue
      }
    }

    const { dates, newNextDate, shouldDeactivate } = calculateDueOccurrences(
      rec,
      endOfToday,
      effectiveMonthStartDay
    )

    if (dates.length > 0) {
      for (const occDate of dates) {
        let circleManualTxRef: ReturnType<typeof doc> | undefined
        let cycleIndex: number | undefined
        if (rec.circleId && circleMap.has(rec.circleId)) {
          const circle = circleMap.get(rec.circleId)!
          const currentCycleIndex = getCircleCycleIndex(circle.startDate, occDate, effectiveMonthStartDay) + 1
          cycleIndex = currentCycleIndex

          const isUserMemberMatch = (m: { turnMonth: number }) =>
            m.turnMonth === circle.myTurnMonth ||
            (circle.shareType === 'double' &&
              circle.secondTurnMonth !== undefined &&
              m.turnMonth === circle.secondTurnMonth)

          const userMembers = (circle.members || []).filter(isUserMemberMatch)

          const isAlreadyHandled = userMembers.some(
            (m) =>
              m.paymentsByMonth?.[String(currentCycleIndex)] === false ||
              m.paymentsByMonth?.[String(currentCycleIndex)] === true ||
              (Array.isArray(m.paidMonths) && m.paidMonths.includes(currentCycleIndex))
          )

          if (isAlreadyHandled) {
            // User explicitly cancelled/unpaid or already paid this month; do not auto-generate transaction
            continue
          }

          circleManualTxRef = doc(db, 'users', uid, 'transactions', `circle_${circle.id}_m${currentCycleIndex}`)
        }

        const txId = getDeterministicTxId(rec.id, occDate)
        const txRef = doc(db, 'users', uid, 'transactions', txId)
        pendingTxs.push({ txId, txRef, circleManualTxRef, occDate, rec, cycleIndex })
      }
    }

    const updatePayload: Record<string, unknown> = {
      nextDate: Timestamp.fromDate(newNextDate),
    }
    if (shouldDeactivate) {
      updatePayload.active = false
    }
    recurringUpdates.push({ recRef, payload: updatePayload })
  }

  const circleModified = new Set<string>()

  // Fetch verification documents concurrently via Promise.all
  const verificationSnaps = await Promise.all(
    pendingTxs.map(async (item) => {
      const txSnap = await safeGetDoc(item.txRef)
      const manualSnap = item.circleManualTxRef ? await safeGetDoc(item.circleManualTxRef) : null
      return { txSnap, manualSnap }
    })
  )

  let createdCount = 0
  type BatchOp = (b: ReturnType<typeof writeBatch>) => void
  const operations: BatchOp[] = []

  for (let i = 0; i < pendingTxs.length; i++) {
    const { txSnap, manualSnap } = verificationSnaps[i]
    if (!txSnap.exists() && (!manualSnap || !manualSnap.exists())) {
      const { txRef, occDate, rec, cycleIndex } = pendingTxs[i]
      const newTxData: Record<string, unknown> = {
        type: rec.type,
        amountFils: rec.amountFils,
        categoryId: rec.categoryId,
        date: Timestamp.fromDate(occDate),
        note: typeof rec.note === 'string' ? rec.note.slice(0, 500) : '',
        recurringId: rec.id,
        createdAt: serverTimestamp(),
      }
      if (rec.title) {
        newTxData.title = rec.title.slice(0, 100)
      }
      operations.push((b) => b.set(txRef, newTxData))
      createdCount++

      // If linked to circle, automatically mark user's slot as paid for this cycle
      if (rec.circleId && circleMap.has(rec.circleId) && cycleIndex !== undefined) {
        const circle = circleMap.get(rec.circleId)!
        const marked = markCircleCyclePaidForUser(circle, cycleIndex)
        if (marked) {
          circleModified.add(circle.id)
        }
      }
    }
  }

  for (const { recRef, payload } of recurringUpdates) {
    operations.push((b) => b.update(recRef, payload))
  }

  // Add circle updates to operations
  for (const circleId of circleModified) {
    const circle = circleMap.get(circleId)
    if (circle) {
      operations.push((b) => {
        const circleRef = doc(db, 'users', uid, 'circles', circle.id)
        b.update(circleRef, {
          members: circle.members.map((m) => ({
            id: m.id,
            name: m.name.trim().slice(0, 50),
            turnMonth: Math.round(m.turnMonth),
            paidMonths: (m.paidMonths || []).map(Number),
            ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
          })),
        })
      })
    }
  }

  // Chunk write operations in writeBatch to max 400 per batch to respect Firestore limit (500)
  const CHUNK_SIZE = 400
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const op of chunk) {
      op(batch)
    }
    await commitFirestoreWrite(batch.commit())
  }

  return createdCount
}

/**
 * Confirms and executes a pending occurrence for a recurring transaction that requires manual confirmation.
 * Allows customAmountFils (e.g. for variable utility bills) without changing the recurring rule's baseline amount.
 * Creates the transaction, advances nextDate, and updates linked circle payment if applicable.
 */
export async function confirmRecurringOccurrence(
  uid: string,
  rec: Recurring,
  customAmountFils?: number,
  monthStartDay?: number
): Promise<string> {
  const amountToCharge = customAmountFils !== undefined ? customAmountFils : rec.amountFils
  if (!Number.isInteger(amountToCharge) || amountToCharge <= 0) {
    throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }
  if (amountToCharge > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const occDate = rec.nextDate instanceof Date ? rec.nextDate : new Date(rec.nextDate)
  const txId = getDeterministicTxId(rec.id, occDate)
  const txRef = doc(db, 'users', uid, 'transactions', txId)
  const recRef = doc(db, 'users', uid, 'recurring', rec.id)

  const { newNextDate, shouldDeactivate } = computeNextActiveOccurrence(rec, occDate, monthStartDay)

  const batch = writeBatch(db)

  const newTxData: Record<string, unknown> = {
    type: rec.type,
    amountFils: amountToCharge,
    categoryId: rec.categoryId,
    date: Timestamp.fromDate(occDate),
    note: typeof rec.note === 'string' ? rec.note.slice(0, 500) : '',
    recurringId: rec.id,
    createdAt: serverTimestamp(),
  }
  if (rec.title) {
    newTxData.title = rec.title.slice(0, 100)
  }
  batch.set(txRef, newTxData)

  const recUpdate: Record<string, unknown> = {
    nextDate: Timestamp.fromDate(newNextDate),
  }
  if (shouldDeactivate) {
    recUpdate.active = false
  }
  batch.update(recRef, recUpdate)

  // Circle handling if linked
  if (rec.circleId) {
    try {
      const circleDocRef = doc(db, 'users', uid, 'circles', rec.circleId).withConverter(circleConverter)
      const circleSnap = await safeGetDoc(circleDocRef)
      if (circleSnap.exists()) {
        const circle = circleSnap.data()
        const effectiveMonthStartDay = monthStartDay ?? 1
        const cycleIndex = getCircleCycleIndex(circle.startDate, occDate, effectiveMonthStartDay) + 1
        const marked = markCircleCyclePaidForUser(circle, cycleIndex)
        if (marked) {
          batch.update(doc(db, 'users', uid, 'circles', circle.id), {
            members: circle.members.map((m) => ({
              id: m.id,
              name: m.name.trim().slice(0, 50),
              turnMonth: Math.round(m.turnMonth),
              paidMonths: (m.paidMonths || []).map(Number),
              ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
            })),
          })
        }
      }
    } catch (err) {
      console.error('Failed to link confirmed recurring to circle:', err)
    }
  }

  await commitFirestoreWrite(batch.commit())
  return txId
}

/**
 * Skips the current due occurrence without creating a transaction, advancing nextDate to the next cycle.
 */
export async function skipRecurringOccurrence(
  uid: string,
  rec: Recurring,
  monthStartDay?: number
): Promise<void> {
  const occDate = rec.nextDate instanceof Date ? rec.nextDate : new Date(rec.nextDate)
  const { newNextDate, shouldDeactivate } = computeNextActiveOccurrence(rec, occDate, monthStartDay)

  const recRef = doc(db, 'users', uid, 'recurring', rec.id)
  const recUpdate: Record<string, unknown> = {
    nextDate: Timestamp.fromDate(newNextDate),
  }
  if (shouldDeactivate) {
    recUpdate.active = false
  }

  await commitFirestoreWrite(updateDoc(recRef, recUpdate))
}
