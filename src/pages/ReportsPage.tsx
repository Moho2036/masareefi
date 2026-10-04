import React, { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { SegmentedControl } from '../components/ui/SegmentedControl'

export const ReportsPage: React.FC = () => {
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير المالية"
        subtitle="إحصائيات ورسوم بيانية تفصيلية للمصاريف والمداخيل"
        actions={
          <SegmentedControl<'monthly' | 'yearly'>
            value={reportPeriod}
            onChange={setReportPeriod}
            options={[
              { value: 'monthly', label: 'تقرير شهري' },
              { value: 'yearly', label: 'تقرير سنوي' },
            ]}
          />
        }
      />

      <EmptyState
        icon={<BarChart3 className="w-7 h-7" />}
        title="لا توجد بيانات كافية لإعداد التقارير"
        description="ستظهر هنا مقارنات الشهور السابقة ومخططات توزيع الإنفاق فور توفر معاملات مالية."
      />
    </div>
  )
}
