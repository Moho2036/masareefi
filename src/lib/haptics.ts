/**
 * Haptic feedback utility using the Navigator Vibration API.
 * Safely handles unsupported devices/browsers and SSR environments.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'warning' = 'light'): void {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return
  }

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10)
        break
      case 'medium':
        navigator.vibrate(20)
        break
      case 'warning':
        navigator.vibrate([15, 30, 15])
        break
    }
  } catch {
    // Gracefully ignore environments that restrict vibration permissions
  }
}
