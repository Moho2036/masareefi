import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, isChunkLoadError } from './ErrorBoundary'

// Component that throws on demand
const ProblemChild: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({
  shouldThrow = false,
  errorMessage = 'Unexpected crash',
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage)
  }
  return <div data-testid="child-content">المحتوى السليم</div>
}

describe('ErrorBoundary & isChunkLoadError', () => {
  const originalLocation = window.location

  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()

    // Mock console.error to keep test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock window.location.reload and href
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        reload: vi.fn(),
        href: '',
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  describe('isChunkLoadError helper', () => {
    it('identifies standard Vite dynamic import chunk failures', () => {
      expect(
        isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/DebtsPage.js'))
      ).toBe(true)
      expect(
        isChunkLoadError(new Error('Importing a module script failed.'))
      ).toBe(true)
      expect(
        isChunkLoadError(new Error('error loading dynamically imported module'))
      ).toBe(true)
    })

    it('identifies Webpack and standard chunk loading errors', () => {
      expect(
        isChunkLoadError(new Error('ChunkLoadError: Loading chunk 3 failed.'))
      ).toBe(true)
      expect(
        isChunkLoadError(new Error('Loading chunk 42 failed.'))
      ).toBe(true)
    })

    it('returns false for generic errors and falsy values', () => {
      expect(isChunkLoadError(new Error('TypeError: Cannot read properties of undefined'))).toBe(false)
      expect(isChunkLoadError(new Error('Network error: server returned 500'))).toBe(false)
      expect(isChunkLoadError(null)).toBe(false)
      expect(isChunkLoadError(undefined)).toBe(false)
      expect(isChunkLoadError('')).toBe(false)
    })
  })

  describe('ErrorBoundary Component Lifecycle & UI', () => {
    it('renders children normally when there is no error', () => {
      render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('child-content')).toBeInTheDocument()
      expect(screen.getByText('المحتوى السليم')).toBeInTheDocument()
      expect(screen.queryByText('عذراً، حدث خطأ غير متوقع')).not.toBeInTheDocument()
    })

    it('catches generic errors and displays the Swiss Clarity fallback UI', () => {
      render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} errorMessage="Something went wrong in the component" />
        </ErrorBoundary>
      )

      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument()
      expect(screen.getByText('عذراً، حدث خطأ غير متوقع')).toBeInTheDocument()
      expect(
        screen.getByText('بياناتك المالية محفوظة بأمان. يرجى تحديث الصفحة للمتابعة.')
      ).toBeInTheDocument()

      const reloadBtn = screen.getByRole('button', { name: 'تحديث الصفحة' })
      const homeBtn = screen.getByRole('button', { name: 'العودة للرئيسية' })
      expect(reloadBtn).toBeInTheDocument()
      expect(homeBtn).toBeInTheDocument()
    })

    it('reloads page automatically on the first chunk load error', () => {
      expect(sessionStorage.getItem('baseer_chunk_reload')).toBeNull()

      render(
        <ErrorBoundary>
          <ProblemChild
            shouldThrow={true}
            errorMessage="Failed to fetch dynamically imported module: /assets/ReportsPage.js"
          />
        </ErrorBoundary>
      )

      expect(sessionStorage.getItem('baseer_chunk_reload')).toBe('true')
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })

    it('displays new update banner if chunk load error recurs after automatic reload', () => {
      // Simulate that automatic reload already happened
      sessionStorage.setItem('baseer_chunk_reload', 'true')

      render(
        <ErrorBoundary>
          <ProblemChild
            shouldThrow={true}
            errorMessage="Failed to fetch dynamically imported module: /assets/ReportsPage.js"
          />
        </ErrorBoundary>
      )

      // Should not call reload again in an infinite loop
      expect(window.location.reload).not.toHaveBeenCalled()

      // Title should indicate a new app update is available
      expect(screen.getByText('يتوفر تحديث جديد للتطبيق')).toBeInTheDocument()
      expect(
        screen.getByText('بياناتك المالية محفوظة بأمان. يرجى تحديث الصفحة للمتابعة.')
      ).toBeInTheDocument()

      // Clicking reload button should clear sessionStorage flag and reload
      const reloadBtn = screen.getByRole('button', { name: 'تحديث الصفحة' })
      fireEvent.click(reloadBtn)

      expect(sessionStorage.getItem('baseer_chunk_reload')).toBeNull()
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })

    it('redirects to root when clicking Go Home button', () => {
      render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} errorMessage="Generic crash" />
        </ErrorBoundary>
      )

      const homeBtn = screen.getByRole('button', { name: 'العودة للرئيسية' })
      fireEvent.click(homeBtn)

      expect(window.location.href).toBe('/')
    })

    it('supports custom fallback render function', () => {
      render(
        <ErrorBoundary
          fallback={({ error, resetError }) => (
            <div>
              <span data-testid="custom-error">{error.message}</span>
              <button onClick={resetError}>إعادة المحاولة</button>
            </div>
          )}
        >
          <ProblemChild shouldThrow={true} errorMessage="Custom error message" />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('custom-error')).toHaveTextContent('Custom error message')
    })
  })
})
