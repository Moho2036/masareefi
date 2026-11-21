import React, { useState } from 'react'
import {
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { Modal } from '../../ui/Modal'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { TransactionForm } from '../../TransactionForm'
import { toFils } from '../../../lib/money'

export interface WorkHoursDecisionInsightCardProps {
  itemPrice: number
  itemPriceFils: number
  itemName: string
  config: { decimals: number }
  forecast: {
    freeBalance: number
    remainingDays: number
    dailySafeFils: number
  }
  newFreeBalance: number
  newDailySafeFils: number
  dailySafeDropFils: number
  itemDailyBurdenFils: number
}

export const WorkHoursDecisionInsightCard: React.FC<WorkHoursDecisionInsightCardProps> = ({
  itemPrice,
  itemPriceFils,
  itemName,
  config,
  forecast,
  newFreeBalance,
  newDailySafeFils,
  dailySafeDropFils,
  itemDailyBurdenFils,
}) => {
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)

  if (itemPrice <= 0) return null

  const itemFils = toFils(itemPrice, config.decimals)
  const isDanger =
    forecast.freeBalance <= 0 ||
    itemFils > forecast.freeBalance ||
    (forecast.freeBalance > 0 && itemFils >= forecast.freeBalance * 0.8)
  const isWarning =
    !isDanger &&
    forecast.freeBalance > 0 &&
    (itemFils >= forecast.freeBalance * 0.4 ||
      (forecast.dailySafeFils > 0 && dailySafeDropFils >= forecast.dailySafeFils * 0.4))

  return (
    <>
      <Card
        title="بصيرة القرار الشرائي على ميزانية هذا الشهر"
        className="border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-2xs dark:shadow-none"
      >
        <div className="space-y-3.5 pt-1">
          {/* Status Alert Banner */}
          {forecast.freeBalance <= 0 ? (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-0.5">
                  تحذير: لا يوجد رصيد حر متاح هذا الشهر (<FormattedMoney amountFils={forecast.freeBalance} />)
                </span>
                <span className="text-[11px] leading-relaxed">
                  ميزانيتك للشهر الحالي مستنفدة بالكامل أو في حالة عجز مالي. إتمام هذا الشراء سيزيد من العجز المرحّل للشهر القادم.
                </span>
              </div>
            </div>
          ) : toFils(itemPrice, config.decimals) > forecast.freeBalance ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-0.5">
                  تنبيه: سعر السلعة يتجاوز رصيدك الحر المتبقي!
                </span>
                <span className="text-[11px] leading-relaxed">
                  سعر السلعة (<FormattedMoney amountFils={toFils(itemPrice, config.decimals)} />) أكبر من رصيدك الحر المتبقي (<FormattedMoney amountFils={forecast.freeBalance} />) بمقدار <FormattedMoney amountFils={toFils(itemPrice, config.decimals) - forecast.freeBalance} />.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-start gap-3 text-zinc-800 dark:text-zinc-200 text-xs">
              <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-0.5 text-blue-600 dark:text-blue-400">
                  قرار شراء آمن ضمن حدود رصيدك المتاح
                </span>
                <span className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  سعر السلعة يقع بالكامل ضمن رصيدك الحر المتبقي لهذا الشهر (<FormattedMoney amountFils={forecast.freeBalance} />).
                </span>
              </div>
            </div>
          )}

          {/* Metrics Grid: Swiss divided container eliminating Box-in-Box clutter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-[#E4E4E7] dark:divide-[#27272A] overflow-hidden bg-zinc-50/70 dark:bg-zinc-900/40">
            <div className="p-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 block mb-1">
                  نسبة الاستهلاك من الرصيد الحر
                </span>
                <span className="text-base sm:text-xl font-black text-zinc-900 dark:text-white">
                  {forecast.freeBalance <= 0
                    ? '100%+ (عجز)'
                    : toFils(itemPrice, config.decimals) > forecast.freeBalance
                      ? '100%+ (يتجاوز المتاح)'
                      : `${((toFils(itemPrice, config.decimals) / forecast.freeBalance) * 100).toFixed(1)}%`}
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-zinc-400 block mt-1">
                الرصيد الحر الحالي: <FormattedMoney amountFils={forecast.freeBalance} />
              </span>
            </div>

            <div className="p-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 block mb-1">
                  الأثر على حد الصرف اليومي
                </span>
                <span className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400">
                  - <FormattedMoney amountFils={forecast.dailySafeFils > 0 && newFreeBalance >= 0 ? dailySafeDropFils : itemDailyBurdenFils} maskAmount={false} /> / يوم
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-zinc-400 block mt-1">
                {forecast.dailySafeFils > 0 && newFreeBalance >= 0 ? (
                  <>
                    ينخفض من <FormattedMoney amountFils={forecast.dailySafeFils} /> إلى <FormattedMoney amountFils={newDailySafeFils} />
                  </>
                ) : forecast.dailySafeFils > 0 ? (
                  <>
                    ينخفض للصفر (<FormattedMoney amountFils={0} />) مع عجز يومي بقيمة <FormattedMoney amountFils={itemDailyBurdenFils - forecast.dailySafeFils} maskAmount={false} />
                  </>
                ) : (
                  <>
                    الحد الآمن الحالي <FormattedMoney amountFils={0} /> — تُضيف عبئاً يومياً بقيمة <FormattedMoney amountFils={itemDailyBurdenFils} maskAmount={false} />
                  </>
                )}
              </span>
            </div>

            <div className="p-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 block mb-1">
                  الأيام المتبقية في الشهر المالي
                </span>
                <span className="text-base sm:text-xl font-black text-zinc-900 dark:text-white">
                  {forecast.remainingDays} يوم
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-zinc-400 block mt-1">
                حتى موعد تجدد الدورة المالية
              </span>
            </div>
          </div>

          {/* Quick Record Action */}
          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              إدراج السلعة في الميزانية
            </span>
            <Button
              type="button"
              variant={isDanger ? 'danger' : isWarning ? 'warning' : 'primary'}
              size="md"
              onClick={() => setIsTxModalOpen(true)}
              icon={<ShoppingBag className="w-4 h-4" />}
            >
              تسجيل المصروف
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Add Expense Modal */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title="تسجيل مصروف السلعة"
        hideCloseButton={true}
      >
        {isTxModalOpen && (
          <TransactionForm
            initialType="expense"
            duplicateFrom={{
              id: '',
              type: 'expense',
              amountFils: itemPriceFils,
              title: itemName || 'مشتريات جديدة',
              note: itemName ? `شراء ${itemName}` : '',
              categoryId: '',
              date: new Date(),
              createdAt: new Date(),
            }}
            onClose={() => setIsTxModalOpen(false)}
            onSuccess={() => setIsTxModalOpen(false)}
          />
        )}
      </Modal>
    </>
  )
}
