import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { processDueRecurring } from '../services/recurring'

export function useRecurringProcessor(): void {
  const { user } = useAuth()
  const { showToast } = useToast()
  const processedForUid = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      processedForUid.current = null
      return
    }

    if (processedForUid.current === user.uid) {
      return
    }

    processedForUid.current = user.uid

    processDueRecurring(user.uid)
      .then((count) => {
        if (count > 0) {
          const countLabel =
            count === 1
              ? 'معاملة متكررة واحدة'
              : count === 2
                ? 'معاملتان متكررتان'
                : count >= 3 && count <= 10
                  ? `${count} معاملات متكررة`
                  : `${count} معاملة متكررة`
          showToast(`تم تسجيل ${countLabel} تلقائياً`, 'info')
        }
      })
      .catch((err) => {
        console.error('Failed to process due recurring transactions:', err)
      })
  }, [user, showToast])
}
