import type { Transaction } from '../types'
import { getFinancialMonthRange } from './dates'

export const RECONCILIATION_TITLE = 'تسوية رصيد (فرق جرد)'
export const RECONCILIATION_NOTE = 'معاملة تسوية مسجلة آلياً لمطابقة الرصيد الفعلي'

export function isReconciliationTransaction(tx: { title?: string; note?: string }): boolean {
  return (
    tx.title === RECONCILIATION_TITLE ||
    Boolean(tx.note?.includes('تسوية رصيد')) ||
    tx.note === RECONCILIATION_NOTE
  )
}

export interface CalculateReconciliationParams {
  transactions: Transaction[]
  targetFils: number
  monthStartDay?: number
  rolloverBalance?: boolean
  rolloverStartDate?: Date | { toDate?: () => Date } | string | number | null
  now?: Date
}

export interface ReconciliationCalculationResult {
  currentCycle: { start: Date; end: Date }
  oldReconcileTxs: Transaction[]
  relevantTxs: Transaction[]
  netTxFils: number
  requiredOpening: number
  newOpeningBalanceFils: number
  diffExpenseFils: number
  needsDiffExpense: boolean
}

export function calculateReconciliation(
  params: CalculateReconciliationParams
): ReconciliationCalculationResult {
  const {
    transactions,
    targetFils,
    monthStartDay = 1,
    rolloverBalance = false,
    rolloverStartDate = null,
    now = new Date(),
  } = params

  const currentCycle = getFinancialMonthRange(now, monthStartDay)

  const oldReconcileTxs = transactions.filter((tx) => {
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    return (
      txDate >= currentCycle.start &&
      txDate < currentCycle.end &&
      isReconciliationTransaction(tx)
    )
  })
  const oldReconcileIds = new Set(oldReconcileTxs.map((t) => t.id))

  const relevantTxs = transactions.filter((tx) => {
    if (oldReconcileIds.has(tx.id)) {
      return false
    }
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date)
    if (txDate > now || txDate >= currentCycle.end) {
      return false
    }
    if (!rolloverBalance) {
      return txDate >= currentCycle.start
    }
    if (rolloverStartDate) {
      const rawStart = rolloverStartDate
      const startDate =
        rawStart instanceof Date
          ? rawStart
          : typeof (rawStart as { toDate?: () => Date }).toDate === 'function'
          ? (rawStart as { toDate: () => Date }).toDate()
          : new Date(rawStart as unknown as string | number)
      return txDate >= startDate
    }
    return true
  })

  const netTxFils = relevantTxs.reduce((acc, tx) => {
    const amount =
      typeof tx.amountFils === 'number' && Number.isFinite(tx.amountFils) ? tx.amountFils : 0
    return tx.type === 'income' ? acc + amount : acc - amount
  }, 0)

  const requiredOpening = targetFils - netTxFils

  if (requiredOpening >= 0) {
    return {
      currentCycle,
      oldReconcileTxs,
      relevantTxs,
      netTxFils,
      requiredOpening,
      newOpeningBalanceFils: requiredOpening,
      diffExpenseFils: 0,
      needsDiffExpense: false,
    }
  }

  return {
    currentCycle,
    oldReconcileTxs,
    relevantTxs,
    netTxFils,
    requiredOpening,
    newOpeningBalanceFils: 0,
    diffExpenseFils: -requiredOpening,
    needsDiffExpense: true,
  }
}
