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
            createdAt: debtStartDate,
          },
        ]

  const totalEntriesFils = displayEntries.reduce((sum, e) => sum + e.amountFils, 0)
  const totalPaymentsFils = payments.reduce((sum, p) => sum + p.amountFils, 0)

  return (
    <div className="hidden print:block w-full max-w-full text-zinc-900 bg-white p-2 text-start font-sans">
      {/* Formal Statement Header */}
      <div className="border-b-2 border-zinc-900 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-zinc-900">بَصير</span>
              <span className="text-sm font-bold text-zinc-600">
                — كشف حساب مالي تفصيلي
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-1">
              تقرير رسمي صادر عن نظام بَصير لإدارة الذمم والالتزامات المالية
            </p>
          </div>
          <div className="text-end">
            <span
              className={`inline-block px-3 py-1 rounded-md text-xs font-black border ${
                debt.settled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-blue-50 text-blue-800 border-blue-300'
              }`}
            >
              {statusLabel}
            </span>
            <div className="text-[11px] text-zinc-600 mt-1">
              تاريخ الطباعة: {printDateStr}
            </div>
          </div>
        </div>
      </div>

      {/* Account & Party Metadata Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-200">
        <div className="space-y-1.5">
          <div>
            <span className="font-semibold text-zinc-600">اسم الطرف: </span>
            <span className="font-black text-sm text-zinc-900">
              {debt.personName}
            </span>
          </div>
          <div>
            <span className="font-semibold text-zinc-600">نوع المعاملة: </span>
            <span className="font-bold text-zinc-900">{statementType}</span>
          </div>
          {debt.note && (
            <div>
              <span className="font-semibold text-zinc-600">البيان العام: </span>
              <span className="font-medium text-zinc-800">{debt.note}</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div>
            <span className="font-semibold text-zinc-600">تاريخ بدء الدين: </span>
            <span className="font-bold text-zinc-900">
              {toWesternDigits(formatDate(debtStartDate, 'yyyy/MM/dd'))}
            </span>
          </div>
          <div>
            <span className="font-semibold text-zinc-600">تاريخ الاستحقاق: </span>
            <span className="font-bold text-zinc-900">
              {debtDueDate ? toWesternDigits(formatDate(debtDueDate, 'yyyy/MM/dd')) : 'غير محدد'}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary KPI Block */}
      <div className="grid grid-cols-3 gap-3 mb-6 print-avoid-break">
        <div className="p-3.5 rounded-xl border border-zinc-200 bg-white text-start">
          <div className="text-[11px] font-bold text-zinc-600 mb-1">
            إجمالي المبلغ
          </div>
          <div className="text-base font-black text-zinc-900">
            <FormattedMoney amountFils={debt.amountFils} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 bg-white text-start">
          <div className="text-[11px] font-bold text-zinc-600 mb-1">
            إجمالي المسدد
          </div>
          <div className="text-base font-black text-emerald-600">
            <FormattedMoney amountFils={debt.paidFils || 0} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-zinc-200 bg-white text-start">
          <div className="text-[11px] font-bold text-zinc-600 mb-1">
            المتبقي الفعلي
          </div>
          <div
            className={`text-base font-black ${
              remainingFils > 0
                ? isLent
                  ? 'text-emerald-600'
                  : 'text-red-600'
                : 'text-zinc-500'
            }`}
          >
            <FormattedMoney amountFils={remainingFils} />
          </div>
        </div>
      </div>

      {/* Table 1: Debt Entries / Advances */}
      <div className="mb-6 print-avoid-break">
        <h3 className="text-xs font-black text-zinc-900 mb-2 border-b border-zinc-200 pb-1">
          أولاً: تفاصيل أصل الدين والسلف المسجلة ({displayEntries.length})
        </h3>
        <table className="w-full text-xs text-start border-collapse border border-zinc-200">
          <thead>
            <tr className="bg-zinc-100 font-bold border-b border-zinc-200">
              <th className="p-2 text-start w-10 text-zinc-700">#</th>
              <th className="p-2 text-start w-28 text-zinc-700">التاريخ</th>
              <th className="p-2 text-start text-zinc-700">البيان / العنوان</th>
              <th className="p-2 text-start text-zinc-700">الملاحظات</th>
              <th className="p-2 text-end w-32 text-zinc-700">المبلغ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {displayEntries.map((entry, idx) => {
              const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date)
              return (
                <tr key={entry.id || idx}>
                  <td className="p-2 text-zinc-500">{toWesternDigits(String(idx + 1))}</td>
                  <td className="p-2 tabular-nums text-zinc-800">
                    {toWesternDigits(formatDate(entryDate, 'yyyy/MM/dd'))}
                  </td>
                  <td className="p-2 font-bold text-zinc-900">{entry.title || 'سلفة / حركة دين'}</td>
                  <td className="p-2 text-zinc-600">{entry.note || '—'}</td>
                  <td className="p-2 text-end font-black tabular-nums text-zinc-900">
                    <FormattedMoney amountFils={entry.amountFils} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 font-black border-t-2 border-zinc-300">
              <td colSpan={4} className="p-2 text-start text-zinc-900">
                مجموع أصل الدين والسلف
              </td>
              <td className="p-2 text-end font-bold tabular-nums text-zinc-900">
                <FormattedMoney amountFils={totalEntriesFils} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Table 2: Payments History */}
      <div className="mb-6 print-avoid-break">
        <h3 className="text-xs font-black text-zinc-900 mb-2 border-b border-zinc-200 pb-1">
          ثانياً: سجل الدفعات المسددة ({payments.length})
        </h3>
        {payments.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-300 rounded-xl bg-white">
            لا توجد دفعات مسددة مسجلة على هذا الحساب بعد.
          </div>
        ) : (
          <table className="w-full text-xs text-start border-collapse border border-zinc-200">
            <thead>
              <tr className="bg-zinc-100 font-bold border-b border-zinc-200">
                <th className="p-2 text-start w-10 text-zinc-700">#</th>
                <th className="p-2 text-start w-28 text-zinc-700">التاريخ</th>
                <th className="p-2 text-start text-zinc-700">البيان</th>
                <th className="p-2 text-start text-zinc-700">الملاحظات</th>
                <th className="p-2 text-end w-32 text-zinc-700">المبلغ المسدد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {payments.map((pmt, idx) => {
                const pmtDate = pmt.date instanceof Date ? pmt.date : new Date(pmt.date)
                return (
                  <tr key={pmt.id || idx}>
                    <td className="p-2 text-zinc-500">{toWesternDigits(String(idx + 1))}</td>
                    <td className="p-2 tabular-nums text-zinc-800">
                      {toWesternDigits(formatDate(pmtDate, 'yyyy/MM/dd'))}
                    </td>
                    <td className="p-2 font-bold text-zinc-900">دفعة سداد</td>
                    <td className="p-2 text-zinc-600">{pmt.note || '—'}</td>
                    <td className="p-2 text-end font-black tabular-nums text-emerald-600">
                      <FormattedMoney amountFils={pmt.amountFils} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-50 font-black border-t-2 border-zinc-300">
                <td colSpan={4} className="p-2 text-start text-zinc-900">
                  إجمالي المبالغ المسددة
                </td>
                <td className="p-2 text-end font-bold tabular-nums text-emerald-600">
                  <FormattedMoney amountFils={totalPaymentsFils} />
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Statement Certification Footer */}
      <div className="pt-4 border-t border-zinc-200 flex items-center justify-between text-[10px] text-zinc-500">
        <div>
          <span>كشف حساب مالي تفصيلي صادر إلكترونياً من تطبيق </span>
          <span className="font-bold text-zinc-900">بَصير</span>
        </div>
        <div>صفحة 1 من 1</div>
      </div>
    </div>
  )
}
