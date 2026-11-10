import type { CircleMember, CircleShareType, MoneyCircle } from '../../../types'

export interface BuildCircleMembersParams {
  membersCount: number
  myTurnMonth: number
  shareType: CircleShareType
  secondTurnMonthStr: string
  isManager: boolean
  customMembers: string[]
  editingCircle: MoneyCircle | null
}

export function buildCircleMembers({
  membersCount,
  myTurnMonth,
  shareType,
  secondTurnMonthStr,
  isManager,
  customMembers,
  editingCircle,
}: BuildCircleMembersParams): CircleMember[] {
  const members: CircleMember[] = []
  const secondTurnNum = shareType === 'double' ? parseInt(secondTurnMonthStr, 10) : undefined

  if (editingCircle) {
    const oldTurnMonth = editingCircle.myTurnMonth
    const newTurnMonth = myTurnMonth
    const isTurnChanged = oldTurnMonth !== newTurnMonth
    const oldUserMember = editingCircle.members?.find(
      (m) => m.turnMonth === oldTurnMonth || m.name === 'أنت'
    )

    for (let i = 1; i <= membersCount; i++) {
      const isSecond = shareType === 'double' && i === secondTurnNum
      const defaultName = i === newTurnMonth ? 'أنت' : isSecond ? 'أنت (سهم 2)' : `عضو ${i}`

      let existingMember: CircleMember | undefined

      if (i === newTurnMonth) {
        existingMember = oldUserMember
      } else if (i === oldTurnMonth) {
        existingMember = editingCircle.members?.find(
          (m) => m.turnMonth === newTurnMonth && m.id !== oldUserMember?.id
        )
        if (!existingMember) {
          const enteredName = isManager ? (customMembers[i - 1] || '').trim() : ''
          const searchName = enteredName || defaultName
          existingMember = editingCircle.members?.find(
            (m) => m.name === searchName && m.id !== oldUserMember?.id
          )
        }
      } else {
        existingMember = editingCircle.members?.find(
          (m) => m.turnMonth === i && m.id !== oldUserMember?.id
        )
        if (!existingMember) {
          const enteredName = isManager ? (customMembers[i - 1] || '').trim() : ''
          const searchName = enteredName || defaultName
          existingMember = editingCircle.members?.find(
            (m) => m.name === searchName && m.id !== oldUserMember?.id
          )
        }
      }

      let memberName: string
      if (isManager) {
        const enteredName = (customMembers[i - 1] || '').trim()
        memberName = enteredName || defaultName
      } else {
        memberName =
          i === newTurnMonth
            ? 'أنت'
            : isSecond
              ? (existingMember?.name && existingMember.name !== 'أنت' && !existingMember.name.startsWith('عضو ')
                  ? existingMember.name
                  : 'أنت (سهم 2)')
              : existingMember?.name && existingMember.name !== 'أنت'
                ? existingMember.name
                : defaultName
      }

      const rawPaid = existingMember?.paidMonths || []
      const isUserMember = i === newTurnMonth || existingMember?.id === oldUserMember?.id
      const cleanedPaid = rawPaid.filter((mNum) => {
        if (mNum > membersCount) return false
        if (mNum === i) return false
        if (isTurnChanged && isUserMember && mNum === oldTurnMonth) {
          return false
        }
        return true
      })

      const rawPaymentsByMonth = existingMember?.paymentsByMonth
      let cleanedPaymentsByMonth: Record<string, boolean> | undefined = undefined
      if (rawPaymentsByMonth) {
        cleanedPaymentsByMonth = {}
        for (const [key, val] of Object.entries(rawPaymentsByMonth)) {
          const monthKeyNum = Number(key)
          if (
            !isNaN(monthKeyNum) &&
            monthKeyNum >= 1 &&
            monthKeyNum <= membersCount &&
            monthKeyNum !== i &&
            (!isTurnChanged || !isUserMember || monthKeyNum !== oldTurnMonth) &&
            Boolean(val)
          ) {
            cleanedPaymentsByMonth[key] = true
          }
        }
      }

      members.push({
        id: existingMember?.id || `mem_${i}`,
        name: memberName,
        turnMonth: i,
        paidMonths: cleanedPaid,
        ...(cleanedPaymentsByMonth ? { paymentsByMonth: cleanedPaymentsByMonth } : {}),
      })
    }
  } else {
    for (let i = 1; i <= membersCount; i++) {
      const isSecond = shareType === 'double' && i === secondTurnNum
      const defaultName = i === myTurnMonth ? 'أنت' : isSecond ? 'أنت (سهم 2)' : `عضو ${i}`
      const enteredName = isManager ? (customMembers[i - 1] || '').trim() : ''
      members.push({
        id: `mem_${i}`,
        name: enteredName || defaultName,
        turnMonth: i,
        paidMonths: [],
      })
    }
  }

  return members
}
