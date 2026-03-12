import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ owner: 'bloom-base', repo: 'genesis' }),
  usePathname: () => '/bloom-base/genesis/analytics',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/EvalDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="eval-dashboard">EvalDashboard</div>,
}))

vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  getCurrentUser: vi.fn(),
  getProjectAnalytics: vi.fn(),
  getTokenTimeseries: vi.fn(),
}))

import AnalyticsPage from './page'
import * as api from '@/lib/api'

const mockProject = {
  id: 'proj-1',
  name: 'genesis',
  description: 'The genesis project',
  github_repo: 'bloom-base/genesis',
  owner_id: 'user-1',
  is_public: true,
  vision: 'Build the future',
  created_at: '2026-01-01T00:00:00Z',
}

const mockUser = {
  id: 'user-1',
  github_username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'pro',
  is_admin: false,
  has_anthropic_key: false,
}

const mockAnalytics = {
  tasks: { total: 12, completed: 10, failed: 1, success_rate: 0.83 },
  cost: { total_cost_usd: 2.45, avg_cost_per_task_usd: 0.20 },
  timing: { avg_duration_seconds: 120, p95_duration_seconds: 300 },
  agents: { turns_by_agent: { coder: 40, reviewer: 15 } },
  tools: { top_tools: { read_file: 50, write_file: 30 } },
  models: { models_used: {} },
}

const mockTimeseries = {
  period_days: 30,
  project_id: 'proj-1',
  hours: 720,
  total_tokens: 100000,
  total_cost_usd: 1.50,
  data: [
    {
      hour: '2026-02-28T00:00:00Z',
      tokens_in: 5000,
      tokens_out: 3000,
      tokens_total: 8000,
      cost_usd: 0.10,
      segments: [
        { id: 's1', title: 'Task 1', type: 'task' as const, agent: 'coder', tokens_in: 5000, tokens_out: 3000, tokens_total: 8000, cost_usd: 0.10, pr_url: null },
      ],
    },
  ],
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getProjectAnalytics).mockResolvedValue(mockAnalytics as any)
    vi.mocked(api.getTokenTimeseries).mockResolvedValue(mockTimeseries as any)
  })

  it('shows sign in message for logged-out users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Sign in to view analytics')).toBeInTheDocument()
    })
  })

  it('shows analytics header for logged-in users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })
    expect(screen.getByText('Task performance, costs, and agent activity')).toBeInTheDocument()
  })

  it('shows period selector buttons', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('7d')).toBeInTheDocument()
    })
    expect(screen.getByText('30d')).toBeInTheDocument()
    expect(screen.getByText('90d')).toBeInTheDocument()
  })

  it('shows project not found for invalid project', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(null as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Project not found')).toBeInTheDocument()
    })
  })

  it('clicking 7d period button calls getTokenTimeseries with period 7', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    // Wait for the page to fully render with analytics
    await waitFor(() => {
      expect(screen.getByText('7d')).toBeInTheDocument()
    })

    // Clear the call history from the initial load (period=30 default)
    vi.mocked(api.getTokenTimeseries).mockClear()
    vi.mocked(api.getProjectAnalytics).mockClear()

    fireEvent.click(screen.getByText('7d'))

    await waitFor(() => {
      expect(api.getTokenTimeseries).toHaveBeenCalledWith(7, 'proj-1')
    })
  })

  it('clicking 90d period button calls getTokenTimeseries with period 90', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('90d')).toBeInTheDocument()
    })

    vi.mocked(api.getTokenTimeseries).mockClear()
    vi.mocked(api.getProjectAnalytics).mockClear()

    fireEvent.click(screen.getByText('90d'))

    await waitFor(() => {
      expect(api.getTokenTimeseries).toHaveBeenCalledWith(90, 'proj-1')
    })
  })

  it('selected period button has active styling', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('30d')).toBeInTheDocument()
    })

    // Default period is 30, so 30d button should have active class
    const btn30d = screen.getByText('30d')
    expect(btn30d.className).toContain('bg-white')
    expect(btn30d.className).toContain('shadow-sm')

    // 7d should not have active class
    const btn7d = screen.getByText('7d')
    expect(btn7d.className).not.toContain('shadow-sm')

    // Click 7d
    fireEvent.click(btn7d)

    // Now 7d should have active styling and 30d should not
    await waitFor(() => {
      expect(screen.getByText('7d').className).toContain('shadow-sm')
    })
    expect(screen.getByText('30d').className).not.toContain('shadow-sm')
  })

  it('switching period re-fetches both analytics and timeseries', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })

    // Wait for initial data to load
    await waitFor(() => {
      expect(api.getTokenTimeseries).toHaveBeenCalled()
    })

    vi.mocked(api.getTokenTimeseries).mockClear()
    vi.mocked(api.getProjectAnalytics).mockClear()

    // Switch to 7d
    fireEvent.click(screen.getByText('7d'))

    await waitFor(() => {
      expect(api.getTokenTimeseries).toHaveBeenCalledWith(7, 'proj-1')
    })
    // getProjectAnalytics is also re-fetched because the effect depends on [project, period]
    expect(api.getProjectAnalytics).toHaveBeenCalledWith('proj-1')
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Stat Cards Display
  // ────────────────────────────────────────────────────────────

  it('shows summary stat cards with correct values', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Total Tasks')).toBeInTheDocument()
    })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('10 completed')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('83%')).toBeInTheDocument()
    expect(screen.getByText('1 failed')).toBeInTheDocument()
    expect(screen.getByText('Total Cost')).toBeInTheDocument()
    expect(screen.getByText('$2.45')).toBeInTheDocument()
    expect(screen.getByText('Avg Duration')).toBeInTheDocument()
    expect(screen.getByText('2m')).toBeInTheDocument()
  })

  it('shows avg cost per task in stat card subtitle', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('$0.20 avg/task')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Token Chart Rendering
  // ────────────────────────────────────────────────────────────

  it('shows token usage chart section with totals', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Token Usage')).toBeInTheDocument()
    })

    expect(screen.getByText('100,000 total tokens')).toBeInTheDocument()
    expect(screen.getByText('$1.50 total cost')).toBeInTheDocument()
  })

  it('shows "No token usage data yet" when timeseries has no data', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.getTokenTimeseries).mockResolvedValue({
      ...mockTimeseries,
      data: [],
    } as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('No token usage data yet')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Cost by Agent Section
  // ────────────────────────────────────────────────────────────

  it('shows cost by agent section with agent bars', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Cost by Agent')).toBeInTheDocument()
    })

    // The coder agent from the timeseries segment (appears in both Cost by Agent and Turns by Agent)
    const coderElements = screen.getAllByText('coder')
    expect(coderElements.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "No agent cost data yet" when timeseries has no segments', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.getTokenTimeseries).mockResolvedValue({
      ...mockTimeseries,
      data: [
        {
          hour: '2026-02-28T00:00:00Z',
          tokens_in: 5000,
          tokens_out: 3000,
          tokens_total: 8000,
          cost_usd: 0.10,
          segments: [],
        },
      ],
    } as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('No agent cost data yet')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Turns by Agent
  // ────────────────────────────────────────────────────────────

  it('shows turns by agent section', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Turns by Agent')).toBeInTheDocument()
    })

    // coder: 40, reviewer: 15 from mockAnalytics
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Top Tools Section
  // ────────────────────────────────────────────────────────────

  it('shows top tools section with tool rows', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Top Tools')).toBeInTheDocument()
    })

    // read_file: 50, write_file: 30 from mockAnalytics
    expect(screen.getByText('read_file')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('write_file')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()

    // Total calls
    expect(screen.getByText('80 total calls')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: No Data Empty State
  // ────────────────────────────────────────────────────────────

  it('shows "No analytics data yet" when neither analytics nor timeseries are available', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.getProjectAnalytics).mockResolvedValue(null as any)
    vi.mocked(api.getTokenTimeseries).mockResolvedValue(null as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('No analytics data yet')).toBeInTheDocument()
    })

    expect(screen.getByText('Analytics appear after tasks complete. Submit an idea to get started.')).toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Models Used Section
  // ────────────────────────────────────────────────────────────

  it('shows models used section when model data exists', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.getProjectAnalytics).mockResolvedValue({
      ...mockAnalytics,
      models: { models_used: { 'claude-3-sonnet': 25, 'claude-3-haiku': 10 } },
    } as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Models Used')).toBeInTheDocument()
    })

    expect(screen.getByText('claude-3-sonnet')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('claude-3-haiku')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('does not show models used section when no model data', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })

    // mockAnalytics has models_used: {} which is empty
    expect(screen.queryByText('Models Used')).not.toBeInTheDocument()
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: EvalDashboard rendering
  // ────────────────────────────────────────────────────────────

  it('renders EvalDashboard component', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('eval-dashboard')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Loading State
  // ────────────────────────────────────────────────────────────

  it('shows loading skeleton initially', async () => {
    // Make APIs slow
    let resolveProject: (value: any) => void
    vi.mocked(api.getProjectByPath).mockImplementation(() =>
      new Promise((resolve) => { resolveProject = resolve })
    )
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)

    const { container } = render(<AnalyticsPage />)

    // Should show skeleton loading (animate-pulse)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()

    // Resolve to clean up
    resolveProject!(mockProject)

    await waitFor(() => {
      expect(screen.getByText('Analytics')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Sign In Link
  // ────────────────────────────────────────────────────────────

  it('sign in link goes to /auth/login', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Sign in to view analytics')).toBeInTheDocument()
    })

    const signInLink = screen.getByText('Sign in')
    expect(signInLink.closest('a')).toHaveAttribute('href', '/auth/login')
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: P95 Duration Display
  // ────────────────────────────────────────────────────────────

  it('shows p95 duration in stat card subtitle', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('p95: 5m')).toBeInTheDocument()
    })
  })
})
