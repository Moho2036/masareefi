import { useCallback, useMemo } from 'react'
import { useUserSettings } from './useUserSettings'
import {
  formatMoney,
  formatSigned,
  getCurrencyConfig,
  type CurrencyInfo,
  type FormatOptions,
} from '../lib/money'

export interface UseCurrencyResult {
  currency: string
  config: CurrencyInfo
  format: (fils: number, opts?: FormatOptions) => string
  formatWithSign: (fils: number, type: 'expense' | 'income', opts?: FormatOptions) => string
}

export function useCurrency(): UseCurrencyResult {
  const { data: settings } = useUserSettings()
  const currency = settings?.currency || 'JOD'
  const customDecimals = settings?.customCurrencyDecimals
  const hideBalances = Boolean(settings?.hideBalances)
  const hideZeroDecimals = settings?.hideZeroDecimals ?? true

  const config = useMemo(
    () => getCurrencyConfig(currency, customDecimals),
    [currency, customDecimals]
  )

  const format = useCallback(
    (fils: number, opts?: FormatOptions) => {
      return formatMoney(fils, currency, {
        maskAmount: opts?.maskAmount !== undefined ? opts.maskAmount : hideBalances,
        hideZeroDecimals:
          opts?.hideZeroDecimals !== undefined ? opts.hideZeroDecimals : hideZeroDecimals,
        customDecimals: opts?.customDecimals !== undefined ? opts.customDecimals : customDecimals,
        ...opts,
      })
    },
    [currency, hideBalances, hideZeroDecimals, customDecimals]
  )

  const formatWithSign = useCallback(
    (fils: number, type: 'expense' | 'income', opts?: FormatOptions) => {
      return formatSigned(fils, type, {
        maskAmount: opts?.maskAmount !== undefined ? opts.maskAmount : hideBalances,
        hideZeroDecimals:
          opts?.hideZeroDecimals !== undefined ? opts.hideZeroDecimals : hideZeroDecimals,
        customDecimals: opts?.customDecimals !== undefined ? opts.customDecimals : customDecimals,
        currency,
        ...opts,
      })
    },
    [currency, hideBalances, hideZeroDecimals, customDecimals]
  )

  return { currency, config, format, formatWithSign }
}
