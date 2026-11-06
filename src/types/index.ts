import type { Timestamp } from 'firebase/firestore'

export type TxType = 'expense' | 'income'

export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

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
  skipMonths?: number[]
  requireConfirmation?: boolean
  createdAt?: Date
}

export interface NotificationPrefs {
  autoPayments?: boolean
  debtReminders?: boolean
  debtReminderDaysBefore?: number // 0, 1, or 3
  circleAlerts?: boolean
  budgetWarnings?: boolean
  dailyReminder?: boolean
  dailyReminderTime?: string // e.g. '21:00'
}

export interface UserSettings {
  uid?: string
  displayName: string
  currency: string
  monthStartDay: number
  theme: ThemePreference
  rolloverBalance?: boolean
  onboardingCompleted?: boolean
  openingBalanceFils?: number
  hideBalances?: boolean
  hideZeroDecimals?: boolean
  categorySortMode?: 'usage' | 'manual'
  customCurrencyDecimals?: number | null // 0, 2, or 3
  rolloverStartDate?: Date | Timestamp | null
  lastBackupAt?: string
  avatarColor?: string
  notificationPrefs?: NotificationPrefs
  createdAt?: Date | Timestamp
}

export type DebtType = 'lent' | 'borrowed'

export interface DebtPayment {
  id: string
  amountFils: number
  date: Date
  note?: string
  transactionId?: string
  createdAt: Date
  isMerged?: boolean
  mergedTransactionIds?: string[]
}

export interface DebtEntry {
  id: string
  amountFils: number
  date: Date
  title?: string
  note: string
  transactionId?: string
  createdAt: Date
  isMerged?: boolean
  mergedTransactionIds?: string[]
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
  entries?: DebtEntry[]
}

export interface CircleMember {
  id: string
  name: string
  turnMonth: number
  paidMonths: number[] // Array of month numbers (1..membersCount) they have paid
  paymentsByMonth?: Record<string, boolean>
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
  expenseCategoryId?: string
  incomeCategoryId?: string
  categoryId?: string
  shareType?: 'full' | 'half' | 'double'
  secondTurnMonth?: number
}

