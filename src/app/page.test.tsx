import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock API
vi.mock('@/lib/api', () => ({
  getCurrentUser: vi.fn(),
  getPublicProjects: vi.fn(),
}))

import Home from './page'
import * as api from '@/lib/api'

const mockProjects = [
  {
    id: 'proj-1',
    name: 'genesis',
    description: 'The genesis project',
    github_repo: 'bloom-base/genesis',
    in_progress: 2,
    queued: 3,
    completed: 10,
    last_activity_at: '2026-03-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    is_public: true,
  },
  {
    id: 'proj-2',
    name: 'arcade',
    description: 'Retro arcade games',
    github_repo: 'bloom-base/arcade',
    in_progress: 0,
    queued: 1,
    completed: 5,
    last_activity_at: '2026-02-28T00:00:00Z',
    created_at: '2026-01-15T00:00:00Z',
    is_public: true,
  },
]

describe('Homepage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders hero section for logged-out users', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/Software that/)).toBeInTheDocument()
    })
    expect(screen.getByText(/grows/)).toBeInTheDocument()
  })

  it('shows project cards after loading', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('genesis')).toBeInTheDocument()
    })
    expect(screen.getByText('arcade')).toBeInTheDocument()
  })

  it('shows stats bar with project counts', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Live projects')).toBeInTheDocument()
    })
    // 2 in progress total
    expect(screen.getByText('Building now')).toBeInTheDocument()
    // 15 completed total
    expect(screen.getByText('Ideas shipped')).toBeInTheDocument()
  })

  it('shows agent count when tasks in progress', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('2 agents building now')).toBeInTheDocument()
    })
  })

  it('shows shipped count when no tasks in progress', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: [{ ...mockProjects[1], in_progress: 0 }],
      total: 1,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('5 ideas shipped')).toBeInTheDocument()
    })
  })

  it('shows how it works section', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('How it works')).toBeInTheDocument()
    })
    expect(screen.getByText('Pick a project')).toBeInTheDocument()
    expect(screen.getByText('Share an idea')).toBeInTheDocument()
    expect(screen.getByText('Watch it grow')).toBeInTheDocument()
  })

  it('shows CTA section with explore and pricing links', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Ready to contribute?')).toBeInTheDocument()
    })
    expect(screen.getByText('View pricing')).toBeInTheDocument()
  })

  it('shows BYOK section for developers', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('For developers')).toBeInTheDocument()
    })
    expect(screen.getByText('Bring your own key')).toBeInTheDocument()
    expect(screen.getByText('Priority queue')).toBeInTheDocument()
    expect(screen.getByText('Shared knowledge')).toBeInTheDocument()
  })

  it('renders homepage for logged-in users (no dashboard redirect)', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      handle: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getAllByText('Explore projects').length).toBeGreaterThan(0)
    })
  })

  it('shows error state when projects fail to load', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockRejectedValue(new Error('Network error'))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Could not load projects right now.')).toBeInTheDocument()
    })
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('shows empty state when no projects exist', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('No projects yet. Check back soon.')).toBeInTheDocument()
    })
  })

  // --- New interactive tests ---

  it('hero "Explore projects" button links to /explore', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getAllByText('Explore projects').length).toBeGreaterThan(0)
    })

    // All "Explore projects" links should point to /explore
    const exploreLinks = screen.getAllByText('Explore projects')
    for (const link of exploreLinks) {
      const anchor = link.closest('a')
      expect(anchor).toHaveAttribute('href', '/explore')
    }
  })

  it('hero "View on GitHub" button links to bloom-base GitHub', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('View on GitHub')).toBeInTheDocument()
    })

    const githubLink = screen.getByText('View on GitHub').closest('a')
    expect(githubLink).toHaveAttribute('href', 'https://github.com/bloom-base')
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('CTA section "Explore projects" links to /explore', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Ready to contribute?')).toBeInTheDocument()
    })

    // The CTA section has its own "Explore projects" link
    const ctaSection = screen.getByText('Ready to contribute?').closest('section')!
    const exploreLink = ctaSection.querySelector('a[href="/explore"]')
    expect(exploreLink).toBeInTheDocument()
    expect(exploreLink).toHaveTextContent('Explore projects')
  })

  it('CTA section "View pricing" links to /pricing', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('View pricing')).toBeInTheDocument()
    })

    const pricingLink = screen.getByText('View pricing').closest('a')
    expect(pricingLink).toHaveAttribute('href', '/pricing')
  })

  it('"View all" link in live projects section links to /explore', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Live projects')).toBeInTheDocument()
    })

    // The "View all" link has an arrow character
    const viewAllLink = screen.getByText(/View all/).closest('a')
    expect(viewAllLink).toHaveAttribute('href', '/explore')
  })

  it('retry button re-fetches projects after error', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockRejectedValue(new Error('Network error'))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    // Now make the next call succeed
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: mockProjects,
      total: 2,
      limit: 50,
      offset: 0,
    })

    fireEvent.click(screen.getByText('Try again'))

    await waitFor(() => {
      expect(screen.getByText('genesis')).toBeInTheDocument()
    })
    expect(screen.getByText('arcade')).toBeInTheDocument()
    // Error message should be gone
    expect(screen.queryByText('Could not load projects right now.')).not.toBeInTheDocument()
  })

  it('retry button calls getPublicProjects again', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
    vi.mocked(api.getPublicProjects).mockRejectedValue(new Error('Network error'))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    const callCountBefore = vi.mocked(api.getPublicProjects).mock.calls.length

    // Set up to succeed on retry
    vi.mocked(api.getPublicProjects).mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    })

    fireEvent.click(screen.getByText('Try again'))

    await waitFor(() => {
      expect(vi.mocked(api.getPublicProjects).mock.calls.length).toBeGreaterThan(callCountBefore)
    })
  })
})
