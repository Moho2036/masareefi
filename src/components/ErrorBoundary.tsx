/* eslint-disable react-refresh/only-export-components */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((props: { error: Error; resetError: () => void }) => ReactNode)
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
  'ChunkLoadError',
  'Loading chunk',
]

/**
 * Checks if an error is caused by a missing lazy-loaded chunk,
 * typically after a new production deployment on Firebase Hosting.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const errString =
    error instanceof Error
      ? `${error.name} ${error.message} ${error.stack || ''}`
      : String(error)

  return CHUNK_ERROR_PATTERNS.some((pattern) =>
    errString.toLowerCase().includes(pattern.toLowerCase())
  )
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    if (isChunkLoadError(error)) {
      try {
        if (
          typeof window !== 'undefined' &&
          window.sessionStorage &&
          sessionStorage.getItem('baseer_chunk_reload') !== 'true'
        ) {
          sessionStorage.setItem('baseer_chunk_reload', 'true')
          window.location.reload()
          return
        }
      } catch (err) {
        console.warn('Failed to access sessionStorage for chunk reload:', err)
      }
    }
  }

  handleReload = (): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('baseer_chunk_reload')
      }
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback({
            error,
            resetError: () => this.setState({ hasError: false, error: null }),
          })
        }
        return fallback
      }

      const isChunk = isChunkLoadError(error)

      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center p-4 bg-[#F4F4F5] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans select-none"
        >
          <div className="w-full max-w-md rounded-2xl p-6 bg-white dark:bg-[#121215] border border-[#E4E4E7] dark:border-[#27272A] shadow-2xs dark:shadow-none text-center space-y-4 animate-scale-in">
            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              {isChunk ? (
                <RefreshCw className="w-6 h-6 stroke-[2]" />
              ) : (
                <AlertTriangle className="w-6 h-6 stroke-[2]" />
              )}
            </div>

            {/* Title */}
            <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              {isChunk ? 'يتوفر تحديث جديد للتطبيق' : 'عذراً، حدث خطأ غير متوقع'}
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              بياناتك المالية محفوظة بأمان. يرجى تحديث الصفحة للمتابعة.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 font-bold cursor-pointer transition-colors"
              >
                تحديث الصفحة
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#121215] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl h-11 px-4 font-bold cursor-pointer transition-colors"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      )
    }

    return children
  }
}
