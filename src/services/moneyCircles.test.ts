import { describe, it, expect } from 'vitest'
import {
  getCurrentCircleMonth,
  isUserTurnMonth,
  circleConverter,
} from './moneyCircles'
import type { MoneyCircle } from '../types'

describe('moneyCircles service', () => {
  const sampleCircle: MoneyCircle = {
    id: 'circle-1',
    name: 'جمعية العائلة',
    monthlyAmountFils: 100000, // 100 JOD
    membersCount: 10,
    totalAmountFils: 1000000, // 1000 JOD
    myTurnMonth: 4,
    startDate: new Date(2026, 0, 1), // Jan 1, 2026
    members: [
      { id: 'm-1', name: 'أحمد', turnMonth: 1, paidMonths: [1, 2] },
      { id: 'm-2', name: 'محمد', turnMonth: 2, paidMonths: [1] },
      { id: 'm-4', name: 'أنت', turnMonth: 4, paidMonths: [1, 2] },
    ],
    status: 'active',
    createdAt: new Date(),
  }

  describe('getCurrentCircleMonth', () => {
    it('calculates the current month index based on elapsed months', () => {
      // Month 1: Jan 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 0, 15))).toBe(1)
      // Month 3: March 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 2, 10))).toBe(3)
      // Month 4: April 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 3, 5))).toBe(4)
      // Month 10: Oct 2026
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 9, 20))).toBe(10)
    })

    it('clamps to membersCount if beyond duration', () => {
      // Nov 2026 (month 11) should clamp to 10
      expect(getCurrentCircleMonth(sampleCircle, new Date(2026, 10, 1))).toBe(10)
    })

    it('clamps to 1 if before start date', () => {
      expect(getCurrentCircleMonth(sampleCircle, new Date(2025, 11, 20))).toBe(1)
    })
  })

  describe('isUserTurnMonth', () => {
    it('returns true when current month equals myTurnMonth', () => {
      // April 2026 is month 4
      expect(isUserTurnMonth(sampleCircle, new Date(2026, 3, 10))).toBe(true)
    })

    it('returns false when current month is not myTurnMonth', () => {
      // March 2026 is month 3
      expect(isUserTurnMonth(sampleCircle, new Date(2026, 2, 10))).toBe(false)
      // May 2026 is month 5
      expect(isUserTurnMonth(sampleCircle, new Date(2026, 4, 10))).toBe(false)
    })
  })

  describe('circleConverter', () => {
    it('converts circle to firestore document format', () => {
      const doc = circleConverter.toFirestore(sampleCircle)
      expect(doc.name).toBe('جمعية العائلة')
      expect(doc.monthlyAmountFils).toBe(100000)
      expect(doc.totalAmountFils).toBe(1000000)
      expect(doc.myTurnMonth).toBe(4)
      expect(doc.members).toHaveLength(3)
      expect(doc.members[0].paidMonths).toEqual([1, 2])
    })
  })
})
