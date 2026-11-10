import React from 'react'
import { Delete, Fingerprint } from 'lucide-react'

export interface PinKeypadProps {
  inputPin: string
  errorMsg: string | null
  lockoutSeconds: number
  isBiometricsAvailable: boolean
  onDigit: (digit: string) => void
  onDelete: () => void
  onBiometric: () => void
}

export const PinKeypad: React.FC<PinKeypadProps> = ({
  inputPin,
  errorMsg,
  lockoutSeconds,
  isBiometricsAvailable,
  onDigit,
  onDelete,
  onBiometric,
}) => {
  return (
    <>
      {/* PIN Dots */}
      <div dir="ltr" className="flex items-center justify-center gap-4 py-2">
        {[0, 1, 2, 3].map((index) => {
          const isFilled = inputPin.length > index
          return (
            <div
              key={index}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                isFilled
                  ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500 scale-110 shadow-xs'
                  : 'border-zinc-300 dark:border-zinc-700 bg-zinc-200/80 dark:bg-zinc-800/60'
              }`}
            />
          )
        })}
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="text-xs font-bold text-red-600 dark:text-red-400 animate-in fade-in duration-150">
          {errorMsg}
        </div>
      )}

      {/* Numeric Keypad */}
      <div dir="ltr" className="grid grid-cols-3 gap-3 w-full pt-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={lockoutSeconds > 0}
            onClick={() => onDigit(digit)}
            className="h-14 rounded-2xl bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:bg-zinc-200 dark:active:bg-zinc-600 text-zinc-900 dark:text-white text-xl font-black transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700/40 shadow-xs dark:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {digit}
          </button>
        ))}

        {/* Biometrics button */}
        <button
          type="button"
          onClick={onBiometric}
          disabled={!isBiometricsAvailable || lockoutSeconds > 0}
          className={`h-14 rounded-2xl flex items-center justify-center transition-all border ${
            isBiometricsAvailable && lockoutSeconds === 0
              ? 'bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:bg-zinc-200 dark:active:bg-zinc-600 text-blue-600 dark:text-blue-400 border-zinc-200 dark:border-zinc-700/40 shadow-xs dark:shadow-none cursor-pointer'
              : 'opacity-0 pointer-events-none border-transparent'
          }`}
        >
          <Fingerprint className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Zero */}
        <button
          type="button"
          disabled={lockoutSeconds > 0}
          onClick={() => onDigit('0')}
          className="h-14 rounded-2xl bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:bg-zinc-200 dark:active:bg-zinc-600 text-zinc-900 dark:text-white text-xl font-black transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700/40 shadow-xs dark:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          disabled={lockoutSeconds > 0}
          onClick={onDelete}
          className="h-14 rounded-2xl bg-white dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 active:bg-zinc-200 dark:active:bg-zinc-600 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700/40 shadow-xs dark:shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </>
  )
}
