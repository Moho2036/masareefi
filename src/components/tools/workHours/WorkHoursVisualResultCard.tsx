import React from 'react'
import {
  Briefcase,
  Percent,
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { toFils } from '../../../lib/money'
import { cn } from '../../../lib/cn'

export interface WorkHoursVisualResultCardProps {
  salary: number
  itemPrice: number
  itemName: string
  config: { decimals: number; symbol: string }
  impactTier: 'none' | 'light' | 'medium' | 'heavy'
  fullHours: number
  remainingMinutes: number
  equivalentWorkDays: string
  salaryPercent: string | number
}

export const WorkHoursVisualResultCard: React.FC<WorkHoursVisualResultCardProps> = ({
  salary,
  itemPrice,
  itemName,
  config,
  impactTier,
  fullHours,
  remainingMinutes,
  equivalentWorkDays,
  salaryPercent,
}) => {
  return (
    <Card className="h-full flex flex-col justify-between border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] shadow-2xs dark:shadow-none">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-xs font-bold text-zinc-400">التكلفة الفعلية للشراء</span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full',
              impactTier === 'none' &&
                'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
              impactTier === 'light' &&
                'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
              impactTier === 'medium' &&
                'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
              impactTier === 'heavy' &&
                'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                impactTier === 'none' && 'bg-zinc-400',
                impactTier === 'light' && 'bg-blue-500',
                impactTier === 'medium' && 'bg-amber-500',
                impactTier === 'heavy' && 'bg-rose-500'
              )}
            />
            <span>
              {impactTier === 'none' && 'بانتظار البيانات'}
              {impactTier === 'light' && 'عبء خفيف'}
              {impactTier === 'medium' && 'عبء متوسط'}
              {impactTier === 'heavy' && 'عبء مرتفع'}
            </span>
          </span>
        </div>

        {/* Main hours counter */}
        {salary <= 0 || itemPrice <= 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
              يرجى إدخال راتب شهري وسعر سلعة أكبر من الصفر لاحتساب ساعات العمل المطلوبة
            </p>
          </div>
        ) : (
          <div className="py-1 text-center space-y-1.5">
            <p className="text-xs font-semibold text-zinc-400">
              لشراء <span className="font-bold text-zinc-700 dark:text-zinc-200">"{itemName || 'هذه السلعة'}"</span> بسعر <FormattedMoney amountFils={toFils(itemPrice, config.decimals)} maskAmount={false} />، تحتاج إلى:
            </p>

            <div className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white select-none tracking-tight">
              {fullHours}{' '}
              <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                ساعة
              </span>
              {remainingMinutes > 0 && (
                <span className="text-2xl sm:text-3xl font-extrabold text-zinc-400 ms-2">
                  و {remainingMinutes} دقيقة
                </span>
              )}
            </div>

            <div className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5 pt-1">
              <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>
                ما يعادل تقريباً{' '}
                <strong className="text-blue-600 dark:text-blue-400 font-black">
                  {equivalentWorkDays}
                </strong>{' '}
                يوم دوام عملي
              </span>
            </div>
          </div>
        )}

        {/* Direct Metric: Percent of Monthly Salary */}
        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Percent className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium text-zinc-600 dark:text-zinc-300">من الراتب الشهري:</span>
          </div>
          <span className="text-sm font-black text-zinc-800 dark:text-zinc-100">
            %{salaryPercent}
          </span>
        </div>
      </div>
    </Card>
  )
}
