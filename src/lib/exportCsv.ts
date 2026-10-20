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
 * and sep=, directive so Microsoft Excel renders Arabic characters and columns accurately.
 */
export function buildCsv(
  headers: string[],
  rows: (string | number)[][],
  options: { includeSepDirective?: boolean } = {}
): string {
  const includeSepDirective = options.includeSepDirective ?? true
  const headerLine = headers.map(escapeCsvCell).join(',')
  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(','))
  const prefix = includeSepDirective ? '\uFEFFsep=,\r\n' : '\uFEFF'
  return prefix + [headerLine, ...rowLines].join('\r\n')
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

  const headers = ['التاريخ', 'النوع', 'التصنيف', 'العنوان', 'الملاحظة', `المبلغ (${symbol})`, 'العملة']

  const rows = transactions.map((tx) => {
    const dateStr = format(tx.date, 'yyyy-MM-dd')
    const typeStr = tx.type === 'expense' ? 'مصروف' : 'دخل'
    const categoryStr = categoryMap.get(tx.categoryId) || 'غير محدد'
    const titleStr = tx.title || ''
    const noteStr = tx.note || ''
    const amountStr = fromFils(tx.amountFils).toFixed(decimals)

    return [dateStr, typeStr, categoryStr, titleStr, noteStr, amountStr, symbol]
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
    'العملة',
    'الحالة',
    'عدد الدفعات',
    'تاريخ الدين',
    'تاريخ الاستحقاق',
    'الملاحظة',
  ]

  const rows = debts.map((d) => {
    const personName = d.personName
    const typeStr = d.type === 'lent' ? 'لي (أطلبهم)' : 'عليّ (يطلبوني)'
    const originalAmount = fromFils(d.amountFils).toFixed(decimals)
    const paidAmount = fromFils(d.paidFils).toFixed(decimals)
    const remainingAmount = fromFils(Math.max(0, d.amountFils - d.paidFils)).toFixed(decimals)
    const statusStr = d.settled ? 'مسدد بالكامل' : 'مفتوح'
    const paymentsCount = String((d.payments || []).length)
    const startDateStr = format(d.startDate, 'yyyy-MM-dd')
    const dueDateStr = d.dueDate ? format(d.dueDate, 'yyyy-MM-dd') : 'غير محدد'
    const noteStr = d.note || ''

    return [
      personName,
      typeStr,
      originalAmount,
      paidAmount,
      remainingAmount,
      symbol,
      statusStr,
      paymentsCount,
      startDateStr,
      dueDateStr,
      noteStr,
    ]
  })

  const csv = buildCsv(headers, rows)
  const today = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`masareefi_debts_${today}.csv`, csv)
}
