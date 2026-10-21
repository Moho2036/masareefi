import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CategoryForm } from './CategoryForm'
import * as catService from '../services/categories'
import type { Category } from '../types'

let mockCategories: Category[] = []

vi.mock('../services/categories', () => ({
  addCategory: vi.fn().mockResolvedValue('new-cat-id'),
  updateCategory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: mockCategories }),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

describe('CategoryForm Custom Emoji Input', () => {
  it('selects new emoji when typed before existing emoji', () => {
    render(
      <CategoryForm
        isOpen={true}
        onClose={vi.fn()}
        defaultType="expense"
      />
    )

    const emojiInput = screen.getByPlaceholderText(/أو اكتب\/الصق إيموجي مخصص/i) as HTMLInputElement
    // Initial icon for expense is 🛒
    expect(emojiInput.value).toBe('🛒')

    // User types 🍕 before 🛒 -> value becomes 🍕🛒
    fireEvent.change(emojiInput, { target: { value: '🍕🛒' } })
    expect(emojiInput.value).toBe('🍕')
  })

  it('selects new emoji when typed after existing emoji', () => {
    render(
      <CategoryForm
        isOpen={true}
        onClose={vi.fn()}
        defaultType="expense"
      />
    )

    const emojiInput = screen.getByPlaceholderText(/أو اكتب\/الصق إيموجي مخصص/i) as HTMLInputElement
    expect(emojiInput.value).toBe('🛒')

    // User types 🍕 after 🛒 -> value becomes 🛒🍕
    fireEvent.change(emojiInput, { target: { value: '🛒🍕' } })
    expect(emojiInput.value).toBe('🍕')
  })

  it('clears emoji when input is cleared', () => {
    render(
      <CategoryForm
        isOpen={true}
        onClose={vi.fn()}
        defaultType="expense"
      />
    )

    const emojiInput = screen.getByPlaceholderText(/أو اكتب\/الصق إيموجي مخصص/i) as HTMLInputElement
    fireEvent.change(emojiInput, { target: { value: '' } })
    expect(emojiInput.value).toBe('')
  })

  describe('Duplicate Category Name and Type Validation', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockCategories = [
        {
          id: 'cat-food',
          name: 'طعام وبقالة',
          type: 'expense',
          icon: '🛒',
          color: '#F59E0B',
          archived: false,
          order: 0,
        },
        {
          id: 'cat-old-gym',
          name: 'اشتراك جيم',
          type: 'expense',
          icon: '🏋️',
          color: '#EF4444',
          archived: true,
          order: 1,
        },
        {
          id: 'cat-salary',
          name: 'راتب',
          type: 'income',
          icon: '💼',
          color: '#10B981',
          archived: false,
          order: 2,
        },
      ]
    })

    it('prevents adding a new category if active category with same name and type already exists', async () => {
      render(
        <CategoryForm
          isOpen={true}
          onClose={vi.fn()}
          defaultType="expense"
        />
      )

      const nameInput = screen.getByLabelText('اسم التصنيف')
      fireEvent.change(nameInput, { target: { value: 'طعام وبقالة' } })

      const submitBtn = screen.getByRole('button', { name: 'حفظ التصنيف' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(
          screen.getByText('يوجد تصنيف آخر بنفس الاسم والنوع بالفعل.')
        ).toBeInTheDocument()
      })
      expect(catService.addCategory).not.toHaveBeenCalled()
    })

    it('prevents adding a new category if archived category with same name and type already exists', async () => {
      render(
        <CategoryForm
          isOpen={true}
          onClose={vi.fn()}
          defaultType="expense"
        />
      )

      const nameInput = screen.getByLabelText('اسم التصنيف')
      fireEvent.change(nameInput, { target: { value: 'اشتراك جيم' } })

      const submitBtn = screen.getByRole('button', { name: 'حفظ التصنيف' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(
          screen.getByText(
            'يوجد تصنيف مؤرشف بنفس الاسم والنوع. يمكنك استعادته من قسم التصنيفات المؤرشفة بدلاً من تكراره.'
          )
        ).toBeInTheDocument()
      })
      expect(catService.addCategory).not.toHaveBeenCalled()
    })

    it('allows adding category with same name if type is different', async () => {
      render(
        <CategoryForm
          isOpen={true}
          onClose={vi.fn()}
          defaultType="income"
        />
      )

      // 'طعام وبقالة' exists as expense, now adding as income
      const nameInput = screen.getByLabelText('اسم التصنيف')
      fireEvent.change(nameInput, { target: { value: 'طعام وبقالة' } })

      const submitBtn = screen.getByRole('button', { name: 'حفظ التصنيف' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(catService.addCategory).toHaveBeenCalledWith(
          'user-1',
          expect.objectContaining({
            name: 'طعام وبقالة',
            type: 'income',
          })
        )
      })
    })

    it('allows editing an existing category without changing its name', async () => {
      const existing = mockCategories[0] // 'طعام وبقالة'
      render(
        <CategoryForm
          isOpen={true}
          onClose={vi.fn()}
          initialCategory={existing}
        />
      )

      const submitBtn = screen.getByRole('button', { name: 'تعديل التصنيف' })
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(catService.updateCategory).toHaveBeenCalledWith(
          'user-1',
          existing.id,
          expect.objectContaining({
            name: 'طعام وبقالة',
          })
        )
      })
    })
  })
})
