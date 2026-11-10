import React from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { QuickFeatureHub } from '../components/dashboard/QuickFeatureHub'
import { DashboardHeroSection } from '../components/dashboard/DashboardHeroSection'
import { DashboardRecentTransactions } from '../components/dashboard/DashboardRecentTransactions'
import { DashboardUpcomingSection } from '../components/dashboard/DashboardUpcomingSection'
import { useDashboardData } from '../hooks/useDashboardData'

export const DashboardPage: React.FC = () => {
  const {
    range,
    monthStartDay,
    isCurrentFiscalMonth,
    isRolloverResolving,
    isInitialOrLoading,
    sums,
    forecast,
    safeDisplayBalance,
    heroTopBar,
    heroShieldColor,
    greetingSubtitle,
    debtSummary,
    nearestUpcomingDebt,
    debtsLoading,
    categoryMap,
    topExpenseCategories,
    recentTransactions,
    upcomingRecurring,
    recurringLoading,
    today,
    openAdd,
    openEdit,
    openDuplicate,
    goToCurrentMonth,
  } = useDashboardData()

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header with Title and Desktop-only Quick Add */}
      <PageHeader
        title="لوحة التحكم"
        subtitle={greetingSubtitle}
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => openAdd('expense')}
            data-tour="add-transaction-btn"
            className="hidden lg:inline-flex gap-1.5 shadow-xs font-semibold press-scale"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة معاملة</span>
          </Button>
        }
      />

      {/* 1. Hero Card: Clean Swiss Surface */}
      <DashboardHeroSection
        isInitialOrLoading={isInitialOrLoading}
        isRolloverResolving={isRolloverResolving}
        isCurrentFiscalMonth={isCurrentFiscalMonth}
        range={range}
        monthStartDay={monthStartDay}
        goToCurrentMonth={goToCurrentMonth}
        safeDisplayBalance={safeDisplayBalance}
        sums={sums}
        forecast={forecast}
        heroTopBar={heroTopBar}
        heroShieldColor={heroShieldColor}
      />

      {/* Quick Feature Access Hub (Mobile only, hidden on lg desktop) */}
      <QuickFeatureHub />

      {/* 2. Core Activity: Recent Transactions (col 7) & Debts Summary + Upcoming Recurring (col 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <DashboardRecentTransactions
          isInitialOrLoading={isInitialOrLoading}
          recentTransactions={recentTransactions}
          topExpenseCategories={topExpenseCategories}
          categoryMap={categoryMap}
          today={today}
          openAdd={openAdd}
          openEdit={openEdit}
          openDuplicate={openDuplicate}
        />

        <DashboardUpcomingSection
          isInitialOrLoading={isInitialOrLoading}
          debtsLoading={debtsLoading}
          debtSummary={debtSummary}
          nearestUpcomingDebt={nearestUpcomingDebt}
          upcomingRecurring={upcomingRecurring}
          recurringLoading={recurringLoading}
          categoryMap={categoryMap}
          today={today}
        />
      </div>
    </div>
  )
}
