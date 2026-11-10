import { useState, useEffect } from 'react'

export function useWindowFocusAndPrint() {
  const [focusTick, setFocusTick] = useState(0)
  const [isPrinting, setIsPrinting] = useState(false)

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') setFocusTick((t) => t + 1)
    }
    const handleBeforePrint = () => setIsPrinting(true)
    const handleAfterPrint = () => setIsPrinting(false)

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)
    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  return { focusTick, isPrinting }
}
