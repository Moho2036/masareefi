import React from 'react'
import { LogOut } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export interface PinForgotModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmReset: () => void
}

export const PinForgotModal: React.FC<PinForgotModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="استعادة رمز الدخول"
      hideCloseButton={true}
    >
      <div className="space-y-4 text-start">
        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          لأسباب أمنية وحماية خصوصيتك، يُحفظ رمز الدخول محلياً على جهازك فقط. لإلغاء القفل، يمكنك تسجيل الخروج من هذا الجهاز ثم تسجيل الدخول مرة أخرى بحسابك السحابي بأمان.
        </p>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="danger"
            onClick={onConfirmReset}
            icon={<LogOut className="w-4 h-4" />}
          >
            تسجيل الخروج وإعادة التعيين
          </Button>
        </div>
      </div>
    </Modal>
  )
}
