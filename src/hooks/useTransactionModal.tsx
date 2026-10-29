/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { Modal } from '../components/ui/Modal'
import { TransactionForm } from '../components/TransactionForm'
import type { Transaction, TxType } from '../types'

interface TransactionModalContextValue {
  openAdd: (type?: TxType) => void
  openEdit: (tx: Transaction) => void
  openDuplicate: (tx: Transaction) => void
  closeModal: () => void
  isOpen: boolean
}

const TransactionModalContext = createContext<TransactionModalContextValue | null>(null)

export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [duplicateTransaction, setDuplicateTransaction] = useState<Transaction | null>(null)
  const [defaultType, setDefaultType] = useState<TxType>('expense')
  const [isFormDirty, setIsFormDirty] = useState(false)

  const openAdd = useCallback((type: TxType = 'expense') => {
    setEditingTransaction(null)
    setDuplicateTransaction(null)
    setIsFormDirty(false)
    setDefaultType(type)
    setIsOpen(true)
  }, [])

  const openEdit = useCallback((tx: Transaction) => {
    setEditingTransaction(tx)
    setDuplicateTransaction(null)
    setIsFormDirty(false)
    setDefaultType(tx.type)
    setIsOpen(true)
  }, [])

  const openDuplicate = useCallback((tx: Transaction) => {
    setEditingTransaction(null)
    setDuplicateTransaction(tx)
    setIsFormDirty(false)
    setDefaultType(tx.type)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setEditingTransaction(null)
    setDuplicateTransaction(null)
    setIsFormDirty(false)
  }, [])

  const value = useMemo(
    () => ({
      openAdd,
      openEdit,
      openDuplicate,
      closeModal,
      isOpen,
    }),
    [openAdd, openEdit, openDuplicate, closeModal, isOpen]
  )

  const modalTitle = editingTransaction
    ? 'تعديل المعاملة'
    : duplicateTransaction
      ? 'تكرار المعاملة'
      : 'إضافة معاملة'

  return (
    <TransactionModalContext.Provider value={value}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={modalTitle}
        closeOnBackdropClick={!isFormDirty && !editingTransaction && !duplicateTransaction}
      >
        {isOpen && (
          <TransactionForm
            key={
              editingTransaction
                ? `edit-${editingTransaction.id}`
                : duplicateTransaction
                  ? `dup-${duplicateTransaction.id}`
                  : `new-${defaultType}`
            }
            initialTransaction={editingTransaction}
            duplicateFrom={duplicateTransaction}
            initialType={defaultType}
            onClose={closeModal}
            onDuplicate={openDuplicate}
            onDirtyChange={setIsFormDirty}
          />
        )}
      </Modal>
    </TransactionModalContext.Provider>
  )
}

export function useTransactionModal(): TransactionModalContextValue {
  const context = useContext(TransactionModalContext)
  if (!context) {
    throw new Error('useTransactionModal must be used within a TransactionModalProvider')
  }
  return context
}
