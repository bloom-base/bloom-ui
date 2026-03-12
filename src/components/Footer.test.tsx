import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { Footer } from './Footer'

describe('Footer', () => {
  it('renders copyright with current year', () => {
    render(<Footer />)

    const year = new Date().getFullYear()
    expect(screen.getByText(`© ${year} Bloom`)).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Footer />)

    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Terms')).toBeInTheDocument()
    expect(screen.getByText('Privacy')).toBeInTheDocument()
  })

  it('links to correct paths', () => {
    render(<Footer />)

    expect(screen.getByText('Explore').closest('a')).toHaveAttribute('href', '/explore')
    expect(screen.getByText('Pricing').closest('a')).toHaveAttribute('href', '/pricing')
    expect(screen.getByText('Terms').closest('a')).toHaveAttribute('href', '/terms')
    expect(screen.getByText('Privacy').closest('a')).toHaveAttribute('href', '/privacy')
  })

  it('GitHub links to bloom-base org', () => {
    render(<Footer />)

    const githubLink = screen.getByText('GitHub').closest('a')
    expect(githubLink).toHaveAttribute('href', 'https://github.com/bloom-base')
    expect(githubLink).toHaveAttribute('target', '_blank')
  })
})
