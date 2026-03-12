import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { ProjectCard } from './ProjectCard'

describe('ProjectCard', () => {
  const baseProps = {
    org: 'bloom-base',
    name: 'genesis',
    description: 'The genesis project for building the future',
    inProgress: 2,
    queued: 3,
    completed: 10,
    href: '/bloom-base/genesis',
  }

  it('renders project name and org', () => {
    render(<ProjectCard {...baseProps} />)

    expect(screen.getByText('genesis')).toBeInTheDocument()
    expect(screen.getByText('bloom-base')).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<ProjectCard {...baseProps} />)

    expect(screen.getByText('The genesis project for building the future')).toBeInTheDocument()
  })

  it('shows in-progress count when active', () => {
    render(<ProjectCard {...baseProps} />)

    expect(screen.getByText('2 in progress')).toBeInTheDocument()
  })

  it('shows Idle when no tasks in progress', () => {
    render(<ProjectCard {...baseProps} inProgress={0} />)

    expect(screen.getByText('Idle')).toBeInTheDocument()
  })

  it('shows queued count when queued > 0', () => {
    render(<ProjectCard {...baseProps} />)

    expect(screen.getByText(/3 queued/)).toBeInTheDocument()
  })

  it('hides queued when queued is 0', () => {
    render(<ProjectCard {...baseProps} queued={0} />)

    expect(screen.queryByText(/queued/)).not.toBeInTheDocument()
  })

  it('shows shipped count', () => {
    render(<ProjectCard {...baseProps} />)

    expect(screen.getByText('10 shipped')).toBeInTheDocument()
  })

  it('shows flagship badge when flagship is true', () => {
    render(<ProjectCard {...baseProps} flagship={true} />)

    expect(screen.getByText('Flagship')).toBeInTheDocument()
  })

  it('hides flagship badge when not flagged', () => {
    render(<ProjectCard {...baseProps} flagship={false} />)

    expect(screen.queryByText('Flagship')).not.toBeInTheDocument()
  })

  it('shows language when provided', () => {
    render(<ProjectCard {...baseProps} language="TypeScript" />)

    expect(screen.getByText('TypeScript')).toBeInTheDocument()
  })

  it('links to correct href', () => {
    render(<ProjectCard {...baseProps} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/bloom-base/genesis')
  })
})
