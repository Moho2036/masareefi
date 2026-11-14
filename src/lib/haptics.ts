/**
 * Baseer Haptic Bank (بنك الاهتزازات التفاعلية المعتمد).
 * Provides distinct haptic feedback using the Navigator Vibration API.
 * Safely handles unsupported devices/browsers and SSR environments.
 */

export type HapticFeedbackType =
  | 'tick'
  | 'impact'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'light'
  | 'medium'

export function triggerHaptic(type: HapticFeedbackType = 'tick'): void {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return
  }

  try {
    switch (type) {
      case 'tick':
      case 'light':
        navigator.vibrate(10)
        break
      case 'impact':
      case 'medium':
        navigator.vibrate(20)
        break
      case 'success':
        navigator.vibrate([15, 40, 25])
        break
      case 'warning':
        navigator.vibrate(35)
        break
      case 'destructive':
        navigator.vibrate([25, 35, 25])
        break
    }
  } catch {
    // Gracefully ignore environments that restrict vibration permissions
  }
}
