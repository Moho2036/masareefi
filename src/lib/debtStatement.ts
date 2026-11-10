import { format } from 'date-fns'
import type { Debt } from '../types'
import { getDebtRemainingFils } from './debts'
import { fromFils, getCurrencyConfig } from './money'

export function formatDebtAccountStatement(
  debt: Debt,
  currencySymbol = 'د.أ',
  currencyCodeOrDecimals?: string | number
): string {
  const decimals =
    typeof currencyCodeOrDecimals === 'number'
      ? currencyCodeOrDecimals
      : getCurrencyConfig(currencyCodeOrDecimals).decimals
  const factor = Math.pow(10, decimals)
  const formatAmount = (fils: number): number => Math.round(fromFils(fils) * factor) / factor

  const isLent = debt.type === 'lent'
  const typeText = isLent ? 'مستحقات لك (سلف / إقراض)' : 'التزامات عليك (اقتراض)'
  const statusText = debt.settled ? 'مسدد بالكامل' : 'قيد السداد'
  const remaining = getDebtRemainingFils(debt)

  const entriesText =
    debt.entries && debt.entries.length > 0
      ? debt.entries
          .map(
            (e, idx) =>
              `${idx + 1}. ${format(new Date(e.date), 'yyyy/MM/dd')}: ${formatAmount(e.amountFils)} ${currencySymbol}${e.title ? ` (${e.title})` : ''}${e.note ? ` - ${e.note}` : ''}`
          )
          .join('\n')
      : `1. ${format(new Date(debt.startDate), 'yyyy/MM/dd')}: ${formatAmount(debt.amountFils)} ${currencySymbol}${debt.note ? ` - ${debt.note}` : ''}`

  let paymentsText = 'لا توجد دفعات مسجلة بعد.'
  if (debt.payments && debt.payments.length > 0) {
    paymentsText = debt.payments
      .map(
        (p, idx) =>
          `${idx + 1}. ${format(new Date(p.date), 'yyyy/MM/dd')}: ${formatAmount(p.amountFils)} ${currencySymbol}${p.note ? ` (${p.note})` : ''}`
      )
      .join('\n')
  }

  return `*كشف حساب مالي - تطبيق بَصير*
────────────────
*الطرف:* ${debt.personName}
*نوع المعاملة:* ${typeText}
*الحالة:* ${statusText}

*تفاصيل السلف وأصل الدين:*
${entriesText}

*سجل الدفعات المسددة:*
${paymentsText}

────────────────
*إجمالي المبلغ:* ${formatAmount(debt.amountFils)} ${currencySymbol}
*المسدد:* ${formatAmount(debt.paidFils || 0)} ${currencySymbol}
*المتبقي:* ${formatAmount(remaining)} ${currencySymbol}
────────────────
تم إنشاء كشف الحساب في ${format(new Date(), 'yyyy/MM/dd')}`
}
