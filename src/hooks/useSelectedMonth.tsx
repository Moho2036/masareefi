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
}

export const SelectedMonthContext = createContext<SelectedMonthContextValue | null>(null)

export function SelectedMonthProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const { data: settings } = useUserSettings()

  const monthStartDay = settings?.monthStartDay ?? 1

  const goToPreviousMonth = useCallback(() => {
    setSelectedDate((prev) => getPreviousFinancialMonth(prev, monthStartDay))
  }, [monthStartDay])

  const goToNextMonth = useCallback(() => {
    setSelectedDate((prev) => getNextFinancialMonth(prev, monthStartDay))
  }, [monthStartDay])

  const goToCurrentMonth = useCallback(() => {
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
