import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BaseerLogo } from './BaseerLogo'

describe('BaseerLogo Component', () => {
  it('renders default brand logo SVG with accessible label', () => {
    const { container } = render(<BaseerLogo />)
    const svg = screen.getByRole('img', { name: 'شعار بَصير' })
    expect(svg).toBeDefined()
    expect(svg.getAttribute('viewBox')).toBe('0 0 256 256')
    // Wordmark is hidden by default
    expect(screen.queryByText('بَصير')).toBeNull()
    // Verify 4 paths exist
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(4)
  })

  it('renders wordmark when showWordmark is true', () => {
    render(<BaseerLogo showWordmark size={32} />)
    const wordmark = screen.getByText('بَصير')
    expect(wordmark).toBeDefined()
    expect(wordmark.classList.contains('font-black')).toBe(true)
  })

  it('renders app-icon variant with sapphire container and white fill', () => {
    const { container } = render(<BaseerLogo variant="app-icon" size={48} />)
    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect?.getAttribute('fill')).toBe('#2563EB')
    const paths = container.querySelectorAll('path')
    paths.forEach((p) => {
      expect(p.getAttribute('fill')).toBe('#FFFFFF')
    })
  })

  it('renders mono variant using fill-current', () => {
    const { container } = render(<BaseerLogo variant="mono" />)
    const paths = container.querySelectorAll('path')
    paths.forEach((p) => {
      expect(p.classList.contains('fill-current')).toBe(true)
    })
  })

  it('applies smallOpticalCut when specified or when size <= 24', () => {
    const { container: smallContainer } = render(<BaseerLogo size={20} />)
    const smallPath = smallContainer.querySelectorAll('path')[2] // upperAccentSegment
    // small cut has M 177.40 90.50
    expect(smallPath.getAttribute('d')).toContain('177.40')

    const { container: masterContainer } = render(<BaseerLogo size={40} />)
    const masterPath = masterContainer.querySelectorAll('path')[2]
    // master cut has M 174.19 87.35
    expect(masterPath.getAttribute('d')).toContain('174.19')
  })
})
