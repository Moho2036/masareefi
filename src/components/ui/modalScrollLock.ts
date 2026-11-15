// Module-level stack tracking open modal IDs for nested modal handling
export const openModalStack: string[] = []

let savedScrollY = 0
let savedBodyStyle: {
  overflow: string
  position: string
  top: string
  width: string
} | null = null

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return
  if (openModalStack.length === 1) {
    savedScrollY = window.scrollY || window.pageYOffset || 0
    savedBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedScrollY}px`
    document.body.style.width = '100%'
  }
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return
  if (openModalStack.length === 0 && savedBodyStyle) {
    document.body.style.overflow = savedBodyStyle.overflow
    document.body.style.position = savedBodyStyle.position
    document.body.style.top = savedBodyStyle.top
    document.body.style.width = savedBodyStyle.width
    if (
      typeof window.scrollTo === 'function' &&
      !window.scrollTo.toString().includes('notImplementedMethod')
    ) {
      window.scrollTo(0, savedScrollY)
    }
    savedBodyStyle = null
  }
}
