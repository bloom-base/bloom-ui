import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/bloom-base/genesis',
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import ProjectNav from './ProjectNav'

describe('ProjectNav', () => {
  it('renders all standard tabs', () => {
    render(<ProjectNav owner="bloom-base" repo="genesis" />)

    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
    expect(screen.getByText('Knowledge')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Sponsor')).toBeInTheDocument()
    expect(screen.getByText('Governance')).toBeInTheDocument()
  })

  it('shows Settings tab for owners', () => {
    render(<ProjectNav owner="bloom-base" repo="genesis" isOwner={true} />)

    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('hides Settings tab for non-owners', () => {
    render(<ProjectNav owner="bloom-base" repo="genesis" isOwner={false} />)

    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('links tabs to correct paths', () => {
    render(<ProjectNav owner="bloom-base" repo="genesis" />)

    expect(screen.getByText('Overview').closest('a')).toHaveAttribute('href', '/bloom-base/genesis')
    expect(screen.getByText('Chat').closest('a')).toHaveAttribute('href', '/bloom-base/genesis/chat')
    expect(screen.getByText('Search').closest('a')).toHaveAttribute('href', '/bloom-base/genesis/search')
    expect(screen.getByText('Knowledge').closest('a')).toHaveAttribute('href', '/bloom-base/genesis/knowledge')
    expect(screen.getByText('Sponsor').closest('a')).toHaveAttribute('href', '/bloom-base/genesis/sponsor')
    expect(screen.getByText('Governance').closest('a')).toHaveAttribute('href', '/bloom-base/genesis/council')
  })

  it('highlights active tab', () => {
    render(<ProjectNav owner="bloom-base" repo="genesis" />)

    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink?.className).toContain('border-gray-900')
  })
})
