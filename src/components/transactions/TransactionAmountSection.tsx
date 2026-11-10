import React from 'react'
import { SegmentedControl } from '../ui/SegmentedControl'
import { FormattedMoney } from '../ui/FormattedMoney'
import { toFils } from '../../lib/money'
import { hasMathOperator, evaluateMathExpression } from '../../lib/mathExpression'
import { cn } from '../../lib/cn'
import type { TxType } from '../../types'
import type { ForecastResult } from '../../lib/forecast'

export interface TransactionAmountSectionProps {
  type: TxType
  onTypeChange: (type: TxType) => void
  typeDisabled: boolean
  amountStr: string
  onAmountChange: (val: string) => void
  amountInputRef: React.RefObject<HTMLInputElement | null>
  isLockedTransaction: boolean
  isEditing: boolean
  isTouchDevice: boolean
  currencyConfig: { decimals: number; symbol: string }
  error: string | null
  forecast: ForecastResult | null
  onClearError?: () => void
}

const typeOptions: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'دخل' },
]

export const TransactionAmountSection: React.FC<TransactionAmountSectionProps> = ({
  type,
  onTypeChange,
  typeDisabled,
  amountStr,
  onAmountChange,
  amountInputRef,
  isLockedTransaction,
  isEditing,
  isTouchDevice,
  currencyConfig,
  error,
  forecast,
  onClearError,
}) => {
  const handleEvaluateMath = () => {
    if (hasMathOperator(amountStr)) {
      const evaluated = evaluateMathExpression(amountStr)
      if (evaluated !== null && evaluated >= 0) {
        onAmountChange(String(Number(evaluated.toFixed(currencyConfig.decimals))))
      }
    }
  }

  return (
    <div className="space-y-3.5">
      {/* Type Toggle: مصروف / دخل */}
      <div>
        <SegmentedControl<TxType>
          value={type}
          disabled={typeDisabled}
          onChange={(newType) => {
            onTypeChange(newType)
            onClearError?.()
          }}
          options={typeOptions}
          className="w-full"
        />
      </div>

      {/* Big Amount Input */}
      <div>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900/70 rounded-xl border transition-all',
            error && amountStr && toFils(amountStr, currencyConfig.decimals) <= 0
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-[#E4E4E7] dark:border-[#27272A] focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20',
            isLockedTransaction && 'opacity-70 bg-zinc-100 dark:bg-zinc-800/80 cursor-not-allowed'
          )}
        >
          <input
            ref={amountInputRef}
            id="tx-amount"
            aria-label="المبلغ"
            type="text"
            inputMode="decimal"
            readOnly={isLockedTransaction}
            disabled={isLockedTransaction}
            value={amountStr}
            onChange={(e) => {
              if (isLockedTransaction) return
              onAmountChange(e.target.value)
              onClearError?.()
            }}
            onKeyDown={(e) => {
              if (e.key === '=') {
                e.preventDefault()
                handleEvaluateMath()
              }
            }}
            onBlur={handleEvaluateMath}
            placeholder={currencyConfig.decimals === 3 ? '0.000' : '0.00'}
            className={cn(
              'w-full bg-transparent text-2xl lg:text-3xl font-black text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none',
              isLockedTransaction && 'cursor-not-allowed'
            )}
            autoFocus={!isEditing && !isLockedTransaction && !isTouchDevice}
          />
          <span className="text-base lg:text-lg font-bold text-zinc-400 dark:text-zinc-500 select-none pe-1">
            {currencyConfig.symbol}
          </span>
        </div>

        {/* Guidance Subline for Expense in Current Month */}
        {type === 'expense' && forecast && forecast.isCurrentMonth && (
          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 px-1 font-medium">
            <span>
              الرصيد المتاح الحر:{' '}
              <strong
                className={cn(
                  forecast.freeBalance < 0
                    ? 'text-red-500 dark:text-red-400 font-bold'
                    : 'text-zinc-700 dark:text-zinc-200'
                )}
              >
                <FormattedMoney amountFils={forecast.freeBalance} />
              </strong>
            </span>
            <span>
              حد الصرف اليومي الآمن:{' '}
              <strong
                className={cn(
                  forecast.dailySafeFils > 0
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : forecast.dailySafeFils < 0
                      ? 'text-red-600 dark:text-red-400 font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 font-bold'
                )}
              >
                <FormattedMoney amountFils={forecast.dailySafeFils} />
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
