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
  usePathname: () => '/pricing',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  redirectToLogin: vi.fn(),
}))

// Mock API
vi.mock('@/lib/api', () => ({
  getCurrentUser: vi.fn(),
  createProCheckout: vi.fn(),
}))

import PricingPage from './page'
import * as api from '@/lib/api'
import { redirectToLogin } from '@/lib/auth'

describe('PricingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders pricing header', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument()
    })
  })

  it('shows Free and Pro tier cards', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('$0')).toBeInTheDocument()
    })
    expect(screen.getByText('$19')).toBeInTheDocument()
    // Free and Pro appear in both cards and comparison table
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Pro').length).toBeGreaterThanOrEqual(2)
  })

  it('shows feature list for free tier', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Access all public projects')).toBeInTheDocument()
    })
    // "Chat with AI maintainers" appears in both Free features and comparison table
    expect(screen.getAllByText('Chat with AI maintainers').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Submit ideas and watch them ship')).toBeInTheDocument()
    expect(screen.getByText('50 agent turns per task')).toBeInTheDocument()
  })

  it('shows feature list for pro tier', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Create public or private projects')).toBeInTheDocument()
    })
    expect(screen.getByText('Connect your GitHub repos')).toBeInTheDocument()
    expect(screen.getByText('Fork any public project')).toBeInTheDocument()
    expect(screen.getByText('100 agent turns per task')).toBeInTheDocument()
  })

  it('shows BYOK section', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Bring Your Own Key')).toBeInTheDocument()
    })
  })

  it('shows sponsorship tiers', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Sponsorships')).toBeInTheDocument()
    })
    expect(screen.getByText('Supporter')).toBeInTheDocument()
    expect(screen.getByText('Backer')).toBeInTheDocument()
    expect(screen.getByText('Patron')).toBeInTheDocument()
  })

  it('shows feature comparison table', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Compare plans')).toBeInTheDocument()
    })
    expect(screen.getByText('Create projects')).toBeInTheDocument()
    expect(screen.getByText('Private repositories')).toBeInTheDocument()
    expect(screen.getByText('Agent turns per task')).toBeInTheDocument()
  })

  it('shows FAQ section', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Questions')).toBeInTheDocument()
    })
    expect(screen.getByText('What can I do for free?')).toBeInTheDocument()
    expect(screen.getByText('What does Pro unlock?')).toBeInTheDocument()
    expect(screen.getByText('What is BYOK?')).toBeInTheDocument()
    expect(screen.getByText('How do sponsorships work?')).toBeInTheDocument()
    expect(screen.getByText('Can I cancel anytime?')).toBeInTheDocument()
    expect(screen.getByText('What are agent turns?')).toBeInTheDocument()
    expect(screen.getByText('Do I need a GitHub account?')).toBeInTheDocument()
    expect(screen.getByText('How do I get support?')).toBeInTheDocument()
  })

  it('shows "Get started" link for logged-out users on free tier', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Get started')).toBeInTheDocument()
    })
  })

  it('shows "Explore projects" link for logged-in free users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Explore projects')).toBeInTheDocument()
    })
  })

  it('shows "Current plan" for Pro users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: false,
      has_anthropic_key: false,
    })

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Current plan')).toBeInTheDocument()
    })
  })

  it('shows "Upgrade to Pro" for logged-in free users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })
  })

  it('redirects to login when upgrade clicked without auth', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Sign in to upgrade')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Sign in to upgrade'))

    expect(redirectToLogin).toHaveBeenCalledWith('/pricing')
  })

  it('shows checkout error message', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })
    vi.mocked(api.createProCheckout).mockRejectedValue(new Error('Payment processing failed'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Upgrade to Pro'))

    await waitFor(() => {
      expect(screen.getByText('Payment processing failed')).toBeInTheDocument()
    })
  })

  it('calls createProCheckout with correct URLs when logged-in user clicks upgrade', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })
    // Keep it pending so we can inspect the call without redirect
    vi.mocked(api.createProCheckout).mockResolvedValue({ checkout_url: 'https://checkout.stripe.com/test' })

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Upgrade to Pro'))

    await waitFor(() => {
      expect(api.createProCheckout).toHaveBeenCalledWith({
        success_url: `${window.location.origin}/profile?upgraded=true`,
        cancel_url: `${window.location.origin}/pricing`,
      })
    })
  })

  it('shows "Redirecting to Stripe..." loading state during checkout', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })

    // Create a promise we control so the checkout stays in loading state
    let resolveCheckout!: (value: { checkout_url: string }) => void
    vi.mocked(api.createProCheckout).mockImplementation(
      () => new Promise((resolve) => { resolveCheckout = resolve })
    )

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Upgrade to Pro'))

    await waitFor(() => {
      expect(screen.getByText('Redirecting to Stripe...')).toBeInTheDocument()
    })

    // The button should be disabled during loading
    const button = screen.getByText('Redirecting to Stripe...')
    expect(button).toBeDisabled()

    // Resolve to prevent unhandled promise warning
    resolveCheckout({ checkout_url: 'https://checkout.stripe.com/test' })
  })

  it('shows generic checkout error for non-Error exceptions', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })
    // Throw a string instead of an Error to test the fallback message
    vi.mocked(api.createProCheckout).mockRejectedValue('unknown error')

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Upgrade to Pro'))

    await waitFor(() => {
      expect(screen.getByText('Checkout failed')).toBeInTheDocument()
    })
  })

  it('re-enables button after checkout error', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })
    vi.mocked(api.createProCheckout).mockRejectedValue(new Error('Network error'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Upgrade to Pro'))

    // After error, the button should be re-enabled and show "Upgrade to Pro" again
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    const button = screen.getByText('Upgrade to Pro')
    expect(button).not.toBeDisabled()
  })

  it('"Get started" link points to /auth/register', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Get started')).toBeInTheDocument()
    })

    const link = screen.getByText('Get started').closest('a')
    expect(link).toHaveAttribute('href', '/auth/register')
  })

  it('"Explore projects" link points to /explore for logged-in users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Explore projects')).toBeInTheDocument()
    })

    const link = screen.getByText('Explore projects').closest('a')
    expect(link).toHaveAttribute('href', '/explore')
  })

  it('"Contact us" link points to mailto for enterprise', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Contact us')).toBeInTheDocument()
    })

    const link = screen.getByText('Contact us').closest('a')
    expect(link).toHaveAttribute('href', 'mailto:dan@bloomit.ai')
  })

  it('shows "Current plan" for enterprise users too', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'enterprise',
      is_admin: false,
      has_anthropic_key: false,
    })

    render(<PricingPage />)

    await waitFor(() => {
      expect(screen.getByText('Current plan')).toBeInTheDocument()
    })
  })
})
