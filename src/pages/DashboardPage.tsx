import React from 'react'
import { Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { QuickFeatureHub } from '../components/dashboard/QuickFeatureHub'
import { DashboardHeroSection } from '../components/dashboard/DashboardHeroSection'
import { DashboardRecentTransactions } from '../components/dashboard/DashboardRecentTransactions'
import { DashboardUpcomingSection } from '../components/dashboard/DashboardUpcomingSection'
import { useDashboardData } from '../hooks/useDashboardData'
import { isTestEnv, pageTransition } from '../lib/motionTokens'

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

  const [prevStart, setPrevStart] = React.useState(() => range.start.getTime())
  const [slideDirection, setSlideDirection] = React.useState<number>(1)

  const currentStart = range.start.getTime()
  if (currentStart !== prevStart) {
    setPrevStart(currentStart)
    setSlideDirection(currentStart > prevStart ? 1 : -1)
  }

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

      {/* Monthly Content with Smooth Transition */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={range.start.toISOString().slice(0, 7)}
          initial={isTestEnv ? false : { opacity: 0.85, y: slideDirection * 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={isTestEnv ? undefined : { opacity: 0.85, y: -slideDirection * 10 }}
          transition={pageTransition}
          className="space-y-6"
        >
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
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
