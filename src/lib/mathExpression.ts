/**
 * Pure helper functions for evaluating arithmetic expressions in amount input fields.
 * Supports +, -, *, / with standard operator precedence and handles Arabic/Indic digits,
 * Persian digits, Arabic decimal separator (٫), and comma/dot thousand/decimal separators.
 */

export function hasMathOperator(expr: string): boolean {
  if (!expr) return false
  const normalized = expr
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/\s+/g, '')
  const withoutLeadingSign = normalized.replace(/^[+-]/, '')
  return /[+\-*/]/.test(withoutLeadingSign)
}

export function cleanNumberToken(raw: string): number {
  if (!raw) return NaN
  if ((raw.match(/\./g) || []).length > 1) return NaN
  if (raw.includes(',')) {
    if (raw.includes('.')) {
      if (raw.lastIndexOf(',') < raw.lastIndexOf('.')) {
        raw = raw.replace(/,/g, '')
      } else {
        raw = raw.replace(/\./g, '').replace(/,/g, '.')
      }
    } else {
      const parts = raw.split(',')
      if (parts.length > 2) {
        raw = raw.replace(/,/g, '')
      } else if (parts[1].length === 3 && parts[0].length >= 1) {
        raw = raw.replace(/,/g, '')
      } else {
        raw = parts[0] + '.' + parts[1]
      }
    }
  }
  return Number(raw)
}

export function evaluateMathExpression(expr: string): number | null {
  if (!expr) return null
  let normalized = expr
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/\u066B/g, '.')
    .replace(/\u060C/g, ',')
    .replace(/\s+/g, '')

  normalized = normalized.replace(/[^\d.,+\-*/]/g, '')
  normalized = normalized.replace(/[+\-*/.,]+$/, '')
  if (!normalized) return null

  try {
    const tokens: string[] = []
    let currentNum = ''
    let i = 0

    if (normalized[0] === '+' || normalized[0] === '-') {
      currentNum += normalized[0]
      i = 1
    }

    for (; i < normalized.length; i++) {
      const ch = normalized[i]
      if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
        if (currentNum) {
          tokens.push(currentNum)
          currentNum = ''
        }
        tokens.push(ch)
      } else {
        currentNum += ch
      }
    }
    if (currentNum) {
      tokens.push(currentNum)
    }

    if (tokens.length === 0) return null

    const firstPass: (number | string)[] = []
    let idx = 0
    while (idx < tokens.length) {
      const tok = tokens[idx]
      if (tok === '*' || tok === '/') {
        const prevTok = firstPass.pop()
        const prev = typeof prevTok === 'number' ? prevTok : cleanNumberToken(String(prevTok))
        const nextRaw = tokens[++idx]
        const next = cleanNumberToken(nextRaw)
        if (isNaN(prev) || isNaN(next)) return null
        if (tok === '/' && next === 0) return null
        firstPass.push(tok === '*' ? prev * next : prev / next)
      } else if (tok === '+' || tok === '-') {
        firstPass.push(tok)
      } else {
        const num = cleanNumberToken(tok)
        if (isNaN(num)) return null
        firstPass.push(num)
      }
      idx++
    }

    if (firstPass.length === 0) return null
    let result = typeof firstPass[0] === 'number' ? firstPass[0] : cleanNumberToken(String(firstPass[0]))
    if (isNaN(result)) return null

    let j = 1
    while (j < firstPass.length) {
      const op = firstPass[j]
      const nextTok = firstPass[j + 1]
      const nextVal = typeof nextTok === 'number' ? nextTok : cleanNumberToken(String(nextTok))
      if (isNaN(nextVal)) return null
      if (op === '+') result += nextVal
      else if (op === '-') result -= nextVal
      else return null
      j += 2
    }

    return isFinite(result) ? result : null
  } catch {
    return null
  }
}
