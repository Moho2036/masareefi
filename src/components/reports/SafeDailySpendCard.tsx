import React from 'react'
import type { ForecastResult } from '../../lib/forecast'
import { PastMonthSpendCard } from './safeSpend/PastMonthSpendCard'
import { FutureMonthSpendCard } from './safeSpend/FutureMonthSpendCard'
import { CurrentMonthSpendCard } from './safeSpend/CurrentMonthSpendCard'

export interface SafeDailySpendCardProps {
  forecast: ForecastResult
  className?: string
}

export const SafeDailySpendCard: React.FC<SafeDailySpendCardProps> = ({
  forecast,
  className,
}) => {
  if (forecast.isPastMonth) {
    return <PastMonthSpendCard forecast={forecast} className={className} />
  }

  if (forecast.isFutureMonth) {
    return <FutureMonthSpendCard forecast={forecast} className={className} />
  }

  if (forecast.isCurrentMonth) {
    return <CurrentMonthSpendCard forecast={forecast} className={className} />
  }

  return null
}
