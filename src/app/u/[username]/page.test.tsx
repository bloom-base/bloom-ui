import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ username: 'testuser' }),
  usePathname: () => '/u/testuser',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

vi.mock('@/lib/api', () => ({
  getPublicProfile: vi.fn(),
}))

import PublicProfilePage from './page'
import * as api from '@/lib/api'

const mockProfile = {
  username: 'testuser',
  display_name: 'Test User',
  bio: 'I build things with AI.',
  avatar_url: null,
  github_username: 'testuser',
  created_at: '2026-01-01T00:00:00Z',
  projects: [
    {
      id: 'proj-1',
      name: 'my-project',
      description: 'A cool project',
      github_repo: 'testuser/my-project',
      in_progress: 1,
      queued: 2,
      completed: 5,
    },
  ],
  contributions: [
    {
      id: 'task-1',
      title: 'Add dark mode',
      status: 'completed',
      project_name: 'my-project',
      project_github_repo: 'testuser/my-project',
      created_at: '2026-02-15T00:00:00Z',
      github_pr_url: 'https://github.com/testuser/my-project/pull/1',
    },
    {
      id: 'task-2',
      title: 'Fix login bug',
      status: 'in_progress',
      project_name: 'my-project',
      project_github_repo: 'testuser/my-project',
      created_at: '2026-03-01T00:00:00Z',
      github_pr_url: null,
    },
  ],
}

describe('PublicProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders profile header with display name', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
    expect(screen.getByText('@testuser')).toBeInTheDocument()
  })

  it('shows bio when present', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('I build things with AI.')).toBeInTheDocument()
    })
  })

  it('shows contribution stats', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      // 1 shipped, 1 active — "Shipped" appears in stats and as badge
      expect(screen.getAllByText('Shipped').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('Ideas')).toBeInTheDocument()
  })

  it('shows projects section', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })
    // "my-project" appears in projects section and contributions
    expect(screen.getAllByText('my-project').length).toBeGreaterThanOrEqual(1)
  })

  it('shows contributions list', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Add dark mode')).toBeInTheDocument()
    })
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
  })

  it('shows 404 for nonexistent user', async () => {
    vi.mocked(api.getPublicProfile).mockRejectedValue(new Error('404 not found'))

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument()
    })
  })

  it('shows letter initial when no avatar', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('T')).toBeInTheDocument()
    })
  })

  it('shows joined date', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText(/Joined/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no contributions', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue({
      ...mockProfile,
      contributions: [],
      projects: [],
    } as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
    // No contributions section shown
    expect(screen.queryByText('Add dark mode')).not.toBeInTheDocument()
  })

  it('GitHub username link has correct href, target, and rel', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('testuser', { selector: 'a' })).toBeInTheDocument()
    })

    const githubLink = screen.getByText('testuser', { selector: 'a' })
    expect(githubLink).toHaveAttribute('href', 'https://github.com/testuser')
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('project cards link to correct project detail page', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    // Find the project card link by its text content
    const projectHeading = screen.getByRole('heading', { name: 'my-project' })
    const projectLink = projectHeading.closest('a')
    expect(projectLink).toHaveAttribute('href', '/testuser/my-project')
  })

  it('contribution project name link points to correct project', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Contributions')).toBeInTheDocument()
    })

    // The contribution project name links (in the contributions section)
    // "my-project" appears both as a project card heading and as contribution links
    const projectLinks = screen.getAllByRole('link', { name: 'my-project' })
    // At least one should link to the project repo path
    const contributionProjectLink = projectLinks.find(
      (link) => link.getAttribute('href') === '/testuser/my-project' && link.tagName === 'A'
    )
    expect(contributionProjectLink).toBeDefined()
    expect(contributionProjectLink).toHaveAttribute('href', '/testuser/my-project')
  })

  it('View PR link has correct href and target="_blank"', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue(mockProfile as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('View PR')).toBeInTheDocument()
    })

    const viewPrLink = screen.getByText('View PR').closest('a')!
    expect(viewPrLink).toHaveAttribute('href', 'https://github.com/testuser/my-project/pull/1')
    expect(viewPrLink).toHaveAttribute('target', '_blank')
    expect(viewPrLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not render View PR link when github_pr_url is null', async () => {
    vi.mocked(api.getPublicProfile).mockResolvedValue({
      ...mockProfile,
      contributions: [
        {
          id: 'task-2',
          title: 'Fix login bug',
          status: 'in_progress',
          project_name: 'my-project',
          project_github_repo: 'testuser/my-project',
          created_at: '2026-03-01T00:00:00Z',
          github_pr_url: null,
        },
      ],
    } as any)

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
    })

    expect(screen.queryByText('View PR')).not.toBeInTheDocument()
  })

  it('Show more button reveals additional contributions when clicked', async () => {
    // Create 25 contributions to exceed the 20-per-page limit
    const manyContributions = Array.from({ length: 25 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Contribution ${i + 1}`,
      status: 'completed',
      project_name: 'my-project',
      project_github_repo: 'testuser/my-project',
      created_at: '2026-02-15T00:00:00Z',
      github_pr_url: null,
    }))

    vi.mocked(api.getPublicProfile).mockResolvedValue({
      ...mockProfile,
      contributions: manyContributions,
    } as any)

    const { fireEvent: fe } = await import('@testing-library/react')

    render(<PublicProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Contribution 1')).toBeInTheDocument()
    })

    // Initially only 20 are shown — contribution 21 should not be visible
    expect(screen.queryByText('Contribution 21')).not.toBeInTheDocument()

    // Show more button should display "5 remaining"
    const showMoreBtn = screen.getByRole('button', { name: /Show more/ })
    expect(showMoreBtn).toHaveTextContent('5 remaining')

    fe.click(showMoreBtn)

    await waitFor(() => {
      expect(screen.getByText('Contribution 21')).toBeInTheDocument()
    })

    // All 25 contributions now visible — button should be gone
    expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument()
  })
})
