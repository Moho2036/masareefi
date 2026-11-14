import { describe, it, expect } from 'vitest'
import {
  isDebtInitTransaction,
  isDebtEntryTransaction,
  isDebtPaymentTransaction,
  isCirclePayoutTransaction,
  isCircleInstallmentTransaction,
  parseCircleInstallmentId,
  isSystemLinkedTransaction,
  resolveTransactionLockStatus,
  buildDebtLookup,
} from './transactionLocks'
import type { Transaction, Debt, MoneyCircle } from '../types'

describe('transactionLocks lib', () => {
  const sampleDebt: Debt = {
    id: 'debt-123',
    type: 'borrowed',
    personName: 'أحمد',
    amountFils: 50_000,
    paidFils: 10_000,
    settled: false,
    startDate: new Date(),
    note: '',
    createdAt: new Date(),
    entries: [
      {
        id: 'entry-1',
        amountFils: 20_000,
        date: new Date(),
        note: '',
        createdAt: new Date(),
        transactionId: 'debt_entry_entry-1',
      },
    ],
    payments: [
      {
        id: 'pay-1',
        amountFils: 10_000,
        date: new Date(),
        isMerged: true,
        createdAt: new Date(),
      },
      {
        id: 'pay-2',
        amountFils: 5_000,
        date: new Date(),
        isMerged: false,
        createdAt: new Date(),
      },
    ],
  }

  const sampleCircle: MoneyCircle = {
    id: 'circle-456',
    name: 'جمعية العائلة',
    totalAmountFils: 600_000,
    monthlyAmountFils: 50_000,
    membersCount: 12,
    myTurnMonth: 3,
    startDate: new Date(2026, 0, 1),
    status: 'active',
    members: [],
    createdAt: new Date(),
  }

  it('correctly identifies transaction ID patterns', () => {
    expect(isDebtInitTransaction('debt_init_123')).toBe(true)
    expect(isDebtInitTransaction('tx_123')).toBe(false)

    expect(isDebtEntryTransaction('debt_entry_456')).toBe(true)
    expect(isDebtEntryTransaction('debt_init_456')).toBe(false)

    expect(isDebtPaymentTransaction('debt_pay_789')).toBe(true)
    expect(isDebtPaymentTransaction('tx_789')).toBe(false)

    expect(isCirclePayoutTransaction('circle_payout_abc')).toBe(true)
    expect(isCirclePayoutTransaction('circle_abc_m1')).toBe(false)

    expect(isCircleInstallmentTransaction('circle_abc_m2')).toBe(true)
    expect(isCircleInstallmentTransaction('circle_payout_abc')).toBe(false)

    const parsed = parseCircleInstallmentId('circle_mycircle_m4')
    expect(parsed).toEqual({ circleId: 'mycircle', monthNumber: 4 })
    expect(parseCircleInstallmentId('random_id')).toBeNull()
  })

  it('determines system-locked transactions based on ID prefixes', () => {
    expect(isSystemLinkedTransaction({ id: 'debt_init_1' })).toBe(true)
    expect(isSystemLinkedTransaction({ id: 'circle_c1_m2' })).toBe(true)
    expect(isSystemLinkedTransaction({ id: 'normal_tx' })).toBe(false)
  })

  it('resolves unlocked status for normal transactions', () => {
    const tx: Transaction = {
      id: 'tx-normal',
      title: 'بقالة',
      amountFils: 15_000,
      type: 'expense',
      date: new Date(),
      categoryId: 'cat-1',
      note: '',
      createdAt: new Date(),
    }

    const status = resolveTransactionLockStatus(tx, [sampleDebt], [sampleCircle])
    expect(status.isLocked).toBe(false)
    expect(status.lockReason).toBeNull()
    expect(status.isSourceMissing).toBe(false)
  })

  it('locks debt_init transaction when debt exists and unlocks when debt is missing', () => {
    const tx: Transaction = {
      id: 'debt_init_debt-123',
      title: 'أصل الدين',
      amountFils: 50_000,
      type: 'expense',
      date: new Date(),
      categoryId: 'cat-1',
      note: '',
      createdAt: new Date(),
    }

    // Debt exists
    const statusExists = resolveTransactionLockStatus(tx, [sampleDebt], [sampleCircle])
    expect(statusExists.isLocked).toBe(true)
    expect(statusExists.lockReason).toBe('debt_init')
    expect(statusExists.isDebtExists).toBe(true)
    expect(statusExists.isSourceMissing).toBe(false)

    // Debt missing
    const statusMissing = resolveTransactionLockStatus(tx, [], [sampleCircle])
    expect(statusMissing.isLocked).toBe(false)
    expect(statusMissing.isSourceMissing).toBe(true)
    expect(statusMissing.isDebtExists).toBe(false)
  })

  it('locks merged debt payment transaction', () => {
    const tx: Transaction = {
      id: 'debt_pay_pay-1',
      title: 'سداد دين مدمج',
      amountFils: 10_000,
      type: 'income',
      date: new Date(),
      categoryId: 'cat-1',
      note: '',
      createdAt: new Date(),
    }

    const status = resolveTransactionLockStatus(tx, [sampleDebt], [sampleCircle])
    expect(status.isLocked).toBe(true)
    expect(status.lockReason).toBe('debt_payment_merged')
    expect(status.isMergedPaymentTx).toBe(true)
  })

  it('locks circle_payout transaction when circle exists and unlocks when deleted', () => {
    const tx: Transaction = {
      id: 'circle_payout_circle-456',
      title: 'استلام جمعية',
      amountFils: 600_000,
      type: 'income',
      date: new Date(),
      categoryId: 'cat-1',
      note: '',
      createdAt: new Date(),
    }

    const statusExists = resolveTransactionLockStatus(tx, [sampleDebt], [sampleCircle])
    expect(statusExists.isLocked).toBe(true)
    expect(statusExists.lockReason).toBe('circle_payout')

    const statusMissing = resolveTransactionLockStatus(tx, [sampleDebt], [])
    expect(statusMissing.isLocked).toBe(false)
    expect(statusMissing.isSourceMissing).toBe(true)
  })

  it('buildDebtLookup indexes debt_init and merged entry transaction IDs', () => {
    const debtWithMergedEntry: Debt = {
      ...sampleDebt,
      entries: [
        {
          id: 'entry-merged-1',
          amountFils: 30_000,
          date: new Date(),
          note: '',
          createdAt: new Date(),
          isMerged: true,
          mergedTransactionIds: ['merged-tx-1', 'merged-tx-2'],
        },
      ],
    }

    const lookup = buildDebtLookup([debtWithMergedEntry])
    expect(lookup.entryTxIdsSet.has('debt_init_debt-123')).toBe(true)
    expect(lookup.entryTxIdsSet.has('merged-tx-1')).toBe(true)
    expect(lookup.entryTxIdsSet.has('merged-tx-2')).toBe(true)
    expect(lookup.entryTxIdsSet.has('debt_entry_entry-merged-1')).toBe(true)
  })

  it('locks compacted/merged debt entry transaction', () => {
    const debtWithMergedEntry: Debt = {
      ...sampleDebt,
      entries: [
        {
          id: 'entry-merged-1',
          amountFils: 30_000,
          date: new Date(),
          note: '',
          createdAt: new Date(),
          isMerged: true,
          mergedTransactionIds: ['merged-tx-1', 'merged-tx-2'],
        },
      ],
    }

    const tx: Transaction = {
      id: 'merged-tx-1',
      title: 'دفعة سابقة مدمجة في بند دين',
      amountFils: 15_000,
      type: 'expense',
      date: new Date(),
      categoryId: 'cat-1',
      note: '',
      createdAt: new Date(),
    }

    const status = resolveTransactionLockStatus(tx, [debtWithMergedEntry], [sampleCircle])
    expect(status.isLocked).toBe(true)
    expect(status.lockReason).toBe('debt_entry')
    expect(status.isMergedEntryTx).toBe(true)
    expect(status.isSourceMissing).toBe(false)
  })
})
