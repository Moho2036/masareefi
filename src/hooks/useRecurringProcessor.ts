import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { processDueRecurring } from '../services/recurring'
import { formatDateInput } from '../lib/dates'

export function useRecurringProcessor(): void {
  const { user } = useAuth()
  const { showToast } = useToast()
  const lastProcessedKey = useRef<string | null>(null)
  const isProcessing = useRef(false)
  const userId = user?.uid

  useEffect(() => {
    if (!userId) {
      lastProcessedKey.current = null
      return
    }

    const runProcessor = async () => {
      if (isProcessing.current) return

      const todayKey = `${userId}_${formatDateInput(new Date())}`
      if (lastProcessedKey.current === todayKey) {
        return
      }

      isProcessing.current = true
      try {
        const count = await processDueRecurring(userId)
        lastProcessedKey.current = todayKey
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
      } catch (err) {
        console.error('Failed to process due recurring transactions:', err)
      } finally {
        isProcessing.current = false
      }
    }

    // Run on initial mount / user change
    void runProcessor()

    // Run when the app becomes visible or focused on a new day
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runProcessor()
      }
    }
    const handleFocus = () => {
      void runProcessor()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [userId, showToast])
}
