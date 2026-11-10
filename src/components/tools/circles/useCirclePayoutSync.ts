import { useState, useEffect, useRef, useMemo } from 'react'
import { getCurrentCircleMonth, checkCirclePayoutExists } from '../../../services/moneyCircles'
import type { MoneyCircle, Transaction } from '../../../types'

export interface UseCirclePayoutSyncProps {
  user: { uid: string } | null
  circles: MoneyCircle[]
  transactions?: Transaction[]
  monthStartDay: number
}

export function useCirclePayoutSync({
  user,
  circles,
  transactions,
  monthStartDay,
}: UseCirclePayoutSyncProps) {
  const [extraDepositedIds, setExtraDepositedIds] = useState<Set<string>>(new Set())
  const [removedDepositedIds, setRemovedDepositedIds] = useState<Set<string>>(new Set())

  // Check which circles have already had their net payout deposited in transactions
  const depositedCircleIds = useMemo(() => {
    const set = new Set<string>()
    if (transactions) {
      for (const tx of transactions) {
        if (tx.id.startsWith('circle_payout_')) {
          const key = tx.id.replace('circle_payout_', '')
          set.add(key)
        }
      }
    }
    for (const id of extraDepositedIds) {
      set.add(id)
    }
    for (const id of removedDepositedIds) {
      set.delete(id)
    }
    return set
  }, [transactions, extraDepositedIds, removedDepositedIds])

  const addDepositedCircleId = (id: string) => {
    setExtraDepositedIds((prev) => new Set([...prev, id]))
    setRemovedDepositedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const removeDepositedCircleId = (id: string) => {
    setRemovedDepositedIds((prev) => new Set([...prev, id]))
    setExtraDepositedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const checkedCirclesRef = useRef<Set<string>>(new Set())

  // Synchronous fallback / verification for payouts
  useEffect(() => {
    let isCancelled = false
    const checkPayouts = async () => {
      if (!user || circles.length === 0) return

      const now = new Date()
      const eligibleToCheck = circles.filter((c) => {
        const currentMonth = getCurrentCircleMonth(c, now, monthStartDay)
        const checkTurn1 =
          currentMonth >= c.myTurnMonth &&
          !depositedCircleIds.has(c.id) &&
          !checkedCirclesRef.current.has(c.id)
        const checkTurn2 = Boolean(
          c.shareType === 'double' &&
            c.secondTurnMonth &&
            currentMonth >= c.secondTurnMonth &&
            !depositedCircleIds.has(`${c.id}_t2`) &&
            !checkedCirclesRef.current.has(`${c.id}_t2`)
        )
        return checkTurn1 || checkTurn2
      })

      if (eligibleToCheck.length === 0) return

      for (const c of eligibleToCheck) {
        if (!depositedCircleIds.has(c.id) && !checkedCirclesRef.current.has(c.id)) {
          checkedCirclesRef.current.add(c.id)
          const exists = await checkCirclePayoutExists(user.uid, c.id)
          if (exists && !isCancelled) {
            addDepositedCircleId(c.id)
          }
        }
        if (
          c.shareType === 'double' &&
          c.secondTurnMonth &&
          !depositedCircleIds.has(`${c.id}_t2`) &&
          !checkedCirclesRef.current.has(`${c.id}_t2`)
        ) {
          checkedCirclesRef.current.add(`${c.id}_t2`)
          const exists = await checkCirclePayoutExists(user.uid, `${c.id}_t2`)
          if (exists && !isCancelled) {
            addDepositedCircleId(`${c.id}_t2`)
          }
        }
      }
    }

    checkPayouts()

    return () => {
      isCancelled = true
    }
  }, [user, circles, monthStartDay, depositedCircleIds])

  return {
    depositedCircleIds,
    addDepositedCircleId,
    removeDepositedCircleId,
    checkedCirclesRef,
  }
}
