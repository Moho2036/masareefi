/**
 * Baseer Haptic Bank (بنك الاهتزازات التفاعلية المعتمد).
 * Provides distinct, guaranteed tactile feedback using a dual-engine architecture:
 * 1. Navigator Vibration API with realistic hardware durations for Android devices (60ms - 100ms)
 *    to overcome physical motor spin-up inertia.
 * 2. Web Audio API micro-acoustic tactile impulse (sub-bass physical speaker diaphragm thump)
 *    for iOS Safari and as an instant zero-latency layer across all mobile devices.
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

// Cached Web Audio context for tactile synthesis
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

// Auto-prime AudioContext and Vibration API on the first user interaction
if (typeof window !== 'undefined') {
  const primeHaptics = () => {
    try {
      const ctx = getAudioContext()
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0)
      }
    } catch {
      // ignore
    }
  }
  window.addEventListener('pointerdown', primeHaptics, { once: true, passive: true })
  window.addEventListener('touchstart', primeHaptics, { once: true, passive: true })
  window.addEventListener('click', primeHaptics, { once: true, passive: true })
}

/**
 * Synthesizes a crisp, sub-bass acoustic tactile impulse that physically
 * vibrates the speaker diaphragm, producing an instantaneous mechanical click feel.
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
          navigator.vibrate(60)
        }
        playTactileImpulse(130, 0.016, 0.16)
        break
      case 'impact':
      case 'medium':
        if (hasVibrate) {
          navigator.vibrate(85)
        }
        playTactileImpulse(100, 0.024, 0.22)
        break
      case 'success':
        if (hasVibrate) {
          navigator.vibrate([65, 60, 85])
        }
        playTactileImpulse(150, 0.02, 0.2)
        setTimeout(() => playTactileImpulse(190, 0.025, 0.22), 80)
        break
      case 'warning':
        if (hasVibrate) {
          navigator.vibrate([80, 50, 80])
        }
        playTactileImpulse(90, 0.035, 0.24)
        break
      case 'destructive':
        if (hasVibrate) {
          navigator.vibrate([90, 50, 90, 50, 110])
        }
        playTactileImpulse(70, 0.04, 0.28)
        setTimeout(() => playTactileImpulse(60, 0.04, 0.28), 70)
        break
    }
  } catch {
    // Gracefully ignore environments that restrict vibration or audio permissions
  }
}
