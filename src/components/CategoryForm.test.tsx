import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryForm } from './CategoryForm'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
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
})
