export type TxType = 'expense' | 'income'

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Category {
  id: string
  name: string
  type: TxType
  icon: string
  color: string
  archived: boolean
  order: number
}

export interface Transaction {
  id: string
  type: TxType
  amountFils: number
  categoryId: string
  date: Date
  note: string
  recurringId?: string
  createdAt: Date
}

export interface Recurring {
  id: string
  type: TxType
  amountFils: number
  categoryId: string
  note: string
  frequency: Frequency
  startDate: Date
  nextDate: Date
  endDate?: Date
  active: boolean
  createdAt?: Date
}

export interface UserSettings {
  uid?: string
  displayName: string
  currency: string
  monthStartDay: number
  theme: ThemePreference
  createdAt?: Date
}
