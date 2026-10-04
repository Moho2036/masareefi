import React, { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router'
import {
  Home,
  ArrowLeftRight,
  RefreshCw,
  BarChart3,
  LayoutGrid,
  Settings,
  Plus,
  Wallet,
  Calendar,
} from 'lucide-react'
import { BottomNav } from './BottomNav'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Toggle } from '../ui/Toggle'
import { cn } from '../../lib/cn'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { to: '/', label: 'لوحة التحكم', icon: Home },
  { to: '/transactions', label: 'المعاملات', icon: ArrowLeftRight },
  { to: '/recurring', label: 'المتكررة', icon: RefreshCw },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/categories', label: 'التصنيفات', icon: LayoutGrid },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

export const AppShell: React.FC = () => {
  const location = useLocation()
  const pathname = location.pathname
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [modalTxType, setModalTxType] = useState<'expense' | 'income'>('expense')
  const [isRecurring, setIsRecurring] = useState(false)

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased font-sans">
      {/* Desktop Sidebar (start side / right side in RTL) */}
      <aside
        aria-label="القائمة الجانبية"
        className="hidden lg:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-850 border-e border-slate-200/80 dark:border-slate-800 p-6 min-h-screen sticky top-0 h-screen overflow-y-auto"
      >
        {/* App Logo */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Wallet className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
              مصاريفي
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5" aria-label="تنقل الصفحات">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.to === '/'
                ? pathname === '/'
                : pathname.startsWith(item.to)

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium transition-all text-sm select-none',
                  isActive
                    ? 'bg-emerald-500 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80',
                )}
              >
                <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500')} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer / User Profile snippet */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-200 dark:border-emerald-800">
              م
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                مستخدم تجريبي
              </div>
              <div className="text-[11px] text-slate-400">
                المرحلة 1: التأسيس
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Mobile brand logo (visible only on small screens) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-slate-800 dark:text-white">
              مصاريفي
            </span>
          </div>

          <div className="hidden lg:block">
            {/* Desktop breadcrumb or subtle info */}
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              تطبيق إدارة المصاريف والمداخيل الشخصية
            </span>
          </div>

          {/* Top Header Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={() => setIsAddModalOpen(true)}
              className="font-semibold"
            >
              إضافة معاملة
            </Button>
          </div>
        </header>

        {/* Page View Slot */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onOpenAddModal={() => setIsAddModalOpen(true)} />

      {/* Global Add Transaction Placeholder Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="إضافة معاملة"
      >
        <div className="space-y-4 pt-1">
          {/* Segmented Control for Expense / Income */}
          <SegmentedControl<'expense' | 'income'>
            value={modalTxType}
            onChange={setModalTxType}
            options={[
              { value: 'expense', label: 'مصروف' },
              { value: 'income', label: 'دخل' },
            ]}
            className="w-full"
          />

          {/* Amount input */}
          <Input
            label="المبلغ (د.أ)"
            type="number"
            step="0.001"
            placeholder="0.000"
            className="text-lg font-bold text-center"
          />

          {/* Note input */}
          <Input
            label="ملاحظة (اختياري)"
            placeholder="مثال: بقالة، وقود، غداء عمل..."
          />

          {/* Date placeholder */}
          <Input
            label="التاريخ"
            type="date"
            defaultValue={new Date().toISOString().split('T')[0]}
            startIcon={<Calendar className="w-4 h-4" />}
          />

          {/* Toggle recurring */}
          <div className="pt-2">
            <Toggle
              checked={isRecurring}
              onChange={setIsRecurring}
              label="جعلها معاملة متكررة"
              description="تكرار هذه المعاملة تلقائياً في مواعيد محددة"
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs text-center border border-emerald-100 dark:border-emerald-900/40">
            نموذج إضافة المعاملات الحقيقي سيتم ربطه بقاعدة البيانات في المرحلة القادمة.
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
            >
              حفظ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
