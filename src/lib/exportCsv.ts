import { format } from 'date-fns'
import { fromFils } from './money'
import type { Transaction, Debt, Category, Recurring, MoneyCircle } from '../types'

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
  if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(str)) {
    str = `'${str}`
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Builds a valid CSV string with UTF-8 BOM (\uFEFF) at the start
 * so Microsoft Excel and other spreadsheet viewers render Arabic characters accurately.
 */
export function buildCsv(
  headers: string[],
  rows: (string | number)[][],
  options: { includeSepDirective?: boolean } = {}
): string {
  const includeSepDirective = options.includeSepDirective ?? false
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
  triggerCsvDownload(`baseer_transactions_${today}.csv`, csv)
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
  triggerCsvDownload(`baseer_debts_${today}.csv`, csv)
}

/**
 * Converts recurring rules into formatted CSV content and triggers download.
 */
export function exportRecurringToCsv(
  recurring: Recurring[],
  categories: Category[],
  options?: ExportCurrencyOptions
): void {
  const categoryMap = new Map<string, string>()
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name)
  }

  const symbol = options?.symbol ?? 'د.أ'
  const decimals = options?.decimals ?? 3

  const frequencyMap: Record<string, string> = {
    daily: 'يومي',
    weekly: 'أسبوعي',
    biweekly: 'كل أسبوعين',
    monthly: 'شهري',
    quarterly: 'ربع سنوي',
    semiannual: 'نصف سنوي',
    yearly: 'سنوي',
  }

  const headers = [
    'العنوان',
    'النوع',
    'التصنيف',
    `المبلغ (${symbol})`,
    'التكرار',
    'الحالة',
    'تاريخ البدء',
    'تاريخ الاستحقاق القادم',
    'تاريخ الانتهاء',
    'الملاحظة',
    'العملة',
  ]

  const rows = recurring.map((r) => {
    const titleStr = r.title || ''
    const typeStr = r.type === 'expense' ? 'مصروف' : 'دخل'
    const categoryStr = categoryMap.get(r.categoryId) || 'غير محدد'
    const amountStr = fromFils(r.amountFils).toFixed(decimals)
    const freqStr = frequencyMap[r.frequency] || r.frequency
    const statusStr = r.active ? 'نشط' : 'متوقف'
    const startDateStr = format(r.startDate, 'yyyy-MM-dd')
    const nextDateStr = format(r.nextDate, 'yyyy-MM-dd')
    const endDateStr = r.endDate ? format(r.endDate, 'yyyy-MM-dd') : 'مستمر'
    const noteStr = r.note || ''

    return [
      titleStr,
      typeStr,
      categoryStr,
      amountStr,
      freqStr,
      statusStr,
      startDateStr,
      nextDateStr,
      endDateStr,
      noteStr,
      symbol,
    ]
  })

  const csv = buildCsv(headers, rows)
  const today = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`baseer_recurring_${today}.csv`, csv)
}

/**
 * Converts money circles into formatted CSV content and triggers download.
 */
export function exportCirclesToCsv(
  circles: MoneyCircle[],
  options?: ExportCurrencyOptions
): void {
  const symbol = options?.symbol ?? 'د.أ'
  const decimals = options?.decimals ?? 3

  const headers = [
    'اسم الجمعية',
    `القسط الشهري (${symbol})`,
    'عدد الأعضاء',
    `إجمالي القبض (${symbol})`,
    'دوري في الشهر',
    'الحالة',
    'تاريخ البدء',
    'العملة',
  ]

  const rows = circles.map((c) => {
    const nameStr = c.name
    const userMonthlyFils =
      c.shareType === 'half'
        ? Math.round(c.monthlyAmountFils / 2)
        : c.shareType === 'double'
          ? c.monthlyAmountFils * 2
          : c.monthlyAmountFils
    const userTotalPayoutFils =
      c.shareType === 'half'
        ? Math.round(c.totalAmountFils / 2)
        : c.totalAmountFils

    const monthlyStr = fromFils(userMonthlyFils).toFixed(decimals)
    const membersCountStr = String(c.membersCount)
    const totalStr = fromFils(userTotalPayoutFils).toFixed(decimals)
    const myTurnStr = String(c.myTurnMonth)
    const statusStr = c.status === 'active' ? 'نشطة' : 'مكتملة'
    const startDateStr = format(c.startDate, 'yyyy-MM-dd')

    return [
      nameStr,
      monthlyStr,
      membersCountStr,
      totalStr,
      myTurnStr,
      statusStr,
      startDateStr,
      symbol,
    ]
  })

  const csv = buildCsv(headers, rows)
  const today = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`baseer_circles_${today}.csv`, csv)
}
