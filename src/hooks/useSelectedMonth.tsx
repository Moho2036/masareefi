/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import { addMonths } from 'date-fns'
import { formatMonthLabel, getFinancialMonthRange, formatFinancialRangeLabel } from '../lib/dates'
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
}

export const SelectedMonthContext = createContext<SelectedMonthContextValue | null>(null)

export function SelectedMonthProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [refreshKey, setRefreshKey] = useState<number>(0)
  const { data: settings } = useUserSettings()

  const monthStartDay = settings?.monthStartDay ?? 1

  const goToPreviousMonth = useCallback(() => {
    setSelectedDate((prev) => addMonths(prev, -1))
  }, [])

  const goToNextMonth = useCallback(() => {
    setSelectedDate((prev) => addMonths(prev, 1))
  }, [])

  const goToCurrentMonth = useCallback(() => {
    setSelectedDate(new Date())
  }, [])

  const refreshData = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const monthLabel = useMemo(() => {
    return formatMonthLabel(selectedDate)
  }, [selectedDate])

  const range = useMemo(() => {
    return getFinancialMonthRange(selectedDate, monthStartDay)
  }, [selectedDate, monthStartDay])

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
