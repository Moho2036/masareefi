import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { toWesternDigits } from '../../lib/dates'

export interface PinSetupModalProps {
  isOpen: boolean
  onClose: () => void
  pinInput: string
  setPinInput: (val: string) => void
  pinConfirmInput: string
  setPinConfirmInput: (val: string) => void
  pinError: string | null
  onSavePin: () => void
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onClose,
  pinInput,
  setPinInput,
  pinConfirmInput,
  setPinConfirmInput,
  pinError,
  onSavePin,
}) => {
  const [showPin, setShowPin] = useState(false)

  const handleClose = () => {
    setShowPin(false)
    onClose()
  }

  const handleSavePin = () => {
    setShowPin(false)
    onSavePin()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="تعيين رمز الدخول (PIN)"
      hideCloseButton={true}
    >
      <div className="space-y-4">
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          أدخل رمز دخول من 4 أرقام لحماية التطبيق على هذا الجهاز:
        </p>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              رمز الدخول الجديد (4 أرقام)
            </label>
            <button
              type="button"
              onClick={() => setShowPin((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}</span>
            </button>
          </div>
          <Input
            type={showPin ? 'text' : 'password'}
            name="baseer-local-pin"
            autoComplete="new-password"
            inputMode="numeric"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(toWesternDigits(e.target.value).replace(/\D/g, ''))}
            placeholder={showPin ? '1234' : '••••'}
            dir="ltr"
            className="font-mono tracking-widest text-center text-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
            تأكيد رمز الدخول (4 أرقام)
          </label>
          <Input
            type={showPin ? 'text' : 'password'}
            name="baseer-local-pin"
            autoComplete="new-password"
            inputMode="numeric"
            maxLength={4}
            value={pinConfirmInput}
            onChange={(e) => setPinConfirmInput(toWesternDigits(e.target.value).replace(/\D/g, ''))}
            placeholder={showPin ? '1234' : '••••'}
            dir="ltr"
            className="font-mono tracking-widest text-center text-lg"
          />
        </div>

        {pinError && (
          <div className="text-xs font-bold text-red-600 dark:text-red-400">
            {pinError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            size="md"
            onClick={handleClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSavePin}
            disabled={pinInput.length !== 4 || pinConfirmInput.length !== 4}
          >
            تفعيل القفل
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export interface RemovePinModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmRemove: () => void
}

export const RemovePinModal: React.FC<RemovePinModalProps> = ({
  isOpen,
  onClose,
  onConfirmRemove,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تأكيد إلغاء قفل التطبيق"
      hideCloseButton={true}
    >
      <div className="space-y-4 text-start">
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          هل أنت متأكد من رغبتك في إلغاء قفل التطبيق؟ سيؤدي ذلك إلى تعطيل رمز PIN والبصمة.
        </p>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirmRemove}
          >
            تأكيد إلغاء القفل
          </Button>
        </div>
      </div>
    </Modal>
  )
}
