import React, { useMemo } from 'react'
import { useUserSettings } from '../../hooks/useUserSettings'
import { getCurrencyConfig, fromFils } from '../../lib/money'
import { cn } from '../../lib/cn'

export interface FormattedMoneyProps {
  amountFils: number
  currencyCode?: string
  withSign?: 'expense' | 'income' | 'auto'
  hideZeroDecimals?: boolean
  maskAmount?: boolean
  showCurrency?: boolean
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
  const isExactThousand = absFils % 1000 === 0
  const decimalsToUse = shouldHideZeroDecimals && isExactThousand ? 0 : config.decimals

  const absAmount = fromFils(absFils)
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimalsToUse,
    maximumFractionDigits: decimalsToUse,
  }).format(absAmount)

  const [integerPart, decimalPart] = formattedNumber.split('.')

  return (
    <span className={cn('inline-flex items-baseline tabular-nums select-none', className)}>
      <span dir="ltr" className="inline-flex items-baseline">
        {signPrefix && <span className="me-0.5">{signPrefix}</span>}
        <span className="font-bold">{integerPart}</span>
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
