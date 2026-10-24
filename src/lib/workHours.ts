/**
 * Pure calculation and clamping logic for work hours and days.
 */

export function clampWorkHoursPerDay(val: number): number {
  return Math.min(24, Math.max(1, val))
}

export function clampWorkDaysPerWeek(val: number): number {
  return Math.min(7, Math.max(1, val))
}

export function clampWorkDaysPerMonth(val: number): number {
  return Math.min(31, Math.max(1, val))
}
