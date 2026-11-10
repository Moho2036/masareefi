import type { MoneyCircle, Frequency } from '../../types'
import { updateMoneyCircle } from '../../services/moneyCircles'

export const frequencyLabels: Record<Frequency, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  biweekly: 'كل أسبوعين',
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  semiannual: 'نصف سنوي',
  yearly: 'سنوي',
}

export async function syncCircleRecurringAmounts(
  uid: string,
  circleId: string,
  amountFils: number,
  circles: MoneyCircle[]
) {
  const linked = circles.find((c) => c.id === circleId)
  if (!linked) return

  const expectedCircleMonthly =
    linked.shareType === 'half'
      ? amountFils * 2
      : linked.shareType === 'double'
        ? Math.round(amountFils / 2)
        : amountFils

  if (linked.monthlyAmountFils !== expectedCircleMonthly) {
    await updateMoneyCircle(uid, linked.id, {
      monthlyAmountFils: expectedCircleMonthly,
      totalAmountFils: expectedCircleMonthly * linked.membersCount,
    }).catch(() => {})
  }
}
