import React, { useMemo } from 'react'
import { motion } from 'motion/react'
import { useUserSettings } from '../../hooks/useUserSettings'
import { getCurrencyConfig, fromFils, getFormatter } from '../../lib/money'
import { cn } from '../../lib/cn'
import { springBounce, isTestEnv } from '../../lib/motionTokens'

const NUMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

const RollingDigit: React.FC<{ char: string }> = ({ char }) => {
  const digit = parseInt(char, 10)
  if (isNaN(digit)) {
    return <span>{char}</span>
  }

  return (
    <span className="inline-block relative h-[1.1em] w-[0.62em] overflow-hidden align-text-bottom tabular-nums">
      <motion.span
        initial={false}
        animate={{ y: `-${digit * 10}%` }}
        transition={springBounce}
        className="absolute top-0 start-0 flex flex-col items-center w-full"
      >
        {NUMS.map((n) => (
          <span key={n} className="h-[1.1em] leading-none flex items-center justify-center">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export interface FormattedMoneyProps {
  amountFils: number
  currencyCode?: string
  withSign?: 'expense' | 'income' | 'auto'
  hideZeroDecimals?: boolean
  maskAmount?: boolean
  showCurrency?: boolean
  animated?: boolean
  className?: string
  symbolClassName?: string
  decimalClassName?: string
}

export const FormattedMoney: React.FC<FormattedMoneyProps> = ({
  amountFils,
  currencyCode,
  withSign,
  hideZeroDecimals,
  maskAmount,
  showCurrency = true,
  animated = false,
  className,
  symbolClassName,
  decimalClassName,
}) => {
  const { data: settings } = useUserSettings()
  const currency = currencyCode || settings?.currency || 'JOD'
  const customDecimals = settings?.customCurrencyDecimals
  const isMasked = maskAmount !== undefined ? maskAmount : Boolean(settings?.hideBalances)
  const shouldHideZeroDecimals =
    hideZeroDecimals !== undefined ? hideZeroDecimals : (settings?.hideZeroDecimals ?? true)

  const config = useMemo(
    () => getCurrencyConfig(currency, customDecimals),
    [currency, customDecimals]
  )

  if (isMasked) {
    return (
      <span className={cn('inline-flex items-baseline select-none', className)}>
        <span>•••••</span>
        {showCurrency && (
          <span className={cn('ms-1 text-[0.72em] opacity-80 font-medium', symbolClassName)}>
            {config.symbol}
          </span>
        )}
      </span>
    )
  }

  // Determine sign prefix and absolute amount
  let signPrefix = ''
  if (withSign === 'expense') {
    signPrefix = '- '
  } else if (withSign === 'income') {
    signPrefix = '+ '
  } else if (withSign === 'auto') {
    if (amountFils > 0) signPrefix = '+ '
    else if (amountFils < 0) signPrefix = '- '
  } else if (amountFils < 0) {
    signPrefix = '- '
  }

  const absFils = Math.abs(amountFils)
  const factor = Math.pow(10, config.decimals)
  const rawAbsAmount = fromFils(absFils)
  const absAmount = Math.round(rawAbsAmount * factor) / factor
  const isExactInteger = absAmount % 1 === 0
  const decimalsToUse = shouldHideZeroDecimals && isExactInteger ? 0 : config.decimals

  const formattedNumber = getFormatter(decimalsToUse).format(absAmount)

  const [integerPart, decimalPart] = formattedNumber.split('.')

  return (
    <span className={cn('inline-flex items-baseline tabular-nums select-none', className)}>
      <span dir="ltr" className="inline-flex items-baseline">
        {signPrefix && <span className="me-0.5">{signPrefix}</span>}
        <span className="font-bold">
          {animated && !isTestEnv
            ? integerPart.split('').map((char, i) => (
                <RollingDigit key={`${integerPart.length - i}-${char}`} char={char} />
              ))
            : integerPart}
        </span>
        {decimalPart !== undefined && (
          <span className={cn('text-[0.72em] opacity-80 font-medium', decimalClassName)}>
            .{decimalPart}
          </span>
        )}
      </span>
      {showCurrency && (
        <span className={cn('ms-1 text-[0.72em] opacity-80 font-medium', symbolClassName)}>
          {config.symbol}
        </span>
      )}
    </span>
  )
}
