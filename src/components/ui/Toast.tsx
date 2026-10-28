import React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/cn'

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 inset-x-4 sm:inset-x-auto sm:start-6 z-50 flex flex-col gap-2 sm:max-w-sm pointer-events-none"
      role="region"
      aria-label="الإشعارات"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success'
        const isError = toast.type === 'error'

        return (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border text-sm font-bold transition-all animate-in slide-in-from-bottom-2 duration-200 backdrop-blur-md',
              isSuccess &&
                'bg-white/95 text-zinc-900 border-emerald-500/30 dark:bg-zinc-900/95 dark:text-zinc-100 dark:border-emerald-500/30 ring-1 ring-emerald-500/20',
              isError &&
                'bg-white/95 text-zinc-900 border-red-500/30 dark:bg-zinc-900/95 dark:text-zinc-100 dark:border-red-500/30 ring-1 ring-red-500/20',
              !isSuccess &&
                !isError &&
                'bg-white/95 text-zinc-900 border-zinc-200/80 dark:bg-zinc-900/95 dark:text-zinc-100 dark:border-zinc-800 ring-1 ring-zinc-500/10'
            )}
          >
            <div className="flex items-center gap-2.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              {isError && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-zinc-500 shrink-0" />}
              <span>{toast.message}</span>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              aria-label="إغلاق الإشعار"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
