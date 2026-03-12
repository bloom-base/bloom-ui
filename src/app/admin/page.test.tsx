import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/admin',
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
  getAdminDashboard: vi.fn(),
}))

import AdminPage from './page'
import * as api from '@/lib/api'

const mockDashboard = {
  subscribers: { total: 100, free: 80, pro: 20 },
  revenue: {
    total_mrr_usd: 380,
    pro_mrr_usd: 380,
    sponsorship_mrr_usd: 150,
    total_sponsorship_revenue_usd: 600,
    pro_subscribers: 20,
  },
  churn: {
    churned_last_30_days: 2,
    users_with_failed_payments: 1,
    recent_churns: [
      { username: 'lostuser', churned_at: '2026-02-28T00:00:00Z' },
    ],
  },
  recent_events: [
    {
      id: 'evt-1',
      event_type: 'customer.subscription.created',
      summary: 'New subscription',
      username: 'newuser',
      error: null,
      processed_at: '2026-03-01T00:00:00Z',
    },
  ],
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getAdminDashboard).mockReturnValue(new Promise(() => {}))

    render(<AdminPage />)

    // Skeleton loading state has animated placeholders
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

    render(<AdminPage />)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('shows admin dashboard for admin users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getAdminDashboard).mockResolvedValue(mockDashboard as any)

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument()
    })
    expect(screen.getByText('Total MRR')).toBeInTheDocument()
    expect(screen.getAllByText('Pro Subscribers').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Total Users')).toBeInTheDocument()
  })

  it('shows revenue breakdown', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getAdminDashboard).mockResolvedValue(mockDashboard as any)

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Revenue Breakdown')).toBeInTheDocument()
    })
  })

  it('shows churn metrics', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getAdminDashboard).mockResolvedValue(mockDashboard as any)

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Churn (30 days)')).toBeInTheDocument()
    })
    expect(screen.getByText('lostuser')).toBeInTheDocument()
  })

  it('shows webhook event log', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getAdminDashboard).mockResolvedValue(mockDashboard as any)

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Webhook Event Log')).toBeInTheDocument()
    })
    expect(screen.getByText('New subscription')).toBeInTheDocument()
  })

  it('shows error state on failure', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Network error'))

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load admin dashboard')).toBeInTheDocument()
    })
  })

  it('has navigation links to observability and analytics', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'admin',
      email: 'admin@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: true,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getAdminDashboard).mockResolvedValue(mockDashboard as any)

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText('Observability')).toBeInTheDocument()
    })
    expect(screen.getByText('Agent Analytics')).toBeInTheDocument()
  })
})
