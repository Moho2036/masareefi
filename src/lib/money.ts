export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  decimals: number
  flag: string
}

export const PRESET_CURRENCIES: Record<string, CurrencyInfo> = {
  JOD: { code: 'JOD', name: 'دينار أردني', symbol: 'د.أ', decimals: 3, flag: '🇯🇴' },
  SAR: { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', decimals: 2, flag: '🇸🇦' },
  USD: { code: 'USD', name: 'دولار أمريكي', symbol: '$', decimals: 2, flag: '🇺🇸' },
  EUR: { code: 'EUR', name: 'يورو أوروبي', symbol: '€', decimals: 2, flag: '🇪🇺' },
  AED: { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, flag: '🇦🇪' },
}

export function getCurrencyConfig(currencyCode?: string): CurrencyInfo {
  if (!currencyCode || currencyCode === 'JOD') {
    return PRESET_CURRENCIES.JOD
  }
  if (PRESET_CURRENCIES[currencyCode]) {
    return PRESET_CURRENCIES[currencyCode]
  }
  // Custom user currency: default to 2 decimal places with the custom string as symbol
  const clean = currencyCode.trim().slice(0, 20)
  return {
    code: clean,
    name: clean,
    symbol: clean,
    decimals: 2,
    flag: '🪙',
  }
}

/**
 * Returns a suitable input placeholder according to currency decimal places.
 * e.g. 3 decimals -> '0.000', 2 decimals -> '0.00'
 */
export function getCurrencyPlaceholder(decimals: number): string {
  return decimals === 3 ? '0.000' : '0.00'
}

export interface FormatOptions {
  showCurrency?: boolean
  currency?: string
}

export type FormatJODOptions = FormatOptions

const formattersCache = new Map<number, Intl.NumberFormat>()

function getFormatter(decimals: number): Intl.NumberFormat {
  let formatter = formattersCache.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat('ar-JO', {
      numberingSystem: 'latn',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    formattersCache.set(decimals, formatter)
  }
  return formatter
}

/**
 * Converts a currency amount (string or number) into integer thousandths (1 unit = 1000 fils/base units).
 * Handles inputs like '12.5', '12.500', '1,250.500', '12,5', '12,500', Arabic numerals, etc.
 */
export function toFils(input: string | number): number {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return 0
    return Math.round(input * 1000)
  }

  if (typeof input !== 'string') return 0

  // Normalize Eastern Arabic / Persian numerals to Latin
  const normalized = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .trim()

  if (!normalized) return 0

  // Strip all whitespace
  let clean = normalized.replace(/\s+/g, '')

  // Handle both comma and dot present
  if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',')
    const lastDot = clean.lastIndexOf('.')
    if (lastComma < lastDot) {
      // 1,250.50 -> comma is thousands separator
      clean = clean.replace(/,/g, '')
    } else {
      // 1.250,50 -> dot is thousands separator
      clean = clean.replace(/\./g, '').replace(/,/g, '.')
    }
  } else if (clean.includes(',')) {
    // Only comma present
    const commaCount = (clean.match(/,/g) || []).length
    if (commaCount > 1) {
      // Multiple commas e.g. 1,000,000 -> thousands separator
      clean = clean.replace(/,/g, '')
    } else {
      // Single comma and no dot: always treat as decimal comma
      clean = clean.replace(',', '.')
    }
  }

  const num = parseFloat(clean)
  if (isNaN(num) || !isFinite(num)) return 0
  return Math.round(num * 1000)
}

/**
 * Converts integer base units back to decimal units (e.g. 12500 -> 12.5).
 */
export function fromFils(fils: number): number {
  if (isNaN(fils) || !isFinite(fils)) return 0
  return fils / 1000
}

/**
 * Formats amount according to specified currency (or JOD by default).
 */
export function formatMoney(
  fils: number,
  currencyCode?: string,
  opts: FormatOptions = {}
): string {
  const code = currencyCode || opts.currency
  const config = getCurrencyConfig(code)
  const amount = fromFils(fils)
  const formatter = getFormatter(config.decimals)
  const formattedNumber = formatter.format(amount)

  if (opts.showCurrency === false) {
    return formattedNumber
  }
  return `${formattedNumber} ${config.symbol}`
}

/**
 * Formats fils as currency representation (defaults to JOD for backward compatibility).
 */
export function formatJOD(fils: number, opts: FormatOptions = {}): string {
  return formatMoney(fils, opts.currency, opts)
}

/**
 * Formats fils with a leading positive (+) or negative (-) sign based on transaction type.
 * e.g. formatSigned(12500, 'income') -> "+ 12.500 د.أ"
 *      formatSigned(12500, 'expense') -> "- 12.500 د.أ"
 */
export function formatSigned(
  fils: number,
  type: 'expense' | 'income',
  opts: FormatOptions = {}
): string {
  const prefix = type === 'income' ? '+ ' : '- '
  const absFormatted = formatMoney(Math.abs(fils), opts.currency, opts)
  return `${prefix}${absFormatted}`
}
