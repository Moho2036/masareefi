import type { Transaction, Debt, DebtEntry, MoneyCircle } from '../types'
import { findLinkedDebtPayment } from './debts'
import { getOccurrenceMonthIndex } from './recurring'

export type TransactionLockReason =
  | 'debt_init'
  | 'debt_entry'
  | 'debt_payment_merged'
  | 'circle_payout'

export interface TransactionLockStatus {
  isLocked: boolean
  lockReason: TransactionLockReason | null
  isLinkedToDebtInit: boolean
  isLinkedToDebtEntry: boolean
  isLinkedToDebtPayment: boolean
  isMergedPaymentTx: boolean
  isMergedEntryTx: boolean
  isLinkedToCircle: boolean
  isLinkedToCircleInstallment: boolean
  isCircleInstallmentExists: boolean
  circleInstallmentId: string | null
  circleInstallmentMonth: number | null
  linkedCircleInstallment: MoneyCircle | null
  linkedDebtPayment: ReturnType<typeof findLinkedDebtPayment>
  linkedDebt: Debt | null
  linkedDebtEntry: { debt: Debt; entry: DebtEntry } | null
  isSourceMissing: boolean
  isDebtExists: boolean
  isDebtEntryExists: boolean
  isCircleExists: boolean
}

export function isDebtInitTransaction(txId: string): boolean {
  return typeof txId === 'string' && txId.startsWith('debt_init_')
}

export function isDebtEntryTransaction(txId: string): boolean {
  return typeof txId === 'string' && txId.startsWith('debt_entry_')
}

export function isDebtPaymentTransaction(txId: string): boolean {
  return typeof txId === 'string' && txId.startsWith('debt_pay_')
}

export function isCirclePayoutTransaction(txId: string): boolean {
  return typeof txId === 'string' && txId.startsWith('circle_payout_')
}

export function isCircleInstallmentTransaction(txId: string): boolean {
  return typeof txId === 'string' && /^circle_(.+)_m(\d+)$/.test(txId)
}

export function parseCircleInstallmentId(
  txId: string
): { circleId: string; monthNumber: number } | null {
  if (typeof txId !== 'string') return null
  const match = txId.match(/^circle_(.+)_m(\d+)$/)
  if (!match) return null
  return {
    circleId: match[1],
    monthNumber: parseInt(match[2], 10),
  }
}

export function isSystemLinkedTransaction(tx: { id: string; note?: string }): boolean {
  if (!tx || typeof tx.id !== 'string') return false
  return (
    tx.id.startsWith('debt_') ||
    tx.id.startsWith('circle_') ||
    Boolean(tx.note?.includes('تسوية رصيد'))
  )
}

export interface DebtLookup {
  debtIdsSet: Set<string>
  entryTxIdsSet: Set<string>
  debtByIdMap: Map<string, Debt>
  entryByTxIdMap: Map<string, { debt: Debt; entry: DebtEntry }>
  paymentByTxIdMap: Map<string, { debt: Debt; payment: Debt['payments'][number] }>
}

export function buildDebtLookup(debts: Debt[]): DebtLookup {
  const debtIdsSet = new Set<string>()
  const entryTxIdsSet = new Set<string>()
  const debtByIdMap = new Map<string, Debt>()
  const entryByTxIdMap = new Map<string, { debt: Debt; entry: DebtEntry }>()
  const paymentByTxIdMap = new Map<string, { debt: Debt; payment: Debt['payments'][number] }>()

  for (const d of debts) {
    debtIdsSet.add(d.id)
    debtByIdMap.set(d.id, d)
    // The debt initialisation transaction is deterministically identified by debt_init_<debtId>
    entryTxIdsSet.add(`debt_init_${d.id}`)
    if (d.entries) {
      for (const e of d.entries) {
        const entryItem = { debt: d, entry: e }
        if (e.transactionId) {
          entryTxIdsSet.add(e.transactionId)
          entryByTxIdMap.set(e.transactionId, entryItem)
        }
        entryTxIdsSet.add(`debt_entry_${e.id}`)
        entryByTxIdMap.set(`debt_entry_${e.id}`, entryItem)
        if (e.transactionId === `debt_init_${d.id}`) {
          entryByTxIdMap.set(`debt_init_${d.id}`, entryItem)
        }
        // Merged entry transaction IDs (e.g. from debt entry consolidation)
        if (Array.isArray(e.mergedTransactionIds)) {
          for (const mid of e.mergedTransactionIds) {
            if (mid) {
              entryTxIdsSet.add(mid)
              entryByTxIdMap.set(mid, entryItem)
            }
          }
        }
      }
    }
    if (d.payments) {
      for (const p of d.payments) {
        const item = { debt: d, payment: p }
        if (p.transactionId) paymentByTxIdMap.set(p.transactionId, item)
        paymentByTxIdMap.set(`debt_pay_${p.id}`, item)
        if (Array.isArray(p.mergedTransactionIds)) {
          for (const mid of p.mergedTransactionIds) {
            if (mid) paymentByTxIdMap.set(mid, item)
          }
        }
      }
    }
  }

  return { debtIdsSet, entryTxIdsSet, debtByIdMap, entryByTxIdMap, paymentByTxIdMap }
}

export function buildDebtTxIdsSet(debtLookup: DebtLookup): Set<string> {
  const set = new Set<string>()
  for (const key of debtLookup.entryTxIdsSet) set.add(key)
  for (const key of debtLookup.paymentByTxIdMap.keys()) set.add(key)
  return set
}

export function resolveTransactionLockStatus(
  tx: Transaction | null | undefined,
  debts: Debt[],
  circles: MoneyCircle[],
  isSourceDeleted?: boolean,
  monthStartDay?: number
): TransactionLockStatus {
  if (!tx) {
    return {
      isLocked: false,
      lockReason: null,
      isLinkedToDebtInit: false,
      isLinkedToDebtEntry: false,
      isLinkedToDebtPayment: false,
      isMergedPaymentTx: false,
      isMergedEntryTx: false,
      isLinkedToCircle: false,
      isLinkedToCircleInstallment: false,
      isCircleInstallmentExists: false,
      circleInstallmentId: null,
      circleInstallmentMonth: null,
      linkedCircleInstallment: null,
      linkedDebtPayment: null,
      linkedDebt: null,
      linkedDebtEntry: null,
      isSourceMissing: false,
      isDebtExists: false,
      isDebtEntryExists: false,
      isCircleExists: false,
    }
  }

  const linkedDebtPayment = findLinkedDebtPayment(tx.id, debts)

  const isMergedEntryTx = debts.some((d) =>
    (d.entries || []).some(
      (e) => Array.isArray(e.mergedTransactionIds) && e.mergedTransactionIds.includes(tx.id)
    )
  )

  const isLinkedToDebtInit = isDebtInitTransaction(tx.id)
  const debtId = isLinkedToDebtInit ? tx.id.replace('debt_init_', '') : null
  const linkedDebt = debtId ? debts.find((d) => d.id === debtId) || null : null
  const isDebtExists = Boolean(
    (debtId && debts.some((d) => d.id === debtId)) ||
      debts.some((d) =>
        (d.entries || []).some(
          (e) =>
            e.transactionId === tx.id ||
            (Array.isArray(e.mergedTransactionIds) && e.mergedTransactionIds.includes(tx.id))
        )
      )
  )

  let linkedDebtEntry: { debt: Debt; entry: DebtEntry } | null = null
  const isLinkedToDebtEntry = isDebtEntryTransaction(tx.id) || isMergedEntryTx
  if (isLinkedToDebtEntry) {
    for (const d of debts) {
      if (d.entries) {
        for (const e of d.entries) {
          if (
            e.transactionId === tx.id ||
            `debt_entry_${e.id}` === tx.id ||
            (Array.isArray(e.mergedTransactionIds) && e.mergedTransactionIds.includes(tx.id))
          ) {
            linkedDebtEntry = { debt: d, entry: e }
            break
          }
        }
      }
      if (linkedDebtEntry) break
    }
  }
  const isDebtEntryExists = Boolean(linkedDebtEntry)

  const isLinkedToDebtPayment = Boolean(
    linkedDebtPayment ||
      (isDebtPaymentTransaction(tx.id) &&
        debts.some((d) =>
          (d.payments || []).some(
            (p) => p.id === tx.id.replace('debt_pay_', '') || p.transactionId === tx.id
          )
        ))
  )

  const isLinkedToCircle = isCirclePayoutTransaction(tx.id)
  const isCircleExists = Boolean(
    isLinkedToCircle &&
      circles.some(
        (c) =>
          tx.id === `circle_payout_${c.id}` ||
          tx.id === `circle_payout_${c.id}_t2`
      )
  )

  const circleInstallmentParsed = parseCircleInstallmentId(tx.id)
  const recurringLinkedCircle =
    !circleInstallmentParsed && tx.recurringId
      ? circles.find((c) => c.recurringId === tx.recurringId)
      : null
  const recurringCircleMonth =
    recurringLinkedCircle && tx.date
      ? getOccurrenceMonthIndex(recurringLinkedCircle.startDate, tx.date, monthStartDay)
      : null
  const isValidRecurringCircleInstallment = Boolean(
    recurringLinkedCircle &&
      recurringCircleMonth !== null &&
      recurringCircleMonth >= 1 &&
      recurringCircleMonth <= recurringLinkedCircle.membersCount
  )
  const isLinkedToCircleInstallment = Boolean(
    circleInstallmentParsed || isValidRecurringCircleInstallment
  )
  const circleInstallmentId = circleInstallmentParsed
    ? circleInstallmentParsed.circleId
    : (recurringLinkedCircle?.id ?? null)
  const circleInstallmentMonth = circleInstallmentParsed
    ? circleInstallmentParsed.monthNumber
    : recurringCircleMonth
  const linkedCircleInstallment = circleInstallmentId
    ? circles.find((c) => c.id === circleInstallmentId) || null
    : null
  const isCircleInstallmentExists = Boolean(linkedCircleInstallment)

  const isMergedPaymentTx = Boolean(linkedDebtPayment?.payment?.isMerged)

  const isSourceMissing =
    isSourceDeleted ??
    ((isLinkedToDebtInit && !isDebtExists) ||
      (isLinkedToDebtEntry && !isDebtEntryExists) ||
      (isLinkedToCircle && !isCircleExists))

  const isLocked =
    !isSourceMissing &&
    (isLinkedToDebtInit || isLinkedToDebtEntry || isLinkedToCircle || isMergedPaymentTx)

  let lockReason: TransactionLockReason | null = null
  if (isLocked) {
    if (isLinkedToDebtInit) lockReason = 'debt_init'
    else if (isLinkedToDebtEntry) lockReason = 'debt_entry'
    else if (isMergedPaymentTx) lockReason = 'debt_payment_merged'
    else if (isLinkedToCircle) lockReason = 'circle_payout'
  }

  return {
    isLocked,
    lockReason,
    isLinkedToDebtInit,
    isLinkedToDebtEntry,
    isLinkedToDebtPayment,
    isMergedPaymentTx,
    isMergedEntryTx,
    isLinkedToCircle,
    isLinkedToCircleInstallment,
    isCircleInstallmentExists,
    circleInstallmentId,
    circleInstallmentMonth,
    linkedCircleInstallment,
    linkedDebtPayment,
    linkedDebt,
    linkedDebtEntry,
    isSourceMissing,
    isDebtExists,
    isDebtEntryExists,
    isCircleExists,
  }
}
