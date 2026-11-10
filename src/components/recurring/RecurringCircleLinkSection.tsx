import React from 'react'
import { Select } from '../ui/Select'
import { useCurrency } from '../../hooks/useCurrency'
import type { MoneyCircle } from '../../types'

export interface RecurringCircleLinkSectionProps {
  availableCircles: MoneyCircle[]
  circleId: string
  isCircleLinked: boolean
  skipMonth?: number
  skipMonths?: number[]
  onChangeCircle: (circleId: string) => void
}

export const RecurringCircleLinkSection: React.FC<RecurringCircleLinkSectionProps> = ({
  availableCircles,
  circleId,
  isCircleLinked,
  skipMonth,
  skipMonths,
  onChangeCircle,
}) => {
  const { format: formatCurrency } = useCurrency()

  return (
    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
      <Select
        id="recurring-circle-select"
        label="ربط مع جمعية نشطة (تخطي الخصم في شهر الاستلام):"
        value={circleId}
        disabled={isCircleLinked}
        onChange={(e) => onChangeCircle(e.target.value)}
      >
        <option value="">-- ليست مرتبطة بجمعية --</option>
        {availableCircles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} (قسط: {formatCurrency(c.monthlyAmountFils)} - شهر استلامك: {c.myTurnMonth})
          </option>
        ))}
      </Select>
      {circleId && (skipMonths?.length || skipMonth) && (
        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-bold flex items-center gap-1">
          <span>
            ✓ لن يتم خصم قسط منك في الشهر {skipMonths && skipMonths.length > 0 ? skipMonths.join(' و ') : skipMonth} لأن هذا الشهر هو دور استلامك للجمعية!
          </span>
        </p>
      )}
    </div>
  )
}
