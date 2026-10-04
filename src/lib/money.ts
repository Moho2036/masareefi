export interface FormatJODOptions {
  showCurrency?: boolean
}

const jodFormatter = new Intl.NumberFormat('ar-JO', {
  numberingSystem: 'latn',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

/**
 * Converts a dinar amount (string or number) into integer fils (1 JOD = 1000 fils).
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
      // Single comma
      const parts = clean.split(',')
      // If the part after comma is exactly 3 digits, treat as thousands separator per "strip spaces/commas, parse"
      if (parts[1] && parts[1].length === 3) {
        clean = clean.replace(',', '')
      } else {
        // e.g. 12,5 or 12,50 -> decimal comma
        clean = clean.replace(',', '.')
      }
    }
  }

  const num = parseFloat(clean)
  if (isNaN(num) || !isFinite(num)) return 0
  return Math.round(num * 1000)
}

/**
 * Converts integer fils back to decimal dinars (e.g. 12500 -> 12.5).
 */
export function fromFils(fils: number): number {
  if (isNaN(fils) || !isFinite(fils)) return 0
  return fils / 1000
}

/**
 * Formats fils as Jordan Dinar representation (e.g. 12500 -> "12.500 د.أ").
 */
export function formatJOD(fils: number, opts: FormatJODOptions = {}): string {
  const amount = fromFils(fils)
  const formattedNumber = jodFormatter.format(amount)
  if (opts.showCurrency === false) {
    return formattedNumber
  }
  return `${formattedNumber} د.أ`
}

/**
 * Formats fils with a leading positive (+) or negative (-) sign based on transaction type.
 * e.g. formatSigned(12500, 'income') -> "+ 12.500 د.أ"
 *      formatSigned(12500, 'expense') -> "- 12.500 د.أ"
 */
export function formatSigned(
  fils: number,
  type: 'expense' | 'income',
  opts: FormatJODOptions = {},
): string {
  const prefix = type === 'income' ? '+ ' : '- '
  const absFormatted = formatJOD(Math.abs(fils), opts)
  return `${prefix}${absFormatted}`
}
