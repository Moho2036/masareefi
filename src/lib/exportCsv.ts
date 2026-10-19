import { format } from 'date-fns'
import { fromFils } from './money'
import type { Transaction, Debt, Category } from '../types'

/**
 * Escapes a cell value according to standard CSV rules (RFC 4180):
 * If the value contains commas, quotes, or newlines, it must be enclosed in double quotes
 * and any internal double quotes must be doubled.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  let str = String(value)
  if (typeof value === 'string' && /^[=+\-@]/.test(str)) {
    str = `'${str}`
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Builds a valid CSV string with UTF-8 BOM (\uFEFF) at the start
 * so Microsoft Excel renders Arabic characters accurately.
 */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n')
}

/**
 * Triggers a client-side download of a CSV file.
 */
export function triggerCsvDownload(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export interface ExportCurrencyOptions {
  symbol?: string
  decimals?: number
}

/**
 * Converts transactions into formatted CSV content and triggers download.
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  options?: ExportCurrencyOptions
): void {
  const categoryMap = new Map<string, string>()
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name)
  }

  const symbol = options?.symbol ?? 'د.أ'
  const decimals = options?.decimals ?? 3

  const headers = ['التاريخ', 'النوع', 'التصنيف', 'العنوان', 'الملاحظة', `المبلغ (${symbol})`]

  const rows = transactions.map((tx) => {
    const dateStr = format(tx.date, 'yyyy-MM-dd')
    const typeStr = tx.type === 'expense' ? 'مصروف' : 'دخل'
    const categoryStr = categoryMap.get(tx.categoryId) || 'غير محدد'
    const titleStr = tx.title || ''
    const noteStr = tx.note || ''
    const amountStr = fromFils(tx.amountFils).toFixed(decimals)

    return [dateStr, typeStr, categoryStr, titleStr, noteStr, amountStr]
  })

  const csv = buildCsv(headers, rows)
  const today = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`masareefi_transactions_${today}.csv`, csv)
}

/**
 * Converts debts into formatted CSV content and triggers download.
 */
export function exportDebtsToCsv(debts: Debt[], options?: ExportCurrencyOptions): void {
  const symbol = options?.symbol ?? 'د.أ'
  const decimals = options?.decimals ?? 3

  const headers = [
    'اسم الشخص',
    'النوع',
    `المبلغ الأصلي (${symbol})`,
    `المسدد (${symbol})`,
    `المتبقي (${symbol})`,
    'الحالة',
    'تاريخ الدين',
    'تاريخ الاستحقاق',
  ]

  const rows = debts.map((d) => {
    const personName = d.personName
    const typeStr = d.type === 'lent' ? 'لي (أطلبهم)' : 'عليّ (يطلبوني)'
    const originalAmount = fromFils(d.amountFils).toFixed(decimals)
    const paidAmount = fromFils(d.paidFils).toFixed(decimals)
    const remainingAmount = fromFils(Math.max(0, d.amountFils - d.paidFils)).toFixed(decimals)
    const statusStr = d.settled ? 'مسدد بالكامل' : 'مفتوح'
    const startDateStr = format(d.startDate, 'yyyy-MM-dd')
    const dueDateStr = d.dueDate ? format(d.dueDate, 'yyyy-MM-dd') : 'غير محدد'

    return [
      personName,
      typeStr,
      originalAmount,
      paidAmount,
      remainingAmount,
      statusStr,
      startDateStr,
      dueDateStr,
    ]
  })

  const csv = buildCsv(headers, rows)
  const today = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`masareefi_debts_${today}.csv`, csv)
}
