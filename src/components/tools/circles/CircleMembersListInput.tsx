import React from 'react'
import { Input } from '../../ui/Input'

export interface CircleMembersListInputProps {
  membersCount: number
  myTurnMonth: number
  shareType: 'full' | 'half' | 'double'
  secondTurnMonthStr: string
  customMembers: string[]
  setCustomMembers: React.Dispatch<React.SetStateAction<string[]>>
}

export const CircleMembersListInput: React.FC<CircleMembersListInputProps> = ({
  membersCount,
  myTurnMonth,
  shareType,
  secondTurnMonthStr,
  customMembers,
  setCustomMembers,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
        ترتيب وأسماء الأعضاء:
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
        {Array.from({ length: membersCount }, (_, i) => {
          const turn = i + 1
          const isUser = turn === myTurnMonth
          const isSecondTurn =
            shareType === 'double' && turn === parseInt(secondTurnMonthStr, 10)
          const defaultVal = isUser ? 'أنت' : isSecondTurn ? 'أنت (سهم 2)' : `عضو ${turn}`
          return (
            <div key={turn} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-black flex items-center justify-center shrink-0">
                {turn}
              </span>
              <Input
                type="text"
                className="py-1.5 text-xs flex-1"
                value={customMembers[i] ?? defaultVal}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomMembers((prev) => {
                    const next = [...prev]
                    next[i] = val
                    return next
                  })
                }}
                placeholder={`اسم العضو رقم ${turn}`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
