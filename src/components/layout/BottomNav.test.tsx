import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BottomNav } from './BottomNav'

describe('BottomNav smartTools active highlighting', () => {
  it('highlights only circles tool when url is /tools?tool=circles', () => {
    render(
      <MemoryRouter initialEntries={['/tools?tool=circles']}>
        <BottomNav onOpenAddModal={vi.fn()} />
      </MemoryRouter>
    )

    // Open More drawer
    const moreBtn = screen.getByRole('button', { name: /المزيد/i })
    fireEvent.click(moreBtn)

    const circlesLink = screen.getByRole('link', { name: /الجمعيات والصناديق المشتركة/i })
    const workHoursLink = screen.getByRole('link', { name: /تكلفة الشراء بساعات العمل/i })

    expect(circlesLink.className).toContain('bg-emerald-50')
    expect(workHoursLink.className).not.toContain('bg-emerald-50')
  })

  it('highlights only work_hours tool when url is /tools?tool=work_hours', () => {
    render(
      <MemoryRouter initialEntries={['/tools?tool=work_hours']}>
        <BottomNav onOpenAddModal={vi.fn()} />
      </MemoryRouter>
    )

    // Open More drawer
    const moreBtn = screen.getByRole('button', { name: /المزيد/i })
    fireEvent.click(moreBtn)

    const circlesLink = screen.getByRole('link', { name: /الجمعيات والصناديق المشتركة/i })
    const workHoursLink = screen.getByRole('link', { name: /تكلفة الشراء بساعات العمل/i })

    expect(workHoursLink.className).toContain('bg-emerald-50')
    expect(circlesLink.className).not.toContain('bg-emerald-50')
  })
})
