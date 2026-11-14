import React from 'react'
import {
  Home,
  ArrowLeftRight,
  RefreshCw,
  BarChart3,
  LayoutGrid,
  Settings,
  HandCoins,
  Calculator,
  Users,
  Clock,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'المتابعة اليومية',
    items: [
      { to: '/', label: 'لوحة التحكم', icon: Home },
      { to: '/transactions', label: 'المعاملات', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'الالتزامات والتخطيط',
    items: [
      { to: '/debts', label: 'الديون', icon: HandCoins },
      { to: '/recurring', label: 'المتكررة', icon: RefreshCw },
      { to: '/tools', label: 'الأدوات الإضافية', icon: Calculator },
      { to: '/reports', label: 'التقارير', icon: BarChart3 },
    ],
  },
  {
    title: 'التخصيص والنظام',
    items: [
      { to: '/categories', label: 'التصنيفات', icon: LayoutGrid },
      { to: '/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
]

export interface FeatureItem {
  to: string
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}

export const smartTools: FeatureItem[] = [
  {
    to: '/tools?tool=circles',
    title: 'الجمعيات والصناديق المشتركة',
    subtitle: 'متابعة دورك، الأقساط، ودفعات الأعضاء',
    icon: Users,
  },
  {
    to: '/tools?tool=work_hours',
    title: 'تكلفة الشراء بساعات العمل',
    subtitle: 'تحويل سعر أي سلعة إلى ساعات دوام عملي',
    icon: Clock,
  },
]

export const managementItems: FeatureItem[] = [
  {
    to: '/reports',
    title: 'التقارير المالية',
    subtitle: 'مخططات بيانية، مؤشر الأمان، وتوقع نهاية الشهر',
    icon: BarChart3,
  },
  {
    to: '/recurring',
    title: 'المعاملات المتكررة',
    subtitle: 'الرواتب، الفواتير، والاشتراكات الشهرية المجدولة',
    icon: RefreshCw,
  },
  {
    to: '/categories',
    title: 'إدارة التصنيفات',
    subtitle: 'تخصيص الأيقونات، الألوان وترتيب التصنيفات',
    icon: LayoutGrid,
  },
  {
    to: '/settings',
    title: 'الإعدادات والعملة',
    subtitle: 'تفضيلات العملة والمظهر والنسخ الاحتياطي',
    icon: Settings,
  },
]
