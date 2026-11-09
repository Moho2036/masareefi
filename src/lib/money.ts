import { toWesternDigits } from './dates'

export const MAX_AMOUNT_FILS = 1_000_000_000_000

export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  decimals: number
  flag: string
}

export const PRESET_CURRENCIES: Record<string, CurrencyInfo> = {
  JOD: { code: 'JOD', name: 'دينار أردني', symbol: 'د.أ', decimals: 3, flag: 'JOD' },
  SAR: { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', decimals: 2, flag: 'SAR' },
  AED: { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, flag: 'AED' },
  KWD: { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك', decimals: 3, flag: 'KWD' },
  BHD: { code: 'BHD', name: 'دينار بحريني', symbol: 'د.ب', decimals: 3, flag: 'BHD' },
  OMR: { code: 'OMR', name: 'ريال عماني', symbol: 'ر.ع', decimals: 3, flag: 'OMR' },
  EGP: { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', decimals: 2, flag: 'EGP' },
  USD: { code: 'USD', name: 'دولار أمريكي', symbol: '$', decimals: 2, flag: 'USD' },
  EUR: { code: 'EUR', name: 'يورو أوروبي', symbol: '€', decimals: 2, flag: 'EUR' },
}

const THREE_DECIMAL_CODES = new Set([
  'JOD', 'KWD', 'BHD', 'OMR', 'TND', 'LYD', 'IQD',
  'د.أ', 'د.ك', 'د.ب', 'ر.ع', 'د.ت', 'د.ل', 'د.ع'
])

export function getCurrencyConfig(currencyCode?: string, customDecimals?: number | null): CurrencyInfo {
  let baseConfig: CurrencyInfo
  if (!currencyCode || currencyCode === 'JOD') {
    baseConfig = PRESET_CURRENCIES.JOD
  } else {
    const clean = currencyCode.trim().slice(0, 20)
    const upper = clean.toUpperCase()

    if (PRESET_CURRENCIES[upper]) {
      baseConfig = PRESET_CURRENCIES[upper]
    } else {
      const matchBySymbol = Object.values(PRESET_CURRENCIES).find(
        (c) => c.symbol === clean || c.code === upper
      )
      if (matchBySymbol) {
        baseConfig = matchBySymbol
      } else {
        const isThreeDecimals = THREE_DECIMAL_CODES.has(clean) || THREE_DECIMAL_CODES.has(upper)
        const decimals = isThreeDecimals ? 3 : 2
        baseConfig = {
          code: clean,
          name: clean,
          symbol: clean,
          decimals,
          flag: clean.slice(0, 3).toUpperCase(),
        }
      }
    }
  }

  if (customDecimals != null && [0, 2, 3].includes(customDecimals)) {
    return { ...baseConfig, decimals: customDecimals }
  }
  return baseConfig
}

export interface FormatOptions {
  showCurrency?: boolean
  currency?: string
  hideZeroDecimals?: boolean
  maskAmount?: boolean
  customDecimals?: number | null
}

const formattersCache = new Map<number, Intl.NumberFormat>()

export function getFormatter(decimals: number): Intl.NumberFormat {
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
export function toFils(
  input: string | number,
  decimalsOrCurrency?: number | string,
  customDecimals?: number | null
): number {
  let decimals: number | undefined
  if (typeof decimalsOrCurrency === 'number') {
    decimals = decimalsOrCurrency
  } else if (typeof decimalsOrCurrency === 'string') {
    decimals = getCurrencyConfig(decimalsOrCurrency, customDecimals).decimals
  }

  const clampSafe = (val: number): number => {
    if (isNaN(val) || !isFinite(val)) return 0
    if (val > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER
    if (val < -Number.MAX_SAFE_INTEGER) return -Number.MAX_SAFE_INTEGER
    return val
  }

  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return 0
    if (decimals === 0) {
      return clampSafe(Math.round(input) * 1000)
    }
    if (decimals === 2) {
      return clampSafe(Math.round(input * 100) * 10)
    }
    return clampSafe(Math.round(input * 1000))
  }

  if (typeof input !== 'string') return 0

  // Normalize Eastern Arabic / Persian numerals to Latin and Arabic commas to Western
  // and strip invisible bidirectional/formatting characters
  const normalized = input
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/\u066B/g, '.')
    .replace(/\u060C/g, ',')
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
      const singleCommaMatch = clean.match(/^([+-]?\d+),(\d+)$/)
      if (singleCommaMatch) {
        const [, before, after] = singleCommaMatch
        // If before is '0' (e.g. 0,500), it is always a decimal comma
        if (before === '0' || before === '-0' || before === '+0') {
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

  if ((clean.match(/\./g) || []).length > 1 || !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(clean)) {
    return 0
  }

  const num = parseFloat(clean)
  if (isNaN(num) || !isFinite(num)) return 0
  if (decimals === 0) {
    return clampSafe(Math.round(num) * 1000)
  }
  if (decimals === 2) {
    return clampSafe(Math.round(num * 100) * 10)
  }
  return clampSafe(Math.round(num * 1000))
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
  const config = getCurrencyConfig(code, opts.customDecimals)

  if (opts.maskAmount) {
    if (opts.showCurrency === false) {
      return '•••••'
    }
    return `••••• ${config.symbol}`
  }

  const safeFils = typeof fils === 'number' && Number.isFinite(fils) ? fils : 0
  const sign = safeFils < 0 ? -1 : 1
  const absFils = Math.abs(safeFils)

  let roundedAmount: number
  if (config.decimals === 0) {
    roundedAmount = sign * Math.round(absFils / 1000)
  } else if (config.decimals === 2) {
    roundedAmount = sign * (Math.round(absFils / 10) / 100)
  } else if (config.decimals === 3) {
    roundedAmount = sign * (Math.round(absFils) / 1000)
  } else {
    const shift = 3 - config.decimals
    if (shift > 0) {
      const div = Math.pow(10, shift)
      const scale = Math.pow(10, config.decimals)
      roundedAmount = sign * (Math.round(absFils / div) / scale)
    } else {
      const mul = Math.pow(10, -shift)
      roundedAmount = sign * (Math.round(absFils * mul) / 1000)
    }
  }

  const isExactInteger = Math.abs(roundedAmount) % 1 === 0
  const decimalsToUse =
    opts.hideZeroDecimals && isExactInteger ? 0 : config.decimals

  const formatter = getFormatter(decimalsToUse)
  const formattedNumber = formatter.format(Object.is(roundedAmount, -0) ? 0 : roundedAmount)

  if (opts.showCurrency === false) {
    return formattedNumber
  }
  return `${formattedNumber} ${config.symbol}`
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
  const code = opts.currency
  const config = getCurrencyConfig(code, opts.customDecimals)

  if (opts.maskAmount) {
    if (opts.showCurrency === false) {
      return '•••••'
    }
    return `••••• ${config.symbol}`
  }

  const prefix = type === 'income' ? '+ ' : '- '
  const absFormatted = formatMoney(Math.abs(fils), code, opts)
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

/**
 * Detects default currency from browser timezone or locale with JOD as default fallback.
 */
export function detectDefaultCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const lang = typeof navigator !== 'undefined' ? navigator.language : ''
    if (tz.includes('Amman') || lang === 'ar-JO') return 'JOD'
    if (tz.includes('Riyadh') || lang === 'ar-SA') return 'SAR'
    if (tz.includes('Dubai') || lang === 'ar-AE') return 'AED'
    if (tz.includes('Kuwait') || lang === 'ar-KW') return 'KWD'
    if (tz.includes('Bahrain') || lang === 'ar-BH') return 'BHD'
    if (tz.includes('Muscat') || lang === 'ar-OM') return 'OMR'
    if (tz.includes('Cairo') || lang === 'ar-EG') return 'EGP'
    if (tz.includes('Europe')) return 'EUR'
    if (tz.includes('America') || tz.includes('US') || lang === 'en-US') return 'USD'
  } catch {
    // fallback
  }
  return 'JOD'
}
