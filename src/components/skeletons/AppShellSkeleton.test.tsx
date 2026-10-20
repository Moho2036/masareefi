import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppShellSkeleton } from './AppShellSkeleton'

describe('AppShellSkeleton Component', () => {
  it('renders DashboardSkeleton and month selector skeleton on dashboard route (/)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppShellSkeleton />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('جاري تحميل لوحة التحكم')).toBeInTheDocument()
    expect(screen.queryByLabelText('جاري تحميل الصفحة')).not.toBeInTheDocument()

    // Month selector skeleton box should be present
    const monthSelectorSkeleton = container.querySelector('.w-28.sm\\:w-36.h-8.sm\\:h-9')
    expect(monthSelectorSkeleton).toBeInTheDocument()
  })

  it('renders PageSkeleton and hides month selector skeleton on /debts route', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/debts']}>
        <AppShellSkeleton />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('جاري تحميل الصفحة')).toBeInTheDocument()
    expect(screen.queryByLabelText('جاري تحميل لوحة التحكم')).not.toBeInTheDocument()

    // Month selector skeleton box should NOT be present on /debts
    const monthSelectorSkeleton = container.querySelector('.w-28.sm\\:w-36.h-8.sm\\:h-9')
    expect(monthSelectorSkeleton).not.toBeInTheDocument()
  })

  it('renders PageSkeleton and shows month selector skeleton on /transactions route', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/transactions']}>
        <AppShellSkeleton />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('جاري تحميل الصفحة')).toBeInTheDocument()
    expect(screen.queryByLabelText('جاري تحميل لوحة التحكم')).not.toBeInTheDocument()

    // Month selector skeleton box should be present on /transactions
    const monthSelectorSkeleton = container.querySelector('.w-28.sm\\:w-36.h-8.sm\\:h-9')
    expect(monthSelectorSkeleton).toBeInTheDocument()
  })
})
