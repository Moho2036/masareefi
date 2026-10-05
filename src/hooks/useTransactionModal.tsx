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
  closeModal: () => void
  isOpen: boolean
}

const TransactionModalContext = createContext<TransactionModalContextValue | null>(null)

export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [defaultType, setDefaultType] = useState<TxType>('expense')

  const openAdd = useCallback((type: TxType = 'expense') => {
    setEditingTransaction(null)
    setDefaultType(type)
    setIsOpen(true)
  }, [])

  const openEdit = useCallback((tx: Transaction) => {
    setEditingTransaction(tx)
    setDefaultType(tx.type)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setEditingTransaction(null)
  }, [])

  const value = useMemo(
    () => ({
      openAdd,
      openEdit,
      closeModal,
      isOpen,
    }),
    [openAdd, openEdit, closeModal, isOpen]
  )

  return (
    <TransactionModalContext.Provider value={value}>
      {children}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={editingTransaction ? 'تعديل المعاملة' : 'إضافة معاملة'}
      >
        <TransactionForm
          initialTransaction={editingTransaction}
          initialType={defaultType}
          onClose={closeModal}
        />
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
