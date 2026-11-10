export function generateReportYearOptions(
  currentYear: number,
  selectedYear: number,
  createdAt?: unknown
): { value: string; label: string }[] {
  const calendarYear = new Date().getFullYear()
  let createdYear = currentYear
  if (createdAt) {
    const rawCreated = createdAt
    const createdDate =
      rawCreated instanceof Date
        ? rawCreated
        : typeof (rawCreated as { toDate?: () => Date }).toDate === 'function'
        ? (rawCreated as { toDate: () => Date }).toDate()
        : new Date(rawCreated as unknown as string | number)
    if (!isNaN(createdDate.getTime())) {
      createdYear = createdDate.getFullYear()
    }
  }

  const maxYear = Math.max(calendarYear + 1, currentYear, selectedYear)
  const minYear = Math.min(createdYear, selectedYear)

  const yearsSet = new Set<number>()
  yearsSet.add(selectedYear)
  for (let y = maxYear; y >= minYear; y--) {
    yearsSet.add(y)
  }
  const sortedYears = Array.from(yearsSet).sort((a, b) => b - a)
  const finalYears = sortedYears.slice(0, 15)
  if (!finalYears.includes(selectedYear)) {
    finalYears.push(selectedYear)
    finalYears.sort((a, b) => b - a)
  }

  return finalYears.map((y) => ({
    value: String(y),
    label: `سنة ${y}`,
  }))
}
