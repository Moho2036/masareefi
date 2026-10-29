import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
  type DocumentReference,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Debt, DebtPayment, DebtEntry, TxType } from '../types'
import { debtConverter, categoryConverter } from './converters'

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

/**
 * Resolves or creates a suitable category for debt transactions.
 * Expense: looks for 'الديون والسلف' or 'سداد الديون والأقساط', then 'أخرى', otherwise creates 'الديون والسلف'.
 * Income: looks for 'الديون والسلف' or 'سداد الديون والأقساط', then 'أخرى', otherwise creates 'الديون والسلف'.
 */
export async function getOrCreateDebtCategory(
  uid: string,
  type: TxType
): Promise<string> {
  const colRef = collection(db, 'users', uid, 'categories').withConverter(categoryConverter)
  const snap = await getDocs(colRef)
  const categories = snap.docs.map((d) => d.data())

  if (type === 'expense') {
    const debtCat = categories.find(
      (c) => c.type === 'expense' && !c.archived && (c.name === 'الديون والسلف' || c.name === 'سداد الديون والأقساط')
    )
    if (debtCat) return debtCat.id

    const otherCat = categories.find(
      (c) => c.type === 'expense' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    try {
      const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
      await setDoc(newDocRef, {
        id: '',
        name: 'الديون والسلف',
        type: 'expense',
        icon: '💳',
        color: '#D97706',
        archived: false,
        order: 0,
      })
      return newDocRef.id
    } catch (err) {
      console.error('Failed to create expense debt category:', err)
      const anyCat = categories.find((c) => c.type === 'expense' && !c.archived)
      if (anyCat) return anyCat.id
      throw err
    }
  } else {
    const debtCat = categories.find(
      (c) => c.type === 'income' && !c.archived && (c.name === 'الديون والسلف' || c.name === 'سداد الديون والأقساط')
    )
    if (debtCat) return debtCat.id

    const otherCat = categories.find(
      (c) => c.type === 'income' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    try {
      const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
      await setDoc(newDocRef, {
        id: '',
        name: 'الديون والسلف',
        type: 'income',
        icon: '💳',
        color: '#10B981',
        archived: false,
        order: 0,
      })
      return newDocRef.id
    } catch (err) {
      console.error('Failed to create income debt category:', err)
      const anyCat = categories.find((c) => c.type === 'income' && !c.archived)
      if (anyCat) return anyCat.id
      throw err
    }
  }
}

export interface AddDebtOptions {
  syncTransaction?: boolean
  initialPaidFils?: number
  initialPaymentNote?: string
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

  const debtsCol = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const debtDocRef = doc(debtsCol)
  const debtId = debtDocRef.id

  const defaultDebtNote = debt.type === 'lent' ? 'دين مستحق (لي)' : 'دين مستحق (عليّ)'
  const finalDebtNote = (typeof debt.note === 'string' && debt.note.trim() ? debt.note.trim() : defaultDebtNote).slice(0, 500)

  const initialPaid = options?.initialPaidFils && options.initialPaidFils > 0
    ? Math.min(debt.amountFils, Math.max(0, Math.round(options.initialPaidFils)))
    : 0

  const initialPayments: DebtPayment[] = initialPaid > 0 ? [
    {
      id: `p_init_${Date.now()}`,
      amountFils: initialPaid,
      date: debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate),
      note: (options?.initialPaymentNote?.trim() || 'سداد مسبق (توثيقي)').slice(0, 500),
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
  }

  await batch.commit()
  return debtId
}

function toTimestamp(d: unknown): Timestamp {
  if (typeof Timestamp === 'function' && d instanceof Timestamp) return d
  if (d instanceof Date) return Timestamp.fromDate(d)
  if (
    d &&
    typeof d === 'object' &&
    'toDate' in d &&
    typeof (d as { toDate: () => Date }).toDate === 'function'
  ) {
    return Timestamp.fromDate((d as { toDate: () => Date }).toDate())
  }
  if (d && typeof d === 'object' && 'seconds' in d) {
    return d as Timestamp
  }
  return Timestamp.fromDate(new Date())
}

function serializePayment(p: DebtPayment): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: p.id,
    amountFils: Math.round(Number(p.amountFils)),
    date: toTimestamp(p.date),
    createdAt: toTimestamp(p.createdAt),
  }
  if (p.note && typeof p.note === 'string' && p.note.trim()) {
    item.note = p.note.trim().slice(0, 500)
  } else {
    item.note = 'دفعة سداد'
  }
  if (p.transactionId && typeof p.transactionId === 'string' && p.transactionId.trim()) {
    item.transactionId = p.transactionId.trim()
  }
  if (p.isMerged) {
    item.isMerged = true
  }
  if (Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.length > 0) {
    item.mergedTransactionIds = p.mergedTransactionIds.filter(Boolean)
  }
  return item
}

function serializeDebtEntry(e: DebtEntry): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: e.id,
    amountFils: Math.round(Number(e.amountFils)),
    date: toTimestamp(e.date),
    note: typeof e.note === 'string' ? e.note.slice(0, 500) : '',
    createdAt: toTimestamp(e.createdAt),
  }
  if (e.title && typeof e.title === 'string' && e.title.trim()) {
    item.title = e.title.trim().slice(0, 100)
  }
  if (e.transactionId && typeof e.transactionId === 'string' && e.transactionId.trim()) {
    item.transactionId = e.transactionId.trim().slice(0, 128)
  }
  return item
}

async function findLegacyInitTransactionId(
  uid: string,
  _debtId: string,
  debt: Debt
): Promise<string | null> {
  try {
    const txColRef = collection(db, 'users', uid, 'transactions')
    const q = query(txColRef, where('amountFils', '==', debt.amountFils))
    const snap = await getDocs(q)
    if (!snap || !snap.docs || snap.docs.length === 0) return null

    const dDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
    const dTime = dDate.getTime()

    for (const d of snap.docs) {
      if (
        typeof d?.id === 'string' &&
        (d.id.startsWith('debt_pay_') || (d.id.startsWith('debt_init_') && d.id !== 'debt_init_' + _debtId))
      ) {
        continue
      }
      const tx = typeof d?.data === 'function' ? d.data() : (d as unknown as Record<string, unknown>)
      if (!tx || Boolean(tx.recurringId)) continue
      const txDate =
        tx.date && typeof (tx.date as { toDate?: unknown }).toDate === 'function'
          ? (tx.date as { toDate: () => Date }).toDate()
          : new Date(tx.date as string | number | Date)
      const dayDiff = Math.abs(txDate.getTime() - dTime)
      const isSameDay = dayDiff < 24 * 60 * 60 * 1000

      const titleMatches =
        typeof tx.title === 'string' &&
        (tx.title.includes(debt.personName) ||
          tx.title.includes('إقراض') ||
          tx.title.includes('اقتراض') ||
          tx.title.includes('دين'))

      if (isSameDay && titleMatches) {
        return d.id
      }
    }
  } catch (err) {
    console.error('Error querying legacy init transaction:', err)
  }
  return null
}

export async function checkDebtInitialTransactionExists(
  uid: string,
  debtId: string,
  debt?: Debt
): Promise<boolean> {
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${debtId}`)
  const snap = await getDoc(initTxRef)
  if (snap && typeof snap.exists === 'function' && snap.exists()) return true
  if (debt) {
    const legacyId = await findLegacyInitTransactionId(uid, debtId, debt)
    return Boolean(legacyId)
  }
  return false
}

export async function checkDebtPaymentTransactionExists(
  uid: string,
  debt: Debt,
  payment: DebtPayment
): Promise<boolean> {
  if (payment.transactionId) {
    const txRef = doc(db, 'users', uid, 'transactions', payment.transactionId)
    const snap = await getDoc(txRef)
    if (snap && typeof snap.exists === 'function' && snap.exists()) return true
  }
  const defaultPayTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${payment.id}`)
  const defaultSnap = await getDoc(defaultPayTxRef)
  if (defaultSnap && typeof defaultSnap.exists === 'function' && defaultSnap.exists()) return true

  const legacyId = await findLegacyPaymentTransactionId(uid, payment, debt)
  return Boolean(legacyId)
}

export async function updateDebt(
  uid: string,
  id: string,
  data: Partial<Omit<Debt, 'id' | 'createdAt'>>,
  options?: { syncTransaction?: boolean }
): Promise<void> {
  const docRef = doc(db, 'users', uid, 'debts', id).withConverter(debtConverter)
  const debtSnap = await getDoc(docRef)
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
  if (data.entries !== undefined) {
    updates.entries = data.entries.map(serializeDebtEntry)
  }

  // Always compute settled to satisfy firestore.rules:
  // data.settled == (data.paidFils == data.amountFils)
  const settled = effectivePaidFils === effectiveAmountFils
  updates.settled = settled

  const batch = writeBatch(db)
  batch.update(docRef, updates)

  // Synchronize with initial transaction debt_init_${id} or legacy initial transaction
  const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
  const initTxSnap = await getDoc(initTxRef)
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
    // Only delete the initial transaction; DO NOT delete payment transactions!
    if (initTxExists) {
      batch.delete(effectiveInitTxRef)
    }
  } else if (initTxExists) {
    const txUpdates: Record<string, unknown> = {}
    if (data.amountFils !== undefined) {
      txUpdates.amountFils = Math.round(Number(data.amountFils))
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

    batch.set(initTxRef, {
      type: newTxType,
      amountFils: effectiveAmountFils,
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

      for (const p of payments) {
        if (!p.id) continue
        let payTxRef: DocumentReference | null = null
        let payTxSnap: DocumentSnapshot | null = null

        const candidateIds = [p.transactionId, `debt_pay_${p.id}`].filter(Boolean) as string[]
        for (const cId of candidateIds) {
          const candidateRef = doc(db, 'users', uid, 'transactions', cId)
          const snap = await getDoc(candidateRef)
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
            const snap = await getDoc(legRef)
            if (snap.exists()) {
              payTxRef = legRef
              payTxSnap = snap
            }
          }
        }

        if (payTxRef && payTxSnap && payTxSnap.exists()) {
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
          batch.update(payTxRef, payTxUpdates)
        }

        if (Array.isArray(p.mergedTransactionIds) && p.mergedTransactionIds.length > 0) {
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
          for (const mergedTxId of p.mergedTransactionIds) {
            if (!mergedTxId) continue
            const mergedRef = doc(db, 'users', uid, 'transactions', mergedTxId)
            const mergedSnap = await getDoc(mergedRef)
            if (mergedSnap.exists()) {
              batch.update(mergedRef, payTxUpdates)
            }
          }
        }
      }
    }
  }

  await batch.commit()
}

export async function deleteDebt(
  uid: string,
  id: string,
  optionsOrFlag?: { deleteTransactions?: boolean } | boolean
): Promise<void> {
  const debtRef = doc(db, 'users', uid, 'debts', id).withConverter(debtConverter)
  const snap = await getDoc(debtRef)
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
      } else if (e.id) {
        addRefToDelete(doc(db, 'users', uid, 'transactions', `debt_entry_${e.id}`))
      }
    }
  }

  if (refsToDelete.length <= 450) {
    const batch = writeBatch(db)
    for (const ref of refsToDelete) {
      batch.delete(ref)
    }
    await batch.commit()
  } else {
    for (let i = 0; i < refsToDelete.length; i += 450) {
      const chunk = refsToDelete.slice(i, i + 450)
      const batch = writeBatch(db)
      for (const ref of chunk) {
        batch.delete(ref)
      }
      await batch.commit()
    }
  }
}

function generatePaymentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface AddPaymentOptions {
  syncTransaction?: boolean
}

export async function addDebtPayment(
  uid: string,
  debt: Debt,
  payment: { amountFils: number; date: Date; note?: string },
  options?: AddPaymentOptions
): Promise<string> {
  if ((debt.payments || []).length >= 100) {
    throw new Error('تم الوصول للحد الأقصى لعدد الدفعات (100 دفعة) لهذا الدين')
  }

  const amount = Math.round(Number(payment.amountFils))
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }

  const remaining = Math.max(0, debt.amountFils - (debt.paidFils || 0))
  if (amount > remaining) {
    throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
  }

  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date)
  const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
  const paymentDay = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate(), 0, 0, 0, 0)
  if (paymentDay < debtStartDay) {
    throw new Error('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
  }

  const paymentId = generatePaymentId()
  const defaultPaymentNote = debt.type === 'lent' ? 'دفعة استرداد دين' : 'دفعة سداد دين'
  const finalPaymentNote = (payment.note?.trim() || defaultPaymentNote).slice(0, 500)
  const txId = `debt_pay_${paymentId}`

  const newPayment: DebtPayment = {
    id: paymentId,
    amountFils: amount,
    date: payment.date,
    note: finalPaymentNote,
    transactionId: options?.syncTransaction ? txId : undefined,
    createdAt: new Date(),
  }

  const updatedPayments = [...(debt.payments || []), newPayment]
  const newPaidFils = (debt.paidFils || 0) + amount
  const newSettled = newPaidFils === debt.amountFils

  const batch = writeBatch(db)
  const debtRef = doc(db, 'users', uid, 'debts', debt.id)

  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  if (options?.syncTransaction) {
    // If lent (recovering money): transaction is income
    // If borrowed (paying back debt): transaction is expense
    const txType: TxType = debt.type === 'lent' ? 'income' : 'expense'
    const categoryId = await getOrCreateDebtCategory(uid, txType)
    const title = (
      debt.type === 'lent'
        ? `استرداد دفعة دين: ${debt.personName}`
        : `سداد دفعة دين: ${debt.personName}`
    ).slice(0, 100)

    const txRef = doc(db, 'users', uid, 'transactions', txId)
    const txData: Record<string, unknown> = {
      type: txType,
      amountFils: amount,
      categoryId,
      date: payment.date instanceof Date ? Timestamp.fromDate(payment.date) : payment.date,
      title,
      note: finalPaymentNote,
      createdAt: serverTimestamp(),
    }
    batch.set(txRef, txData)
  }

  await batch.commit()
  return paymentId
}

async function findLegacyPaymentTransactionId(
  uid: string,
  debtIdOrPayment: string | DebtPayment,
  debtOrCurrentDebt: Debt,
  paymentParam?: DebtPayment
): Promise<string | null> {
  try {
    const debt = debtOrCurrentDebt
    const payment = typeof debtIdOrPayment === 'string' ? paymentParam! : debtIdOrPayment
    if (!payment) return null

    const otherPaymentTxIds = new Set<string>()
    for (const otherP of debt.payments || []) {
      if (otherP.id !== payment.id) {
        if (otherP.transactionId) otherPaymentTxIds.add(otherP.transactionId)
        otherPaymentTxIds.add(`debt_pay_${otherP.id}`)
        if (Array.isArray(otherP.mergedTransactionIds)) {
          for (const mId of otherP.mergedTransactionIds) {
            if (mId) otherPaymentTxIds.add(mId)
          }
        }
      }
    }

    const txColRef = collection(db, 'users', uid, 'transactions')
    const q = query(txColRef, where('amountFils', '==', payment.amountFils))
    const snap = await getDocs(q)
    if (!snap || !snap.docs || snap.docs.length === 0) return null

    const pDate = payment.date instanceof Date ? payment.date : new Date(payment.date)
    const pTime = pDate.getTime()

    for (const d of snap.docs) {
      if (
        typeof d?.id === 'string' &&
        (d.id.startsWith('debt_init_') ||
          otherPaymentTxIds.has(d.id) ||
          (d.id.startsWith('debt_pay_') && d.id !== `debt_pay_${payment.id}`))
      ) {
        continue
      }
      const tx = typeof d?.data === 'function' ? d.data() : (d as unknown as Record<string, unknown>)
      if (!tx || Boolean(tx.recurringId)) continue
      const txDate =
        tx.date && typeof (tx.date as { toDate?: unknown }).toDate === 'function'
          ? (tx.date as { toDate: () => Date }).toDate()
          : new Date(tx.date as string | number | Date)
      const dayDiff = Math.abs(txDate.getTime() - pTime)
      const isSameDay = dayDiff < 24 * 60 * 60 * 1000

      const titleMatches =
        typeof tx.title === 'string' &&
        (tx.title.includes(debt.personName) ||
          tx.title.includes('دين') ||
          tx.title.includes('سداد') ||
          tx.title.includes('تحصيل') ||
          tx.title.includes('استرداد'))

      const genericDefaultNotes = ['دفعة استرداد دين', 'دفعة سداد دين', 'دفعة سداد']
      const isGenericDefaultNote =
        typeof payment.note === 'string' && genericDefaultNotes.includes(payment.note.trim())

      const rawNoteMatches = Boolean(
        payment.note && typeof tx.note === 'string' && tx.note.includes(payment.note)
      )
      const noteMatches = isGenericDefaultNote ? rawNoteMatches && titleMatches : rawNoteMatches

      if (isSameDay && (titleMatches || noteMatches)) {
        return d.id
      }
    }
  } catch (err) {
    console.error('Error querying legacy payment transaction:', err)
  }
  return null
}

export interface DeletePaymentOptions {
  deleteTransaction?: boolean
}

export async function deleteDebtPayment(
  uid: string,
  debt: Debt,
  paymentId: string,
  options?: DeletePaymentOptions
): Promise<void> {
  const targetPayment = (debt.payments || []).find((p) => p.id === paymentId)
  const updatedPayments = (debt.payments || []).filter((p) => p.id !== paymentId)

  const previousPaymentsSum = (debt.payments || []).reduce((acc, p) => acc + p.amountFils, 0)
  const untrackedPaidFils = Math.max(0, (debt.paidFils || 0) - previousPaymentsSum)
  const updatedPaymentsTotal = updatedPayments.reduce((sum, p) => sum + p.amountFils, 0)
  const newPaidFils = Math.min(debt.amountFils, untrackedPaidFils + updatedPaymentsTotal)
  const newSettled = newPaidFils === debt.amountFils

  const batch = writeBatch(db)
  const debtRef = doc(db, 'users', uid, 'debts', debt.id)

  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  // Synchronize: Delete payment transaction if options?.deleteTransaction !== false
  if (options?.deleteTransaction !== false) {
    const isMerged = Boolean(targetPayment?.isMerged || paymentId.startsWith('compacted_'))
    const txId = targetPayment?.transactionId || `debt_pay_${paymentId}`

    if (targetPayment?.transactionId || (!isMerged && !paymentId.startsWith('compacted_'))) {
      const payTxRef = doc(db, 'users', uid, 'transactions', txId)
      batch.delete(payTxRef)
    }

    if (Array.isArray(targetPayment?.mergedTransactionIds)) {
      for (const mId of targetPayment.mergedTransactionIds) {
        if (mId) {
          batch.delete(doc(db, 'users', uid, 'transactions', mId))
        }
      }
    }

    // Legacy fallback: if targetPayment had no transactionId and deterministic doc might not match,
    // search by note/title/amount/date
    if (!targetPayment?.transactionId && !isMerged && targetPayment) {
      try {
        const legacyTxId = await findLegacyPaymentTransactionId(uid, debt.id, debt, targetPayment)
        if (legacyTxId && legacyTxId !== txId) {
          batch.delete(doc(db, 'users', uid, 'transactions', legacyTxId))
        }
      } catch (err) {
        console.error('Error finding legacy payment transaction to delete:', err)
      }
    }
  }

  await batch.commit()
}

export const removeDebtPayment = deleteDebtPayment

export interface UpdatePaymentOptions {
  syncTransaction?: boolean
  categoryId?: string
}

export async function updateDebtPayment(
  uid: string,
  debtOrId: string | Debt,
  paymentId: string,
  updatedData: {
    amountFils: number
    date: Date
    note?: string
    title?: string
    syncTransaction?: boolean
    categoryId?: string
  },
  options?: UpdatePaymentOptions
): Promise<void> {
  let debt: Debt
  if (typeof debtOrId === 'string') {
    const docRef = doc(db, 'users', uid, 'debts', debtOrId).withConverter(debtConverter)
    const snap = await getDoc(docRef)
    if (!snap.exists() || !snap.data()) {
      throw new Error('سجل الدين غير موجود')
    }
    debt = snap.data()!
  } else {
    debt = debtOrId
  }

  const payments = debt.payments || []
  const existingPayment = payments.find((p) => p.id === paymentId)
  if (!existingPayment) {
    throw new Error('الدفعة غير موجودة')
  }

  const amount = Math.round(Number(updatedData.amountFils))
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون عدداً صحيحاً موجباً بالفلس')
  }

  const previousPaymentsSum = payments.reduce((acc, p) => acc + p.amountFils, 0)
  const untrackedPaidFils = Math.max(0, (debt.paidFils || 0) - previousPaymentsSum)

  const otherPaymentsTotal = payments
    .filter((p) => p.id !== paymentId)
    .reduce((sum, p) => sum + p.amountFils, 0)

  const remainingAllowed = Math.max(0, debt.amountFils - (otherPaymentsTotal + untrackedPaidFils))
  if (amount > remainingAllowed) {
    throw new Error('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي من الدين')
  }

  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const paymentDate = updatedData.date instanceof Date ? updatedData.date : new Date(updatedData.date)
  const debtStartDay = new Date(debtStartDate.getFullYear(), debtStartDate.getMonth(), debtStartDate.getDate(), 0, 0, 0, 0)
  const paymentDay = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate(), 0, 0, 0, 0)
  if (paymentDay < debtStartDay) {
    throw new Error('تاريخ الدفعة لا يمكن أن يسبق تاريخ بداية الدين')
  }

  const defaultPaymentNote = debt.type === 'lent' ? 'دفعة استرداد دين' : 'دفعة سداد دين'
  const finalPaymentNote = (updatedData.note?.trim() || defaultPaymentNote).slice(0, 500)

  const syncTxOption =
    updatedData.syncTransaction !== undefined
      ? updatedData.syncTransaction
      : options?.syncTransaction

  // 1. Look up existing transaction for this payment
  let existingTxId: string | null = null
  let existingTxRef: DocumentReference | null = null

  const candidateIds = [existingPayment.transactionId, `debt_pay_${paymentId}`].filter(Boolean) as string[]
  for (const cId of candidateIds) {
    const candidateRef = doc(db, 'users', uid, 'transactions', cId)
    const snap = await getDoc(candidateRef)
    if (snap.exists()) {
      existingTxId = cId
      existingTxRef = candidateRef
      break
    }
  }

  if (!existingTxRef) {
    const legacyId = await findLegacyPaymentTransactionId(uid, debt.id, debt, existingPayment)
    if (legacyId) {
      const legRef = doc(db, 'users', uid, 'transactions', legacyId)
      const snap = await getDoc(legRef)
      if (snap.exists()) {
        existingTxId = legacyId
        existingTxRef = legRef
      }
    }
  }

  const batch = writeBatch(db)
  let finalTransactionId: string | undefined = existingPayment.transactionId
  let txToDelete: DocumentReference | null = null
  let txToUpdate: {
    ref: DocumentReference
    data: {
      amountFils: number
      date: Timestamp | Date
      note: string
      title?: string
      categoryId?: string
    }
  } | null = null
  let newTxData: {
    ref: DocumentReference
    data: {
      type: TxType
      amountFils: number
      categoryId: string
      date: Timestamp | Date
      title: string
      note: string
      createdAt: ReturnType<typeof serverTimestamp>
    }
  } | null = null

  if (syncTxOption === false) {
    if (existingTxRef) {
      txToDelete = existingTxRef
    }
    finalTransactionId = undefined
  } else if (syncTxOption === true || (syncTxOption === undefined && existingTxRef)) {
    if (existingTxRef) {
      const defaultTitle = (
        debt.type === 'lent'
          ? `استرداد دفعة دين: ${debt.personName}`
          : `سداد دفعة دين: ${debt.personName}`
      ).slice(0, 100)

      const titleUpdate: { title?: string } = {}
      if (updatedData.title !== undefined) {
        const trimmedTitle = updatedData.title.trim()
        titleUpdate.title = trimmedTitle ? trimmedTitle.slice(0, 100) : defaultTitle
      }

      txToUpdate = {
        ref: existingTxRef,
        data: {
          amountFils: amount,
          date: updatedData.date instanceof Date ? Timestamp.fromDate(updatedData.date) : updatedData.date,
          note: finalPaymentNote,
          ...(updatedData.categoryId ? { categoryId: updatedData.categoryId } : {}),
          ...titleUpdate,
        },
      }
      finalTransactionId = existingTxId || existingPayment.transactionId || `debt_pay_${paymentId}`
    } else if (syncTxOption === true) {
      const newTxId = `debt_pay_${paymentId}`
      const newTxRef = doc(db, 'users', uid, 'transactions', newTxId)
      const txType: TxType = debt.type === 'lent' ? 'income' : 'expense'
      const categoryId =
        updatedData.categoryId ||
        options?.categoryId ||
        (await getOrCreateDebtCategory(uid, txType))
      const defaultTitle = (
        debt.type === 'lent'
          ? `استرداد دفعة دين: ${debt.personName}`
          : `سداد دفعة دين: ${debt.personName}`
      ).slice(0, 100)
      const effectiveTitle =
        updatedData.title !== undefined && updatedData.title.trim()
          ? updatedData.title.trim().slice(0, 100)
          : defaultTitle

      newTxData = {
        ref: newTxRef,
        data: {
          type: txType,
          amountFils: amount,
          categoryId,
          date: updatedData.date instanceof Date ? Timestamp.fromDate(updatedData.date) : updatedData.date,
          title: effectiveTitle,
          note: finalPaymentNote,
          createdAt: serverTimestamp(),
        },
      }
      finalTransactionId = newTxId
    }
  }

  const updatedPayments = payments.map((p) => {
    if (p.id !== paymentId) return p
    const item: DebtPayment = {
      ...p,
      amountFils: amount,
      date: updatedData.date,
      note: finalPaymentNote,
      ...(finalTransactionId !== undefined ? { transactionId: finalTransactionId } : {}),
    }
    if (finalTransactionId === undefined) {
      delete item.transactionId
    }
    return item
  })

  const updatedPaymentsTotal = updatedPayments.reduce((sum, p) => sum + p.amountFils, 0)
  const newPaidFils = Math.min(debt.amountFils, untrackedPaidFils + updatedPaymentsTotal)
  const newSettled = newPaidFils === debt.amountFils

  const debtRef = doc(db, 'users', uid, 'debts', debt.id)
  const serializedPayments = updatedPayments.map(serializePayment)

  batch.update(debtRef, {
    paidFils: newPaidFils,
    settled: newSettled,
    payments: serializedPayments,
  })

  if (txToDelete) {
    batch.delete(txToDelete)
  }
  if (txToUpdate) {
    batch.update(txToUpdate.ref, txToUpdate.data)
  }
  if (newTxData) {
    batch.set(newTxData.ref, newTxData.data)
  }

  await batch.commit()
}

export interface CompactDebtPaymentsResult {
  mergedCount: number
  mergedAmountFils: number
}

export async function compactDebtPayments(
  uid: string,
  debtId: string
): Promise<CompactDebtPaymentsResult> {
  const docRef = doc(db, 'users', uid, 'debts', debtId).withConverter(debtConverter)
  const snap = await getDoc(docRef)
  if (!snap.exists() || !snap.data()) {
    throw new Error('سجل الدين غير موجود')
  }

  const debt = snap.data()!
  const payments = debt.payments || []

  // If 10 or fewer payments, compaction is not required
  if (payments.length <= 10) {
    return { mergedCount: 0, mergedAmountFils: 0 }
  }

  // Keep the latest 10 payments separate
  const toKeep = payments.slice(-10)
  // Merge all older payments
  const toMerge = payments.slice(0, -10)
  const mergedCount = toMerge.reduce((count, p) => {
    if (p.isMerged && typeof p.note === 'string') {
      const match = p.note.match(/\((\d+)\s*دفعة\)/)
      return count + (match ? parseInt(match[1], 10) : 1)
    }
    return count + 1
  }, 0)
  const mergedAmountFils = toMerge.reduce((sum, p) => sum + p.amountFils, 0)

  const lastMergedPayment = toMerge[toMerge.length - 1]
  const mergedDate =
    lastMergedPayment.date instanceof Date
      ? lastMergedPayment.date
      : new Date(lastMergedPayment.date)

  const mergedTxIds: string[] = []
  for (const p of toMerge) {
    if (p.transactionId && typeof p.transactionId === 'string' && p.transactionId.trim()) {
      if (!mergedTxIds.includes(p.transactionId.trim())) {
        mergedTxIds.push(p.transactionId.trim())
      }
    } else if (!p.isMerged && p.id) {
      const defaultTxId = `debt_pay_${p.id}`
      if (!mergedTxIds.includes(defaultTxId)) {
        mergedTxIds.push(defaultTxId)
      }
    }
    if (Array.isArray(p.mergedTransactionIds)) {
      for (const mId of p.mergedTransactionIds) {
        if (mId && typeof mId === 'string' && mId.trim() && !mergedTxIds.includes(mId.trim())) {
          mergedTxIds.push(mId.trim())
        }
      }
    }
  }

  const genericNotes = new Set([
    'دفعة سداد',
    'دفعة استرداد دين',
    'دفعة سداد دين',
    'استرداد دفعة دين',
    'سداد دفعة دين',
  ])
  const customNotes: string[] = []
  for (const p of toMerge) {
    if (p.note && typeof p.note === 'string') {
      const trimmed = p.note.trim()
      if (trimmed && !genericNotes.has(trimmed)) {
        const cleaned = trimmed
          .replace(/^رصيد دفعات سابقة مدمجة \(\d+\s*دفعة\):?\s*/, '')
          .trim()
        if (cleaned && !customNotes.includes(cleaned)) {
          customNotes.push(cleaned)
        }
      }
    }
  }
  const baseMergedNote = `رصيد دفعات سابقة مدمجة (${mergedCount} دفعة)`
  const finalMergedNote =
    customNotes.length > 0
      ? `${baseMergedNote}: ${customNotes.join(' ، ')}`.slice(0, 500)
      : baseMergedNote

  const consolidatedPayment: DebtPayment = {
    id: `compacted_${generatePaymentId()}`,
    amountFils: mergedAmountFils,
    date: mergedDate,
    note: finalMergedNote,
    createdAt: new Date(),
    isMerged: true,
    mergedTransactionIds: mergedTxIds,
  }

  const newPayments = [consolidatedPayment, ...toKeep]
  const serializedPayments = newPayments.map(serializePayment)

  const batch = writeBatch(db)
  batch.update(docRef, {
    payments: serializedPayments,
  })

  await batch.commit()
  return { mergedCount, mergedAmountFils }
}

export async function getAllDebts(uid: string): Promise<Debt[]> {
  const colRef = collection(db, 'users', uid, 'debts').withConverter(debtConverter)
  const q = query(colRef, orderBy('startDate', 'desc'))
  const snap = await getDocs(q)
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

  const entryId = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const existingEntries: DebtEntry[] =
    Array.isArray(debt.entries) && debt.entries.length > 0
      ? [...debt.entries]
      : [
          {
            id: `entry_base_${debt.id}`,
            amountFils: debt.amountFils,
            date: debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate),
            title: 'أصل الدين الأول',
            note: debt.note || '',
            transactionId: `debt_init_${debt.id}`,
            createdAt: debt.createdAt instanceof Date ? debt.createdAt : new Date(debt.createdAt || debt.startDate),
          },
        ]

  let txId: string | undefined
  const batch = writeBatch(db)

  if (options?.syncTransaction) {
    txId = `debt_entry_${entryId}`
    const txType: TxType = debt.type === 'lent' ? 'expense' : 'income'
    const categoryId = await getOrCreateDebtCategory(uid, txType)
    const txRef = doc(db, 'users', uid, 'transactions', txId)
    const title = (
      entry.title?.trim() ||
      (debt.type === 'lent' ? `سلفة إضافية: ${debt.personName}` : `اقتراض إضافي من: ${debt.personName}`)
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

  const debtRef = doc(db, 'users', uid, 'debts', debt.id).withConverter(debtConverter)
  batch.update(debtRef, {
    amountFils: newAmountFils,
    settled,
    entries: newEntries.map(serializeDebtEntry),
  })

  await batch.commit()
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

  const entries = debt.entries || []
  const entryIndex = entries.findIndex((e) => e.id === entryId)
  if (entryIndex === -1) {
    throw new Error('السلفة المحددة غير موجودة')
  }

  const oldEntry = entries[entryIndex]
  const diff = updated.amountFils - oldEntry.amountFils
  const newAmountFils = debt.amountFils + diff

  if (newAmountFils < (debt.paidFils || 0)) {
    throw new Error('لا يمكن تقليص مبلغ السلفة لأن إجمالي الدين سيصبح أقل من المبالغ المسددة فعلياً')
  }

  const batch = writeBatch(db)

  if (oldEntry.transactionId) {
    const txRef = doc(db, 'users', uid, 'transactions', oldEntry.transactionId)
    batch.update(txRef, {
      amountFils: updated.amountFils,
      date: updated.date instanceof Date ? Timestamp.fromDate(updated.date) : updated.date,
      ...(updated.title ? { title: updated.title.trim().slice(0, 100) } : {}),
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
  }

  const settled = (debt.paidFils || 0) === newAmountFils
  const debtRef = doc(db, 'users', uid, 'debts', debt.id).withConverter(debtConverter)
  batch.update(debtRef, {
    amountFils: newAmountFils,
    settled,
    entries: newEntries.map(serializeDebtEntry),
  })

  await batch.commit()
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

  const newEntries = entries.filter((e) => e.id !== entryId)
  const settled = (debt.paidFils || 0) === newAmountFils
  const debtRef = doc(db, 'users', uid, 'debts', debt.id).withConverter(debtConverter)
  batch.update(debtRef, {
    amountFils: newAmountFils,
    settled,
    entries: newEntries.map(serializeDebtEntry),
  })

  await batch.commit()
}

export async function mergePersonDebts(
  uid: string,
  debtsToMerge: Debt[]
): Promise<string> {
  if (!Array.isArray(debtsToMerge) || debtsToMerge.length < 2) {
    throw new Error('يجب اختيار دينين على الأقل للدمج')
  }

  const firstType = debtsToMerge[0].type
  const allSameType = debtsToMerge.every((d) => d.type === firstType)
  if (!allSameType) {
    throw new Error('لا يمكن دمج ديون من نوعين مختلفين (لي وعليّ) معاً')
  }

  // Sort by startDate ascending to pick the primary (oldest) debt
  const sorted = [...debtsToMerge].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  )
  const primaryDebt = sorted[0]
  const secondaryDebts = sorted.slice(1)

  // Collect and consolidate entries
  const consolidatedEntries: DebtEntry[] = []
  for (const d of sorted) {
    if (Array.isArray(d.entries) && d.entries.length > 0) {
      for (const e of d.entries) {
        consolidatedEntries.push({ ...e })
      }
    } else {
      consolidatedEntries.push({
        id: `entry_base_${d.id}`,
        amountFils: d.amountFils,
        date: d.startDate instanceof Date ? d.startDate : new Date(d.startDate),
        title: `أصل دين: ${d.personName}`,
        note: d.note || '',
        transactionId: `debt_init_${d.id}`,
        createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt || d.startDate),
      })
    }
  }
  consolidatedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Collect and consolidate payments
  const consolidatedPayments: DebtPayment[] = []
  for (const d of sorted) {
    if (Array.isArray(d.payments)) {
      for (const p of d.payments) {
        consolidatedPayments.push({ ...p })
      }
    }
  }
  consolidatedPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Consolidate notes
  const notesSet = new Set<string>()
  for (const d of sorted) {
    if (d.note && d.note.trim()) {
      notesSet.add(d.note.trim())
    }
  }
  const combinedNote = Array.from(notesSet).join(' | ').slice(0, 500)

  const totalAmountFils = sorted.reduce((sum, d) => sum + d.amountFils, 0)
  const totalPaidFils = sorted.reduce((sum, d) => sum + (d.paidFils || 0), 0)
  const settled = totalPaidFils === totalAmountFils

  const batch = writeBatch(db)

  const primaryRef = doc(db, 'users', uid, 'debts', primaryDebt.id).withConverter(debtConverter)
  batch.update(primaryRef, {
    amountFils: totalAmountFils,
    paidFils: totalPaidFils,
    settled,
    note: combinedNote,
    payments: consolidatedPayments.map(serializePayment),
    entries: consolidatedEntries.slice(0, 100).map(serializeDebtEntry),
  })

  // Delete secondary debt documents
  for (const secondary of secondaryDebts) {
    const secRef = doc(db, 'users', uid, 'debts', secondary.id).withConverter(debtConverter)
    batch.delete(secRef)
  }

  await batch.commit()
  return primaryDebt.id
}
