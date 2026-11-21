import React, { useState } from 'react'
import { Coins } from 'lucide-react'
import { Card } from '../ui/Card'
import { Select } from '../ui/Select'
import { Toggle } from '../ui/Toggle'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { FormattedMoney } from '../ui/FormattedMoney'
import { getFinancialMonthRange, toWesternDigits } from '../../lib/dates'
import { toFils, fromFils, PRESET_CURRENCIES, getCurrencyConfig, MAX_AMOUNT_FILS } from '../../lib/money'
import {
  calculateReconciliation,
  RECONCILIATION_TITLE,
  RECONCILIATION_NOTE,
} from '../../lib/reconciliation'
import { getAllTransactions, addTransaction, deleteTransaction } from '../../services/transactions'
import type { UserSettings, Category } from '../../types'

export interface FinancialCycleSectionProps {
  uid: string | undefined
  settings: UserSettings | null | undefined
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
  selectedDay: string | null
  setSelectedDay: (val: string) => void
  categories: Category[]
  activeCurrency: string
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  refreshData?: () => void | Promise<void>
}

export const FinancialCycleSection: React.FC<FinancialCycleSectionProps> = ({
  uid,
  settings,
  updateSettings,
  selectedDay,
  setSelectedDay,
  categories,
  activeCurrency,
  showToast,
  refreshData,
}) => {
  const currentStartDay =
    selectedDay ?? (settings?.monthStartDay ? String(settings.monthStartDay) : '1')

  const dayOptions = Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `يوم ${i + 1} من كل شهر`,
  }))

  const activeConfig = getCurrencyConfig(activeCurrency, settings?.customCurrencyDecimals)

  // Balance Reconciliation Modal state
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [reconcileAmount, setReconcileAmount] = useState(
    settings?.openingBalanceFils ? String(fromFils(settings.openingBalanceFils)) : ''
  )
  const [savingReconcile, setSavingReconcile] = useState(false)

  const handleStartDayChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const parsed = parseInt(val, 10)
    const currentSaved = settings?.monthStartDay ?? 1
    if (parsed === currentSaved) {
      setSelectedDay(val)
      return
    }
    setSelectedDay(val)
    try {
      const updatePayload: { monthStartDay: number; rolloverStartDate?: Date } = { monthStartDay: parsed }
      if (settings?.rolloverStartDate) {
        updatePayload.rolloverStartDate = getFinancialMonthRange(new Date(), parsed).start
      }
      await updateSettings(updatePayload)
      showToast(`تم تعيين بداية الشهر المالي إلى يوم ${parsed} من كل شهر`, 'success')
    } catch (err) {
      console.error('Failed to persist month start day:', err)
    }
  }

  const handleToggleRollover = async (checked: boolean) => {
    try {
      await updateSettings({ rolloverBalance: checked })
      showToast(
        checked
          ? 'تم تفعيل ترحيل الرصيد المتبقي تلقائياً'
          : 'تم إيقاف ترحيل الرصيد، يعتمد التطبيق الآن على كل شهر منفصلاً',
        'success'
      )
    } catch (err) {
      console.error('Failed to toggle rollover balance:', err)
      showToast('تعذر تحديث إعدادات ترحيل الرصيد', 'error')
    }
  }

  const handleToggleRolloverStartDate = async (checked: boolean) => {
    try {
      const currentCycleStart = getFinancialMonthRange(new Date(), settings?.monthStartDay ?? 1).start
      const nextDate = checked ? currentCycleStart : null
      await updateSettings({
        rolloverStartDate: nextDate,
        ...(checked ? { openingBalanceFils: 0 } : {}),
      })
      showToast(
        checked
          ? 'تم تصفير العجز/الفائض السابق، وسيبدأ احتساب الترحيل من دورة هذا الشهر فصاعداً'
          : 'تم إلغاء القيد وسيعتمد الترحيل على كافة المعاملات السابقة',
        'success'
      )
    } catch (err) {
      console.error('Failed to toggle rollover start date:', err)
    }
  }

  const handleSaveReconciliation = async () => {
    if (!uid) return
    const rawDigits = toWesternDigits(reconcileAmount)
    const trimmed = rawDigits.trim()
    if (!trimmed) {
      showToast('يرجى إدخال مبلغ صالح', 'error')
      return
    }
    const decimals = settings?.customCurrencyDecimals ?? PRESET_CURRENCIES[activeCurrency]?.decimals ?? 3
    const targetFils = toFils(trimmed, decimals)
    if (isNaN(targetFils)) {
      showToast('يرجى إدخال مبلغ صالح', 'error')
      return
    }
    if (Math.abs(targetFils) > MAX_AMOUNT_FILS) {
      showToast('المبلغ يتجاوز الحد الأقصى المسموح به', 'error')
      return
    }
    setSavingReconcile(true)
    try {
      const allTxs = await getAllTransactions(uid)
      const res = calculateReconciliation({
        transactions: allTxs,
        targetFils,
        monthStartDay: settings?.monthStartDay ?? 1,
        rolloverBalance: settings?.rolloverBalance,
        rolloverStartDate: settings?.rolloverStartDate,
        now: new Date(),
      })

      // Delete old reconciliation transactions
      for (const oldTx of res.oldReconcileTxs) {
        await deleteTransaction(uid, oldTx.id)
      }

      await updateSettings({ openingBalanceFils: res.newOpeningBalanceFils })

      if (res.needsDiffExpense) {
        const expenseCategory =
          categories.find((c) => c.type === 'expense' && !c.archived && (c.name === 'أخرى' || c.name.includes('أخرى'))) ||
          categories.find((c) => c.type === 'expense' && !c.archived) ||
          categories.find((c) => c.type === 'expense')

        if (expenseCategory) {
          await addTransaction(uid, {
            title: RECONCILIATION_TITLE,
            amountFils: res.diffExpenseFils,
            type: 'expense',
            categoryId: expenseCategory.id,
            date: new Date(),
            note: RECONCILIATION_NOTE,
          })
        }
      }

      showToast('تمت تسوية وتحديث الرصيد الفعلي بنجاح', 'success')
      setShowReconcileModal(false)
      refreshData?.()
    } catch (err) {
      console.error('Failed to reconcile balance:', err)
      showToast('تعذر حفظ تسوية الرصيد', 'error')
    } finally {
      setSavingReconcile(false)
    }
  }

  return (
    <>
      <Card
        title="إعدادات الدورة المالية والترحيل"
        subtitle="يوم بداية الدورة المالية، ترحيل الرصيد، وتسوية الرصيد الفعلي"
      >
        <div className="pt-2 space-y-5">
          <div className="max-w-xs">
            <Select
              label="يوم بداية الدورة المالية"
              value={currentStartDay}
              onChange={handleStartDayChange}
              options={dayOptions}
              helperText="تبدأ تقاريرك الشهرية وحد الصرف اليومي من هذا اليوم (حتى يوم 28 لضمان انتظام كافة الأشهر)."
            />
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="rollover-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                ترحيل الرصيد المتبقي من الأشهر السابقة تلقائياً (Rollover)
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                ترحيل الفائض أو العجز المتراكم تلقائياً إلى رصيد الشهر التالي.
              </p>
            </div>
            <Toggle
              id="rollover-toggle"
              checked={settings?.rolloverBalance ?? true}
              onChange={handleToggleRollover}
            />
          </div>

          {/* Rollover Start Date Option */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <label htmlFor="rollover-start-date-toggle" className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                بدء احتساب الترحيل من هذا الشهر فقط (تصفير العجز السابق)
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                تصفير العجز السابق وبدء احتساب الترحيل من دورة هذا الشهر فصاعداً.
              </p>
            </div>
            <Toggle
              id="rollover-start-date-toggle"
              checked={Boolean(settings?.rolloverStartDate)}
              onChange={handleToggleRolloverStartDate}
            />
          </div>

          {/* Balance Reconciliation Button */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                تسوية وتعديل الرصيد الفعلي
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                الرصيد الافتتاحي المسجل حالياً:{' '}
                <span className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  <FormattedMoney amountFils={settings?.openingBalanceFils ?? 0} />
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={<Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              onClick={() => {
                setReconcileAmount(
                  settings?.openingBalanceFils ? String(fromFils(settings.openingBalanceFils)) : ''
                )
                setShowReconcileModal(true)
              }}
              className="font-bold text-xs"
            >
              تسوية وتعديل الرصيد
            </Button>
          </div>
        </div>
      </Card>

      {/* Balance Reconciliation Modal */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title="تسوية وتعديل الرصيد الفعلي"
        hideCloseButton={true}
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            أدخل الرصيد الفعلي الموجود حالياً في محفظتك النقدية أو حسابك البنكي لتسوية وتحديث الرصيد الافتتاحي:
          </p>
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              الرصيد الفعلي ({activeConfig.symbol})
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={reconcileAmount}
              onChange={(e) => setReconcileAmount(toWesternDigits(e.target.value))}
              placeholder="0.00"
              dir="ltr"
              className="font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowReconcileModal(false)}
              disabled={savingReconcile}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveReconciliation}
              disabled={savingReconcile || !reconcileAmount.trim()}
            >
              {savingReconcile ? 'جارٍ التسوية...' : 'حفظ وتسوية الرصيد'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
