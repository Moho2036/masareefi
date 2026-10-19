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
import { subscribeDebts } from '../services/debts'
import { subscribeRecurring } from '../services/recurring'
import { subscribeMoneyCircles } from '../services/moneyCircles'
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

  useEffect(() => {
    if (!user) {
      return
    }

    // 1. Single listener for User Settings
    const unsubSettings = subscribeUserSettings(
      user.uid,
      (newSettings) => {
        setSettings(newSettings)
        setSettingsLoading(false)
      },
      (err) => {
        setSettingsError(err)
        setSettingsLoading(false)
      }
    )

    // 2. Single listener for Categories
    const unsubCategories = subscribeCategories(
      user.uid,
      (newCategories) => {
        setCategories(newCategories)
        setCategoriesLoading(false)
      },
      (err) => {
        setCategoriesError(err)
        setCategoriesLoading(false)
      }
    )

    // 3. Single listener for Debts
    const unsubDebts = subscribeDebts(
      user.uid,
      (newDebts) => {
        setDebts(newDebts)
        setDebtsLoading(false)
      },
      (err) => {
        setDebtsError(err)
        setDebtsLoading(false)
      }
    )

    // 4. Single listener for Recurring rules
    const unsubRecurring = subscribeRecurring(
      user.uid,
      (newRecurring) => {
        setRecurring(newRecurring)
        setRecurringLoading(false)
      },
      (err) => {
        setRecurringError(err)
        setRecurringLoading(false)
      }
    )

    // 5. Single listener for Money Circles
    const unsubCircles = subscribeMoneyCircles(
      user.uid,
      (newCircles) => {
        setMoneyCircles(newCircles)
        setMoneyCirclesLoading(false)
      },
      (err) => {
        setMoneyCirclesError(err)
        setMoneyCirclesLoading(false)
      }
    )

    return () => {
      unsubSettings()
      unsubCategories()
      unsubDebts()
      unsubRecurring()
      unsubCircles()
    }
  }, [user])

  const handleUpdateSettings = useCallback(
    async (partial: Partial<Omit<UserSettings, 'uid' | 'createdAt'>>): Promise<void> => {
      if (!user) throw new Error('No authenticated user')
      await updateUserSettings(user.uid, partial)
    },
    [user]
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
      }
    }

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
    }
  }, [
    user,
    settings,
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
  ])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue | null {
  return useContext(AppDataContext)
}
