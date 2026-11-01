/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import {
  formatFinancialMonthLabel,
  getFinancialMonthRange,
  formatFinancialRangeLabel,
  getPreviousFinancialMonth,
  getNextFinancialMonth,
  getFiscalMonthKey,
  getFiscalMonthInfo,
} from '../lib/dates'
import { useUserSettings } from './useUserSettings'

interface SelectedMonthContextValue {
  selectedDate: Date
  setSelectedDate: (date: Date) => void
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  goToCurrentMonth: () => void
  refreshData: () => void
  refreshKey: number
  monthLabel: string
  range: { start: Date; end: Date }
  monthStartDay: number
  rangeLabel: string
  isCurrentMonth: boolean
  manualNavKey?: number
}

export const SelectedMonthContext = createContext<SelectedMonthContextValue | null>(null)

export function SelectedMonthProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [manualNavKey, setManualNavKey] = useState<number>(0)
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const { data: settings } = useUserSettings()

  const monthStartDay = settings?.monthStartDay ?? 1
  const [prevMonthStartDay, setPrevMonthStartDay] = useState<number>(monthStartDay)

  if (prevMonthStartDay !== monthStartDay) {
    setPrevMonthStartDay(monthStartDay)
    const isViewingCurrent =
      manualNavKey === 0 ||
      getFiscalMonthKey(selectedDate, prevMonthStartDay) ===
        getFiscalMonthKey(new Date(), prevMonthStartDay)

    if (isViewingCurrent) {
      setSelectedDate(new Date())
    } else {
      const { year, monthIndex } = getFiscalMonthInfo(selectedDate, prevMonthStartDay)
      const safeDay = Math.max(1, Math.min(28, Math.floor(monthStartDay) || 1))
      setSelectedDate(new Date(year, monthIndex, safeDay, 12, 0, 0, 0))
    }
  }

  const goToPreviousMonth = useCallback(() => {
    setManualNavKey((k) => k + 1)
    setSelectedDate((prev) => getPreviousFinancialMonth(prev, monthStartDay))
  }, [monthStartDay])

  const goToNextMonth = useCallback(() => {
    setManualNavKey((k) => k + 1)
    setSelectedDate((prev) => getNextFinancialMonth(prev, monthStartDay))
  }, [monthStartDay])

  const goToCurrentMonth = useCallback(() => {
    setManualNavKey((k) => k + 1)
    setSelectedDate(new Date())
  }, [])

  const refreshData = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const range = useMemo(() => {
    return getFinancialMonthRange(selectedDate, monthStartDay)
  }, [selectedDate, monthStartDay])

  const isCurrentMonth = useMemo(() => {
    return (
      getFiscalMonthKey(selectedDate, monthStartDay) ===
      getFiscalMonthKey(new Date(), monthStartDay)
    )
  }, [selectedDate, monthStartDay])

  const monthLabel = useMemo(() => {
    return formatFinancialMonthLabel(range, monthStartDay)
  }, [range, monthStartDay])

  const rangeLabel = useMemo(() => {
    return formatFinancialRangeLabel(range)
  }, [range])

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      goToPreviousMonth,
      goToNextMonth,
      goToCurrentMonth,
      refreshData,
      refreshKey,
      monthLabel,
      range,
      monthStartDay,
      rangeLabel,
      isCurrentMonth,
      manualNavKey,
    }),
    [
      selectedDate,
      goToPreviousMonth,
      goToNextMonth,
      goToCurrentMonth,
      refreshData,
      refreshKey,
      monthLabel,
      range,
      monthStartDay,
      rangeLabel,
      isCurrentMonth,
      manualNavKey,
    ]
  )

  return (
    <SelectedMonthContext.Provider value={value}>
      {children}
    </SelectedMonthContext.Provider>
  )
}

export function useSelectedMonth(): SelectedMonthContextValue {
  const context = useContext(SelectedMonthContext)
  if (!context) {
    throw new Error('useSelectedMonth must be used within a SelectedMonthProvider')
  }
  return context
}
