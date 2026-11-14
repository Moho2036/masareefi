import { useState, useMemo, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useAppData } from '../context/AppDataContext'
import { subscribePriorBalance } from '../services/transactions'
import { getFiscalMonthKey, getFinancialMonthRange } from '../lib/dates'
import type { UserSettings } from '../types'

export interface UsePeriodRolloverResult {
  effectiveRollover: number
  isRolloverResolving: boolean
  isCurrentFiscalMonth: boolean
  isRolloverEnabled: boolean
  parsedRolloverStartDate: Date | null
}

export function usePeriodRollover(
  range: { start: Date; end: Date },
  settings?: UserSettings | null
): UsePeriodRolloverResult {
  const { user } = useAuth()
  const appData = useAppData()

  const currentSettings = settings !== undefined ? settings : appData?.settings
  const isRolloverEnabled = currentSettings?.rolloverBalance ?? true
  const monthStartDay = currentSettings?.monthStartDay ?? 1

  const isCurrentFiscalMonth =
    getFiscalMonthKey(range.start, monthStartDay) ===
    getFiscalMonthKey(new Date(), monthStartDay)

  const parsedRolloverStartDate = useMemo(() => {
    if (!currentSettings?.rolloverStartDate) return null
    const raw = currentSettings.rolloverStartDate
    return raw instanceof Date
      ? raw
      : typeof (raw as { toDate?: () => Date }).toDate === 'function'
      ? (raw as { toDate: () => Date }).toDate()
      : new Date(raw as unknown as string)
  }, [currentSettings?.rolloverStartDate])

  const [localRollover, setLocalRollover] = useState<{ key: string; amount: number }>({
    key: '',
    amount: 0,
  })

  useEffect(() => {
    if (!user?.uid || !isRolloverEnabled || isCurrentFiscalMonth) {
      return
    }
    if (parsedRolloverStartDate && range.start.getTime() <= parsedRolloverStartDate.getTime()) {
      return
    }
    const currentKey = range.start.toISOString()
    const unsub = subscribePriorBalance(
      user.uid,
      range.start,
      (bal) => {
        setLocalRollover({ key: currentKey, amount: bal })
      },
      (err) => {
        console.error('Failed to subscribe prior balance in usePeriodRollover:', err)
      },
      parsedRolloverStartDate
    )
    return () => {
      unsub()
    }
  }, [user?.uid, isRolloverEnabled, range.start, isCurrentFiscalMonth, parsedRolloverStartDate])

  const isRolloverResolving = useMemo(() => {
    if (isCurrentFiscalMonth) {
      return Boolean(appData?.rolloverLoading)
    }
    if (!isRolloverEnabled) return false
    if (parsedRolloverStartDate && range.start.getTime() <= parsedRolloverStartDate.getTime()) {
      return false
    }
    return localRollover.key !== range.start.toISOString()
  }, [
    isCurrentFiscalMonth,
    appData?.rolloverLoading,
    isRolloverEnabled,
    parsedRolloverStartDate,
    range.start,
    localRollover.key,
  ])

  const effectiveLocalRollover =
    localRollover.key === range.start.toISOString() ? localRollover.amount : 0

  const effectiveRollover = useMemo(() => {
    if (isCurrentFiscalMonth) {
      return appData?.rolloverBalanceFils ?? 0
    }
    if (!isRolloverEnabled) {
      return 0
    }
    if (parsedRolloverStartDate && range.start.getTime() < parsedRolloverStartDate.getTime()) {
      return 0
    }
    if (currentSettings?.createdAt) {
      const rawCreated = currentSettings.createdAt
      const createdAtDate =
        rawCreated instanceof Date
          ? rawCreated
          : typeof (rawCreated as { toDate?: () => Date }).toDate === 'function'
          ? (rawCreated as { toDate: () => Date }).toDate()
          : new Date(rawCreated as unknown as string)
      const createdCycleStart = getFinancialMonthRange(createdAtDate, monthStartDay).start
      if (range.start.getTime() < createdCycleStart.getTime()) {
        return 0
      }
    }
    return effectiveLocalRollover + (currentSettings?.openingBalanceFils ?? 0)
  }, [
    isCurrentFiscalMonth,
    appData?.rolloverBalanceFils,
    isRolloverEnabled,
    parsedRolloverStartDate,
    range.start,
    currentSettings,
    monthStartDay,
    effectiveLocalRollover,
  ])

  return {
    effectiveRollover,
    isRolloverResolving,
    isCurrentFiscalMonth,
    isRolloverEnabled,
    parsedRolloverStartDate,
  }
}
