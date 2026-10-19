import React, { useState, useMemo } from 'react'
import { Link } from 'react-router'
import { format as formatDate, addMonths } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  Crown,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Toggle } from '../components/ui/Toggle'
import { RecurringForm } from '../components/RecurringForm'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { useMoneyCircles } from '../hooks/useMoneyCircles'
import { useCurrency } from '../hooks/useCurrency'
import { useToast } from '../hooks/useToast'
import { addRecurring, updateRecurring, deleteRecurring } from '../services/recurring'
import { getCurrentCircleMonth, isUserTurnMonth, updateMoneyCircle } from '../services/moneyCircles'
import { calculateMonthlyEquivalent, isOccurrenceSkipped } from '../lib/recurring'
import { toWesternDigits } from '../lib/dates'
import { cn } from '../lib/cn'
import type { Recurring, Frequency } from '../types'

export const RecurringPage: React.FC = () => {
  const { user } = useAuth()
  const { data: recurringItems, loading: recurringLoading } = useRecurring()
  const { data: categories } = useCategories()
  const { data: circles } = useMoneyCircles()
  const { format, formatWithSign } = useCurrency()
  const { showToast } = useToast()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Recurring | null>(null)
  const [itemToDelete, setItemToDelete] = useState<Recurring | null>(null)
  const [deleting, setDeleting] = useState(false)

  const activeCircles = useMemo(() => circles.filter((c) => c.status === 'active'), [circles])

  // Map categoryId to Category
  const categoryMap = useMemo(() => {
    const map = new Map<string, (typeof categories)[0]>()
    for (const c of categories) {
      map.set(c.id, c)
    }
    return map
  }, [categories])

  // Monthly equivalents (waives turn month for circle recurring items)
  const monthlyStats = useMemo(() => {
    return calculateMonthlyEquivalent(recurringItems, new Date())
  }, [recurringItems])

  const handleScheduleCircle = async (circle: (typeof circles)[0]) => {
    if (!user) return
    const defaultExpenseCategory = categories.find((c) => c.type === 'expense' && !c.archived)
    if (!defaultExpenseCategory) {
      showToast('يرجى إنشاء تصنيف مصاريف أولاً', 'error')
      return
    }
    try {
      const recId = await addRecurring(user.uid, {
        type: 'expense',
        amountFils: circle.monthlyAmountFils,
        categoryId: defaultExpenseCategory.id,
        title: `قسط ${circle.name}`,
        note: `قسط شهري للجمعية - معفى من الخصم في شهر الاستلام (${circle.myTurnMonth})`,
        frequency: 'monthly',
        startDate: circle.startDate,
        nextDate: circle.startDate,
        endDate: addMonths(circle.startDate, circle.membersCount - 1),
        active: true,
        circleId: circle.id,
        skipMonth: circle.myTurnMonth,
      })
      await updateMoneyCircle(user.uid, circle.id, { recurringId: recId })
      showToast('تمت جدولة القسط في المعاملات المتكررة بنجاح مع تخطي شهر استلامك!', 'success')
    } catch (err) {
      console.error('Failed to schedule circle:', err)
      showToast('تعذر جدولة القسط', 'error')
    }
  }

  const handleToggleActive = async (item: Recurring) => {
    if (!user) return
    const newActive = !item.active
    try {
      await updateRecurring(user.uid, item.id, { active: newActive })
      showToast(
        newActive
          ? 'تم تفعيل المعاملة المتكررة'
          : 'تم إيقاف المعاملة المتكررة مؤقتاً',
        'info'
      )
    } catch (err) {
      console.error('Failed to toggle recurring item:', err)
      showToast('تعذر تغيير حالة المعاملة', 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!user || !itemToDelete) return
    setDeleting(true)
    try {
      await deleteRecurring(user.uid, itemToDelete.id)
      showToast('تم حذف المعاملة المتكررة بنجاح', 'info')
      setItemToDelete(null)
    } catch (err) {
      console.error('Failed to delete recurring item:', err)
      showToast('تعذر حذف المعاملة', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const frequencyLabels: Record<Frequency, string> = {
    weekly: 'أسبوعي',
    monthly: 'شهري',
    yearly: 'سنوي',
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="المعاملات المتكررة"
          subtitle="جدولة المصاريف والمداخيل الدورية كالراتب والإيجار والاشتراكات"
        />
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
          onClick={() => {
            setEditingItem(null)
            setIsFormOpen(true)
          }}
          className="self-start sm:self-auto font-semibold"
        >
          إضافة متكررة
        </Button>
      </div>

      {/* KPI Cards: Monthly Income & Expense */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Income Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">
              مداخيل ثابتة شهرياً
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {format(monthlyStats.monthlyIncome)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Expense Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">
              مصاريف ثابتة شهرياً
            </span>
            <span className="text-2xl sm:text-3xl font-black text-red-500 dark:text-red-400">
              {format(monthlyStats.monthlyExpense)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Active Money Circles Section */}
      {activeCircles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <span>أقساط الجمعيات والصناديق المشتركة</span>
            </h3>
            <Link
              to="/tools?tool=circles"
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              إدارة الجمعيات ←
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCircles.map((circle) => {
              const isUserTurn = isUserTurnMonth(circle)
              const currentMonth = getCurrentCircleMonth(circle)
              return (
                <div
                  key={circle.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all flex flex-col justify-between',
                    isUserTurn
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {circle.name}
                    </span>
                    {isUserTurn ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                        <Crown className="w-3 h-3" />
                        <span>دورك في الاستلام!</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400">
                        الشهر {currentMonth} من {circle.membersCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      {isUserTurn ? 'مبلغ الاستلام الإجمالي:' : 'القسط الشهري المطلوب:'}
                    </span>
                    <span
                      className={cn(
                        'font-black text-sm',
                        isUserTurn
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      )}
                    >
                      {isUserTurn
                        ? `+ ${format(circle.totalAmountFils)}`
                        : `- ${format(circle.monthlyAmountFils)}`}
                    </span>
                  </div>

                  {isUserTurn && (
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-2 font-medium">
                      ✓ لن يتم خصم قسط منك هذا الشهر لأنك مستلم الجمعية!
                    </p>
                  )}

                  {/* Recurring Schedule Link / Status */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    {circle.recurringId ? (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>مجدولة بالمعاملات</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleScheduleCircle(circle)}
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>جدولة القسط شهرياً</span>
                      </button>
                    )}
                    {isUserTurn && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">معفى من الخصم</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recurring Items Grid */}
      {recurringLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 animate-pulse"
            />
          ))}
        </div>
      ) : recurringItems.length === 0 ? (
        <EmptyState
          icon={<RefreshCw className="w-8 h-8" />}
          title="لا توجد معاملات متكررة"
          description="أضف التزاماتك الثابتة (رواتب، إيجار، اشتراكات) ليقوم التطبيق بتسجيلها تلقائياً عند حلول موعدها."
          action={
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => {
                setEditingItem(null)
                setIsFormOpen(true)
              }}
            >
              إضافة أول معاملة متكررة
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recurringItems.map((item) => {
            const cat = categoryMap.get(item.categoryId)
            const icon = cat?.icon ?? '➕'
            const color = cat?.color ?? '#94A3B8'
            const name = cat?.name ?? 'غير مصنف'
            const isExpense = item.type === 'expense'
            const isCircleItem = Boolean(item.circleId || item.skipMonth)
            const isCurrentMonthTurn = isCircleItem && isOccurrenceSkipped(item, new Date())

            const nextDateFormatted = toWesternDigits(
              formatDate(
                item.nextDate instanceof Date ? item.nextDate : new Date(item.nextDate),
                'd LLLL yyyy',
                { locale: ar }
              )
            )

            return (
              <div
                key={item.id}
                className={cn(
                  'group rounded-2xl p-5 border transition-all flex flex-col justify-between',
                  item.active
                    ? 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md'
                    : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                )}
              >
                {/* Top Row: Category + Frequency Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${color}25` }}
                    >
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100 block truncate">
                        {item.title || name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400 truncate mt-0.5">
                        {item.title ? (
                          <>
                            <span className="font-medium text-slate-500 dark:text-slate-400">{name}</span>
                            {item.note ? <span>•</span> : null}
                          </>
                        ) : null}
                        {item.note ? <span>{item.note}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!item.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                        متوقفة مؤقتاً
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold border border-amber-200/60 dark:border-amber-900/40">
                      {frequencyLabels[item.frequency]}
                    </span>
                  </div>
                </div>

                {/* Circle Skip Month Indicator */}
                {isCircleItem && (
                  <div className="my-1.5">
                    {isCurrentMonthTurn ? (
                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>دورك في الاستلام هذا الشهر!</span>
                        </span>
                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black">
                          معفى من الخصم تلقائياً
                        </span>
                      </div>
                    ) : item.skipMonth ? (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Zap className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>قسط جمعية (معفى من الخصم في الشهر رقم {item.skipMonth})</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Middle: Amount in large bold text */}
                <div className="my-2">
                  <div
                    className={cn(
                      'text-xl sm:text-2xl font-black select-none',
                      isExpense
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {formatWithSign(item.amountFils, item.type)}
                  </div>
                </div>

                {/* Bottom Row: Next date, Active toggle, Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 truncate">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">الموعد القادم: {nextDateFormatted}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle button */}
                    <Toggle
                      checked={item.active}
                      onChange={() => handleToggleActive(item)}
                      aria-label={item.active ? 'إيقاف مؤقت' : 'تفعيل'}
                      className="shrink-0"
                    />

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item)
                        setIsFormOpen(true)
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      aria-label="تعديل المعاملة المتكررة"
                      title="تعديل المعاملة المتكررة"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      aria-label="حذف المعاملة المتكررة"
                      title="حذف المعاملة المتكررة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recurring Form Modal */}
      <RecurringForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialRecurring={editingItem}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        title="تأكيد حذف المعاملة المتكررة"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              هل أنت متأكد من حذف هذه المعاملة المتكررة؟ لن يتم إنشاء أي معاملات مستقبلية منها.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setItemToDelete(null)}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'جاري الحذف...' : 'حذف المعاملة المتكررة'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
