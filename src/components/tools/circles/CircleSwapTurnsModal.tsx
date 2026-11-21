import React from 'react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Select } from '../../ui/Select'
import type { MoneyCircle, CircleMember } from '../../../types'

export interface CircleSwapTurnsModalProps {
  swapTarget: { circle: MoneyCircle; member: CircleMember } | null
  swapWithMemberId: string
  onSwapWithMemberIdChange: (val: string) => void
  onClose: () => void
  onConfirm: () => void
  isSwapping: boolean
}

export const CircleSwapTurnsModal: React.FC<CircleSwapTurnsModalProps> = ({
  swapTarget,
  swapWithMemberId,
  onSwapWithMemberIdChange,
  onClose,
  onConfirm,
  isSwapping,
}) => {
  return (
    <Modal
      isOpen={Boolean(swapTarget)}
      onClose={onClose}
      title="تبديل الدور بين الأعضاء"
      hideCloseButton={true}
    >
      <div className="space-y-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          اختر العضو الذي ترغب في تبديل دور الاستلام معه لـ &quot;{swapTarget?.member.name}&quot; (الدور الحالي: شهر {swapTarget?.member.turnMonth}):
        </p>

        <Select
          id="swap-target-member-select"
          label="تبديل مع العضو:"
          value={swapWithMemberId}
          onChange={(e) => onSwapWithMemberIdChange(e.target.value)}
          options={(swapTarget?.circle.members || [])
            .filter((m) => m.id !== swapTarget?.member.id)
            .map((m) => ({
              value: m.id,
              label: `${m.name} (شهر ${m.turnMonth})`,
            }))}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSwapping}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isSwapping || !swapWithMemberId}
          >
            {isSwapping ? 'جارٍ التبديل...' : 'تأكيد تبديل الدور'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
