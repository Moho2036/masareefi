/**
 * Baseer Haptic Bank (بنك الاهتزازات التفاعلية المعتمد).
 * Provides distinct haptic feedback using:
 * 1. Navigator Vibration API with realistic hardware durations for Android devices.
 * 2. Web Audio API micro-acoustic tactile impulse for iOS Safari / WebKit devices.
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

// Cached Web Audio context for iOS tactile synthesis
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass()
      } catch {
        // AudioContext might be restricted until user gesture
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // ignore
    })
  }
  return audioCtx
}

/**
 * Synthesizes a crisp low-frequency acoustic impulse that produces
 * a physical tactile sensation on iOS devices lacking navigator.vibrate.
 */
function playTactileImpulse(frequency: number, duration: number, gainValue = 0.2): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + duration)

    gain.gain.setValueAtTime(gainValue, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Gracefully ignore audio synthesis errors
  }
}

export function triggerHaptic(type: HapticFeedbackType = 'tick'): void {
  if (typeof window === 'undefined') return

  const hasVibrate =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

  try {
    switch (type) {
      case 'tick':
      case 'light':
        if (hasVibrate) {
          navigator.vibrate(35)
        } else {
          playTactileImpulse(140, 0.015, 0.15)
        }
        break
      case 'impact':
      case 'medium':
        if (hasVibrate) {
          navigator.vibrate(55)
        } else {
          playTactileImpulse(100, 0.025, 0.22)
        }
        break
      case 'success':
        if (hasVibrate) {
          navigator.vibrate([45, 60, 45])
        } else {
          playTactileImpulse(160, 0.02, 0.2)
          setTimeout(() => playTactileImpulse(200, 0.025, 0.22), 80)
        }
        break
      case 'warning':
        if (hasVibrate) {
          navigator.vibrate([60, 45, 60])
        } else {
          playTactileImpulse(90, 0.035, 0.25)
        }
        break
      case 'destructive':
        if (hasVibrate) {
          navigator.vibrate([75, 45, 90])
        } else {
          playTactileImpulse(70, 0.04, 0.3)
          setTimeout(() => playTactileImpulse(60, 0.04, 0.3), 70)
        }
        break
    }
  } catch {
    // Gracefully ignore environments that restrict vibration or audio permissions
  }
}
