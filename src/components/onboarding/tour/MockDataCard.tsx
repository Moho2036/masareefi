import React from 'react'
import {
  HandCoins,
  RefreshCw,
  Users,
  BarChart3,
  MessageCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react'

export interface MockDataCardProps {
  type: 'debt' | 'recurring' | 'circle' | 'report'
}

export const MockDataCard: React.FC<MockDataCardProps> = ({ type }) => {
  if (type === 'debt') {
    return (
      <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100">
          <div className="flex items-center gap-1.5">
            <HandCoins className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>معاينة: دين مسجل (سلفة أحمد)</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            لك (مستحق)
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 font-medium">الأصل: 50.000 د.أ • سُدّد: 30.000 د.أ</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              المتبقي: 20.000 د.أ
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" style={{ width: '60%' }} />
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
            <span className="text-blue-600 dark:text-blue-400">سجل 3 دفعات جزئية</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-3 h-3" />
              <span>مشاركة واتساب</span>
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'recurring') {
    return (
      <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>معاينة: التزام دوري مجدول</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
            <Clock className="w-2.5 h-2.5" />
            <span>يستحق بعد 4 أيام</span>
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-xs">
          <div>
            <div className="font-black text-zinc-900 dark:text-zinc-100">اشتراك الإنترنت المنزلي</div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
              يتكرر شهرياً في يوم 28 • ينتظر تأكيدك
            </div>
          </div>
          <div className="text-sm font-black text-red-600 dark:text-red-400 tabular-nums">
            -25.000 د.أ
          </div>
        </div>
      </div>
    )
  }

  if (type === 'circle') {
    return (
      <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>معاينة: صندوق جمعية عائلية</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
            دورك: الشهر رقم 3 من 10
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] space-y-1.5 text-xs">
          <div className="flex items-center justify-between font-bold">
            <span className="text-zinc-600 dark:text-zinc-400">القسط: 100.000 د.أ / شهر</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">
              الاستلام: 1,000.000 د.أ
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium flex items-center justify-between">
            <span>تم تسديد 2 من 10 أقساط</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">إيداع فوري بالرصيد</span>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'report') {
    return (
      <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-extrabold text-zinc-900 dark:text-zinc-100">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>معاينة: تحليل توزيع المصاريف</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-3 h-3" />
            <span>وفر +15% هذا الشهر</span>
          </span>
        </div>

        {/* Multi-segment distribution preview bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex">
            <div className="h-full bg-blue-600" style={{ width: '45%' }} title="بقالة 45%" />
            <div className="h-full bg-emerald-500" style={{ width: '25%' }} title="فواتير 25%" />
            <div className="h-full bg-amber-500" style={{ width: '18%' }} title="مطاعم 18%" />
            <div className="h-full bg-purple-500" style={{ width: '12%' }} title="أخرى 12%" />
          </div>

          <div className="grid grid-cols-4 gap-1 text-[9px] font-bold text-zinc-500 text-center">
            <span>بقالة 45%</span>
            <span>فواتير 25%</span>
            <span>مطاعم 18%</span>
            <span>أخرى 12%</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
