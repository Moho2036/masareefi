import React from 'react'
import { format as formatDate } from 'date-fns'
import { ar } from 'date-fns/locale'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { toWesternDigits } from '../../../lib/dates'
import type { Debt, DebtEntry, DebtPayment } from '../../../types'

export interface DebtPrintReportProps {
  debt: Debt
  entries: DebtEntry[]
  payments: DebtPayment[]
  remainingFils: number
  isLent: boolean
  currencySymbol: string
}

export const DebtPrintReport: React.FC<DebtPrintReportProps> = ({
  debt,
  entries,
  payments,
  remainingFils,
  isLent,
}) => {
  const statementType = isLent ? 'مستحقات لك (سلف / إقراض)' : 'التزامات عليك (اقتراض)'
  const statusLabel = debt.settled ? 'مسدد بالكامل' : 'قيد السداد'
  const printDateStr = toWesternDigits(formatDate(new Date(), 'yyyy/MM/dd HH:mm', { locale: ar }))

  const debtStartDate = debt.startDate instanceof Date ? debt.startDate : new Date(debt.startDate)
  const debtDueDate = debt.dueDate
    ? debt.dueDate instanceof Date
      ? debt.dueDate
      : new Date(debt.dueDate)
    : null

  const displayEntries =
    entries.length > 0
      ? entries
      : [
          {
            id: 'init',
            amountFils: debt.amountFils,
            date: debtStartDate,
            title: 'أصل الدين',
            note: debt.note || '',
          },
        ]

  const totalEntriesFils = displayEntries.reduce((sum, e) => sum + e.amountFils, 0)
  const totalPaymentsFils = payments.reduce((sum, p) => sum + p.amountFils, 0)

  return (
    <div className="hidden print:block w-full max-w-full text-zinc-900 dark:text-zinc-100 p-2 text-start font-sans">
      {/* Formal Statement Header */}
      <div className="border-b-2 border-zinc-900 dark:border-zinc-100 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight">بَصير</span>
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                — كشف حساب مالي تفصيلي
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              تقرير رسمي صادر عن نظام بَصير لإدارة الذمم والالتزامات المالية
            </p>
          </div>
          <div className="text-end">
            <span
              className={`inline-block px-3 py-1 rounded-md text-xs font-black border ${
                debt.settled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                  : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700'
              }`}
            >
              {statusLabel}
            </span>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              تاريخ الطباعة: {printDateStr}
            </div>
          </div>
        </div>
      </div>

      {/* Account & Party Metadata Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1.5">
          <div>
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">اسم الطرف: </span>
            <span className="font-black text-sm text-zinc-900 dark:text-zinc-100">
              {debt.personName}
            </span>
          </div>
          <div>
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">نوع المعاملة: </span>
            <span className="font-bold">{statementType}</span>
          </div>
          {debt.note && (
            <div>
              <span className="font-semibold text-zinc-500 dark:text-zinc-400">البيان العام: </span>
              <span className="font-medium">{debt.note}</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div>
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">تاريخ بدء الدين: </span>
            <span className="font-bold">
              {toWesternDigits(formatDate(debtStartDate, 'yyyy/MM/dd'))}
            </span>
          </div>
          <div>
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">تاريخ الاستحقاق: </span>
            <span className="font-bold">
              {debtDueDate ? toWesternDigits(formatDate(debtDueDate, 'yyyy/MM/dd')) : 'غير محدد'}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary KPI Block */}
      <div className="grid grid-cols-3 gap-3 mb-6 print-avoid-break">
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-start">
          <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
            إجمالي المبلغ
          </div>
          <div className="text-base font-black text-zinc-900 dark:text-zinc-100">
            <FormattedMoney amountFils={debt.amountFils} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-start">
          <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
            إجمالي المسدد
          </div>
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
            <FormattedMoney amountFils={debt.paidFils || 0} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] text-start">
          <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1">
            المتبقي الفعلي
          </div>
          <div
            className={`text-base font-black ${
              remainingFils > 0
                ? isLent
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-red-600 dark:text-red-400'
                : 'text-zinc-400'
            }`}
          >
            <FormattedMoney amountFils={remainingFils} />
          </div>
        </div>
      </div>

      {/* Table 1: Debt Entries / Advances */}
      <div className="mb-6 print-avoid-break">
        <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-200 mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          أولاً: تفاصيل أصل الدين والسلف المسجلة ({displayEntries.length})
        </h3>
        <table className="w-full text-xs text-start border-collapse border border-zinc-200 dark:border-zinc-700">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800/80 font-bold border-b border-zinc-200 dark:border-zinc-700">
              <th className="p-2 text-start w-10">#</th>
              <th className="p-2 text-start w-28">التاريخ</th>
              <th className="p-2 text-start">البيان / العنوان</th>
              <th className="p-2 text-start">الملاحظات</th>
              <th className="p-2 text-end w-32">المبلغ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {displayEntries.map((entry, idx) => {
              const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date)
              return (
                <tr key={entry.id || idx}>
                  <td className="p-2 text-zinc-500">{toWesternDigits(String(idx + 1))}</td>
                  <td className="p-2 font-mono">
                    {toWesternDigits(formatDate(entryDate, 'yyyy/MM/dd'))}
                  </td>
                  <td className="p-2 font-bold">{entry.title || 'سلفة / حركة دين'}</td>
                  <td className="p-2 text-zinc-500 dark:text-zinc-400">{entry.note || '—'}</td>
                  <td className="p-2 text-end font-black font-mono">
                    <FormattedMoney amountFils={entry.amountFils} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 font-black border-t-2 border-zinc-300 dark:border-zinc-600">
              <td colSpan={4} className="p-2 text-start">
                مجموع أصل الدين والسلف
              </td>
              <td className="p-2 text-end font-mono">
                <FormattedMoney amountFils={totalEntriesFils} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Table 2: Payments History */}
      <div className="mb-6 print-avoid-break">
        <h3 className="text-xs font-black text-zinc-800 dark:text-zinc-200 mb-2 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          ثانياً: سجل الدفعات المسددة ({payments.length})
        </h3>
        {payments.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
            لا توجد دفعات مسددة مسجلة على هذا الحساب بعد.
          </div>
        ) : (
          <table className="w-full text-xs text-start border-collapse border border-zinc-200 dark:border-zinc-700">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800/80 font-bold border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-2 text-start w-10">#</th>
                <th className="p-2 text-start w-28">التاريخ</th>
                <th className="p-2 text-start">البيان</th>
                <th className="p-2 text-start">الملاحظات</th>
                <th className="p-2 text-end w-32">المبلغ المسدد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {payments.map((pmt, idx) => {
                const pmtDate = pmt.date instanceof Date ? pmt.date : new Date(pmt.date)
                return (
                  <tr key={pmt.id || idx}>
                    <td className="p-2 text-zinc-500">{toWesternDigits(String(idx + 1))}</td>
                    <td className="p-2 font-mono">
                      {toWesternDigits(formatDate(pmtDate, 'yyyy/MM/dd'))}
                    </td>
                    <td className="p-2 font-bold">دفعة سداد</td>
                    <td className="p-2 text-zinc-500 dark:text-zinc-400">{pmt.note || '—'}</td>
                    <td className="p-2 text-end font-black font-mono text-emerald-600 dark:text-emerald-400">
                      <FormattedMoney amountFils={pmt.amountFils} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 font-black border-t-2 border-zinc-300 dark:border-zinc-600">
                <td colSpan={4} className="p-2 text-start">
                  إجمالي المبالغ المسددة
                </td>
                <td className="p-2 text-end font-mono text-emerald-600 dark:text-emerald-400">
                  <FormattedMoney amountFils={totalPaymentsFils} />
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Statement Certification Footer */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <div>
          <span>كشف حساب مالي تفصيلي صادر إلكترونياً من تطبيق </span>
          <span className="font-bold text-zinc-800 dark:text-zinc-200">بَصير</span>
        </div>
        <div>صفحة 1 من 1</div>
      </div>
    </div>
  )
}
