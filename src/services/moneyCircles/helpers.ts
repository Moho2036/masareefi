import {
  Timestamp,
  serverTimestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import type { MoneyCircle } from '../../types'

export interface FirestoreCircleMember {
  id: string
  name: string
  turnMonth: number
  paidMonths: number[]
  paymentsByMonth?: Record<string, boolean>
}

export interface FirestoreCircleDoc {
  name: string
  monthlyAmountFils: number
  membersCount: number
  totalAmountFils: number
  myTurnMonth: number
  startDate: Timestamp
  members: FirestoreCircleMember[]
  status: 'active' | 'completed'
  recurringId?: string
  isManager?: boolean
  createdAt: Timestamp
  expenseCategoryId?: string
  incomeCategoryId?: string
  categoryId?: string
  shareType?: 'full' | 'half' | 'double'
  secondTurnMonth?: number
}

export const circleConverter: FirestoreDataConverter<MoneyCircle> = {
  toFirestore(circle: MoneyCircle): DocumentData {
    const docData: DocumentData = {
      name: circle.name.trim().slice(0, 100),
      monthlyAmountFils: Math.round(circle.monthlyAmountFils),
      membersCount: Math.round(circle.membersCount),
      totalAmountFils: Math.round(circle.totalAmountFils),
      myTurnMonth: Math.round(circle.myTurnMonth),
      startDate:
        circle.startDate instanceof Date
          ? Timestamp.fromDate(circle.startDate)
          : (circle.startDate as unknown as Timestamp),
      members: (circle.members || []).map((m) => ({
        id: m.id,
        name: m.name.trim().slice(0, 50),
        turnMonth: Math.round(m.turnMonth),
        paidMonths: (m.paidMonths || []).map(Number),
        ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
      })),
      status: circle.status,
      createdAt:
        circle.createdAt instanceof Date
          ? Timestamp.fromDate(circle.createdAt)
          : (circle.createdAt as unknown as Timestamp) || serverTimestamp(),
      ...(circle.isManager !== undefined ? { isManager: Boolean(circle.isManager) } : {}),
    }
    if (typeof circle.recurringId === 'string' && circle.recurringId.trim()) {
      docData.recurringId = circle.recurringId.trim().slice(0, 128)
    }
    if (typeof circle.expenseCategoryId === 'string' && circle.expenseCategoryId.trim()) {
      docData.expenseCategoryId = circle.expenseCategoryId.trim().slice(0, 128)
    }
    if (typeof circle.incomeCategoryId === 'string' && circle.incomeCategoryId.trim()) {
      docData.incomeCategoryId = circle.incomeCategoryId.trim().slice(0, 128)
    }
    if (typeof circle.categoryId === 'string' && circle.categoryId.trim()) {
      docData.categoryId = circle.categoryId.trim().slice(0, 128)
    }
    if (circle.shareType && ['full', 'half', 'double'].includes(circle.shareType)) {
      docData.shareType = circle.shareType
    }
    if (
      circle.secondTurnMonth !== undefined &&
      circle.secondTurnMonth !== null &&
      Number.isFinite(Number(circle.secondTurnMonth)) &&
      Number(circle.secondTurnMonth) >= 1 &&
      Number(circle.secondTurnMonth) <= Math.round(circle.membersCount)
    ) {
      docData.secondTurnMonth = Math.round(Number(circle.secondTurnMonth))
    }
    return docData
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): MoneyCircle {
    const data = snapshot.data() as FirestoreCircleDoc
    return {
      id: snapshot.id,
      name: data.name,
      monthlyAmountFils: data.monthlyAmountFils,
      membersCount: data.membersCount,
      totalAmountFils: data.totalAmountFils,
      myTurnMonth: data.myTurnMonth,
      startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(),
      members: (data.members || []).map((m: FirestoreCircleMember) => ({
        id: m.id,
        name: m.name,
        turnMonth: m.turnMonth,
        paidMonths: m.paidMonths || [],
        ...(m.paymentsByMonth ? { paymentsByMonth: m.paymentsByMonth } : {}),
      })),
      status: data.status || 'active',
      ...(data.recurringId ? { recurringId: data.recurringId } : {}),
      ...(data.expenseCategoryId ? { expenseCategoryId: data.expenseCategoryId } : {}),
      ...(data.incomeCategoryId ? { incomeCategoryId: data.incomeCategoryId } : {}),
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      ...(data.shareType ? { shareType: data.shareType } : {}),
      ...(data.secondTurnMonth !== undefined ? { secondTurnMonth: data.secondTurnMonth } : {}),
      ...(data.isManager !== undefined ? { isManager: Boolean(data.isManager) } : {}),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
    }
  },
}

/**
 * Calculates the 0-based elapsed monthly cycles from startDate to refDate based on actual monthly cycles.
 * e.g., if start is Jan 20:
 * Jan 20 to Feb 19 -> 0
 * Feb 20 to Mar 19 -> 1
 * Before Jan 20 -> -1
 */
export function getCircleCycleIndex(
  startDate: Date,
  refDate: Date = new Date(),
  monthStartDay?: number
): number {
  const rawStart = startDate instanceof Date ? startDate : new Date(startDate)
  const target = refDate instanceof Date ? refDate : new Date(refDate)

  let start = rawStart
  const isNearMonthBoundary = rawStart.getDate() === 1 || rawStart.getDate() >= 28
  if (monthStartDay !== undefined && monthStartDay > 1 && isNearMonthBoundary) {
    const candidateStart = new Date(
      rawStart.getFullYear(),
      rawStart.getMonth(),
      Math.min(28, Math.max(1, Math.round(monthStartDay)))
    )
    if (candidateStart <= target || rawStart > target) {
      start = candidateStart
    }
  }

  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0)
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0)

  const anchorDay = start.getDate()
  const addMonthsWithAnchor = (base: Date, count: number) => {
    const d = new Date(base.getFullYear(), base.getMonth() + count, 1, 12, 0, 0)
    const daysInM = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(anchorDay, daysInM))
    return d
  }

  let approxMonths = (t.getFullYear() - s.getFullYear()) * 12 + (t.getMonth() - s.getMonth())
  while (addMonthsWithAnchor(s, approxMonths) > t) {
    approxMonths--
  }
  while (addMonthsWithAnchor(s, approxMonths + 1) <= t) {
    approxMonths++
  }
  return approxMonths
}

/**
 * Calculates which month (1-indexed) the circle is currently in based on actual monthly cycles from startDate.
 */
export function getCurrentCircleMonth(
  circle: MoneyCircle,
  refDate = new Date(),
  monthStartDay?: number
): number {
  const diffMonths = getCircleCycleIndex(circle.startDate, refDate, monthStartDay)
  return Math.max(1, Math.min(circle.membersCount, diffMonths + 1))
}

/**
 * Checks if the reference date falls within the user's turn month to receive the payout.
 */
export function isUserTurnMonth(
  circle: MoneyCircle,
  refDate = new Date(),
  monthStartDay?: number
): boolean {
  const diffMonths = getCircleCycleIndex(circle.startDate, refDate, monthStartDay)
  if (diffMonths < 0 || diffMonths + 1 > circle.membersCount) {
    return false
  }
  const currentMonth = diffMonths + 1
  return (
    currentMonth === circle.myTurnMonth ||
    (circle.shareType === 'double' &&
      circle.secondTurnMonth !== undefined &&
      currentMonth === circle.secondTurnMonth)
  )
}

/**
 * Checks if all member obligations have been fulfilled across all months of the circle.
 * In each month (1..membersCount), all members except the exempt recipient for that month must have paid.
 */
export function isCircleFullyPaid(circle: MoneyCircle): boolean {
  if (!circle.members || circle.members.length === 0 || circle.membersCount <= 0) {
    return false
  }
  for (let month = 1; month <= circle.membersCount; month++) {
    for (const member of circle.members) {
      if (member.turnMonth === month) continue // Exempt receiver for this month
      if (
        circle.shareType === 'double' &&
        circle.secondTurnMonth === month &&
        member.turnMonth === circle.myTurnMonth
      ) {
        continue // Exempt user for second turn month in double-share circle
      }
      const isPaid =
        member.paidMonths?.includes(month) ||
        member.paymentsByMonth?.[String(month)] === true
      if (!isPaid) return false
    }
  }
  return true
}
