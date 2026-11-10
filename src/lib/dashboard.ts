export function formatObligationsCount(count: number): string {
  if (count === 1) return 'التزام واحد يستحق'
  if (count === 2) return 'التزامان يستحقان'
  if (count >= 3 && count <= 10) return `${count} التزامات تستحق`
  return `${count} التزاماً يستحق`
}

export function formatDebtCount(count: number): string {
  if (count === 0) return 'لا توجد ديون نشطة'
  if (count === 1) return 'دين نشط واحد'
  if (count === 2) return 'دينان نشطان'
  if (count >= 3 && count <= 10) return `${count} ديون نشطة`
  return `${count} ديناً نشطاً`
}

export interface DashboardHeroVisualStatusParams {
  isInitialOrLoading: boolean
  isRolloverResolving: boolean
  isTemporaryLiquidityDeficit: boolean
  isFutureMonth: boolean
  displayBalance: number
  freeBalance: number
  healthStatus: 'safe' | 'warning' | 'danger'
  isSpendingWithoutIncome: boolean
  isHighConsumption: boolean
}

export interface DashboardHeroVisualStatus {
  topBarClass: string
  shieldColorClass: string
}

export function getDashboardHeroVisualStatus(
  params: DashboardHeroVisualStatusParams
): DashboardHeroVisualStatus {
  const {
    isInitialOrLoading,
    isRolloverResolving,
    isTemporaryLiquidityDeficit,
    isFutureMonth,
    displayBalance,
    freeBalance,
    healthStatus,
    isSpendingWithoutIncome,
    isHighConsumption,
  } = params

  if (isInitialOrLoading || isRolloverResolving) {
    return {
      topBarClass: 'bg-emerald-500',
      shieldColorClass: 'text-emerald-600 dark:text-emerald-400',
    }
  }

  if (isTemporaryLiquidityDeficit) {
    return {
      topBarClass: 'bg-amber-500',
      shieldColorClass: 'text-amber-500 dark:text-amber-400',
    }
  }

  if (isFutureMonth) {
    if (displayBalance < 0 || healthStatus === 'danger') {
      return {
        topBarClass: 'bg-red-500',
        shieldColorClass: 'text-red-600 dark:text-red-400',
      }
    }
    if (healthStatus === 'warning' || freeBalance < 0) {
      return {
        topBarClass: 'bg-amber-500',
        shieldColorClass: 'text-amber-500 dark:text-amber-400',
      }
    }
    return {
      topBarClass: 'bg-emerald-500',
      shieldColorClass: 'text-emerald-600 dark:text-emerald-400',
    }
  }

  if (
    displayBalance < 0 ||
    freeBalance < 0 ||
    healthStatus === 'danger' ||
    isSpendingWithoutIncome
  ) {
    return {
      topBarClass: 'bg-red-500',
      shieldColorClass: 'text-red-600 dark:text-red-400',
    }
  }

  if (isHighConsumption || healthStatus === 'warning') {
    return {
      topBarClass: 'bg-amber-500',
      shieldColorClass: 'text-amber-500 dark:text-amber-400',
    }
  }

  return {
    topBarClass: 'bg-emerald-500',
    shieldColorClass: 'text-emerald-600 dark:text-emerald-400',
  }
}
