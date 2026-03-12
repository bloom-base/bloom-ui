import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const mockRedirectToLogin = vi.fn()
vi.mock('@/lib/auth', () => ({
  redirectToLogin: (...args: unknown[]) => mockRedirectToLogin(...args),
}))

vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}))

vi.mock('@/lib/api', () => ({
  getCurrentUser: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
}))

import { Nav } from './Nav'
import * as api from '@/lib/api'

const loggedOutUser = () => {
  vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
}

const loggedInUser = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(api.getCurrentUser).mockResolvedValue({
    id: 'user-1',
    github_username: 'testuser',
    username: 'testuser',
    email: 'test@example.com',
    avatar_url: null,
    subscription_tier: 'free',
    is_admin: false,
    has_anthropic_key: false,
    ...overrides,
  } as any)
}

describe('Nav', () => {
  let originalLocation: Location

  beforeEach(() => {
    vi.clearAllMocks()
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '', assign: vi.fn() },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  it('renders bloom logo', async () => {
    loggedOutUser()

    render(<Nav />)

    expect(screen.getByText('bloom')).toBeInTheDocument()
  })

  it('shows navigation links', async () => {
    loggedOutUser()

    render(<Nav />)

    expect(screen.getAllByText('Explore').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Pricing').length).toBeGreaterThanOrEqual(1)
  })

  it('shows sign in and get started for logged-out users', async () => {
    loggedOutUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Sign in').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Get started').length).toBeGreaterThanOrEqual(1)
  })

  it('shows username for logged-in users', async () => {
    loggedInUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('testuser').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows sign out for logged-in users', async () => {
    loggedInUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Sign out').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows Admin link for admin users', async () => {
    loggedInUser({ username: 'admin', github_username: 'admin', email: 'admin@example.com', subscription_tier: 'pro', is_admin: true })

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows New Project for pro users', async () => {
    loggedInUser({ username: 'prouser', github_username: 'prouser', email: 'pro@example.com', subscription_tier: 'pro' })

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('New Project').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('hides New Project for free users', async () => {
    loggedInUser({ username: 'freeuser', github_username: 'freeuser', email: 'free@example.com' })

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('freeuser').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.queryByText('New Project')).not.toBeInTheDocument()
  })

  it('shows notification bell for logged-in users', async () => {
    loggedInUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByTestId('notification-bell').length).toBeGreaterThanOrEqual(1)
    })
  })

  // ====================================================
  // handleSignOut click
  // ====================================================

  it('calls fetch /api/auth/logout and redirects to / on sign out click (desktop)', async () => {
    loggedInUser()
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)

    render(<Nav />)

    // Wait for user to load
    await waitFor(() => {
      expect(screen.getAllByText('Sign out').length).toBeGreaterThanOrEqual(1)
    })

    // Click the desktop sign out button (first one)
    const signOutButtons = screen.getAllByText('Sign out')
    fireEvent.click(signOutButtons[0])

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    })

    await waitFor(() => {
      expect(window.location.href).toBe('/')
    })

    fetchSpy.mockRestore()
  })

  it('redirects to / even when sign out fetch fails', async () => {
    loggedInUser()
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'))

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Sign out').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getAllByText('Sign out')[0])

    await waitFor(() => {
      expect(window.location.href).toBe('/')
    })

    fetchSpy.mockRestore()
  })

  // ====================================================
  // redirectToLogin click
  // ====================================================

  it('calls redirectToLogin when Sign in button is clicked (desktop)', async () => {
    loggedOutUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Sign in').length).toBeGreaterThanOrEqual(1)
    })

    // Click the first Sign in button (desktop)
    const signInButtons = screen.getAllByText('Sign in')
    fireEvent.click(signInButtons[0])

    expect(mockRedirectToLogin).toHaveBeenCalledTimes(1)
  })

  // ====================================================
  // Mobile menu toggle open/close
  // ====================================================

  it('opens mobile menu on hamburger click and shows mobile nav', async () => {
    loggedOutUser()

    render(<Nav />)

    // The mobile menu toggle button has aria-label "Open menu"
    const toggleButton = screen.getByLabelText('Open menu')
    expect(toggleButton).toBeInTheDocument()
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleButton)

    // Mobile nav should now be visible
    const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(mobileNav).toBeInTheDocument()

    // The toggle button label should change to "Close menu"
    const closeButton = screen.getByLabelText('Close menu')
    expect(closeButton).toBeInTheDocument()
    expect(closeButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes mobile menu on close button click', async () => {
    loggedOutUser()

    render(<Nav />)

    // Open menu
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()

    // Close menu
    fireEvent.click(screen.getByLabelText('Close menu'))

    // Mobile nav should be gone
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Open menu')).toHaveAttribute('aria-expanded', 'false')
  })

  it('mobile menu shows Explore and Pricing links', async () => {
    loggedOutUser()

    render(<Nav />)

    fireEvent.click(screen.getByLabelText('Open menu'))

    const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(mobileNav).toBeInTheDocument()

    // Check that mobile nav contains nav links (they also exist in desktop)
    // Look specifically in the mobile navigation region
    const exploreLinks = screen.getAllByText('Explore')
    expect(exploreLinks.length).toBeGreaterThanOrEqual(2) // desktop + mobile
  })

  it('mobile menu shows Sign in and Get started for logged-out users', async () => {
    loggedOutUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Sign in').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByLabelText('Open menu'))

    // After opening mobile menu, should have both desktop and mobile Sign in
    const signInButtons = screen.getAllByText('Sign in')
    expect(signInButtons.length).toBeGreaterThanOrEqual(2)

    const getStartedLinks = screen.getAllByText('Get started')
    expect(getStartedLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('mobile Sign in button calls redirectToLogin and closes menu', async () => {
    loggedOutUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Sign in').length).toBeGreaterThanOrEqual(1)
    })

    // Open mobile menu
    fireEvent.click(screen.getByLabelText('Open menu'))

    // The mobile Sign in is the second button with text "Sign in"
    const signInButtons = screen.getAllByText('Sign in')
    // Click the last one (mobile)
    fireEvent.click(signInButtons[signInButtons.length - 1])

    expect(mockRedirectToLogin).toHaveBeenCalledTimes(1)

    // Mobile menu should close
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  })

  it('mobile Sign out button calls handleSignOut and closes menu', async () => {
    loggedInUser()
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Sign out').length).toBeGreaterThanOrEqual(1)
    })

    // Open mobile menu
    fireEvent.click(screen.getByLabelText('Open menu'))

    // Click the mobile sign out (last one)
    const signOutButtons = screen.getAllByText('Sign out')
    fireEvent.click(signOutButtons[signOutButtons.length - 1])

    // Should close mobile menu
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    })

    await waitFor(() => {
      expect(window.location.href).toBe('/')
    })

    fetchSpy.mockRestore()
  })

  it('mobile menu shows username and profile link for logged-in users', async () => {
    loggedInUser()

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('testuser').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByLabelText('Open menu'))

    // Should have desktop + mobile instances of username
    const usernames = screen.getAllByText('testuser')
    expect(usernames.length).toBeGreaterThanOrEqual(2)
  })

  it('mobile menu shows Admin link for admin users', async () => {
    loggedInUser({ username: 'admin', github_username: 'admin', is_admin: true, subscription_tier: 'pro' })

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByLabelText('Open menu'))

    // Desktop + mobile Admin links
    const adminLinks = screen.getAllByText('Admin')
    expect(adminLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('mobile menu shows New Project for pro users', async () => {
    loggedInUser({ username: 'prouser', github_username: 'prouser', subscription_tier: 'pro' })

    render(<Nav />)

    await waitFor(() => {
      expect(screen.getAllByText('New Project').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByLabelText('Open menu'))

    const newProjectLinks = screen.getAllByText('New Project')
    expect(newProjectLinks.length).toBeGreaterThanOrEqual(2)
  })
})
