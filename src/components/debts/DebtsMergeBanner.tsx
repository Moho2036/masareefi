import React from 'react'
import { GitMerge } from 'lucide-react'
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
  if (candidates.length === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] text-xs">
      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
        <GitMerge className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-semibold">توجد ديون متعددة لنفس الشخص يمكن دمجها:</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {candidates.map((c) => (
          <Button
            key={c.key}
            variant="outline"
            size="sm"
            onClick={() => onSelectCandidate({ debts: c.debts, personName: c.personName })}
            className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>
              {c.type === 'lent'
                ? `دمج ديون ${c.personName} في سجل موحد`
                : `دمج التزامات ${c.personName} في سجل موحد`}
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
