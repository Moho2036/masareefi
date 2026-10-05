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
import { formatMonthLabel, getFinancialMonthRange } from '../lib/dates'
import { useUserSettings } from './useUserSettings'

interface SelectedMonthContextValue {
  selectedDate: Date
  setSelectedDate: (date: Date) => void
  goToPreviousMonth: () => void
  goToNextMonth: () => void
  goToCurrentMonth: () => void
  monthLabel: string
  range: { start: Date; end: Date }
}

const SelectedMonthContext = createContext<SelectedMonthContextValue | null>(null)

export function SelectedMonthProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
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

  const monthLabel = useMemo(() => {
    return formatMonthLabel(selectedDate)
  }, [selectedDate])

  const range = useMemo(() => {
    return getFinancialMonthRange(selectedDate, monthStartDay)
  }, [selectedDate, monthStartDay])

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      goToPreviousMonth,
      goToNextMonth,
      goToCurrentMonth,
      monthLabel,
      range,
    }),
    [
      selectedDate,
      goToPreviousMonth,
      goToNextMonth,
      goToCurrentMonth,
      monthLabel,
      range,
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
