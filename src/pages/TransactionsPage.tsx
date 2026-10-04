import React, { useState } from 'react'
import { ArrowLeftRight, Search } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { SegmentedControl } from '../components/ui/SegmentedControl'

export const TransactionsPage: React.FC = () => {
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="المعاملات"
        subtitle="سجل كامل بجميع المصاريف والمداخيل وتفاصيلها"
      />

      {/* Filter bar mockup */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="ابحث في الملاحظات والتصنيفات..."
            startIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <SegmentedControl<'all' | 'expense' | 'income'>
          value={filterType}
          onChange={setFilterType}
          options={[
            { value: 'all', label: 'الكل' },
            { value: 'expense', label: 'مصاريف' },
            { value: 'income', label: 'مداخيل' },
          ]}
        />
      </div>

      {/* Empty State */}
      <EmptyState
        icon={<ArrowLeftRight className="w-7 h-7" />}
        title="لا توجد أي معاملات مسجلة"
        description="جميع المعاملات التي تضيفها ستظهر هنا مجمّعة حسب اليوم مع خيارات التعديل والحذف."
      />
    </div>
  )
}
