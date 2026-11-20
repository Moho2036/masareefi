import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CategoryIcon } from './CategoryIcon'

describe('CategoryIcon Component', () => {
  it('renders a Lucide SVG icon for known category emoji', () => {
    const { container } = render(<CategoryIcon icon="🛒" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders a Lucide SVG icon for newly added document and utility emojis', () => {
    const { container: c1 } = render(<CategoryIcon icon="📄" />)
    expect(c1.querySelector('svg')).not.toBeNull()

    const { container: c2 } = render(<CategoryIcon icon="📑" />)
    expect(c2.querySelector('svg')).not.toBeNull()

    const { container: c3 } = render(<CategoryIcon icon="💧" />)
    expect(c3.querySelector('svg')).not.toBeNull()

    const { container: c4 } = render(<CategoryIcon icon="documents" />)
    expect(c4.querySelector('svg')).not.toBeNull()
  })

  it('renders a Folder icon when icon is empty or whitespace', () => {
    const { container } = render(<CategoryIcon icon="  " />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders custom text/emoji when icon is unmapped', () => {
    const { container } = render(<CategoryIcon icon="🚀" />)
    expect(container.textContent).toBe('🚀')
  })

  it('applies custom color style to icon', () => {
    const { container } = render(<CategoryIcon icon="🛒" color="#2563eb" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveStyle({ color: '#2563eb' })
  })
})
