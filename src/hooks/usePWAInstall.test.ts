import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  usePWAInstall,
  checkIsStandalone,
  checkIsIOS,
  type BeforeInstallPromptEvent,
} from './usePWAInstall'

describe('usePWAInstall hook and utilities', () => {
  const originalUserAgent = navigator.userAgent
  const originalPlatform = navigator.platform
  const originalMaxTouchPoints = navigator.maxTouchPoints

  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    })
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    })
  })

  it('detects standalone mode from media query or navigator.standalone', () => {
    expect(checkIsStandalone()).toBe(false)

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('display-mode: standalone'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    expect(checkIsStandalone()).toBe(true)
  })

  it('detects iOS devices properly', () => {
    // iPhone userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    expect(checkIsIOS()).toBe(true)

    // iPadOS with MacIntel + touch
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    })
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
    })
    expect(checkIsIOS()).toBe(true)

    // Android/Windows device
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      configurable: true,
    })
    Object.defineProperty(navigator, 'platform', {
      value: 'Linux armv8l',
      configurable: true,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    })
    expect(checkIsIOS()).toBe(false)
  })

  it('returns isIOS true when on iOS browser and not yet installed', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      configurable: true,
    })

    const { result } = renderHook(() => usePWAInstall())
    expect(result.current.isIOS).toBe(true)
    expect(result.current.isInstalled).toBe(false)
  })

  it('handles beforeinstallprompt event and promptInstall', async () => {
    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.isInstallable).toBe(false)

    const mockPrompt = vi.fn().mockResolvedValue(undefined)
    const promptEvent = new Event('beforeinstallprompt') as BeforeInstallPromptEvent
    promptEvent.prompt = mockPrompt
    promptEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' })

    act(() => {
      window.dispatchEvent(promptEvent)
    })

    expect(result.current.isInstallable).toBe(true)

    let success = false
    await act(async () => {
      success = await result.current.promptInstall()
    })

    expect(mockPrompt).toHaveBeenCalledTimes(1)
    expect(success).toBe(true)
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.isInstallable).toBe(false)
  })
})
