import React, { useState } from 'react'
import { GitMerge, X } from 'lucide-react'
import { Button } from '../ui/Button'
import type { Debt, DebtType } from '../../types'

export interface MergeCandidate {
  key: string
  personName: string
  type: DebtType
  debts: Debt[]
}

interface DebtsMergeBannerProps {
  candidates: MergeCandidate[]
  onSelectCandidate: (candidate: { debts: Debt[]; personName: string }) => void
}

export const DebtsMergeBanner: React.FC<DebtsMergeBannerProps> = ({
  candidates,
  onSelectCandidate,
}) => {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed || candidates.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] text-xs shadow-2xs">
      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 min-w-0">
        <GitMerge className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-semibold truncate">توجد سجلات متعددة لنفس الشخص يمكن دمجها:</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {candidates.map((c) => (
          <Button
            key={c.key}
            variant="outline"
            size="sm"
            onClick={() => onSelectCandidate({ debts: c.debts, personName: c.personName })}
            className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer max-w-full"
          >
            <GitMerge className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="flex items-center gap-1">
              <span>{c.type === 'lent' ? 'دمج ديون' : 'دمج التزامات'}</span>
              <strong className="font-bold max-w-[110px] sm:max-w-[150px] truncate inline-block align-bottom">{c.personName}</strong>
            </span>
          </Button>
        ))}
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 ms-auto sm:ms-1"
          title="إخفاء التنبيه"
          aria-label="إخفاء تنبيه دمج الديون"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
