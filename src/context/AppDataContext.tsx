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
import { getFinancialMonthRange } from '../lib/dates'
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

  const userId = user?.uid

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

  // Real-time rollover prior balance sync: calculates cumulative balance before financial cycle start
  useEffect(() => {
    if (!userId || !hasSettings || !isRolloverEnabled) {
      return
    }

    const periodRange = getFinancialMonthRange(new Date(), monthStartDay)
    const unsub = subscribePriorBalance(
      userId,
      periodRange.start,
      (bal) => {
        setRolloverBalanceFils(bal)
      },
      (err) => {
        console.error('Failed to subscribe prior balance in AppDataContext:', err)
      }
    )

    return () => {
      unsub()
    }
  }, [userId, hasSettings, isRolloverEnabled, monthStartDay])

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
      }
    }

    const effectiveRolloverBalanceFils =
      user && isRolloverEnabled ? rolloverBalanceFils : 0

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
  ])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue | null {
  return useContext(AppDataContext)
}
