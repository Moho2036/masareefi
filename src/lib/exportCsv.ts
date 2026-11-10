import { format } from 'date-fns'
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
 * Formats integer fils directly into decimal string without floating point drift.
 */
export function formatFilsForCsv(fils: number, decimals = 3): string {
  if (!Number.isFinite(fils)) return (0).toFixed(decimals)
  if (decimals === 0) return Math.round(fils / 1000).toFixed(0)
  if (decimals === 2) return (Math.round(fils / 10) / 100).toFixed(2)
  if (decimals === 3) return (Math.round(fils) / 1000).toFixed(3)
  const factor = Math.pow(10, decimals)
  return (Math.round((fils / 1000) * factor) / factor).toFixed(decimals)
}

/**
 * Maps transactions into standardized CSV row format.
 */
export function buildTransactionCsvRows(
  transactions: Transaction[],
  categoryMap: Map<string, string>,
  symbol: string,
  decimals: number
): (string | number)[][] {
  return transactions.map((tx) => {
    const d = tx.date instanceof Date ? tx.date : new Date(tx.date)
    const dateStr = format(d, 'yyyy-MM-dd')
    const typeStr = tx.type === 'expense' ? 'مصروف' : 'دخل'
    const categoryStr = categoryMap.get(tx.categoryId) || 'غير محدد'
    const titleStr = tx.title || ''
    const noteStr = tx.note || ''
    const amountStr = formatFilsForCsv(tx.amountFils, decimals)
    return [dateStr, typeStr, categoryStr, titleStr, noteStr, amountStr, symbol]
  })
}

/**
 * Triggers a client-side download of a CSV file.
 */
function triggerCsvDownload(filename: string, csvContent: string): void {
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
  const rows = buildTransactionCsvRows(transactions, categoryMap, symbol, decimals)

  const csv = buildCsv(headers, rows)
  const today = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`baseer_transactions_${today}.csv`, csv)
}

/**
 * Converts all financial data (transactions, debts, recurring, circles) into a unified CSV report and triggers download.
 */
export function exportAllFinancialDataToCsv(
  data: {
    transactions: Transaction[]
    categories: Category[]
    debts: Debt[]
    recurring: Recurring[]
    circles: MoneyCircle[]
  },
  currency?: ExportCurrencyOptions
): void {
  const symbol = currency?.symbol ?? 'د.أ'
  const decimals = currency?.decimals ?? 3

  const categoryMap = new Map<string, string>()
  for (const cat of data.categories) {
    categoryMap.set(cat.id, cat.name)
  }

  // 1. Transactions
  const txHeaders = ['التاريخ', 'النوع', 'التصنيف', 'العنوان', 'الملاحظة', `المبلغ (${symbol})`, 'العملة']
  const txRows = buildTransactionCsvRows(data.transactions, categoryMap, symbol, decimals)

  // 2. Debts
  const debtHeaders = [
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
  const debtRows = data.debts.map((d) => {
    const personName = d.personName
    const typeStr = d.type === 'lent' ? 'لي (أطلبهم)' : 'عليّ (يطلبوني)'
    const originalAmount = formatFilsForCsv(d.amountFils, decimals)
    const paidAmount = formatFilsForCsv(d.paidFils, decimals)
    const remainingAmount = formatFilsForCsv(Math.max(0, d.amountFils - d.paidFils), decimals)
    const statusStr = d.settled ? 'مسدد بالكامل' : 'مفتوح'
    const paymentsCount = String((d.payments || []).length)
    const startD = d.startDate instanceof Date ? d.startDate : new Date(d.startDate)
    const startDateStr = format(startD, 'yyyy-MM-dd')
    const dueDateStr = d.dueDate
      ? format(d.dueDate instanceof Date ? d.dueDate : new Date(d.dueDate), 'yyyy-MM-dd')
      : 'غير محدد'
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

  // 3. Recurring
  const frequencyMap: Record<string, string> = {
    daily: 'يومي',
    weekly: 'أسبوعي',
    biweekly: 'كل أسبوعين',
    monthly: 'شهري',
    quarterly: 'ربع سنوي',
    semiannual: 'نصف سنوي',
    yearly: 'سنوي',
  }
  const recHeaders = [
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
  const recRows = data.recurring.map((r) => {
    const titleStr = r.title || ''
    const typeStr = r.type === 'expense' ? 'مصروف' : 'دخل'
    const categoryStr = categoryMap.get(r.categoryId) || 'غير محدد'
    const amountStr = formatFilsForCsv(r.amountFils, decimals)
    const freqStr = frequencyMap[r.frequency] || r.frequency
    const statusStr = r.active ? 'نشط' : 'متوقف'
    const startD = r.startDate instanceof Date ? r.startDate : new Date(r.startDate)
    const nextD = r.nextDate instanceof Date ? r.nextDate : new Date(r.nextDate)
    const startDateStr = format(startD, 'yyyy-MM-dd')
    const nextDateStr = format(nextD, 'yyyy-MM-dd')
    const endDateStr = r.endDate
      ? format(r.endDate instanceof Date ? r.endDate : new Date(r.endDate), 'yyyy-MM-dd')
      : 'مستمر'
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

  // 4. Money Circles
  const circleHeaders = [
    'اسم الجمعية',
    `القسط الشهري (${symbol})`,
    'عدد الأعضاء',
    `إجمالي القبض (${symbol})`,
    'دوري في الشهر',
    'الحالة',
    'تاريخ البدء',
    'العملة',
  ]
  const circleRows = data.circles.map((c) => {
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
        : c.shareType === 'double' && c.secondTurnMonth
          ? c.totalAmountFils * 2
          : c.totalAmountFils

    const monthlyStr = formatFilsForCsv(userMonthlyFils, decimals)
    const membersCountStr = String(c.membersCount)
    const totalStr = formatFilsForCsv(userTotalPayoutFils, decimals)
    const myTurnStr =
      c.shareType === 'double' && c.secondTurnMonth
        ? `${c.myTurnMonth} ، ${c.secondTurnMonth}`
        : String(c.myTurnMonth)
    const statusStr = c.status === 'active' ? 'نشطة' : 'مكتملة'
    const startD = c.startDate instanceof Date ? c.startDate : new Date(c.startDate)
    const startDateStr = format(startD, 'yyyy-MM-dd')
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

  const formatSection = (title: string, headers: string[], rows: (string | number)[][]) => {
    const sectionTitleLine = escapeCsvCell(title)
    const headerLine = headers.map(escapeCsvCell).join(',')
    const rowLines = rows.map((r) => r.map(escapeCsvCell).join(','))
    return [sectionTitleLine, headerLine, ...rowLines].join('\r\n')
  }

  const sections = [
    formatSection('=== سجل المعاملات المالية ===', txHeaders, txRows),
    formatSection('=== سجل الديون والالتزامات ===', debtHeaders, debtRows),
    formatSection('=== المعاملات المتكررة ===', recHeaders, recRows),
    formatSection('=== الجمعيات المالية ===', circleHeaders, circleRows),
  ]

  const fullCsv = '\uFEFF' + sections.join('\r\n\r\n')
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  triggerCsvDownload(`baseer_full_report_${dateStr}.csv`, fullCsv)
}
