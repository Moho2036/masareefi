/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { useAuth } from '../hooks/useAuth'
import { subscribeUserSettings, updateUserSettings } from '../services/userProfile'
import { subscribeCategories } from '../services/categories'
import { syncCategoriesForUser } from '../services/seed'
import { subscribeDebts } from '../services/debts'
import { subscribeRecurring } from '../services/recurring'
import { subscribeMoneyCircles } from '../services/moneyCircles'
import { subscribePriorBalance } from '../services/transactions'
import { getFinancialMonthRange, formatDateInput } from '../lib/dates'
import type { UserSettings, Category, Debt, Recurring, MoneyCircle } from '../types'

export interface AppDataContextValue {
  settings: UserSettings | null
  settingsLoading: boolean
  settingsError: Error | null
  updateSettings: (partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>) => Promise<void>

  categories: Category[]
  categoriesLoading: boolean
  categoriesError: Error | null

  debts: Debt[]
  debtsLoading: boolean
  debtsError: Error | null

  recurring: Recurring[]
  recurringLoading: boolean
  recurringError: Error | null

  moneyCircles: MoneyCircle[]
  moneyCirclesLoading: boolean
  moneyCirclesError: Error | null

  rolloverBalanceFils: number
  setRolloverBalanceFils: (amount: number) => void
  rolloverLoading?: boolean
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState<Error | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<Error | null>(null)

  const [debts, setDebts] = useState<Debt[]>([])
  const [debtsLoading, setDebtsLoading] = useState(true)
  const [debtsError, setDebtsError] = useState<Error | null>(null)

  const [recurring, setRecurring] = useState<Recurring[]>([])
  const [recurringLoading, setRecurringLoading] = useState(true)
  const [recurringError, setRecurringError] = useState<Error | null>(null)

  const [moneyCircles, setMoneyCircles] = useState<MoneyCircle[]>([])
  const [moneyCirclesLoading, setMoneyCirclesLoading] = useState(true)
  const [moneyCirclesError, setMoneyCirclesError] = useState<Error | null>(null)

  const [rolloverBalanceFils, setRolloverBalanceFils] = useState<number>(0)
  const [rolloverLoading, setRolloverLoading] = useState<boolean>(false)

  const userId = user?.uid
  const [prevUserId, setPrevUserId] = useState(userId)

  // Reset all data states and errors immediately on user change or sign-out during render
  if (prevUserId !== userId) {
    setPrevUserId(userId)
    setSettings(null)
    setSettingsError(null)

    setCategories([])
    setCategoriesError(null)

    setDebts([])
    setDebtsError(null)

    setRecurring([])
    setRecurringError(null)

    setMoneyCircles([])
    setMoneyCirclesError(null)

    setRolloverBalanceFils(0)
    setRolloverLoading(Boolean(userId))

    setSettingsLoading(Boolean(userId))
    setCategoriesLoading(Boolean(userId))
    setDebtsLoading(Boolean(userId))
    setRecurringLoading(Boolean(userId))
    setMoneyCirclesLoading(Boolean(userId))
  }

  useEffect(() => {
    if (!userId) {
      return
    }

    // Sync categories for user (runs once per user account via localStorage and seed markers)
    syncCategoriesForUser(userId).catch((err) => {
      console.warn('Categories sync deferred:', err)
    })

    const unsubscribers: (() => void)[] = []

    // 1. Single real-time listener for User Settings
    const unsubSettings = subscribeUserSettings(
      userId,
      (newSettings) => {
        setSettings(newSettings)
        setSettingsLoading(false)
      },
      (err) => {
        setSettingsError(err)
        setSettingsLoading(false)
      }
    )
    unsubscribers.push(unsubSettings)

    // 2. Single listener for Categories
    const unsubCategories = subscribeCategories(
      userId,
      (newCategories) => {
        setCategories(newCategories)
        setCategoriesLoading(false)
      },
      (err) => {
        setCategoriesError(err)
        setCategoriesLoading(false)
      }
    )
    unsubscribers.push(unsubCategories)

    // 3. Single listener for Debts
    const unsubDebts = subscribeDebts(
      userId,
      (newDebts) => {
        setDebts(newDebts)
        setDebtsLoading(false)
      },
      (err) => {
        setDebtsError(err)
        setDebtsLoading(false)
      }
    )
    unsubscribers.push(unsubDebts)

    // 4. Single listener for Recurring rules
    const unsubRecurring = subscribeRecurring(
      userId,
      (newRecurring) => {
        setRecurring(newRecurring)
        setRecurringLoading(false)
      },
      (err) => {
        setRecurringError(err)
        setRecurringLoading(false)
      }
    )
    unsubscribers.push(unsubRecurring)

    // 5. Single listener for Money Circles
    const unsubCircles = subscribeMoneyCircles(
      userId,
      (newCircles) => {
        setMoneyCircles(newCircles)
        setMoneyCirclesLoading(false)
      },
      (err) => {
        setMoneyCirclesError(err)
        setMoneyCirclesLoading(false)
      }
    )
    unsubscribers.push(unsubCircles)

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [userId])

  const handleUpdateSettings = useCallback(
    async (partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>): Promise<void> => {
      if (!userId) throw new Error('No authenticated user')
      await updateUserSettings(userId, partial)
    },
    [userId]
  )

  const isRolloverEnabled = settings?.rolloverBalance ?? true
  const monthStartDay = settings?.monthStartDay ?? 1
  const hasSettings = settings !== null

  const [currentDayKey, setCurrentDayKey] = useState(() => formatDateInput(new Date()))

  useEffect(() => {
    const handleDayCheck = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return
      }
      setCurrentDayKey((prev) => {
        const next = formatDateInput(new Date())
        return prev === next ? prev : next
      })
    }

    window.addEventListener('focus', handleDayCheck)
    document.addEventListener('visibilitychange', handleDayCheck)

    return () => {
      window.removeEventListener('focus', handleDayCheck)
      document.removeEventListener('visibilitychange', handleDayCheck)
    }
  }, [])

  // Real-time rollover prior balance sync: calculates cumulative balance before financial cycle start
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!userId || !hasSettings || !isRolloverEnabled) {
      if (hasSettings && !isRolloverEnabled) {
        setRolloverLoading(false)
      }
      return
    }

    const periodRange = getFinancialMonthRange(new Date(), monthStartDay)
    const rolloverStartDate = settings?.rolloverStartDate
      ? settings.rolloverStartDate instanceof Date
        ? settings.rolloverStartDate
        : typeof (settings.rolloverStartDate as { toDate?: () => Date }).toDate === 'function'
          ? (settings.rolloverStartDate as { toDate: () => Date }).toDate()
          : new Date(settings.rolloverStartDate as unknown as string)
      : null

    if (rolloverStartDate && periodRange.start.getTime() <= rolloverStartDate.getTime()) {
      setRolloverBalanceFils(0)
      setRolloverLoading(false)
      return
    }

    setRolloverLoading(true)

    const unsub = subscribePriorBalance(
      userId,
      periodRange.start,
      (bal) => {
        setRolloverBalanceFils((prev) => (prev === bal ? prev : bal))
        setRolloverLoading(false)
      },
      (err) => {
        console.error('Failed to subscribe prior balance in AppDataContext:', err)
        setRolloverLoading(false)
      },
      rolloverStartDate
    )

    return () => {
      unsub()
    }
  }, [userId, hasSettings, isRolloverEnabled, monthStartDay, currentDayKey, settings?.rolloverStartDate])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSetRolloverBalanceFils = useCallback(
    (amount: number) => {
      if (!isRolloverEnabled) {
        setRolloverBalanceFils(0)
      } else {
        setRolloverBalanceFils(amount)
      }
    },
    [isRolloverEnabled]
  )

  const value = useMemo<AppDataContextValue>(() => {
    if (!user) {
      return {
        settings: null,
        settingsLoading: false,
        settingsError: null,
        updateSettings: handleUpdateSettings,

        categories: [],
        categoriesLoading: false,
        categoriesError: null,

        debts: [],
        debtsLoading: false,
        debtsError: null,

        recurring: [],
        recurringLoading: false,
        recurringError: null,

        moneyCircles: [],
        moneyCirclesLoading: false,
        moneyCirclesError: null,

        rolloverBalanceFils: 0,
        setRolloverBalanceFils: handleSetRolloverBalanceFils,
        rolloverLoading: false,
      }
    }

    const openingFils = settings?.openingBalanceFils ?? 0
    const effectiveRolloverBalanceFils =
      (user && isRolloverEnabled ? rolloverBalanceFils : 0) + openingFils
    const calculatedRolloverLoading = !user
      ? false
      : settingsLoading || (isRolloverEnabled && rolloverLoading)

    return {
      settings,
      settingsLoading,
      settingsError,
      updateSettings: handleUpdateSettings,

      categories,
      categoriesLoading,
      categoriesError,

      debts,
      debtsLoading,
      debtsError,

      recurring,
      recurringLoading,
      recurringError,

      moneyCircles,
      moneyCirclesLoading,
      moneyCirclesError,

      rolloverBalanceFils: effectiveRolloverBalanceFils,
      setRolloverBalanceFils: handleSetRolloverBalanceFils,
      rolloverLoading: calculatedRolloverLoading,
    }
  }, [
    user,
    settings,
    isRolloverEnabled,
    settingsLoading,
    settingsError,
    handleUpdateSettings,
    categories,
    categoriesLoading,
    categoriesError,
    debts,
    debtsLoading,
    debtsError,
    recurring,
    recurringLoading,
    recurringError,
    moneyCircles,
    moneyCirclesLoading,
    moneyCirclesError,
    rolloverBalanceFils,
    handleSetRolloverBalanceFils,
    rolloverLoading,
  ])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue | null {
  return useContext(AppDataContext)
}
