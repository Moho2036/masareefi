import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Card } from '../ui/Card'
import { SegmentedControl } from '../ui/SegmentedControl'
import { CategoryPieChart } from '../charts/CategoryPieChart'
import { CategoryIcon } from '../ui/CategoryIcon'
import { FormattedMoney } from '../ui/FormattedMoney'
import { isTestEnv } from '../../lib/motionTokens'
import type { CategoryDistributionItem } from '../../lib/reports'
import type { TxType } from '../../types'

export interface MonthlyCategoryBreakdownProps {
  categoryDist: CategoryDistributionItem[]
  categoryType: TxType
  onCategoryTypeChange: (type: TxType) => void
  loading: boolean
  hasLoadedOnce: boolean
  onSelectCategory: (item: CategoryDistributionItem) => void
  onSelectPieCategory: (categoryId: string) => void
}

export const MonthlyCategoryBreakdown: React.FC<MonthlyCategoryBreakdownProps> = ({
  categoryDist,
  categoryType,
  onCategoryTypeChange,
  loading,
  hasLoadedOnce,
  onSelectCategory,
  onSelectPieCategory,
}) => {
  const [showAllCategories, setShowAllCategories] = useState(false)

  return (
    <div className="space-y-5">
      {/* Category Filter Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <h2 className="text-base font-extrabold text-zinc-800 dark:text-zinc-100">
          {categoryType === 'expense' ? 'تحليل المصروفات حسب التصنيف' : 'تحليل المداخيل حسب التصنيف'}
        </h2>
        <SegmentedControl<TxType>
          value={categoryType}
          onChange={onCategoryTypeChange}
          options={[
            { value: 'expense', label: 'المصروفات' },
            { value: 'income', label: 'المداخيل' },
          ]}
        />
      </div>

      {/* Monthly Charts & Top Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut Chart */}
        <Card className="p-5 flex flex-col justify-between print-avoid-break min-h-[380px] sm:min-h-[420px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
              {categoryType === 'expense' ? 'توزيع المصاريف حسب التصنيف' : 'توزيع المداخيل حسب التصنيف'}
            </h2>
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              {categoryDist.length} تصنيفات
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={categoryType}
                initial={isTestEnv ? false : { opacity: 0.82, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={isTestEnv ? undefined : { opacity: 0.82, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex items-center justify-center"
              >
                <CategoryPieChart
                  data={categoryDist}
                  type={categoryType}
                  className="w-full"
                  onSelectCategory={onSelectPieCategory}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </Card>

        {/* Top Categories Progress Bars */}
        <Card className="p-5 print-avoid-break min-h-[380px] sm:min-h-[420px] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-700/60">
            <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
              {categoryType === 'expense' ? 'أعلى التصنيفات إنفاقاً' : 'أعلى التصنيفات دخلاً'}
            </h2>
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              {categoryType === 'expense' ? 'النسبة المئوية من الإنفاق' : 'النسبة المئوية من الدخل'}
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={categoryType}
              initial={isTestEnv ? false : { opacity: 0.82, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isTestEnv ? undefined : { opacity: 0.82, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col justify-between"
            >
              {loading && !hasLoadedOnce ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                          <div className="w-24 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                          <div className="w-8 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : categoryDist.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center flex-1">
                  {categoryType === 'expense'
                    ? 'لا توجد مصاريف مسجلة لهذا الشهر'
                    : 'لا توجد مداخيل مسجلة لهذا الشهر'}
                </div>
              ) : (
                <div className="space-y-3">
                  {(showAllCategories ? categoryDist : categoryDist.slice(0, 6)).map((item) => (
                    <div
                      key={item.categoryId}
                      tabIndex={0}
                      onClick={() => onSelectCategory(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectCategory(item)
                        }
                      }}
                      className="space-y-1.5 p-2 -mx-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors cursor-pointer group"
                      title="اضغط لعرض المعاملات التابعة لهذا التصنيف"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                          <span className="font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-zinc-800 dark:text-zinc-100">
                            <FormattedMoney amountFils={item.amountFils} />
                          </span>
                          <span className="font-bold text-zinc-400 dark:text-zinc-500 min-w-8 text-end">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {categoryDist.length > 6 && (
                    <div className="pt-2 text-center border-t border-zinc-100 dark:border-zinc-700/40 print-hide">
                      <button
                        type="button"
                        onClick={() => setShowAllCategories((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline py-1 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                      >
                        <span>
                          {showAllCategories
                            ? 'عرض أقل'
                            : `عرض جميع التصنيفات (${categoryDist.length})`}
                        </span>
                        {showAllCategories ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
    </div>
  )
}

export interface YearlyCategoryBreakdownProps {
  categoryDist: CategoryDistributionItem[]
  categoryType: TxType
  onCategoryTypeChange: (type: TxType) => void
  loading: boolean
  hasLoadedOnce: boolean
  onSelectCategory: (item: CategoryDistributionItem) => void
}

export const YearlyCategoryBreakdown: React.FC<YearlyCategoryBreakdownProps> = ({
  categoryDist,
  categoryType,
  onCategoryTypeChange,
  loading,
  hasLoadedOnce,
  onSelectCategory,
}) => {
  const [showAllCategories, setShowAllCategories] = useState(false)

  return (
    <Card className="p-5 min-h-[380px] sm:min-h-[420px] flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-700/60">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
            {categoryType === 'expense'
              ? 'أعلى التصنيفات إنفاقاً في السنة'
              : 'أعلى التصنيفات دخلاً في السنة'}
          </h2>
          <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
            {categoryType === 'expense' ? 'حسب إجمالي المصاريف' : 'حسب إجمالي المداخيل'}
          </span>
        </div>
        <SegmentedControl<TxType>
          value={categoryType}
          onChange={onCategoryTypeChange}
          options={[
            { value: 'expense', label: 'المصروفات' },
            { value: 'income', label: 'المداخيل' },
          ]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={categoryType}
          initial={isTestEnv ? false : { opacity: 0.82, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={isTestEnv ? undefined : { opacity: 0.82, y: -6 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col justify-between"
        >
          {loading && !hasLoadedOnce ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                      <div className="w-24 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-3.5 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="w-8 h-3 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                </div>
              ))}
            </div>
          ) : categoryDist.length === 0 ? (
            <div className="py-16 text-center text-xs text-zinc-400 dark:text-zinc-500 flex items-center justify-center flex-1">
              {categoryType === 'expense'
                ? 'لا توجد مصاريف مسجلة في هذه السنة'
                : 'لا توجد مداخيل مسجلة في هذه السنة'}
            </div>
          ) : (
        <div className="space-y-3">
          {(showAllCategories ? categoryDist : categoryDist.slice(0, 6)).map((item) => (
            <div
              key={item.categoryId}
              tabIndex={0}
              onClick={() => onSelectCategory(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectCategory(item)
                }
              }}
              className="space-y-1.5 p-2 -mx-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors cursor-pointer group"
              title="اضغط لعرض المعاملات التابعة لهذا التصنيف"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                  <span className="font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-100">
                    <FormattedMoney amountFils={item.amountFils} />
                  </span>
                  <span className="font-bold text-zinc-400 dark:text-zinc-500 min-w-8 text-end">
                    {item.percentage}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}

          {categoryDist.length > 6 && (
            <div className="pt-2 text-center border-t border-zinc-100 dark:border-zinc-700/40 print-hide">
              <button
                type="button"
                onClick={() => setShowAllCategories((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline py-1 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
              >
                <span>
                  {showAllCategories
                    ? 'عرض أقل'
                    : `عرض جميع التصنيفات (${categoryDist.length})`}
                </span>
                {showAllCategories ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  </AnimatePresence>
</Card>
  )
}
