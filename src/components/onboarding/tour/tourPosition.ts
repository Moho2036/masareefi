export interface Rect {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

export interface ComputedPosition {
  top: number
  left: number
  width: number
  maxHeight: number
  arrowPlacement: 'top' | 'bottom' | null
  arrowLeft: number
  isMobileLayout: boolean
}

const DESKTOP_SIDEBAR_WIDTH = 280
const MOBILE_BOTTOM_NAV_HEIGHT = 88

export function computeCardPosition(
  targetRect: Rect | null,
  vw: number,
  vh: number
): ComputedPosition {
  // Synchronized with AppShell breakpoint (hidden lg:flex for sidebar at 1024px)
  const isMobileLayout = vw < 1024
  const isPhone = vw < 640
  const cardWidth = isPhone ? Math.min(vw - 24, 420) : 440

  const defaultMaxHeight = isPhone
    ? Math.min(360, Math.floor(vh * 0.46))
    : isMobileLayout
      ? Math.min(420, Math.floor(vh * 0.50))
      : Math.min(500, vh - 40)

  // 1. Fallback: No target element in DOM -> centered
  if (!targetRect) {
    const left = Math.max(12, Math.round((vw - cardWidth) / 2))
    const top = Math.max(16, Math.round((vh - defaultMaxHeight) / 2))
    return {
      top,
      left,
      width: cardWidth,
      maxHeight: defaultMaxHeight,
      arrowPlacement: null,
      arrowLeft: 16,
      isMobileLayout,
    }
  }

  // 2. Mobile & Tablet layout (< 1024px)
  if (isMobileLayout) {
    const targetMidY = targetRect.top + targetRect.height / 2
    const targetInUpperHalf = targetMidY < vh * 0.50
    const left = Math.max(12, Math.round((vw - cardWidth) / 2))

    // If target in upper half, dock to bottom with BottomNav clearance
    // If target in lower half, dock to top (12px)
    const top = targetInUpperHalf
      ? Math.max(12, vh - defaultMaxHeight - MOBILE_BOTTOM_NAV_HEIGHT)
      : 12

    return {
      top,
      left,
      width: cardWidth,
      maxHeight: defaultMaxHeight,
      arrowPlacement: null,
      arrowLeft: 16,
      isMobileLayout,
    }
  }

  // 3. Desktop layout (>= 1024px) with RTL sidebar clearance
  // In RTL, the desktop sidebar occupies 280px on the right (start side)
  const maxDesktopLeft = vw - DESKTOP_SIDEBAR_WIDTH - cardWidth - 20
  const idealLeft = targetRect.left + targetRect.width / 2 - cardWidth / 2
  const left = Math.max(16, Math.min(idealLeft, maxDesktopLeft))

  const arrowLeft = Math.max(
    20,
    Math.min(cardWidth - 28, targetRect.left + targetRect.width / 2 - left - 6)
  )

  const spaceBelow = vh - targetRect.bottom - 24
  const spaceAbove = targetRect.top - 24

  let top: number
  let maxHeight: number
  let arrowPlacement: 'top' | 'bottom' | null

  if (spaceBelow >= 300) {
    // Fits comfortably below target
    top = targetRect.bottom + 12
    maxHeight = Math.min(500, spaceBelow)
    arrowPlacement = 'top'
  } else if (spaceAbove >= 300) {
    // Fits comfortably above target (anchored right above without excess void gap)
    maxHeight = Math.min(480, spaceAbove - 12)
    top = targetRect.top - 12 - maxHeight
    arrowPlacement = 'bottom'
  } else {
    // Target is tall or centrally placed: dock to side avoiding right sidebar
    const targetCenter = targetRect.left + targetRect.width / 2
    const lateralLeft = targetCenter > vw / 2 ? 24 : Math.max(16, maxDesktopLeft)
    maxHeight = Math.min(500, vh - 40)
    top = Math.max(16, vh - maxHeight - 24)
    arrowPlacement = null

    return {
      top: Math.max(16, Math.min(top, vh - maxHeight - 16)),
      left: lateralLeft,
      width: cardWidth,
      maxHeight: Math.min(maxHeight, vh - 32),
      arrowPlacement,
      arrowLeft,
      isMobileLayout,
    }
  }

  // Safety clamp: top is NEVER < 16px and bottom NEVER > vh - 16px
  maxHeight = Math.min(maxHeight, vh - 32)
  top = Math.max(16, Math.min(top, vh - maxHeight - 16))

  return { top, left, width: cardWidth, maxHeight, arrowPlacement, arrowLeft, isMobileLayout }
}
