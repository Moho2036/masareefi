import React from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'

export const RecurringPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="المعاملات المتكررة"
        subtitle="جدولة المصاريف والمداخيل الدورية كالراتب والإيجار والاشتراكات"
      />

      <EmptyState
        icon={<RefreshCw className="w-7 h-7" />}
        title="لا توجد معاملات متكررة"
        description="أضف التزاماتك الثابتة ليقوم التطبيق بتسجيلها تلقائياً عند حلول موعد استحقاقها."
      />
    </div>
  )
}
