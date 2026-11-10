import { hasMathOperator, evaluateMathExpression } from '../../lib/mathExpression'
import { toFils, MAX_AMOUNT_FILS } from '../../lib/money'
import { parseLocalDateInput } from '../../lib/dates'

export interface ParsedTransactionInput {
  amountFils: number
  parsedAmountStr: string
  parsedDate: Date
  trimmedTitle: string
}

export function validateAndParseTransactionInput(params: {
  amountStr: string
  activeCategoryId: string
  dateStr: string
  title: string
  currencyDecimals: number
  isLockedTransaction?: boolean
  initialAmountFils?: number
}): { success: true; data: ParsedTransactionInput } | { success: false; error: string } {
  const {
    amountStr,
    activeCategoryId,
    dateStr,
    title,
    currencyDecimals,
    isLockedTransaction,
    initialAmountFils,
  } = params

  let parsedAmountStr = amountStr
  if (hasMathOperator(amountStr)) {
    const evaluated = evaluateMathExpression(amountStr)
    if (evaluated === null || evaluated <= 0) {
      return { success: false, error: 'يرجى إدخال مبلغ أو عملية حسابية صحيحة' }
    }
    parsedAmountStr = String(Number(evaluated.toFixed(currencyDecimals)))
  }

  const amountFils =
    isLockedTransaction && initialAmountFils !== undefined
      ? initialAmountFils
      : toFils(parsedAmountStr, currencyDecimals)

  if (amountFils <= 0) {
    return { success: false, error: 'يرجى إدخال مبلغ صحيح أكبر من الصفر' }
  }

  if (amountFils > MAX_AMOUNT_FILS) {
    return { success: false, error: 'المبلغ يتجاوز الحد الأقصى المسموح به' }
  }

  if (!activeCategoryId) {
    return { success: false, error: 'يرجى اختيار التصنيف' }
  }

  const parsedDate = parseLocalDateInput(dateStr)
  if (isNaN(parsedDate.getTime())) {
    return { success: false, error: 'يرجى اختيار تاريخ صالح' }
  }

  const trimmedTitle = title.trim().slice(0, 100)

  return {
    success: true,
    data: {
      amountFils,
      parsedAmountStr,
      parsedDate,
      trimmedTitle,
    },
  }
}
