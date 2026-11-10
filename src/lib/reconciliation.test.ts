import { describe, it, expect } from 'vitest'
import {
  calculateReconciliation,
  isReconciliationTransaction,
  RECONCILIATION_TITLE,
  RECONCILIATION_NOTE,
} from './reconciliation'
import type { Transaction } from '../types'

describe('reconciliation lib', () => {
  it('correctly identifies reconciliation transactions', () => {
    expect(isReconciliationTransaction({ title: RECONCILIATION_TITLE })).toBe(true)
    expect(isReconciliationTransaction({ note: RECONCILIATION_NOTE })).toBe(true)
    expect(isReconciliationTransaction({ note: 'معاملة تسوية رصيد سابقة' })).toBe(true)
    expect(isReconciliationTransaction({ title: 'بقالة', note: 'شراء خبز' })).toBe(false)
  })

  it('calculates reconciliation when requiredOpening >= 0 without rollover', () => {
    const now = new Date(2026, 4, 15, 12, 0, 0)
    const txs: Transaction[] = [
      {
        id: 'tx1',
        title: 'راتب',
        amountFils: 100_000,
        type: 'income',
        date: new Date(2026, 4, 5),
        categoryId: 'c1',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx2',
        title: 'إيجار',
        amountFils: 40_000,
        type: 'expense',
        date: new Date(2026, 4, 10),
        categoryId: 'c2',
        note: '',
        createdAt: new Date(),
      },
    ]

    // Net txs in cycle = 100_000 - 40_000 = 60_000
    // Target = 150_000
    // requiredOpening = 150_000 - 60_000 = 90_000
    const res = calculateReconciliation({
      transactions: txs,
      targetFils: 150_000,
      monthStartDay: 1,
      rolloverBalance: false,
      now,
    })

    expect(res.netTxFils).toBe(60_000)
    expect(res.requiredOpening).toBe(90_000)
    expect(res.newOpeningBalanceFils).toBe(90_000)
    expect(res.diffExpenseFils).toBe(0)
    expect(res.needsDiffExpense).toBe(false)
    expect(res.oldReconcileTxs).toHaveLength(0)
  })

  it('calculates reconciliation when requiredOpening < 0 and needs inventory difference expense', () => {
    const now = new Date(2026, 4, 15, 12, 0, 0)
    const txs: Transaction[] = [
      {
        id: 'tx1',
        title: 'راتب',
        amountFils: 100_000,
        type: 'income',
        date: new Date(2026, 4, 5),
        categoryId: 'c1',
        note: '',
        createdAt: new Date(),
      },
    ]

    // Net txs = 100_000
    // Target = 70_000
    // requiredOpening = 70_000 - 100_000 = -30_000
    // Should set opening to 0 and diff expense to 30_000
    const res = calculateReconciliation({
      transactions: txs,
      targetFils: 70_000,
      monthStartDay: 1,
      rolloverBalance: false,
      now,
    })

    expect(res.netTxFils).toBe(100_000)
    expect(res.requiredOpening).toBe(-30_000)
    expect(res.newOpeningBalanceFils).toBe(0)
    expect(res.diffExpenseFils).toBe(30_000)
    expect(res.needsDiffExpense).toBe(true)
  })

  it('filters out previous reconciliation transactions and future dated transactions', () => {
    const now = new Date(2026, 4, 15, 12, 0, 0)
    const txs: Transaction[] = [
      {
        id: 'tx-old-rec',
        title: RECONCILIATION_TITLE,
        note: RECONCILIATION_NOTE,
        amountFils: 20_000,
        type: 'expense',
        date: new Date(2026, 4, 3),
        categoryId: 'c-diff',
        createdAt: new Date(),
      },
      {
        id: 'tx-future',
        title: 'معاملة مستقبلية',
        amountFils: 50_000,
        type: 'expense',
        date: new Date(2026, 4, 20),
        categoryId: 'c1',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-valid',
        title: 'دخل عادي',
        amountFils: 80_000,
        type: 'income',
        date: new Date(2026, 4, 8),
        categoryId: 'c1',
        note: '',
        createdAt: new Date(),
      },
    ]

    const res = calculateReconciliation({
      transactions: txs,
      targetFils: 100_000,
      monthStartDay: 1,
      now,
    })

    expect(res.oldReconcileTxs).toHaveLength(1)
    expect(res.oldReconcileTxs[0].id).toBe('tx-old-rec')
    expect(res.relevantTxs).toHaveLength(1)
    expect(res.relevantTxs[0].id).toBe('tx-valid')
    expect(res.netTxFils).toBe(80_000)
    expect(res.requiredOpening).toBe(20_000)
  })

  it('filters by rolloverStartDate when rolloverBalance is enabled', () => {
    const now = new Date(2026, 4, 15, 12, 0, 0)
    const startDate = new Date(2026, 2, 1) // March 1, 2026
    const txs: Transaction[] = [
      {
        id: 'tx-feb',
        title: 'فبراير',
        amountFils: 10_000,
        type: 'income',
        date: new Date(2026, 1, 15),
        categoryId: 'c1',
        note: '',
        createdAt: new Date(),
      },
      {
        id: 'tx-march',
        title: 'مارس',
        amountFils: 25_000,
        type: 'income',
        date: new Date(2026, 2, 15),
        categoryId: 'c1',
        note: '',
        createdAt: new Date(),
      },
    ]

    const res = calculateReconciliation({
      transactions: txs,
      targetFils: 50_000,
      monthStartDay: 1,
      rolloverBalance: true,
      rolloverStartDate: startDate,
      now,
    })

    // Only tx-march should be included
    expect(res.relevantTxs).toHaveLength(1)
    expect(res.relevantTxs[0].id).toBe('tx-march')
    expect(res.netTxFils).toBe(25_000)
    expect(res.requiredOpening).toBe(25_000)
  })
})
