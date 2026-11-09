import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { MAX_AMOUNT_FILS } from '../../lib/money'
import type { Debt, DebtEntry, DebtPayment, TxType } from '../../types'
import { debtConverter } from '../converters'
import { commitFirestoreWrite, safeGetDoc, safeGetDocs } from '../../lib/firestoreOffline'
import {
  toTimestamp,
  serializePayment,
  serializeDebtEntry,
  findLegacyInitTransactionId,
  findLegacyPaymentTransactionId,
  checkDebtInitialTransactionExists,
  getOrCreateDebtCategory,
  type AddDebtOptions,
} from './typesAndHelpers'

export function subscribeDebts(
  uid: string,
  cb: (debts: Debt[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const q = query(colRef, orderBy('startDate', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data())
      cb(items)
    },
    (err) => {
      console.error('subscribeDebts error:', err)
      onError?.(err)
    }
  )
}

export async function addDebt(
  uid: string,
  debt: Omit<Debt, 'id' | 'paidFils' | 'settled' | 'payments' | 'createdAt'>,
  options?: AddDebtOptions
): Promise<string> {
  const personName = (debt.personName || '').trim()
  if (!personName || personName.length > 100) {
    throw new Error('اسم الشخص مطلوب ويجب ألا يتجاوز 100 حرف')
  }

  if (!Number.isInteger(debt.amountFils) || debt.amountFils <= 0) {
    throw new Error('المبلغ يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }
  if (debt.amountFils > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const debtsCol = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const debtDocRef = doc(debtsCol)
  const debtId = debtDocRef.id

  const defaultDebtNote = debt.type === 'lent' ? 'دين مستحق (لي)' : 'دين مستحق (عليّ)'
  const finalDebtNote = (typeof debt.note === 'string' && debt.note.trim() ? debt.note.trim() : defaultDebtNote).slice(0, 500)

  const initialPaid = options?.initialPaidFils && options.initialPaidFils > 0
    ? Math.min(debt.amountFils, Math.max(0, Math.round(options.initialPaidFils)))
    : 0

  const initialPaymentId = `p_init_${Date.now()}`
  const initialPaymentTxId = `debt_pay_${initialPaymentId}`
  const initialPaymentNote = (options?.initialPaymentNote?.trim() || 'سداد مسبق (توثيقي)').slice(0, 500)

  const initialPayments: DebtPayment[] = initialPaid > 0 ? [
    {
      id: initialPaymentId,
      amountFils: initialPaid,
      date: debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate),
      note: initialPaymentNote,
      ...(options?.syncTransaction ? { transactionId: initialPaymentTxId } : {}),
      createdAt: new Date(),
    }
  ] : []

  const paidFils = initialPaid
  const settled = paidFils === debt.amountFils

  const initialEntry: DebtEntry = {
    id: `entry_${debtId}`,
    amountFils: debt.amountFils,
    date: debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate),
    title: debt.type === 'lent' ? 'أصل السلفة / الدين' : 'أصل الدين المقترض',
    note: finalDebtNote,
    ...(options?.syncTransaction ? { transactionId: `debt_init_${debtId}` } : {}),
    createdAt: new Date(),
  }

  const debtData = {
    id: debtId,
    personName,
    type: debt.type,
    amountFils: debt.amountFils,
    paidFils,
    settled,
    startDate: debt.startDate,
    dueDate: debt.dueDate ?? null,
    note: finalDebtNote,
    payments: initialPayments,
    entries: [initialEntry],
    createdAt: new Date(),
  }

  const batch = writeBatch(db)
  batch.set(debtDocRef, debtData)

  if (options?.syncTransaction) {
    const txType: TxType = debt.type === 'lent' ? 'expense' : 'income'
    const categoryId = await getOrCreateDebtCategory(uid, txType)
    const txRef = doc(db, 'users', uid, 'transactions', `debt_init_${debtId}`)
    const title = (debt.type === 'lent' ? `إقراض: ${personName}` : `اقتراض من: ${personName}`).slice(0, 100)

    const txData: Record<string, unknown> = {
      type: txType,
      amountFils: debt.amountFils,
      categoryId,
      date: debt.startDate instanceof Date ? Timestamp.fromDate(debt.startDate) : debt.startDate,
      title,
      note: finalDebtNote,
      createdAt: serverTimestamp(),
    }
    batch.set(txRef, txData)

    if (initialPaid > 0) {
      const payTxType: TxType = debt.type === 'lent' ? 'income' : 'expense'
      const payCategoryId = await getOrCreateDebtCategory(uid, payTxType)
      const payTxRef = doc(db, 'users', uid, 'transactions', initialPaymentTxId)
      const payTitle = (debt.type === 'lent' ? `سداد دين: ${personName}` : `سداد دين: ${personName}`).slice(0, 100)

      const payTxData: Record<string, unknown> = {
        type: payTxType,
        amountFils: initialPaid,
        categoryId: payCategoryId,
        date: debt.startDate instanceof Date ? Timestamp.fromDate(debt.startDate) : debt.startDate,
        title: payTitle,
        note: options?.initialPaymentNote?.trim() || 'سداد مسبق',
        createdAt: serverTimestamp(),
      }
      batch.set(payTxRef, payTxData)
    }
  }

  await commitFirestoreWrite(batch.commit())
  return debtId
}

export async function updateDebt(
  uid: string,
  id: string,
  data: Partial<Omit<Debt, 'id' | 'createdAt'>>,
  options?: { syncTransaction?: boolean }
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'debts', id).withConverter(debtConverter)
  const debtSnap = await safeGetDoc(docRef)
  if (debtSnap && typeof debtSnap.exists === 'function' && !debtSnap.exists()) {
    throw new Error('الدين غير موجود')
  }
  const currentDebt = debtSnap.data()
  const currentPaidFils = currentDebt?.paidFils ? Math.round(Number(currentDebt.paidFils)) : 0
  const currentAmountFils = currentDebt?.amountFils ? Math.round(Number(currentDebt.amountFils)) : 0

  const effectivePaidFils = data.paidFils !== undefined ? Math.round(Number(data.paidFils)) : currentPaidFils
  const effectiveAmountFils = data.amountFils !== undefined ? Math.round(Number(data.amountFils)) : currentAmountFils

  if (data.amountFils !== undefined) {
    if (effectiveAmountFils < currentPaidFils) {
      throw new Error('لا يمكن أن يكون إجمالي الدين أقل من المبلغ المسدد بالفعل')
    }
    if (effectiveAmountFils > MAX_AMOUNT_FILS) {
      throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
    }
  }

  const updates: Record<string, unknown> = {}

  if (data.personName !== undefined) {
    updates.personName = data.personName.trim().slice(0, 100)
  }
  if (data.type !== undefined) {
    updates.type = data.type
    if (data.type !== currentDebt?.type) {
      if (
        (data.note === undefined || data.note.trim() === (currentDebt?.note || '').trim()) &&
        (currentDebt?.note === 'دين مستحق (لي)' || currentDebt?.note === 'دين مستحق (عليّ)')
      ) {
        updates.note = data.type === 'lent' ? 'دين مستحق (لي)' : 'دين مستحق (عليّ)'
      }
    }
  }
  if (data.startDate !== undefined) {
    updates.startDate = data.startDate instanceof Date ? Timestamp.fromDate(data.startDate) : data.startDate
  }
  if (data.dueDate !== undefined) {
    updates.dueDate = data.dueDate ? (data.dueDate instanceof Date ? Timestamp.fromDate(data.dueDate) : data.dueDate) : null
  }
  if (data.note !== undefined) {
    updates.note = data.note.slice(0, 500)
  }
  if (data.amountFils !== undefined) {
    updates.amountFils = effectiveAmountFils
  }
  if (data.paidFils !== undefined) {
    updates.paidFils = effectivePaidFils
  }
  if (data.payments !== undefined) {
    updates.payments = data.payments.map(serializePayment)
  }
  const currentEntries: DebtEntry[] = currentDebt?.entries || []
  let effectiveEntries: DebtEntry[] =
    data.entries !== undefined ? [...data.entries] : [...currentEntries]

  if (data.entries !== undefined) {
    updates.entries = data.entries.map(serializeDebtEntry)
  } else if (data.amountFils !== undefined && currentDebt?.entries && currentDebt.entries.length === 1) {
    const updatedSingleEntry: DebtEntry = {
      ...currentDebt.entries[0],
      amountFils: effectiveAmountFils,
    }
    effectiveEntries = [updatedSingleEntry]
    updates.entries = [serializeDebtEntry(updatedSingleEntry)]
  }

  // Always compute settled to satisfy firestore.rules:
  // data.settled == (data.paidFils == data.amountFils)
  const settled = effectivePaidFils === effectiveAmountFils
  updates.settled = settled

  // Synchronize with initial transaction debt_init_${id} or legacy initial transaction
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
  const initTxSnap = await safeGetDoc(initTxRef)
  let effectiveInitTxRef = initTxRef
  let initTxExists = Boolean(initTxSnap && typeof initTxSnap.exists === 'function' && initTxSnap.exists())

  if (!initTxExists && currentDebt) {
    const legacyInitId = await findLegacyInitTransactionId(uid, id, currentDebt)
    if (legacyInitId) {
      effectiveInitTxRef = doc(db, 'users', uid, 'transactions', legacyInitId)
      initTxExists = true
    }
  }

  if (options?.syncTransaction === false) {
    if (effectiveEntries.length > 0 && effectiveEntries[0].transactionId) {
      const { transactionId: _omitted, ...firstEntryWithoutTx } = effectiveEntries[0]
      effectiveEntries[0] = firstEntryWithoutTx
      updates.entries = effectiveEntries.map(serializeDebtEntry)
    }
  } else if (options?.syncTransaction === true && !initTxExists) {
    if (effectiveEntries.length > 0) {
      effectiveEntries[0] = {
        ...effectiveEntries[0],
        transactionId: `debt_init_${id}`,
      }
      updates.entries = effectiveEntries.map(serializeDebtEntry)
    }
  }

  const batch = writeBatch(db)
  batch.update(docRef, updates)

  if (options?.syncTransaction === false) {
    // Only delete the initial transaction; DO NOT delete payment transactions!
    if (initTxExists) {
      batch.delete(effectiveInitTxRef)
    }
  } else if (initTxExists) {
    const txUpdates: Record<string, unknown> = {}
    if (data.amountFils !== undefined || data.entries !== undefined) {
      txUpdates.amountFils =
        effectiveEntries.length > 1
          ? effectiveEntries[0].amountFils
          : effectiveAmountFils
    }
    if (data.startDate !== undefined) {
      txUpdates.date = data.startDate instanceof Date ? Timestamp.fromDate(data.startDate) : data.startDate
    }
    if (updates.note !== undefined && updates.note !== currentDebt?.note) {
      txUpdates.note = (updates.note as string).slice(0, 500)
    } else if (data.note !== undefined && data.note.trim() !== (currentDebt?.note || '').trim()) {
      txUpdates.note = data.note.slice(0, 500)
    }

    const effectiveType = data.type !== undefined ? data.type : (currentDebt?.type || 'lent')
    const name = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''

    if (data.personName !== undefined || data.type !== undefined) {
      txUpdates.title = (effectiveType === 'lent' ? `إقراض: ${name}` : `اقتراض من: ${name}`).slice(0, 100)
    }

    if (data.type !== undefined && data.type !== currentDebt?.type) {
      const newTxType: TxType = effectiveType === 'lent' ? 'expense' : 'income'
      const newCategoryId = await getOrCreateDebtCategory(uid, newTxType)
      txUpdates.type = newTxType
      txUpdates.categoryId = newCategoryId
    }

    if (Object.keys(txUpdates).length > 0) {
      batch.update(effectiveInitTxRef, txUpdates)
    }
  } else if (options?.syncTransaction === true) {
    // Transaction did not exist, but user enabled sync to link debt to balance
    const effectiveType = data.type !== undefined ? data.type : (currentDebt?.type || 'lent')
    const newTxType: TxType = effectiveType === 'lent' ? 'expense' : 'income'
    const newCategoryId = await getOrCreateDebtCategory(uid, newTxType)
    const name = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''
    const dateVal =
      data.startDate !== undefined ? toTimestamp(data.startDate) : toTimestamp(currentDebt?.startDate)
    const noteVal = (data.note !== undefined ? data.note : currentDebt?.note) || ''

    const initAmountFils =
      effectiveEntries.length > 1
        ? effectiveEntries[0].amountFils
        : effectiveAmountFils

    batch.set(initTxRef, {
      type: newTxType,
      amountFils: initAmountFils,
      categoryId: newCategoryId,
      title: (effectiveType === 'lent' ? `إقراض: ${name}` : `اقتراض من: ${name}`).slice(0, 100),
      note: noteVal.slice(0, 500),
      date: dateVal,
      createdAt: serverTimestamp(),
    })
  }

  // Synchronize all associated payment transactions if personName or type actually changed
  const nameChanged = data.personName !== undefined && data.personName.trim() !== currentDebt?.personName
  const typeChanged = data.type !== undefined && data.type !== currentDebt?.type

  if (nameChanged || typeChanged) {
    const effectiveType = data.type !== undefined ? data.type : (currentDebt?.type || 'lent')
    const effectivePersonName = (data.personName !== undefined ? data.personName.trim() : currentDebt?.personName) || ''
    const payments: DebtPayment[] = currentDebt?.payments || []

    if (payments.length > 0) {
      const payTxType: TxType = effectiveType === 'lent' ? 'income' : 'expense'
      let newPayCatId: string | undefined
      if (typeChanged) {
        newPayCatId = await getOrCreateDebtCategory(uid, payTxType)
      }

      const resolvedPaymentUpdates = await Promise.all(
        payments.map(async (p) => {
          if (!p.id) return []
          const results: { ref: DocumentReference; updates: Record<string, unknown> }[] = []

          let payTxRef: DocumentReference | null = null
          let payTxSnap: DocumentSnapshot | null = null

          const candidateIds = [p.transactionId, `debt_pay_${p.id}`].filter(Boolean) as string[]
          for (const cId of candidateIds) {
            const candidateRef = doc(db, 'users', uid, 'transactions', cId)
            const snap = await safeGetDoc(candidateRef)
            if (snap.exists()) {
              payTxRef = candidateRef
              payTxSnap = snap
              break
            }
          }

          if (!payTxRef && currentDebt) {
            const legacyTxId = await findLegacyPaymentTransactionId(uid, id, currentDebt, p)
            if (legacyTxId) {
              const legRef = doc(db, 'users', uid, 'transactions', legacyTxId)
              const snap = await safeGetDoc(legRef)
              if (snap.exists()) {
                payTxRef = legRef
                payTxSnap = snap
              }
            }
          }

          const payTxUpdates: Record<string, unknown> = {
            title: (
              effectiveType === 'lent'
                ? `استرداد دفعة دين: ${effectivePersonName}`
                : `سداد دفعة دين: ${effectivePersonName}`
            ).slice(0, 100),
          }
          if (typeChanged) {
            payTxUpdates.type = payTxType
            if (newPayCatId) {
              payTxUpdates.categoryId = newPayCatId
            }
          }
          const defaultNotes = ['دفعة استرداد دين', 'دفعة سداد دين', 'دفعة سداد']
          const hasCustomNote = p.note && !defaultNotes.includes(p.note.trim())
          if (hasCustomNote) {
            payTxUpdates.note = p.note!.trim().slice(0, 500)
          } else if (typeChanged) {
            payTxUpdates.note = effectiveType === 'lent' ? 'دفعة استرداد دين' : 'دفعة سداد دين'
          }

          if (payTxRef && payTxSnap && payTxSnap.exists()) {
            results.push({ ref: payTxRef, updates: payTxUpdates })
          }

          if (Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.length > 0) {
            const mergedResults = await Promise.all(
              p.mergedTransactionIds.map(async (mergedTxId) => {
                if (!mergedTxId) return null
                const mergedRef = doc(db, 'users', uid, 'transactions', mergedTxId)
                const mergedSnap = await safeGetDoc(mergedRef)
                if (mergedSnap.exists()) {
                  return { ref: mergedRef, updates: payTxUpdates }
                }
                return null
              })
            )
            for (const item of mergedResults) {
              if (item) results.push(item)
            }
          }

          return results
        })
      )

      for (const paymentResults of resolvedPaymentUpdates) {
        for (const item of paymentResults) {
          batch.update(item.ref, item.updates)
        }
      }
    }

    // Synchronize all associated debt entries transactions (excluding initial debt_init_${id})
    const entries: DebtEntry[] = currentDebt?.entries || []
    if (entries.length > 0) {
      const entryTxType: TxType = effectiveType === 'lent' ? 'expense' : 'income'
      let newEntryCatId: string | undefined
      if (typeChanged) {
        newEntryCatId = await getOrCreateDebtCategory(uid, entryTxType)
      }

      const resolvedEntryUpdates = await Promise.all(
        entries.map(async (e) => {
          if (!e.id) return null
          const candidateIds = [e.transactionId, `debt_entry_${e.id}`].filter(Boolean) as string[]
          // Skip debt_init_${id} since it was already handled above
          const filteredCandidateIds = candidateIds.filter((cId) => cId !== `debt_init_${id}`)
          if (filteredCandidateIds.length === 0) return null

          let entryTxRef: DocumentReference | null = null
          for (const cId of filteredCandidateIds) {
            const candidateRef = doc(db, 'users', uid, 'transactions', cId)
            const snap = await safeGetDoc(candidateRef)
            if (snap.exists()) {
              entryTxRef = candidateRef
              break
            }
          }

          if (entryTxRef) {
            const entryTxUpdates: Record<string, unknown> = {}
            if (nameChanged || typeChanged) {
              entryTxUpdates.title = (
                effectiveType === 'lent'
                  ? `سلفة إضافية: ${effectivePersonName}`
                  : `اقتراض إضافي من: ${effectivePersonName}`
              ).slice(0, 100)
            }
            if (typeChanged) {
              entryTxUpdates.type = entryTxType
              if (newEntryCatId) {
                entryTxUpdates.categoryId = newEntryCatId
              }
            }
            return { ref: entryTxRef, updates: entryTxUpdates }
          }
          return null
        })
      )

      for (const item of resolvedEntryUpdates) {
        if (item) {
          batch.update(item.ref, item.updates)
        }
      }
    }
  }

  await commitFirestoreWrite(batch.commit())
}

export async function deleteDebt(
  uid: string,
  id: string,
  optionsOrFlag?: { deleteTransactions?: boolean } | boolean
): Promise<void> {
  const debtRef = doc(db, 'users', uid, 'debts', id).withConverter(debtConverter)
  const snap = await safeGetDoc(debtRef)
  const debt = snap.data()
  const payments: DebtPayment[] = debt?.payments || []

  const refsToDelete: DocumentReference[] = [debtRef]
  const seenPaths = new Set<string>([debtRef.path])
  const addRefToDelete = (ref: DocumentReference) => {
    if (!seenPaths.has(ref.path)) {
      seenPaths.add(ref.path)
      refsToDelete.push(ref)
    }
  }

  const shouldDeleteTransactions =
    typeof optionsOrFlag === 'boolean'
      ? optionsOrFlag
      : (optionsOrFlag?.deleteTransactions ?? false)

  if (shouldDeleteTransactions) {
    // Synchronize: Delete initial transaction (deterministic and legacy)
    const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
    addRefToDelete(initTxRef)
    if (debt) {
      const legacyInitId = await findLegacyInitTransactionId(uid, id, debt)
      if (legacyInitId && legacyInitId !== `debt_init_${id}`) {
        addRefToDelete(doc(db, 'users', uid, 'transactions', legacyInitId))
      }
    }

    // Synchronize: Delete all payment transactions
    for (const p of payments) {
      if (p.transactionId) {
        addRefToDelete(doc(db, 'users', uid, 'transactions', p.transactionId))
      }
      if (p.id && p.id !== p.transactionId && !p.isMerged && !p.id.startsWith('compacted_')) {
        const payTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${p.id}`)
        addRefToDelete(payTxRef)
      }
      if (Array.isArray(p.mergedTransactionIds)) {
        for (const mId of p.mergedTransactionIds) {
          if (mId) {
            addRefToDelete(doc(db, 'users', uid, 'transactions', mId))
          }
        }
      }
      if (debt) {
        const legacyPayId = await findLegacyPaymentTransactionId(uid, p, debt)
        if (legacyPayId && legacyPayId !== p.transactionId && legacyPayId !== `debt_pay_${p.id}`) {
          addRefToDelete(doc(db, 'users', uid, 'transactions', legacyPayId))
        }
      }
    }

    // Synchronize: Delete all entry transactions
    for (const e of debt?.entries || []) {
      if (e.transactionId) {
        addRefToDelete(doc(db, 'users', uid, 'transactions', e.transactionId))
      } else if (e.id && !e.isMerged && !e.id.startsWith('compacted_entry_')) {
        addRefToDelete(doc(db, 'users', uid, 'transactions', `debt_entry_${e.id}`))
      }
      if (Array.isArray(e.mergedTransactionIds)) {
        for (const mId of e.mergedTransactionIds) {
          if (mId) {
            addRefToDelete(doc(db, 'users', uid, 'transactions', mId))
          }
        }
      }
    }
  }

  if (refsToDelete.length <= 450) {
    const batch = writeBatch(db)
    for (const ref of refsToDelete) {
      batch.delete(ref)
    }
    await commitFirestoreWrite(batch.commit())
  } else {
    for (let i = 0; i < refsToDelete.length; i += 450) {
      const chunk = refsToDelete.slice(i, i + 450)
      const batch = writeBatch(db)
      for (const ref of chunk) {
        batch.delete(ref)
      }
      await commitFirestoreWrite(batch.commit())
    }
  }
}

export async function getAllDebts(uid: string): Promise<Debt[]> {
  const colRef = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const q = query(colRef, orderBy('startDate', 'desc'))
  const snap = await safeGetDocs(q)
  return snap.docs.map((d) => d.data())
}

export async function addDebtEntry(
  uid: string,
  debt: Debt,
  entry: {
    amountFils: number
    date: Date
    title?: string
    note?: string
  },
  options?: { syncTransaction?: boolean }
): Promise<string> {
  if (!Number.isInteger(entry.amountFils) || entry.amountFils <= 0) {
    throw new Error('مبلغ السلفة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }
  if (entry.amountFils > MAX_AMOUNT_FILS || debt.amountFils + entry.amountFils > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }
  if ((debt.entries || []).length >= 100) {
    throw new Error('تم الوصول للحد الأقصى لعدد السلف (100 سلفة) لهذا السجل')
  }

  const entryId = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const hasEntries = Array.isArray(debt.entries) && debt.entries.length > 0
  let existingEntries: DebtEntry[]
  if (hasEntries) {
    existingEntries = [...debt.entries!]
  } else {
    const hasInitTx = await checkDebtInitialTransactionExists(uid, debt.id, debt)
    existingEntries = [
      {
        id: `entry_base_${debt.id}`,
        amountFils: debt.amountFils,
        date: debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate),
        title: 'أصل الدين الأول',
        note: debt.note || '',
        transactionId: hasInitTx ? `debt_init_${debt.id}` : undefined,
        createdAt: debt.createdAt instanceof Date ? debt.createdAt : new Date(debt.createdAt || debt.startDate),
      },
    ]
  }

  let txId: string | undefined
  const batch = writeBatch(db)

  if (options?.syncTransaction) {
    txId = `debt_entry_${entryId}`
    const txType: TxType = debt.type === 'lent' ? 'expense' : 'income'
    const categoryId = await getOrCreateDebtCategory(uid, txType)
    const txRef = doc(db, 'users', uid, 'transactions', txId)
    const customTitle = entry.title?.trim()
    const title = (
      customTitle
        ? `${customTitle} - ${debt.personName}`
        : (debt.type === 'lent' ? `سلفة إضافية: ${debt.personName}` : `اقتراض إضافي من: ${debt.personName}`)
    ).slice(0, 100)

    const txData: Record<string, unknown> = {
      type: txType,
      amountFils: entry.amountFils,
      categoryId,
      date: entry.date instanceof Date ? Timestamp.fromDate(entry.date) : entry.date,
      title,
      note: (entry.note?.trim() || (entry.title?.trim() ? `سلفة إضافية: ${entry.title.trim()}` : 'سلفة إضافية')).slice(0, 500),
      createdAt: serverTimestamp(),
    }
    batch.set(txRef, txData)
  }

  const newEntry: DebtEntry = {
    id: entryId,
    amountFils: entry.amountFils,
    date: entry.date,
    title: entry.title?.trim() || undefined,
    note: entry.note?.trim() || '',
    transactionId: txId,
    createdAt: new Date(),
  }

  const newEntries = [...existingEntries, newEntry]
  const newAmountFils = debt.amountFils + entry.amountFils
  const paidFils = debt.paidFils || 0
  const settled = paidFils === newAmountFils

  const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date)
  const currentStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const isOlderDate = entryDate.getTime() < currentStartDate.getTime()

  const debtRef = doc(db, 'users', uid, 'debts', debt.id).withConverter(debtConverter)
  const debtUpdateData: Record<string, unknown> = {
    amountFils: newAmountFils,
    settled,
    entries: newEntries.map(serializeDebtEntry),
  }
  if (isOlderDate) {
    debtUpdateData.startDate = Timestamp.fromDate(entryDate)
  }
  batch.update(debtRef, debtUpdateData)

  await commitFirestoreWrite(batch.commit())
  return entryId
}

export async function updateDebtEntry(
  uid: string,
  debt: Debt,
  entryId: string,
  updated: {
    amountFils: number
    date: Date
    title?: string
    note?: string
  }
): Promise<void> {
  if (!Number.isInteger(updated.amountFils) || updated.amountFils <= 0) {
    throw new Error('مبلغ السلفة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }
  if (updated.amountFils > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  const entries = debt.entries || []
  const entryIndex = entries.findIndex((e) => e.id === entryId)
  if (entryIndex === -1) {
    throw new Error('السلفة المحددة غير موجودة')
  }

  const oldEntry = entries[entryIndex]
  const diff = updated.amountFils - oldEntry.amountFils
  const newAmountFils = debt.amountFils + diff

  if (newAmountFils > MAX_AMOUNT_FILS) {
    throw new Error('المبلغ يتجاوز الحد الأقصى المسموح به')
  }

  if (newAmountFils < (debt.paidFils || 0)) {
    throw new Error('لا يمكن تقليص مبلغ السلفة لأن إجمالي الدين سيصبح أقل من المبالغ المسددة فعلياً')
  }

  const batch = writeBatch(db)

  const candidateTxId =
    oldEntry.transactionId ||
    (entryIndex === 0 ? `debt_init_${debt.id}` : `debt_entry_${oldEntry.id}`)

  const txRef = doc(db, 'users', uid, 'transactions', candidateTxId)
  const txSnap = await safeGetDoc(txRef)
  const txExists = Boolean(txSnap && typeof txSnap.exists === 'function' && txSnap.exists())

  const customTitle = updated.title?.trim()
  const formattedTitle = (
    entryIndex === 0
      ? (customTitle
          ? `${customTitle} - ${debt.personName}`
          : (debt.type === 'lent' ? `إقراض: ${debt.personName}` : `اقتراض من: ${debt.personName}`))
      : (customTitle
          ? `${customTitle} - ${debt.personName}`
          : (debt.type === 'lent' ? `سلفة إضافية: ${debt.personName}` : `اقتراض إضافي من: ${debt.personName}`))
  ).slice(0, 100)

  if (txExists) {
    batch.update(txRef, {
      amountFils: updated.amountFils,
      date: updated.date instanceof Date ? Timestamp.fromDate(updated.date) : updated.date,
      title: formattedTitle,
      note: (updated.note?.trim() || '').slice(0, 500),
    })
  }

  const newEntries = [...entries]
  newEntries[entryIndex] = {
    ...oldEntry,
    amountFils: updated.amountFils,
    date: updated.date,
    title: updated.title?.trim() || undefined,
    note: updated.note?.trim() || '',
    ...(txExists ? { transactionId: candidateTxId } : {}),
  }
  if (!txExists && !oldEntry.transactionId) {
    delete newEntries[entryIndex].transactionId
  }

  // Calculate the earliest date among entries to keep debt startDate synchronized
  let earliestEntryDate = new Date(newEntries[0].date)
  for (const e of newEntries) {
    const eDate = e.date instanceof Date ? e.date : new Date(e.date)
    if (eDate.getTime() < earliestEntryDate.getTime()) {
      earliestEntryDate = eDate
    }
  }

  const currentDebtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const shouldUpdateStartDate = earliestEntryDate.getTime() !== currentDebtStartDate.getTime()

  const settled = (debt.paidFils || 0) === newAmountFils
  const debtRef = doc(db, 'users', uid, 'debts', debt.id).withConverter(debtConverter)
  batch.update(debtRef, {
    amountFils: newAmountFils,
    settled,
    entries: newEntries.map(serializeDebtEntry),
    ...(shouldUpdateStartDate ? { startDate: toTimestamp(earliestEntryDate) } : {}),
  })

  await commitFirestoreWrite(batch.commit())
}

export async function deleteDebtEntry(
  uid: string,
  debt: Debt,
  entryId: string
): Promise<void> {
  const entries = debt.entries || []
  const targetEntry = entries.find((e) => e.id === entryId)
  if (!targetEntry) {
    throw new Error('السلفة المحددة غير موجودة')
  }

  const newAmountFils = debt.amountFils - targetEntry.amountFils
  if (newAmountFils < (debt.paidFils || 0)) {
    throw new Error('لا يمكن حذف هذه السلفة لأن إجمالي الدين سيصبح أقل من المبلغ المسدد فعلياً')
  }

  if (newAmountFils <= 0) {
    throw new Error('لا يمكن حذف السلفة الأساسية الوحيدة للدين. يمكنك حذف الدين بالكامل بدلاً من ذلك')
  }

  const batch = writeBatch(db)

  if (targetEntry.transactionId) {
    const txRef = doc(db, 'users', uid, 'transactions', targetEntry.transactionId)
    batch.delete(txRef)
  }
  if (Array.isArray(targetEntry.mergedTransactionIds)) {
    for (const mId of targetEntry.mergedTransactionIds) {
      if (mId) {
        const mTxRef = doc(db, 'users', uid, 'transactions', mId)
        batch.delete(mTxRef)
      }
    }
  }

  const newEntries = entries.filter((e) => e.id !== entryId)
  const settled = (debt.paidFils || 0) === newAmountFils

  let earliestEntryDate = newEntries.length > 0 ? new Date(newEntries[0].date) : null
  if (earliestEntryDate) {
    for (const e of newEntries) {
      const eDate = e.date instanceof Date ? e.date : new Date(e.date)
      if (eDate.getTime() < earliestEntryDate.getTime()) {
        earliestEntryDate = eDate
      }
    }
  }

  const currentDebtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const shouldUpdateStartDate =
    earliestEntryDate !== null && earliestEntryDate.getTime() !== currentDebtStartDate.getTime()

  const debtRef = doc(db, 'users', uid, 'debts', debt.id).withConverter(debtConverter)
  batch.update(debtRef, {
    amountFils: newAmountFils,
    settled,
    entries: newEntries.map(serializeDebtEntry),
    ...(shouldUpdateStartDate ? { startDate: toTimestamp(earliestEntryDate) } : {}),
  })

  await commitFirestoreWrite(batch.commit())
}
