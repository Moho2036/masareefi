import React from 'react'
import { LayoutDashboard } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { formatJOD } from '../lib/money'

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة عامة على مصاريفك ومداخيلك لهذا الشهر"
      />

      {/* KPI Cards Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance Card */}
        <Card className="border-s-4 border-s-emerald-500">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            الرصيد المتبقي
          </div>
          <div className="text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {formatJOD(0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            صافي رصيد الشهر المالي الحالي
          </div>
        </Card>

        {/* Expenses Card */}
        <Card className="border-s-4 border-s-red-500">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            المصاريف
          </div>
          <div className="text-2xl lg:text-3xl font-black text-red-500 dark:text-red-400">
            {formatJOD(0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            إجمالي المصاريف هذا الشهر
          </div>
        </Card>

        {/* Income Card */}
        <Card className="border-s-4 border-s-emerald-500">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            المداخيل
          </div>
          <div className="text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {formatJOD(0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            إجمالي المداخيل هذا الشهر
          </div>
        </Card>
      </div>

      {/* Empty State */}
      <EmptyState
        icon={<LayoutDashboard className="w-7 h-7" />}
        title="لا توجد بيانات لهذا الشهر"
        description="ابدأ بتسجيل أول معاملة أو دخل لتظهر التحليلات والرسوم البيانية هنا."
      />
    </div>
  )
}
