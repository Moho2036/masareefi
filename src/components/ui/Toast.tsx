import React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/cn'

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-22 inset-x-4 sm:inset-x-auto sm:start-6 lg:bottom-6 z-50 flex flex-col gap-2 sm:max-w-sm pointer-events-none"
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
              'pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-lg border text-sm font-bold transition-all animate-in slide-in-from-bottom-2 duration-200',
              isSuccess &&
                'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
              isError &&
                'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-800',
              !isSuccess &&
                !isError &&
                'bg-slate-50 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
            )}
          >
            <div className="flex items-center gap-2.5">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              {isError && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-slate-500 shrink-0" />}
              <span>{toast.message}</span>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
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
