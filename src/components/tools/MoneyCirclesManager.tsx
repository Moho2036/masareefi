import React, { useState, useMemo } from 'react'
import {
  Users,
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { useCurrency } from '../../hooks/useCurrency'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useMoneyCircles } from '../../hooks/useMoneyCircles'
import { useTransactions } from '../../hooks/useTransactions'
import { useRecurring } from '../../hooks/useRecurring'
import { useCategories } from '../../hooks/useCategories'
import { useToast } from '../../hooks/useToast'
import { CircleCard } from './circles/CircleCard'
import { CircleFormModal } from './circles/CircleFormModal'
import { CircleConfirmationModals } from './circles/CircleConfirmationModals'
import { CircleSwapTurnsModal } from './circles/CircleSwapTurnsModal'
import { useMoneyCirclesFormState } from './circles/useMoneyCirclesFormState'
import { useMoneyCirclesActions } from './circles/useMoneyCirclesActions'
import { useCirclePayoutSync } from './circles/useCirclePayoutSync'
import type { MoneyCircle } from '../../types'

export const MoneyCirclesManager: React.FC = () => {
  const { user } = useAuth()
  const { data: settings } = useUserSettings()
  const monthStartDay = settings?.monthStartDay ?? 1
  const { data: circles, loading } = useMoneyCircles()
  const { data: recurringList } = useRecurring()
  const { data: categories } = useCategories()
  const { data: transactions } = useTransactions()
  const { config } = useCurrency()
  const { showToast } = useToast()

  // Sorted circles: active circles first, completed last. Within each group, newest startDate first.
  const sortedCircles = useMemo(() => {
    return [...circles].sort((a, b) => {
      const aCompleted = a.status === 'completed'
      const bCompleted = b.status === 'completed'
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1
      }
      const aTime = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime()
      const bTime = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime()
      return bTime - aTime
    })
  }, [circles])

  const activeCircles = useMemo(
    () => sortedCircles.filter((c) => c.status !== 'completed'),
    [sortedCircles]
  )
  const completedCircles = useMemo(
    () => sortedCircles.filter((c) => c.status === 'completed'),
    [sortedCircles]
  )
  const [userToggledCompleted, setUserToggledCompleted] = useState<boolean | null>(null)
  const isCompletedExpanded =
    userToggledCompleted !== null ? userToggledCompleted : completedCircles.length <= 3

  const defaultExpenseCategory = useMemo(() => {
    const active = categories.filter((c) => c.type === 'expense' && !c.archived)
    return (
      active.find((c) => c.name.includes('سداد الديون والأقساط')) ||
      active.find((c) => c.name.includes('الجمعيات المالية') || c.name.includes('الجمعيات')) ||
      active.find((c) => c.name.includes('أقساط') || c.name.includes('ديون')) ||
      active[0] ||
      categories.find((c) => c.type === 'expense')
    )
  }, [categories])

  const defaultIncomeCategory = useMemo(() => {
    const active = categories.filter((c) => c.type === 'income' && !c.archived)
    return (
      active.find((c) => c.name.includes('الجمعيات المالية') || c.name.includes('الجمعيات')) ||
      active.find((c) => c.name.includes('استلام') || c.name.includes('دخل إضافي')) ||
      active.find((c) => c.name === 'أخرى') ||
      active[0] ||
      categories.find((c) => c.type === 'income')
    )
  }, [categories])

  // Payout sync hook
  const {
    depositedCircleIds,
    addDepositedCircleId,
    removeDepositedCircleId,
    checkedCirclesRef,
  } = useCirclePayoutSync({
    user,
    circles,
    transactions,
    monthStartDay,
  })

  const getLinkedRecurring = (circle: MoneyCircle) => {
    return recurringList.find(
      (r) => r.id === circle.recurringId || r.circleId === circle.id
    )
  }

  // Expanded circle states
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null)
  const [selectedCircleMonth, setSelectedCircleMonth] = useState<Record<string, number>>({})

  // Form State Hook
  const formState = useMoneyCirclesFormState({
    user,
    monthStartDay,
    config,
    categories,
    defaultExpenseCategory,
    defaultIncomeCategory,
    recurringList,
    depositedCircleIds,
    addDepositedCircleId,
    removeDepositedCircleId,
    showToast,
  })

  // Actions Hook
  const actions = useMoneyCirclesActions({
    user,
    monthStartDay,
    defaultExpenseCategory,
    defaultIncomeCategory,
    recurringList,
    depositedCircleIds,
    addDepositedCircleId,
    removeDepositedCircleId,
    checkedCirclesRef,
    showToast,
  })

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div data-tour="tools-circles" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>نظام الجمعيات والصناديق المشتركة</span>
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
            متابعة تحصيل الاشتراكات، الأقساط الشهرية، وسجل سداد الأعضاء بكل شفافية
          </p>
        </div>

        <Button
          onClick={formState.handleOpenAddModal}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          إنشاء جمعية جديدة
        </Button>
      </div>

      {/* Circles List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                  <div className="space-y-1.5">
                    <div className="w-32 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-20 h-3 rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  </div>
                </div>
                <div className="w-20 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-16 rounded-xl bg-zinc-50 dark:bg-zinc-800/40" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : circles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />}
            title="لا توجد جمعيات مالية نشطة حالياً"
            description="أنشئ جمعيتك الأولى لمتابعة الأدوار، الأقساط الشهرية، ودفعات الأعضاء بسهولة تامة."
            action={
              <Button onClick={formState.handleOpenAddModal} variant="primary" icon={<Plus className="w-4 h-4" />}>
                إنشاء جمعية جديدة
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Active Circles */}
          {activeCircles.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              monthStartDay={monthStartDay}
              depositedCircleIds={depositedCircleIds}
              expandedCircleId={expandedCircleId}
              setExpandedCircleId={setExpandedCircleId}
              selectedCircleMonth={selectedCircleMonth}
              setSelectedCircleMonth={setSelectedCircleMonth}
              togglingMemberKey={actions.togglingMemberKey}
              depositingCircleId={actions.depositingCircleId}
              getLinkedRecurring={getLinkedRecurring}
              handleOpenEditModal={formState.handleOpenEditModal}
              setDeleteCircleId={actions.setDeleteCircleId}
              setConfirmCompleteCircle={actions.setConfirmCompleteCircle}
              handleRestoreCircle={actions.handleRestoreCircle}
              handleDepositCircleNet={actions.handleDepositCircleNet}
              handleUndoDepositCircleNet={actions.handleUndoDepositCircleNet}
              handleToggleMemberPayment={actions.handleToggleMemberPayment}
              handleResumeRecurring={actions.handleResumeRecurring}
              handleScheduleCircle={actions.handleScheduleCircle}
              setSwapTarget={actions.setSwapTarget}
              setSwapWithMemberId={actions.setSwapWithMemberId}
            />
          ))}

          {/* If no active circles, but completed circles exist */}
          {activeCircles.length === 0 && completedCircles.length > 0 && (
            <Card className="p-6 text-center border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-xs">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                لا توجد جمعيات مالية نشطة حالياً.
              </p>
            </Card>
          )}

          {/* Completed circles collapsible archive section */}
          {completedCircles.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToggledCompleted(!isCompletedExpanded)}
                className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-colors cursor-pointer select-none border border-[#E4E4E7]/60 dark:border-[#27272A]"
                aria-expanded={isCompletedExpanded}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>الجمعيات المكتملة ({completedCircles.length})</span>
                </div>
                {isCompletedExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </button>
              {isCompletedExpanded && (
                <div className="space-y-4 animate-slide-down">
                  {completedCircles.map((circle) => (
                    <CircleCard
                      key={circle.id}
                      circle={circle}
                      monthStartDay={monthStartDay}
                      depositedCircleIds={depositedCircleIds}
                      expandedCircleId={expandedCircleId}
                      setExpandedCircleId={setExpandedCircleId}
                      selectedCircleMonth={selectedCircleMonth}
                      setSelectedCircleMonth={setSelectedCircleMonth}
                      togglingMemberKey={actions.togglingMemberKey}
                      depositingCircleId={actions.depositingCircleId}
                      getLinkedRecurring={getLinkedRecurring}
                      handleOpenEditModal={formState.handleOpenEditModal}
                      setDeleteCircleId={actions.setDeleteCircleId}
                      setConfirmCompleteCircle={actions.setConfirmCompleteCircle}
                      handleRestoreCircle={actions.handleRestoreCircle}
                      handleDepositCircleNet={actions.handleDepositCircleNet}
                      handleUndoDepositCircleNet={actions.handleUndoDepositCircleNet}
                      handleToggleMemberPayment={actions.handleToggleMemberPayment}
                      handleResumeRecurring={actions.handleResumeRecurring}
                      handleScheduleCircle={actions.handleScheduleCircle}
                      setSwapTarget={actions.setSwapTarget}
                      setSwapWithMemberId={actions.setSwapWithMemberId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Circle Modal */}
      <CircleFormModal
        isOpen={formState.isAddModalOpen}
        onClose={() => {
          formState.setIsAddModalOpen(false)
          formState.setEditingCircle(null)
        }}
        editingCircle={formState.editingCircle}
        formError={formState.formError}
        name={formState.name}
        setName={formState.setName}
        monthlyAmountStr={formState.monthlyAmountStr}
        setMonthlyAmountStr={formState.setMonthlyAmountStr}
        membersCountStr={formState.membersCountStr}
        setMembersCountStr={formState.setMembersCountStr}
        myTurnMonthStr={formState.myTurnMonthStr}
        setMyTurnMonthStr={formState.setMyTurnMonthStr}
        startDateStr={formState.startDateStr}
        setStartDateStr={formState.setStartDateStr}
        shareType={formState.shareType}
        setShareType={formState.setShareType}
        secondTurnMonthStr={formState.secondTurnMonthStr}
        setSecondTurnMonthStr={formState.setSecondTurnMonthStr}
        expenseCategoryId={formState.expenseCategoryId}
        setExpenseCategoryId={formState.setExpenseCategoryId}
        incomeCategoryId={formState.incomeCategoryId}
        setIncomeCategoryId={formState.setIncomeCategoryId}
        autoSchedule={formState.autoSchedule}
        setAutoSchedule={formState.setAutoSchedule}
        setAutoScheduleTouched={formState.setAutoScheduleTouched}
        isManager={formState.isManager}
        setIsManager={formState.setIsManager}
        customMembers={formState.customMembers}
        setCustomMembers={formState.setCustomMembers}
        handleMembersCountChange={formState.handleMembersCountChange}
        handleMyTurnMonthChange={formState.handleMyTurnMonthChange}
        showAmountOrMembersChangeWarning={formState.showAmountOrMembersChangeWarning}
        categories={categories}
        defaultExpenseCategory={defaultExpenseCategory}
        defaultIncomeCategory={defaultIncomeCategory}
        config={config}
        submitting={formState.submitting}
        onSubmit={formState.handleSaveCircle}
      />

      {/* Confirmation Modals (Delete and Complete) */}
      <CircleConfirmationModals
        deleteCircleId={actions.deleteCircleId}
        onCloseDelete={() => {
          actions.setDeleteCircleId(null)
          actions.setDeleteTransactions(false)
        }}
        onConfirmDelete={actions.handleDelete}
        deleteTransactions={actions.deleteTransactions}
        setDeleteTransactions={actions.setDeleteTransactions}
        isDeleting={actions.isDeleting}
        confirmCompleteCircle={actions.confirmCompleteCircle}
        onCloseComplete={() => actions.setConfirmCompleteCircle(null)}
        onConfirmComplete={() => actions.confirmCompleteCircle && actions.handleCompleteCircle(actions.confirmCompleteCircle)}
        isCompleting={actions.isCompleting}
      />

      {/* Swap Turns Modal */}
      <CircleSwapTurnsModal
        swapTarget={actions.swapTarget}
        swapWithMemberId={actions.swapWithMemberId}
        onSwapWithMemberIdChange={actions.setSwapWithMemberId}
        onClose={() => {
          actions.setSwapTarget(null)
          actions.setSwapWithMemberId('')
        }}
        onConfirm={actions.handleConfirmSwap}
        isSwapping={actions.isSwapping}
      />
    </div>
  )
}
