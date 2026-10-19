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

  const config = useMemo(() => getCurrencyConfig(currency), [currency])

  const format = useCallback(
    (fils: number, opts?: FormatOptions) => {
      return formatMoney(fils, currency, opts)
    },
    [currency]
  )

  const formatWithSign = useCallback(
    (fils: number, type: 'expense' | 'income', opts?: FormatOptions) => {
      return formatSigned(fils, type, { ...opts, currency })
    },
    [currency]
  )

  return { currency, config, format, formatWithSign }
}
