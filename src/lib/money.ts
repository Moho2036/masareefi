import { toWesternDigits } from './dates'

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
  AED: { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, flag: '🇦🇪' },
  KWD: { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك', decimals: 3, flag: '🇰🇼' },
  BHD: { code: 'BHD', name: 'دينار بحريني', symbol: 'د.ب', decimals: 3, flag: '🇧🇭' },
  OMR: { code: 'OMR', name: 'ريال عماني', symbol: 'ر.ع', decimals: 3, flag: '🇴🇲' },
  EGP: { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', decimals: 2, flag: '🇪🇬' },
  USD: { code: 'USD', name: 'دولار أمريكي', symbol: '$', decimals: 2, flag: '🇺🇸' },
  EUR: { code: 'EUR', name: 'يورو أوروبي', symbol: '€', decimals: 2, flag: '🇪🇺' },
}

const THREE_DECIMAL_CODES = new Set([
  'JOD', 'KWD', 'BHD', 'OMR', 'TND', 'LYD', 'IQD',
  'د.أ', 'د.ك', 'د.ب', 'ر.ع', 'د.ت', 'د.ل', 'د.ع'
])

export function getCurrencyConfig(currencyCode?: string): CurrencyInfo {
  if (!currencyCode || currencyCode === 'JOD') {
    return PRESET_CURRENCIES.JOD
  }
  const clean = currencyCode.trim().slice(0, 20)
  const upper = clean.toUpperCase()

  if (PRESET_CURRENCIES[upper]) {
    return PRESET_CURRENCIES[upper]
  }

  // Check preset match by symbol (e.g. if user entered "د.ك" or "د.أ" or "ج.م")
  const matchBySymbol = Object.values(PRESET_CURRENCIES).find(
    (c) => c.symbol === clean || c.code === upper
  )
  if (matchBySymbol) {
    return matchBySymbol
  }

  // Check if custom currency text is a known 3-decimal currency
  const isThreeDecimals = THREE_DECIMAL_CODES.has(clean) || THREE_DECIMAL_CODES.has(upper)
  const decimals = isThreeDecimals ? 3 : 2

  return {
    code: clean,
    name: clean,
    symbol: clean,
    decimals,
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
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    formattersCache.set(decimals, formatter)
  }
  return formatter
}

/**
 * Converts a currency amount (string or number) into integer thousandths (1 unit = 1000 fils/base units).
 * Handles inputs like '12.5', '12.500', '1,250.500', '12,5', '12,500', '1,000', Arabic numerals, etc.
 * Optionally accepts currency code or decimal places to distinguish thousands commas from decimals.
 */
export function toFils(input: string | number, decimalsOrCurrency?: number | string): number {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return 0
    return Math.round(input * 1000)
  }

  if (typeof input !== 'string') return 0

  let decimals: number | undefined
  if (typeof decimalsOrCurrency === 'number') {
    decimals = decimalsOrCurrency
  } else if (typeof decimalsOrCurrency === 'string') {
    decimals = getCurrencyConfig(decimalsOrCurrency).decimals
  }

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
      // Single comma
      const singleCommaMatch = clean.match(/^(\d+),(\d+)$/)
      if (singleCommaMatch) {
        const [, before, after] = singleCommaMatch
        // If before is '0' (e.g. 0,500), it is always a decimal comma
        if (before === '0') {
          clean = clean.replace(',', '.')
        } else if (after.length === 3) {
          // Exactly 3 digits after comma
          // 1. If currency is known to have != 3 decimals (e.g. 2 decimals like SAR, USD, EGP, AED), it must be thousands
          // 2. Or if after is '000' (e.g. 1,000 or 2,000 or 50,000), it's a thousands separator
          if ((decimals !== undefined && decimals !== 3) || after === '000') {
            clean = clean.replace(',', '')
          } else {
            // Default 3-decimal currencies (like JOD) e.g. '12,500' -> 12.500
            clean = clean.replace(',', '.')
          }
        } else {
          // If after is not 3 digits (e.g. 12,5 or 12,50), cannot be thousands separator
          clean = clean.replace(',', '.')
        }
      } else {
        clean = clean.replace(',', '.')
      }
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

/**
 * Formats numbers compactly for chart axes (e.g. 10k, 1.5M, etc.).
 */
export function formatCompactNumber(val: number): string {
  if (isNaN(val) || !isFinite(val)) return '0'
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)
    return `${sign}${toWesternDigits(formatted)}M`
  }
  if (abs >= 1_000) {
    const formatted = (abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)
    return `${sign}${toWesternDigits(formatted)}k`
  }
  return `${sign}${toWesternDigits(String(Math.round(abs)))}`
}
