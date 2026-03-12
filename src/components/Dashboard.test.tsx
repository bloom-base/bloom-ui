import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  getDashboard: vi.fn(),
}))

import { Dashboard } from './Dashboard'
import * as api from '@/lib/api'

const freeUser = {
  id: 'user-1',
  github_username: 'testuser',
  handle: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'free' as const,
  is_admin: false,
  has_anthropic_key: false,
}

const proUser = {
  ...freeUser,
  subscription_tier: 'pro' as const,
}

const emptyDashboard = {
  projects: [],
  contributions: [],
  activity: [],
  stats: { total_projects: 0, total_in_progress: 0, total_ideas: 0, total_shipped: 0 },
  featured_projects: [
    {
      id: 'fp-1',
      name: 'genesis',
      description: 'The genesis project',
      github_repo: 'bloom-base/genesis',
      in_progress: 1,
      queued: 2,
      completed: 5,
      last_activity_at: '2026-03-01T00:00:00Z',
    },
  ],
}

const populatedDashboard = {
  projects: [
    {
      id: 'proj-1',
      name: 'my-app',
      description: 'My cool app',
      github_repo: 'testuser/my-app',
      in_progress: 1,
      queued: 0,
      completed: 3,
      last_activity_at: '2026-03-01T00:00:00Z',
    },
  ],
  contributions: [
    {
      id: 'task-1',
      title: 'Add dark mode',
      status: 'completed',
      project_name: 'my-app',
      project_github_repo: 'testuser/my-app',
      created_at: '2026-02-28T00:00:00Z',
    },
  ],
  activity: [
    {
      type: 'shipped',
      title: 'Add dark mode',
      project_name: 'my-app',
      project_github_repo: 'testuser/my-app',
      github_pr_url: 'https://github.com/testuser/my-app/pull/1',
      timestamp: '2026-03-01T00:00:00Z',
    },
  ],
  stats: { total_projects: 1, total_in_progress: 1, total_ideas: 5, total_shipped: 3 },
  featured_projects: [],
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton', () => {
    vi.mocked(api.getDashboard).mockReturnValue(new Promise(() => {}))

    render(<Dashboard user={freeUser as any} />)

    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('shows welcome message for new users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(emptyDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Welcome, testuser')).toBeInTheDocument()
    })
  })

  it('shows welcome back for returning users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(populatedDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Welcome back, testuser')).toBeInTheDocument()
    })
  })

  it('shows quick-start guide for new users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(emptyDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Get started')).toBeInTheDocument()
    })
    expect(screen.getByText('Pick a project')).toBeInTheDocument()
    expect(screen.getByText('Chat with the agent')).toBeInTheDocument()
    expect(screen.getByText('Watch it ship')).toBeInTheDocument()
  })

  it('shows featured projects for new users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(emptyDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Projects to explore')).toBeInTheDocument()
    })
    expect(screen.getByText('genesis')).toBeInTheDocument()
  })

  it('shows user projects for returning users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(populatedDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Your projects')).toBeInTheDocument()
    })
    expect(screen.getAllByText('my-app').length).toBeGreaterThanOrEqual(1)
  })

  it('shows contributions', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(populatedDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Your contributions')).toBeInTheDocument()
    })
    expect(screen.getByText('Add dark mode')).toBeInTheDocument()
    expect(screen.getAllByText('Shipped').length).toBeGreaterThanOrEqual(1)
  })

  it('shows activity feed', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(populatedDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Recent activity')).toBeInTheDocument()
    })
  })

  it('shows upgrade CTA for free users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(emptyDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Create your own projects')).toBeInTheDocument()
    })
    expect(screen.getByText('View plans')).toBeInTheDocument()
  })

  it('hides upgrade CTA for pro users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(emptyDashboard as any)

    render(<Dashboard user={proUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Welcome, testuser')).toBeInTheDocument()
    })
    expect(screen.queryByText('Create your own projects')).not.toBeInTheDocument()
  })

  it('shows New project button for pro users with projects', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(populatedDashboard as any)

    render(<Dashboard user={proUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('New project')).toBeInTheDocument()
    })
  })

  it('shows stats row for returning users', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(populatedDashboard as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
    })
    expect(screen.getAllByText('In progress').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Total ideas')).toBeInTheDocument()
  })

  it('shows empty contributions state', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue({
      ...populatedDashboard,
      contributions: [],
    } as any)

    render(<Dashboard user={freeUser as any} />)

    await waitFor(() => {
      expect(screen.getByText('No contributions yet')).toBeInTheDocument()
    })
  })
})
