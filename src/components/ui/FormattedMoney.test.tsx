import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormattedMoney } from './FormattedMoney'

vi.mock('../../hooks/useUserSettings', () => ({
  useUserSettings: () => ({
    data: {
      currency: 'JOD',
      hideBalances: false,
      hideZeroDecimals: true,
    },
  }),
}))

describe('FormattedMoney', () => {
  it('formats positive amount in JOD', () => {
    render(<FormattedMoney amountFils={15000} />)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('د.أ')).toBeInTheDocument()
  })

  it('formats decimals correctly', () => {
    render(<FormattedMoney amountFils={15750} hideZeroDecimals={false} />)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('.750')).toBeInTheDocument()
  })

  it('displays mask when maskAmount is true', () => {
    render(<FormattedMoney amountFils={50000} maskAmount />)
    expect(screen.getByText('•••••')).toBeInTheDocument()
    expect(screen.queryByText('50')).toBeNull()
  })

  it('displays sign prefix when withSign is expense', () => {
    render(<FormattedMoney amountFils={20000} withSign="expense" />)
    expect(screen.getByText((content) => content.includes('-'))).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('displays sign prefix when withSign is income', () => {
    render(<FormattedMoney amountFils={30000} withSign="income" />)
    expect(screen.getByText((content) => content.includes('+'))).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders correctly when animated is true', () => {
    render(<FormattedMoney amountFils={100000} animated />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})
