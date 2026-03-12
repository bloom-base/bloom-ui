import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/admin/observability',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  getCurrentUser: vi.fn(),
  getObservabilityDashboard: vi.fn(),
}))

import ObservabilityPage from './page'
import * as api from '@/lib/api'

const mockDashboard = {
  queue_health: {
    accepted: 3,
    proposed: 5,
    in_progress: 2,
    paused: 0,
    oldest_accepted_age_seconds: 300,
    stuck_tasks: [],
  },
  throughput: [
    { date: '2026-02-28', completed: 5, failed: 1, proposed: 3 },
    { date: '2026-03-01', completed: 8, failed: 0, proposed: 4 },
  ],
  duration_stats: {
    total_completed: 50,
    avg_seconds: 180,
    p50_seconds: 150,
    p75_seconds: 240,
    p95_seconds: 600,
    max_seconds: 900,
    under_5min: 30,
    under_15min: 42,
    under_30min: 48,
    over_30min: 2,
  },
  agent_efficiency: {
    total_evaluated: 40,
    avg_quality_score: 85,
    avg_completion_score: 0.9,
    avg_efficiency_score: 0.75,
    avg_cost_score: 0.8,
    avg_reliability_score: 0.95,
    avg_turns: 12,
    avg_cost_usd: 0.045,
    avg_tool_error_rate: 0.05,
    total_cost_usd: 1.80,
  },
  recent_failures: [],
  task_totals: {
    total: 100,
    completed: 85,
    in_progress: 5,
    accepted: 3,
    proposed: 2,
    paused: 1,
    rejected: 3,
    cancelled: 1,
    success_rate: 0.85,
  },
}

describe('ObservabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getObservabilityDashboard).mockReturnValue(new Promise(() => {}))

    render(<ObservabilityPage />)

    expect(document.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('redirects non-admin users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    } as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows observability dashboard for admin users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getObservabilityDashboard).mockResolvedValue(mockDashboard as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Observability')).toBeInTheDocument()
    })
    expect(screen.getByText('Queue health, throughput, SLO metrics')).toBeInTheDocument()
  })

  it('shows queue health metrics', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getObservabilityDashboard).mockResolvedValue(mockDashboard as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Queue Depth')).toBeInTheDocument()
    })
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Queue Lag')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  it('shows task duration stats', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getObservabilityDashboard).mockResolvedValue(mockDashboard as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Task Duration')).toBeInTheDocument()
    })
  })

  it('shows agent efficiency metrics', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getObservabilityDashboard).mockResolvedValue(mockDashboard as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Agent Efficiency')).toBeInTheDocument()
    })
    expect(screen.getByText('85/100')).toBeInTheDocument()
  })

  it('shows task status breakdown', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getObservabilityDashboard).mockResolvedValue(mockDashboard as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Task Status (All Time)')).toBeInTheDocument()
    })
  })

  it('shows recent failures section', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getObservabilityDashboard).mockResolvedValue(mockDashboard as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Recent Failures')).toBeInTheDocument()
    })
    expect(screen.getByText('No failures')).toBeInTheDocument()
  })

  it('shows error state on failure', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Network error'))

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load observability dashboard')).toBeInTheDocument()
    })
  })

  it('has billing navigation link', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getObservabilityDashboard).mockResolvedValue(mockDashboard as any)

    render(<ObservabilityPage />)

    await waitFor(() => {
      expect(screen.getByText('Billing')).toBeInTheDocument()
    })
  })
})
