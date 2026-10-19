import type { Timestamp } from 'firebase/firestore'

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
  title?: string
  note: string
  recurringId?: string
  createdAt: Date
}

export interface Recurring {
  id: string
  type: TxType
  amountFils: number
  categoryId: string
  title?: string
  note: string
  frequency: Frequency
  startDate: Date
  nextDate: Date
  endDate?: Date | null
  active: boolean
  circleId?: string
  skipMonth?: number
  createdAt?: Date
}

export interface UserSettings {
  uid?: string
  displayName: string
  currency: string
  monthStartDay: number
  theme: ThemePreference
  rolloverBalance?: boolean
  createdAt?: Date | Timestamp
}

export type DebtType = 'lent' | 'borrowed'

export interface DebtPayment {
  id: string
  amountFils: number
  date: Date
  note?: string
  createdAt: Date
}

export interface Debt {
  id: string
  personName: string
  type: DebtType
  amountFils: number
  paidFils: number
  startDate: Date
  dueDate?: Date | null
  note: string
  settled: boolean
  payments: DebtPayment[]
  createdAt: Date
}

export interface CircleMember {
  id: string
  name: string
  turnMonth: number
  paidMonths: number[] // Array of month numbers (1..membersCount) they have paid
}

export interface MoneyCircle {
  id: string
  name: string
  monthlyAmountFils: number
  membersCount: number
  totalAmountFils: number
  myTurnMonth: number
  startDate: Date
  members: CircleMember[]
  status: 'active' | 'completed'
  recurringId?: string
  isManager?: boolean
  createdAt: Date
}

