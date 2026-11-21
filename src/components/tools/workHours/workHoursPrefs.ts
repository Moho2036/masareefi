export const STORAGE_KEY = 'baseer_work_hours_prefs'
export const LEGACY_STORAGE_KEY = 'masareefi_work_hours_prefs'

export interface BenchmarkExample {
  coffee: number
  dinner: number
  shoes: number
  defaultSalary: string
  defaultItemPrice: string
}

export function getCurrencyBenchmarks(currencyCode: string): BenchmarkExample {
  switch (currencyCode) {
    case 'SAR':
    case 'AED':
    case 'QAR':
      return { coffee: 15, dinner: 100, shoes: 300, defaultSalary: '5000', defaultItemPrice: '1500' }
    case 'EGP':
      return { coffee: 80, dinner: 500, shoes: 1800, defaultSalary: '15000', defaultItemPrice: '6000' }
    case 'USD':
    case 'EUR':
    case 'GBP':
      return { coffee: 5, dinner: 35, shoes: 100, defaultSalary: '3000', defaultItemPrice: '500' }
    case 'KWD':
      return { coffee: 1.5, dinner: 10, shoes: 30, defaultSalary: '500', defaultItemPrice: '250' }
    case 'BHD':
    case 'OMR':
      return { coffee: 2, dinner: 15, shoes: 40, defaultSalary: '500', defaultItemPrice: '250' }
    case 'JOD':
    default:
      return { coffee: 3.5, dinner: 25, shoes: 75, defaultSalary: '500', defaultItemPrice: '250' }
  }
}

export interface StoredWorkHoursPrefs {
  currencyCode?: string
  salary?: string
  isCustomSalary?: boolean
  itemPrice?: string
  isCustomItemPrice?: boolean
  dailyHours?: string
  workDays?: string
  workDaysMode?: 'month' | 'week'
  itemName?: string
}

export function loadStoredPrefs(currencyCode: string): {
  salary: string
  isCustomSalary: boolean
  itemPrice: string
  isCustomItemPrice: boolean
  dailyHours: string
  workDays: string
  workDaysMode: 'month' | 'week'
  itemName: string
  hasInteracted: boolean
} {
  const benchmarks = getCurrencyBenchmarks(currencyCode)
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (raw) {
      const parsed: StoredWorkHoursPrefs = JSON.parse(raw)
      const storedCurr = parsed.currencyCode || 'JOD'
      const prevBenchmarks = getCurrencyBenchmarks(storedCurr)

      let isCustomSalary = Boolean(parsed.isCustomSalary)
      if (parsed.isCustomSalary === undefined) {
        if (parsed.salary && parsed.salary !== prevBenchmarks.defaultSalary && parsed.salary !== '500') {
          isCustomSalary = true
        } else {
          isCustomSalary = false
        }
      }

      let isCustomItemPrice = Boolean(parsed.isCustomItemPrice)
      if (parsed.isCustomItemPrice === undefined) {
        if (parsed.itemPrice && parsed.itemPrice !== prevBenchmarks.defaultItemPrice && parsed.itemPrice !== '250') {
          isCustomItemPrice = true
        } else {
          isCustomItemPrice = false
        }
      }

      const salary = (currencyCode !== storedCurr && !isCustomSalary)
        ? benchmarks.defaultSalary
        : isCustomSalary
          ? String(parsed.salary || benchmarks.defaultSalary)
          : benchmarks.defaultSalary

      const itemPrice = (currencyCode !== storedCurr && !isCustomItemPrice)
        ? benchmarks.defaultItemPrice
        : isCustomItemPrice
          ? String(parsed.itemPrice || benchmarks.defaultItemPrice)
          : benchmarks.defaultItemPrice

      return {
        salary,
        isCustomSalary,
        itemPrice,
        isCustomItemPrice,
        dailyHours: parsed.dailyHours ? String(parsed.dailyHours) : '8',
        workDays: parsed.workDays ? String(parsed.workDays) : '22',
        workDaysMode: parsed.workDaysMode === 'week' ? 'week' : 'month',
        itemName: parsed.itemName ? String(parsed.itemName) : 'هاتف ذكي',
        hasInteracted: Boolean(isCustomSalary || isCustomItemPrice || parsed.dailyHours || parsed.workDays || parsed.workDaysMode),
      }
    }
  } catch {
    // ignore
  }

  return {
    salary: benchmarks.defaultSalary,
    isCustomSalary: false,
    itemPrice: benchmarks.defaultItemPrice,
    isCustomItemPrice: false,
    dailyHours: '8',
    workDays: '22',
    workDaysMode: 'month',
    itemName: 'هاتف ذكي',
    hasInteracted: false,
  }
}

export function clearWorkHoursPrefs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // ignore
  }
}
