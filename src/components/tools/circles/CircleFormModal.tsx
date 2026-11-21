import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { DatePickerInput } from '../../ui/DatePickerInput'
import { Select } from '../../ui/Select'
import { Toggle } from '../../ui/Toggle'
import { FormattedMoney } from '../../ui/FormattedMoney'
import { CircleCategorySelectors } from './CircleCategorySelectors'
import { CircleMembersListInput } from './CircleMembersListInput'
import { toWesternDigits } from '../../../lib/dates'
import { toFils } from '../../../lib/money'
import { cn } from '../../../lib/cn'
import type { MoneyCircle, Category, CircleShareType } from '../../../types'

export interface CircleFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingCircle: MoneyCircle | null
  formError: string | null
  name: string
  setName: (val: string) => void
  monthlyAmountStr: string
  setMonthlyAmountStr: (val: string) => void
  membersCountStr: string
  setMembersCountStr: (val: string) => void
  myTurnMonthStr: string
  setMyTurnMonthStr: (val: string) => void
  startDateStr: string
  setStartDateStr: (val: string) => void
  shareType: CircleShareType
  setShareType: (val: CircleShareType) => void
  secondTurnMonthStr: string
  setSecondTurnMonthStr: (val: string) => void
  expenseCategoryId: string
  setExpenseCategoryId: (val: string) => void
  incomeCategoryId: string
  setIncomeCategoryId: (val: string) => void
  autoSchedule: boolean
  setAutoSchedule: (val: boolean) => void
  setAutoScheduleTouched: (val: boolean) => void
  isManager: boolean
  setIsManager: (val: boolean) => void
  customMembers: string[]
  setCustomMembers: React.Dispatch<React.SetStateAction<string[]>>
  handleMembersCountChange: (count: number) => void
  handleMyTurnMonthChange: (newTurn: number) => void
  showAmountOrMembersChangeWarning: boolean
  categories: Category[]
  defaultExpenseCategory?: Category
  defaultIncomeCategory?: Category
  config: { symbol: string; decimals: number }
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

function parseNumeric(val: string): number {
  if (!val) return 0
  const normalized = val.replace(/,/g, '')
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? 0 : parsed
}

export const CircleFormModal: React.FC<CircleFormModalProps> = ({
  isOpen,
  onClose,
  editingCircle,
  formError,
  name,
  setName,
  monthlyAmountStr,
  setMonthlyAmountStr,
  membersCountStr,
  setMembersCountStr,
  myTurnMonthStr,
  setMyTurnMonthStr,
  startDateStr,
  setStartDateStr,
  shareType,
  setShareType,
  secondTurnMonthStr,
  setSecondTurnMonthStr,
  expenseCategoryId,
  setExpenseCategoryId,
  incomeCategoryId,
  setIncomeCategoryId,
  autoSchedule,
  setAutoSchedule,
  setAutoScheduleTouched,
  isManager,
  setIsManager,
  customMembers,
  setCustomMembers,
  handleMembersCountChange,
  handleMyTurnMonthChange,
  showAmountOrMembersChangeWarning,
  categories,
  defaultExpenseCategory,
  defaultIncomeCategory,
  config,
  submitting,
  onSubmit,
}) => {
  const membersCount = isNaN(parseInt(membersCountStr, 10)) ? 2 : Math.max(2, Math.min(50, parseInt(membersCountStr, 10)))
  const myTurnMonth = isNaN(parseInt(myTurnMonthStr, 10)) ? 1 : Math.max(1, Math.min(membersCount, parseInt(myTurnMonthStr, 10)))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCircle ? 'تعديل الجمعية المالية' : 'إنشاء جمعية مالية جديدة'}
      closeOnBackdropClick={Boolean(!editingCircle && !name.trim())}
      hideCloseButton={true}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Input
          label="اسم الجمعية"
          placeholder="مثال: جمعية الأهل، جمعية الزملاء"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`القسط الشهري (${config.symbol})`}
            type="text"
            inputMode="decimal"
            value={monthlyAmountStr}
            onChange={(e) => setMonthlyAmountStr(toWesternDigits(e.target.value))}
            required
          />

          <Input
            label="عدد الأعضاء (الأشهر)"
            type="text"
            inputMode="numeric"
            value={membersCountStr}
            onChange={(e) => {
              const val = toWesternDigits(e.target.value)
              setMembersCountStr(val)
              const num = parseInt(val, 10)
              if (!isNaN(num) && num >= 2 && num <= 50) {
                handleMembersCountChange(num)
              }
            }}
            onBlur={() => {
              const parsed = parseInt(membersCountStr, 10)
              const safeCount = isNaN(parsed) ? 2 : Math.max(2, Math.min(50, parsed))
              setMembersCountStr(String(safeCount))
              handleMembersCountChange(safeCount)
            }}
            required
          />
        </div>

        {/* Warning when modifying monthly amount or members count of a circle with previously recorded payments */}
        {showAmountOrMembersChangeWarning && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">تنبيه بشأن تعديل تفاصيل الجمعية:</div>
              <p className="leading-relaxed text-[11px] text-amber-700 dark:text-amber-300">
                تحتوي هذه الجمعية على أقساط أو دفعات مسجلة مسبقاً. تعديل القسط الشهري أو عدد الأعضاء سيقوم بتحديث حسابات الجمعية، وتحديث القسط في المعاملات المتكررة ومعاملة استلام الصافي المرتبطة بها تلقائياً.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="دورك في الاستلام (رقم الشهر)"
            type="text"
            inputMode="numeric"
            value={myTurnMonthStr}
            onChange={(e) => {
              const val = toWesternDigits(e.target.value)
              setMyTurnMonthStr(val)
              const num = parseInt(val, 10)
              if (!isNaN(num) && num >= 1 && num <= membersCount) {
                handleMyTurnMonthChange(num)
              }
            }}
            onBlur={() => {
              const parsed = parseInt(myTurnMonthStr, 10)
              const safeTurn = isNaN(parsed) ? 1 : Math.max(1, Math.min(membersCount, parsed))
              setMyTurnMonthStr(String(safeTurn))
              handleMyTurnMonthChange(safeTurn)
            }}
            required
          />

          <DatePickerInput
            label="تاريخ البدء"
            value={startDateStr}
            onChange={(val) => setStartDateStr(val)}
            required
          />
        </div>

        {/* Share Size Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
            حجم السهم في الجمعية
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setShareType('full')}
              className={cn(
                'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center',
                shareType === 'full'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
              )}
            >
              سهم كامل (100%)
            </button>
            <button
              type="button"
              onClick={() => setShareType('half')}
              className={cn(
                'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center',
                shareType === 'half'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
              )}
            >
              نصف سهم (50%)
            </button>
            <button
              type="button"
              onClick={() => {
                setShareType('double')
                setCustomMembers((prev) => {
                  const next = [...prev]
                  const sec = parseInt(secondTurnMonthStr, 10)
                  if (!isNaN(sec) && sec >= 1 && sec <= membersCount) {
                    const idx = sec - 1
                    if (!next[idx] || next[idx].startsWith('عضو ')) {
                      next[idx] = 'أنت (سهم 2)'
                    }
                  }
                  return next
                })
              }}
              className={cn(
                'p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center',
                shareType === 'double'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-[#121215] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400'
              )}
            >
              سهمان (دورين)
            </button>
          </div>
        </div>

        {/* Second Turn Month Selector for Double Share */}
        {shareType === 'double' && (
          <Select
            id="circle-second-turn"
            label="الدور الثاني للاستلام (للسهم الثاني)"
            value={secondTurnMonthStr}
            onChange={(e) => {
              const oldSec = parseInt(secondTurnMonthStr, 10)
              const newSecVal = e.target.value
              const newSec = parseInt(newSecVal, 10)
              setSecondTurnMonthStr(newSecVal)
              setCustomMembers((prev) => {
                const next = [...prev]
                if (!isNaN(oldSec) && oldSec >= 1 && oldSec <= membersCount) {
                  const oldIdx = oldSec - 1
                  if (next[oldIdx] === 'أنت (سهم 2)') {
                    next[oldIdx] = `عضو ${oldSec}`
                  }
                }
                if (!isNaN(newSec) && newSec >= 1 && newSec <= membersCount) {
                  const newIdx = newSec - 1
                  if (!next[newIdx] || next[newIdx].startsWith('عضو ')) {
                    next[newIdx] = 'أنت (سهم 2)'
                  }
                }
                return next
              })
            }}
            options={Array.from({ length: membersCount }, (_, i) => i + 1)
              .filter((m) => m !== myTurnMonth)
              .map((m) => ({
                value: m,
                label: `الشهر ${m}`,
              }))}
          />
        )}

        {/* Category Selectors for Expenses & Income */}
        <CircleCategorySelectors
          categories={categories}
          expenseCategoryId={expenseCategoryId}
          setExpenseCategoryId={setExpenseCategoryId}
          defaultExpenseCategory={defaultExpenseCategory}
          editingCircle={editingCircle}
          incomeCategoryId={incomeCategoryId}
          setIncomeCategoryId={setIncomeCategoryId}
          defaultIncomeCategory={defaultIncomeCategory}
        />

        {(() => {
          const parsedMonthly = parseNumeric(monthlyAmountStr)
          const grossPayoutFils = toFils(
            parsedMonthly * membersCount * (shareType === 'half' ? 0.5 : 1),
            config.decimals
          )
          const doubleShareMonthlyFils = toFils(parsedMonthly, config.decimals)
          const netDoublePayoutFils = grossPayoutFils - doubleShareMonthlyFils * 2
          return (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A] text-xs flex flex-col gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
              <div className="flex items-center justify-between">
                <span>الحصة عند الاستلام:</span>
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                  <FormattedMoney amountFils={grossPayoutFils} />
                  {shareType === 'double' ? ' (لكل دور استلام)' : ''}
                </span>
              </div>
              {shareType === 'double' && (
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-[#E4E4E7]/60 dark:border-[#27272A]/60 pt-1.5">
                  <span>الصافي المودع بعد استقطاع قسط الشهرين:</span>
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">
                    <FormattedMoney amountFils={netDoublePayoutFils} />
                  </span>
                </div>
              )}
            </div>
          )
        })()}

        {/* Auto Schedule Toggle */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A]">
          <Toggle
            checked={autoSchedule}
            onChange={(val) => {
              setAutoSchedule(val)
              setAutoScheduleTouched(true)
            }}
            label="جدولة القسط في المعاملات المتكررة"
            description="خصم شهري تلقائي مع تخطي شهر استلامك"
          />
        </div>

        {/* Manager Mode Toggle */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-[#E4E4E7] dark:border-[#27272A]">
          <Toggle
            checked={isManager}
            onChange={(val) => {
              setIsManager(val)
              if (val) {
                setCustomMembers((prev) => {
                  const next = [...prev]
                  const secondTurnNum = parseInt(secondTurnMonthStr, 10)
                  while (next.length < membersCount) {
                    const idx = next.length + 1
                    const defaultForSecondTurn =
                      shareType === 'double' && idx === secondTurnNum ? 'أنت (سهم 2)' : `عضو ${idx}`
                    next.push(idx === myTurnMonth ? 'أنت' : defaultForSecondTurn)
                  }
                  const turnIdx = myTurnMonth - 1
                  if (turnIdx >= 0 && turnIdx < next.length) {
                    if (!next[turnIdx] || next[turnIdx].startsWith('عضو ')) {
                      next[turnIdx] = 'أنت'
                    }
                  }
                  if (shareType === 'double' && !isNaN(secondTurnNum)) {
                    const secondIdx = secondTurnNum - 1
                    if (secondIdx >= 0 && secondIdx < next.length) {
                      if (!next[secondIdx] || next[secondIdx].startsWith('عضو ')) {
                        next[secondIdx] = 'أنت (سهم 2)'
                      }
                    }
                  }
                  for (let idx = 0; idx < next.length; idx++) {
                    if (idx !== turnIdx && next[idx] === 'أنت') {
                      next[idx] = `عضو ${idx + 1}`
                    }
                  }
                  return next
                })
              }
            }}
            label="أنا مدير الجمعية (تتبع أسماء ودفعات جميع الأعضاء)"
            description="تسجيل أسماء المشتركين ومتابعة سدادهم شهرياً"
          />
        </div>

        {/* Members names list - only visible in manager mode */}
        {isManager && (
          <CircleMembersListInput
            membersCount={membersCount}
            myTurnMonth={myTurnMonth}
            shareType={shareType}
            secondTurnMonthStr={secondTurnMonthStr}
            customMembers={customMembers}
            setCustomMembers={setCustomMembers}
          />
        )}

        {formError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting
              ? editingCircle
                ? 'جارٍ الحفظ...'
                : 'جارٍ الإنشاء...'
              : editingCircle
                ? 'حفظ التعديلات'
                : 'إنشاء الجمعية'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
