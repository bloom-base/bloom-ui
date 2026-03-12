import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/analytics',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    // Return a stub component for ReactECharts
    return function MockECharts() {
      return <div data-testid="echarts">Chart</div>
    }
  },
}))

vi.mock('@/lib/api', () => ({
  getCurrentUser: vi.fn(),
  getPlatformAnalytics: vi.fn(),
  getModelComparison: vi.fn(),
  getTokenTimeseries: vi.fn(),
}))

import AnalyticsPage from './page'
import * as api from '@/lib/api'

const mockPlatform = {
  tasks: {
    total: 200,
    completed: 170,
    rejected: 10,
    failed: 15,
    in_progress: 5,
    success_rate: 0.85,
  },
  cost: {
    total_cost_usd: 12.50,
    avg_cost_per_task_usd: 0.0625,
    cost_by_model: { 'claude-sonnet-4-5-20250929': 10.00, 'claude-haiku-4-5-20251001': 2.50 },
    cost_by_agent: { coder: 8.00, maintainer: 3.00, reviewer: 1.50 },
  },
  timing: {
    avg_duration_seconds: 180,
    p50_duration_seconds: 120,
    p95_duration_seconds: 600,
  },
  period: {
    start: '2026-02-01T00:00:00Z',
    end: '2026-03-01T00:00:00Z',
  },
}

const mockModels = {
  models: [
    {
      model: 'claude-sonnet-4-5-20250929',
      total_turns: 500,
      avg_tokens_per_turn: 2000,
      cost_per_turn_usd: 0.02,
      total_cost_usd: 10.00,
    },
  ],
  recommendation: 'Sonnet is optimal for your workload.',
}

const mockTimeseries = {
  data: [],
  total_tokens: 0,
  total_cost_usd: 0,
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('redirects unauthenticated users', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows platform analytics for admin users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getPlatformAnalytics).mockResolvedValue(mockPlatform as any)
    vi.mocked(api.getModelComparison).mockResolvedValue(mockModels as any)
    vi.mocked(api.getTokenTimeseries).mockResolvedValue(mockTimeseries as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Platform Analytics')).toBeInTheDocument()
    })
    expect(screen.getByText('Total Tasks')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('shows task breakdown', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getPlatformAnalytics).mockResolvedValue(mockPlatform as any)
    vi.mocked(api.getModelComparison).mockResolvedValue(mockModels as any)
    vi.mocked(api.getTokenTimeseries).mockResolvedValue(mockTimeseries as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Task Breakdown')).toBeInTheDocument()
    })
    expect(screen.getByText('170')).toBeInTheDocument() // completed
    expect(screen.getByText('15')).toBeInTheDocument() // failed
  })

  it('shows cost breakdown', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getPlatformAnalytics).mockResolvedValue(mockPlatform as any)
    vi.mocked(api.getModelComparison).mockResolvedValue(mockModels as any)
    vi.mocked(api.getTokenTimeseries).mockResolvedValue(mockTimeseries as any)

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Cost by Model')).toBeInTheDocument()
    })
    expect(screen.getByText('Cost by Agent')).toBeInTheDocument()
  })

  it('shows error state on API failure', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getPlatformAnalytics).mockRejectedValue(new Error('Failed to load analytics'))
    vi.mocked(api.getModelComparison).mockRejectedValue(new Error('Failed'))
    vi.mocked(api.getTokenTimeseries).mockRejectedValue(new Error('Failed'))

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics')).toBeInTheDocument()
    })
  })
})
