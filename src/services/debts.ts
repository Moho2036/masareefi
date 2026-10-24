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
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Debt, DebtPayment, TxType } from '../types'
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
 * Expense: looks for 'سداد الديون والأقساط', then 'أخرى', then any expense category.
 * Income: looks for 'أخرى', then any income category.
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
      (c) => c.type === 'expense' && !c.archived && c.name === 'سداد الديون والأقساط'
    )
    if (debtCat) return debtCat.id

    const otherCat = categories.find(
      (c) => c.type === 'expense' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    const anyCat = categories.find((c) => c.type === 'expense' && !c.archived)
    if (anyCat) return anyCat.id

    const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
    await setDoc(newDocRef, {
      id: '',
      name: 'سداد الديون والأقساط',
      type: 'expense',
      icon: '💳',
      color: '#D97706',
      archived: false,
      order: 0,
    })
    return newDocRef.id
  } else {
    const otherCat = categories.find(
      (c) => c.type === 'income' && !c.archived && c.name === 'أخرى'
    )
    if (otherCat) return otherCat.id

    const anyCat = categories.find((c) => c.type === 'income' && !c.archived)
    if (anyCat) return anyCat.id

    const newDocRef = doc(collection(db, 'users', uid, 'categories')).withConverter(categoryConverter)
    await setDoc(newDocRef, {
      id: '',
      name: 'أخرى',
      type: 'income',
      icon: '➕',
      color: '#64748B',
      archived: false,
      order: 0,
    })
    return newDocRef.id
  }
}

export interface AddDebtOptions {
  syncTransaction?: boolean
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

  const debtData = {
    id: debtId,
    personName,
    type: debt.type,
    amountFils: debt.amountFils,
    paidFils: 0,
    settled: false,
    startDate: debt.startDate,
    dueDate: debt.dueDate ?? null,
    note: finalDebtNote,
    payments: [],
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
      if (typeof d?.id === 'string' && d.id.startsWith('debt_pay_')) continue
      const tx = typeof d?.data === 'function' ? d.data() : (d as unknown as Record<string, unknown>)
      if (!tx) continue
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date as string | number | Date)
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

function updatePaymentTxNote(
  existingNote: string | undefined,
  effectiveType: 'lent' | 'borrowed',
  effectivePersonName: string
): string | undefined {
  if (typeof existingNote !== 'string') return undefined

  const prefixRegex = /^(سداد دين|تحصيل دين|سداد دفعة دين|استرداد دفعة دين|دفعة سداد دين|دفعة استرداد دين)\s*(\([^)]*\)|:\s*[^•\n]+)?/
  if (prefixRegex.test(existingNote)) {
    const action = effectiveType === 'lent' ? 'تحصيل دين' : 'سداد دين'
    const newPrefix = `${action} (${effectivePersonName})`
    return existingNote.replace(prefixRegex, newPrefix).slice(0, 500)
  }

  return undefined
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
    if (data.note !== undefined) {
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
        let payTxRef = null
        let payTxSnap = null

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
          const txData = payTxSnap.data() as Record<string, unknown>
          const payTxUpdates: Record<string, unknown> = {
            title: (effectiveType === 'lent' ? `تحصيل دين: ${effectivePersonName}` : `سداد دين: ${effectivePersonName}`).slice(0, 100),
          }
          if (typeChanged) {
            payTxUpdates.type = payTxType
            if (newPayCatId) {
              payTxUpdates.categoryId = newPayCatId
            }
          }
          if (typeof txData?.note === 'string') {
            const updatedNote = updatePaymentTxNote(txData.note, effectiveType, effectivePersonName)
            if (updatedNote !== undefined) {
              payTxUpdates.note = updatedNote
            }
          }
          batch.update(payTxRef, payTxUpdates)
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
  const debtRef = doc(db, 'users', uid, 'debts', id)
  const snap = await getDoc(debtRef)
  const debt = snap.data()
  const payments: DebtPayment[] = debt?.payments || []

  const batch = writeBatch(db)
  batch.delete(debtRef)

  const shouldDeleteTransactions =
    typeof optionsOrFlag === 'boolean'
      ? optionsOrFlag
      : (optionsOrFlag?.deleteTransactions ?? false)

  if (shouldDeleteTransactions) {
    // Synchronize: Delete initial transaction
    const initTxRef = doc(db, 'users', uid, 'transactions', `debt_init_${id}`)
    batch.delete(initTxRef)

    // Synchronize: Delete all payment transactions
    for (const p of payments) {
      if (p.transactionId) {
        batch.delete(doc(db, 'users', uid, 'transactions', p.transactionId))
      }
      if (p.id && p.id !== p.transactionId) {
        const payTxRef = doc(db, 'users', uid, 'transactions', `debt_pay_${p.id}`)
        batch.delete(payTxRef)
      }
    }
  }

  await batch.commit()
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

    const txColRef = collection(db, 'users', uid, 'transactions')
    const q = query(txColRef, where('amountFils', '==', payment.amountFils))
    const snap = await getDocs(q)
    if (!snap || !snap.docs || snap.docs.length === 0) return null

    const pDate = payment.date instanceof Date ? payment.date : new Date(payment.date)
    const pTime = pDate.getTime()

    for (const d of snap.docs) {
      const tx = d.data()
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date)
      const dayDiff = Math.abs(txDate.getTime() - pTime)
      const isSameDay = dayDiff < 24 * 60 * 60 * 1000

      const titleMatches =
        typeof tx.title === 'string' &&
        (tx.title.includes(debt.personName) ||
          tx.title.includes('دين') ||
          tx.title.includes('سداد') ||
          tx.title.includes('تحصيل') ||
          tx.title.includes('استرداد'))

      const noteMatches =
        payment.note && typeof tx.note === 'string' && tx.note.includes(payment.note)

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
    const txId = targetPayment?.transactionId || `debt_pay_${paymentId}`
    const payTxRef = doc(db, 'users', uid, 'transactions', txId)
    batch.delete(payTxRef)

    // Legacy fallback: if targetPayment had no transactionId and deterministic doc might not match,
    // search by note/title/amount/date
    if (!targetPayment?.transactionId && targetPayment) {
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
  let existingTxRef = null

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
      txToUpdate = {
        ref: existingTxRef,
        data: {
          amountFils: amount,
          date: updatedData.date instanceof Date ? Timestamp.fromDate(updatedData.date) : updatedData.date,
          note: finalPaymentNote,
          ...(updatedData.categoryId ? { categoryId: updatedData.categoryId } : {}),
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
      const title = (
        debt.type === 'lent'
          ? `استرداد دفعة دين: ${debt.personName}`
          : `سداد دفعة دين: ${debt.personName}`
      ).slice(0, 100)

      newTxData = {
        ref: newTxRef,
        data: {
          type: txType,
          amountFils: amount,
          categoryId,
          date: updatedData.date instanceof Date ? Timestamp.fromDate(updatedData.date) : updatedData.date,
          title,
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
  const mergedCount = toMerge.length
  const mergedAmountFils = toMerge.reduce((sum, p) => sum + p.amountFils, 0)

  const lastMergedPayment = toMerge[toMerge.length - 1]
  const mergedDate =
    lastMergedPayment.date instanceof Date
      ? lastMergedPayment.date
      : new Date(lastMergedPayment.date)

  const consolidatedPayment: DebtPayment = {
    id: generatePaymentId(),
    amountFils: mergedAmountFils,
    date: mergedDate,
    note: `رصيد دفعات سابقة مدمجة (${mergedCount} دفعة)`,
    createdAt: new Date(),
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
