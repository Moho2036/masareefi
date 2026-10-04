import React, { useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { SegmentedControl } from '../components/ui/SegmentedControl'

export const CategoriesPage: React.FC = () => {
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense')

  return (
    <div className="space-y-6">
      <PageHeader
        title="التصنيفات"
        subtitle="إدارة تصنيفات المصاريف والمداخيل وتخصيص الأيقونات والألوان"
        actions={
          <SegmentedControl<'expense' | 'income'>
            value={categoryType}
            onChange={setCategoryType}
            options={[
              { value: 'expense', label: 'المصاريف' },
              { value: 'income', label: 'المداخيل' },
            ]}
          />
        }
      />

      <EmptyState
        icon={<LayoutGrid className="w-7 h-7" />}
        title="التصنيفات قيد التهيئة"
        description="سيتم تحميل التصنيفات الافتراضية (طعام، إيجار، فواتير، راتب...) وربطها مع قاعدة البيانات في المرحلة 3."
      />
    </div>
  )
}
