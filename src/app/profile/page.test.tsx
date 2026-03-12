import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

// vi.hoisted runs before vi.mock hoisting, so these are available in factories
const { mockToast, mockPush, mockReplace, mockRouter, mockRedirectToGitHubAuth, mockRedirectToLogin, mockCopyToClipboard } = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockReplace = vi.fn()
  const mockRouter = {
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }
  const mockToast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  })
  const mockRedirectToGitHubAuth = vi.fn()
  const mockRedirectToLogin = vi.fn()
  const mockCopyToClipboard = vi.fn()
  return { mockToast, mockPush, mockReplace, mockRouter, mockRedirectToGitHubAuth, mockRedirectToLogin, mockCopyToClipboard }
})

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock next/navigation with stable references
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({}),
  usePathname: () => '/profile',
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
  redirectToLogin: (...args: unknown[]) => mockRedirectToLogin(...args),
  redirectToGitHubAuth: (...args: unknown[]) => mockRedirectToGitHubAuth(...args),
}))

// Mock clipboard
vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}))

// Mock API
vi.mock('@/lib/api', () => ({
  getCurrentUser: vi.fn(),
  getProjects: vi.fn(),
  getMyContributions: vi.fn(),
  createProCheckout: vi.fn(),
  createBillingPortal: vi.fn(),
  getBillingInfo: vi.fn(),
  getBillingInvoices: vi.fn(),
  getApiKeyStatus: vi.fn(),
  setApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  deleteAccount: vi.fn(),
  setPassword: vi.fn(),
  linkGitHub: vi.fn(),
  resendVerification: vi.fn(),
  setUsername: vi.fn(),
  checkUsernameAvailable: vi.fn(),
  updateNotificationSettings: vi.fn(),
  updateProfile: vi.fn(),
}))

import ProfilePage from './page'
import * as api from '@/lib/api'

const mockUser = {
  id: 'user-1',
  github_username: 'testuser',
  handle: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'free' as string,
  is_admin: false,
  has_anthropic_key: false,
  has_github: true,
  display_name: 'Test User',
  bio: 'A test user bio',
  email_verified: true,
  has_password: true,
  email_notifications: true,
}

const mockProjects = {
  items: [
    {
      id: 'proj-1',
      name: 'my-project',
      description: 'My test project',
      github_repo: 'testuser/my-project',
      owner_id: 'user-1',
      is_public: true,
      vision: 'Test vision',
      deployed_url: null,
      deploy_status: null,
      fly_app_name: null,
      deploy_error: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
}

const mockBillingInfo = {
  tier: 'free',
  billing_email: null,
  compute_budget_usd: 0.50,
  current_usage_usd: 0.10,
  budget_remaining_usd: 0.40,
  over_budget: false,
  can_provision: true,
  budget_warning: null,
  budget_usage_pct: 20,
}

const mockApiKeyStatus = {
  has_key: false,
  key_preview: null,
}

const mockContributions = {
  items: [],
  total: 0,
  limit: 50,
  offset: 0,
}

function setupMocks(overrides: { user?: Partial<typeof mockUser>; apiKeyStatus?: Partial<typeof mockApiKeyStatus> } = {}) {
  const user = { ...mockUser, ...overrides.user }
  vi.mocked(api.getCurrentUser).mockResolvedValue(user as any)
  vi.mocked(api.getProjects).mockResolvedValue(mockProjects as any)
  vi.mocked(api.getBillingInfo).mockResolvedValue({
    ...mockBillingInfo,
    tier: user.subscription_tier,
  } as any)
  vi.mocked(api.getApiKeyStatus).mockResolvedValue({
    ...mockApiKeyStatus,
    ...overrides.apiKeyStatus,
  } as any)
  vi.mocked(api.getMyContributions).mockResolvedValue(mockContributions as any)
  vi.mocked(api.getBillingInvoices).mockResolvedValue([] as any)
}

// Helper: render and wait for profile to load
async function renderProfile(overrides: Parameters<typeof setupMocks>[0] = {}) {
  setupMocks(overrides)
  render(<ProfilePage />)
  await waitFor(() => {
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock HTMLDialogElement methods (jsdom doesn't implement these)
    HTMLDialogElement.prototype.showModal = vi.fn()
    HTMLDialogElement.prototype.close = vi.fn()
    // Mock global fetch for sign out
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
  })

  // ─── Rendering / Display ──────────────────────────────────────────────

  describe('rendering', () => {
    it('renders profile header', async () => {
      await renderProfile()
      expect(screen.getByText('Profile')).toBeInTheDocument()
      expect(screen.getByText('Your account details')).toBeInTheDocument()
    })

    it('shows GitHub username when connected', async () => {
      await renderProfile()
      await waitFor(() => {
        expect(screen.getAllByText('@testuser').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('shows "Link GitHub account" when not connected', async () => {
      await renderProfile({ user: { has_github: false, github_username: null as any } })
      expect(screen.getByText('Link GitHub account')).toBeInTheDocument()
    })

    it('shows user email', async () => {
      await renderProfile()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('shows public profile link', async () => {
      await renderProfile()
      const link = screen.getByText(/View public profile/)
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/u/testuser')
    })

    it('shows upgrade CTA for free users', async () => {
      await renderProfile({ user: { subscription_tier: 'free' } })
      expect(screen.getAllByText('Upgrade to Pro').length).toBeGreaterThanOrEqual(1)
    })

    it('shows manage subscription for pro users', async () => {
      await renderProfile({ user: { subscription_tier: 'pro' } })
      expect(screen.getByText('Manage subscription')).toBeInTheDocument()
    })

    it('shows API key section', async () => {
      await renderProfile()
      expect(screen.getByText(/Claude API Key/i)).toBeInTheDocument()
    })

    it('shows "Add API Key" when no key set', async () => {
      await renderProfile({ user: { has_anthropic_key: false } })
      expect(screen.getByText('Add API Key')).toBeInTheDocument()
    })

    it('shows key preview when set', async () => {
      await renderProfile({
        user: { has_anthropic_key: true },
        apiKeyStatus: { has_key: true, key_preview: 'sk-ant-...abc' },
      })
      expect(screen.getByText('sk-ant-...abc')).toBeInTheDocument()
    })

    it('shows projects section', async () => {
      await renderProfile()
      expect(screen.getByText('My Projects')).toBeInTheDocument()
      expect(screen.getByText('my-project')).toBeInTheDocument()
    })

    it('shows error state on load failure', async () => {
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Server error'))
      vi.mocked(api.getProjects).mockRejectedValue(new Error('Server error'))
      vi.mocked(api.getBillingInfo).mockRejectedValue(new Error('Server error'))
      vi.mocked(api.getApiKeyStatus).mockRejectedValue(new Error('Server error'))
      vi.mocked(api.getMyContributions).mockRejectedValue(new Error('Server error'))
      vi.mocked(api.getBillingInvoices).mockRejectedValue(new Error('Server error'))

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load profile/)).toBeInTheDocument()
      })
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })

    it('shows Danger Zone with account deletion', async () => {
      await renderProfile()
      expect(screen.getByText('Danger Zone')).toBeInTheDocument()
      expect(screen.getByText('Delete account')).toBeInTheDocument()
    })

    it('shows "Verified" badge when email is verified', async () => {
      await renderProfile({ user: { email_verified: true } })
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })

    it('shows "Unverified" badge when email is not verified', async () => {
      await renderProfile({ user: { email_verified: false } })
      expect(screen.getByText('Unverified')).toBeInTheDocument()
    })

    it('shows "Password is set" when has_password is true', async () => {
      await renderProfile({ user: { has_password: true } })
      expect(screen.getByText('Password is set')).toBeInTheDocument()
    })

    it('shows "No password set" when has_password is false', async () => {
      await renderProfile({ user: { has_password: false } })
      expect(screen.getByText('No password set')).toBeInTheDocument()
    })

    it('shows display name and bio', async () => {
      await renderProfile({ user: { display_name: 'Test User', bio: 'A test user bio' } })
      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('A test user bio')).toBeInTheDocument()
    })

    it('shows user ID that is clickable to copy', async () => {
      await renderProfile()
      expect(screen.getByText('user-1')).toBeInTheDocument()
    })

    it('shows notification toggle section', async () => {
      await renderProfile()
      expect(screen.getByText('Email notifications')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()
    })
  })

  // ─── Sign Out ─────────────────────────────────────────────────────────

  describe('sign out', () => {
    it('opens confirmation dialog when clicking Sign out', async () => {
      await renderProfile()
      const signOutButton = screen.getByText('Sign out')
      fireEvent.click(signOutButton)

      await waitFor(() => {
        expect(screen.getByText('Sign out?')).toBeInTheDocument()
      })
      expect(screen.getByText("You'll need to sign in again to access your projects.")).toBeInTheDocument()
    })

    it('confirms sign out: calls /api/auth/logout and redirects to /', async () => {
      await renderProfile()
      fireEvent.click(screen.getByText('Sign out'))

      await waitFor(() => {
        expect(screen.getByText('Sign out?')).toBeInTheDocument()
      })

      // The ConfirmDialog renders a <dialog> element. Find the confirm button inside it.
      const allSignOutBtns = screen.getAllByText('Sign out')
      // The confirm button is the one inside the dialog (second occurrence)
      const confirmBtn = allSignOutBtns.find((el) => {
        return el.tagName === 'BUTTON' && el.closest('dialog') !== null
      }) || allSignOutBtns[allSignOutBtns.length - 1]
      fireEvent.click(confirmBtn!)

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
      })
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('cancels sign out when Cancel is clicked', async () => {
      await renderProfile()
      fireEvent.click(screen.getByText('Sign out'))

      await waitFor(() => {
        expect(screen.getByText('Sign out?')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()
      })
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })

  // ─── API Key ──────────────────────────────────────────────────────────

  describe('API key', () => {
    it('shows Add API Key button and opens input on click', async () => {
      await renderProfile({ user: { has_anthropic_key: false } })

      fireEvent.click(screen.getByText('Add API Key'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument()
      })
    })

    it('saves API key successfully', async () => {
      vi.mocked(api.setApiKey).mockResolvedValue({
        has_key: true,
        key_preview: 'sk-ant-...xyz',
      } as any)

      await renderProfile({ user: { has_anthropic_key: false } })

      fireEvent.click(screen.getByText('Add API Key'))

      const input = screen.getByPlaceholderText('sk-ant-...')
      fireEvent.change(input, { target: { value: 'sk-ant-api03-test-key' } })

      // Click Save in the API key section
      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[saveButtons.length - 1])

      await waitFor(() => {
        expect(api.setApiKey).toHaveBeenCalledWith('sk-ant-api03-test-key')
      })
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('API key saved')
      })
    })

    it('shows error toast when API key save fails', async () => {
      vi.mocked(api.setApiKey).mockRejectedValue(new Error('Invalid key'))

      await renderProfile({ user: { has_anthropic_key: false } })

      fireEvent.click(screen.getByText('Add API Key'))
      const input = screen.getByPlaceholderText('sk-ant-...')
      fireEvent.change(input, { target: { value: 'bad-key' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[saveButtons.length - 1])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Invalid key')
      })
    })

    it('cancels API key input', async () => {
      await renderProfile({ user: { has_anthropic_key: false } })

      fireEvent.click(screen.getByText('Add API Key'))
      expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument()

      // Click Cancel in the API key section
      const cancelButtons = screen.getAllByText('Cancel')
      fireEvent.click(cancelButtons[cancelButtons.length - 1])

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('sk-ant-...')).not.toBeInTheDocument()
      })
    })

    it('shows Change and Remove buttons when key is set', async () => {
      await renderProfile({
        user: { has_anthropic_key: true },
        apiKeyStatus: { has_key: true, key_preview: 'sk-ant-...abc' },
      })

      // "Change" appears in username, password, and API key sections
      const changeButtons = screen.getAllByText('Change')
      expect(changeButtons.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })

    it('clicking Change on existing key opens input', async () => {
      await renderProfile({
        user: { has_anthropic_key: true },
        apiKeyStatus: { has_key: true, key_preview: 'sk-ant-...abc' },
      })

      // Find the API key section by the key preview, then find Change within it
      const keyPreview = screen.getByText('sk-ant-...abc')
      const apiKeySection = keyPreview.closest('div.flex')!
      const changeBtn = within(apiKeySection).getByText('Change')
      fireEvent.click(changeBtn)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument()
      })
    })

    it('Remove opens confirmation dialog and removes key on confirm', async () => {
      vi.mocked(api.deleteApiKey).mockResolvedValue({
        has_key: false,
        key_preview: null,
      } as any)

      await renderProfile({
        user: { has_anthropic_key: true },
        apiKeyStatus: { has_key: true, key_preview: 'sk-ant-...abc' },
      })

      fireEvent.click(screen.getByText('Remove'))

      await waitFor(() => {
        expect(screen.getByText('Remove API key?')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Remove key'))

      await waitFor(() => {
        expect(api.deleteApiKey).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('API key removed')
      })
    })

    it('Remove cancel does not delete key', async () => {
      await renderProfile({
        user: { has_anthropic_key: true },
        apiKeyStatus: { has_key: true, key_preview: 'sk-ant-...abc' },
      })

      fireEvent.click(screen.getByText('Remove'))

      await waitFor(() => {
        expect(screen.getByText('Remove API key?')).toBeInTheDocument()
      })

      // Cancel button in the ConfirmDialog
      const cancelButtons = screen.getAllByText('Cancel')
      fireEvent.click(cancelButtons[cancelButtons.length - 1])

      expect(api.deleteApiKey).not.toHaveBeenCalled()
    })

    it('shows error toast when API key removal fails', async () => {
      vi.mocked(api.deleteApiKey).mockRejectedValue(new Error('Remove failed'))

      await renderProfile({
        user: { has_anthropic_key: true },
        apiKeyStatus: { has_key: true, key_preview: 'sk-ant-...abc' },
      })

      fireEvent.click(screen.getByText('Remove'))

      await waitFor(() => {
        expect(screen.getByText('Remove API key?')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Remove key'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Remove failed')
      })
    })
  })

  // ─── Password ─────────────────────────────────────────────────────────

  describe('password', () => {
    it('shows Change button when password is set, opens input on click', async () => {
      await renderProfile({ user: { has_password: true } })

      // The password section has a "Change" button
      const passwordSection = screen.getByText('Password is set').closest('div')!
      const changeButton = within(passwordSection).getByText('Change')
      fireEvent.click(changeButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')).toBeInTheDocument()
      })
    })

    it('shows Set password button when no password, opens input on click', async () => {
      await renderProfile({ user: { has_password: false } })

      fireEvent.click(screen.getByText('Set password'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')).toBeInTheDocument()
      })
    })

    it('saves password successfully', async () => {
      vi.mocked(api.setPassword).mockResolvedValue(undefined as any)

      await renderProfile({ user: { has_password: false } })

      fireEvent.click(screen.getByText('Set password'))

      const input = screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')
      fireEvent.change(input, { target: { value: 'StrongPass1' } })

      // Find the Save button in the password section
      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(api.setPassword).toHaveBeenCalledWith('StrongPass1')
      })
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Password updated')
      })
    })

    it('shows validation error for weak password', async () => {
      await renderProfile({ user: { has_password: false } })

      fireEvent.click(screen.getByText('Set password'))

      const input = screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')
      fireEvent.change(input, { target: { value: 'short' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Password must be at least 8 characters.')
      })
      expect(api.setPassword).not.toHaveBeenCalled()
    })

    it('shows error for password without uppercase', async () => {
      await renderProfile({ user: { has_password: false } })
      fireEvent.click(screen.getByText('Set password'))
      const input = screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')
      fireEvent.change(input, { target: { value: 'longpassword1' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Password must contain at least one uppercase letter.')
      })
    })

    it('shows error for password without number', async () => {
      await renderProfile({ user: { has_password: false } })
      fireEvent.click(screen.getByText('Set password'))
      const input = screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')
      fireEvent.change(input, { target: { value: 'LongPassword' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Password must contain at least one number.')
      })
    })

    it('shows error toast when setPassword API fails', async () => {
      vi.mocked(api.setPassword).mockRejectedValue(new Error('Server error'))

      await renderProfile({ user: { has_password: false } })
      fireEvent.click(screen.getByText('Set password'))
      const input = screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')
      fireEvent.change(input, { target: { value: 'StrongPass1' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Server error')
      })
    })

    it('cancels password input', async () => {
      await renderProfile({ user: { has_password: false } })
      fireEvent.click(screen.getByText('Set password'))

      expect(screen.getByPlaceholderText('8+ chars, uppercase, lowercase, number')).toBeInTheDocument()

      const cancelButtons = screen.getAllByText('Cancel')
      // Find the cancel in the password section
      fireEvent.click(cancelButtons[0])

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('8+ chars, uppercase, lowercase, number')).not.toBeInTheDocument()
      })
    })
  })

  // ─── Username ─────────────────────────────────────────────────────────

  describe('username', () => {
    it('shows Change button next to existing username', async () => {
      await renderProfile({ user: { handle: 'testuser' } })

      const usernameSection = screen.getByText('Username').closest('div')!
      expect(within(usernameSection).getByText('Change')).toBeInTheDocument()
    })

    it('opens username input when Change is clicked', async () => {
      await renderProfile({ user: { handle: 'testuser' } })

      const usernameSection = screen.getByText('Username').closest('div')!
      fireEvent.click(within(usernameSection).getByText('Change'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('your-username')).toBeInTheDocument()
      })
    })

    it('shows Set username button when no handle', async () => {
      await renderProfile({ user: { handle: null as any } })
      expect(screen.getByText('Set username')).toBeInTheDocument()
    })

    it('opens username input when Set username is clicked', async () => {
      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('your-username')).toBeInTheDocument()
      })
    })

    it('saves username successfully', async () => {
      vi.mocked(api.setUsername).mockResolvedValue(undefined as any)

      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      const input = screen.getByPlaceholderText('your-username')
      fireEvent.change(input, { target: { value: 'newhandle' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(api.setUsername).toHaveBeenCalledWith('newhandle')
      })
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Username updated')
      })
    })

    it('shows error when username is too short', async () => {
      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      const input = screen.getByPlaceholderText('your-username')
      fireEvent.change(input, { target: { value: 'ab' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Username must be at least 3 characters.')).toBeInTheDocument()
      })
      expect(api.setUsername).not.toHaveBeenCalled()
    })

    it('shows error toast when setUsername API fails', async () => {
      vi.mocked(api.setUsername).mockRejectedValue(new Error('Username taken'))

      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      const input = screen.getByPlaceholderText('your-username')
      fireEvent.change(input, { target: { value: 'newhandle' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Username taken')
      })
    })

    it('checks username availability on blur', async () => {
      vi.mocked(api.checkUsernameAvailable).mockResolvedValue({ available: true } as any)

      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      const input = screen.getByPlaceholderText('your-username')
      fireEvent.change(input, { target: { value: 'coolname' } })
      fireEvent.blur(input)

      await waitFor(() => {
        expect(api.checkUsernameAvailable).toHaveBeenCalledWith('coolname')
      })
      await waitFor(() => {
        expect(screen.getByText('available')).toBeInTheDocument()
      })
    })

    it('shows unavailable message when username taken', async () => {
      vi.mocked(api.checkUsernameAvailable).mockResolvedValue({
        available: false,
        error: 'Username is already taken',
      } as any)

      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      const input = screen.getByPlaceholderText('your-username')
      fireEvent.change(input, { target: { value: 'takenname' } })
      fireEvent.blur(input)

      await waitFor(() => {
        expect(screen.getByText('Username is already taken')).toBeInTheDocument()
      })
    })

    it('does not check availability for short usernames on blur', async () => {
      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      const input = screen.getByPlaceholderText('your-username')
      fireEvent.change(input, { target: { value: 'ab' } })
      fireEvent.blur(input)

      expect(api.checkUsernameAvailable).not.toHaveBeenCalled()
    })

    it('cancels username input', async () => {
      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      expect(screen.getByPlaceholderText('your-username')).toBeInTheDocument()

      const cancelButtons = screen.getAllByText('Cancel')
      fireEvent.click(cancelButtons[0])

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('your-username')).not.toBeInTheDocument()
      })
    })

    it('strips non-alphanumeric chars from username input', async () => {
      await renderProfile({ user: { handle: null as any } })
      fireEvent.click(screen.getByText('Set username'))

      const input = screen.getByPlaceholderText('your-username') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Hello_World!123' } })

      // The onChange lowercases then strips non-[a-z0-9-]
      // 'Hello_World!123' => 'hello_world!123' => 'helloworld123'
      await waitFor(() => {
        expect(input.value).toBe('helloworld123')
      })
    })
  })

  // ─── Display Name & Bio ───────────────────────────────────────────────

  describe('display name and bio editing', () => {
    it('shows Edit button and opens edit form', async () => {
      await renderProfile({ user: { display_name: 'Test User', bio: 'A test user bio' } })

      fireEvent.click(screen.getByText('Edit'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('A short bio for your public profile')).toBeInTheDocument()
      })
    })

    it('pre-fills edit form with existing values', async () => {
      await renderProfile({ user: { display_name: 'Test User', bio: 'A test user bio' } })

      fireEvent.click(screen.getByText('Edit'))

      const nameInput = screen.getByPlaceholderText('Your name') as HTMLInputElement
      const bioInput = screen.getByPlaceholderText('A short bio for your public profile') as HTMLTextAreaElement

      expect(nameInput.value).toBe('Test User')
      expect(bioInput.value).toBe('A test user bio')
    })

    it('saves profile changes successfully', async () => {
      vi.mocked(api.updateProfile).mockResolvedValue(undefined as any)

      await renderProfile({ user: { display_name: 'Test User', bio: 'A test user bio' } })

      fireEvent.click(screen.getByText('Edit'))

      const nameInput = screen.getByPlaceholderText('Your name')
      const bioInput = screen.getByPlaceholderText('A short bio for your public profile')

      fireEvent.change(nameInput, { target: { value: 'New Name' } })
      fireEvent.change(bioInput, { target: { value: 'New bio text' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(api.updateProfile).toHaveBeenCalledWith({
          display_name: 'New Name',
          bio: 'New bio text',
        })
      })
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Profile updated')
      })
    })

    it('shows error toast when profile update fails', async () => {
      vi.mocked(api.updateProfile).mockRejectedValue(new Error('Update failed'))

      await renderProfile({ user: { display_name: 'Test User', bio: 'old bio' } })

      fireEvent.click(screen.getByText('Edit'))

      const nameInput = screen.getByPlaceholderText('Your name')
      fireEvent.change(nameInput, { target: { value: 'New Name' } })

      const saveButtons = screen.getAllByText('Save')
      fireEvent.click(saveButtons[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Update failed')
      })
    })

    it('cancels profile edit', async () => {
      await renderProfile({ user: { display_name: 'Test User', bio: 'A test user bio' } })

      fireEvent.click(screen.getByText('Edit'))

      expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()

      const cancelButtons = screen.getAllByText('Cancel')
      fireEvent.click(cancelButtons[0])

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Your name')).not.toBeInTheDocument()
      })
    })

    it('shows bio character count', async () => {
      await renderProfile({ user: { display_name: 'Test User', bio: 'Hello' } })

      fireEvent.click(screen.getByText('Edit'))

      expect(screen.getByText('5/160')).toBeInTheDocument()
    })

    it('updates bio character count on input', async () => {
      await renderProfile({ user: { display_name: 'Test User', bio: '' } })

      fireEvent.click(screen.getByText('Edit'))

      const bioInput = screen.getByPlaceholderText('A short bio for your public profile')
      fireEvent.change(bioInput, { target: { value: 'New bio text here' } })

      expect(screen.getByText('17/160')).toBeInTheDocument()
    })
  })

  // ─── Upgrade to Pro ───────────────────────────────────────────────────

  describe('upgrade to Pro', () => {
    it('calls createProCheckout and redirects on success', async () => {
      vi.mocked(api.createProCheckout).mockResolvedValue({
        checkout_url: 'https://checkout.stripe.com/session123',
      } as any)

      // Mock window.location.href setter
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '', origin: 'http://localhost:3000' },
      })

      await renderProfile({ user: { subscription_tier: 'free' } })

      // Find "Upgrade to Pro" button (the one in the plan section, not the link)
      const upgradeButtons = screen.getAllByText('Upgrade to Pro')
      const planUpgradeBtn = upgradeButtons.find((el) => el.tagName === 'BUTTON')
      fireEvent.click(planUpgradeBtn!)

      await waitFor(() => {
        expect(api.createProCheckout).toHaveBeenCalledWith({
          success_url: 'http://localhost:3000/profile?upgraded=true',
          cancel_url: 'http://localhost:3000/profile',
        })
      })

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/session123')
      })

      // Restore
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      })
    })

    it('shows error toast when checkout fails', async () => {
      vi.mocked(api.createProCheckout).mockRejectedValue(new Error('Payment error'))

      await renderProfile({ user: { subscription_tier: 'free' } })

      const upgradeButtons = screen.getAllByText('Upgrade to Pro')
      const planUpgradeBtn = upgradeButtons.find((el) => el.tagName === 'BUTTON')
      fireEvent.click(planUpgradeBtn!)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Payment error')
      })
    })
  })

  // ─── Manage Billing ───────────────────────────────────────────────────

  describe('manage billing', () => {
    it('calls createBillingPortal and redirects on success', async () => {
      vi.mocked(api.createBillingPortal).mockResolvedValue({
        portal_url: 'https://billing.stripe.com/portal123',
      } as any)

      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '', origin: 'http://localhost:3000' },
      })

      await renderProfile({ user: { subscription_tier: 'pro' } })

      fireEvent.click(screen.getByText('Manage subscription'))

      await waitFor(() => {
        expect(api.createBillingPortal).toHaveBeenCalledWith({
          success_url: 'http://localhost:3000/profile',
          cancel_url: 'http://localhost:3000/profile',
        })
      })

      await waitFor(() => {
        expect(window.location.href).toBe('https://billing.stripe.com/portal123')
      })

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      })
    })

    it('shows error toast when billing portal fails', async () => {
      vi.mocked(api.createBillingPortal).mockRejectedValue(new Error('Billing error'))

      await renderProfile({ user: { subscription_tier: 'pro' } })

      fireEvent.click(screen.getByText('Manage subscription'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Billing error')
      })
    })
  })

  // ─── Link GitHub ──────────────────────────────────────────────────────

  describe('link GitHub', () => {
    it('calls redirectToGitHubAuth when Link GitHub button is clicked', async () => {
      await renderProfile({ user: { has_github: false, github_username: null as any } })

      fireEvent.click(screen.getByText('Link GitHub account'))

      expect(mockRedirectToGitHubAuth).toHaveBeenCalledWith('/profile')
    })
  })

  // ─── Resend Verification Email ────────────────────────────────────────

  describe('resend verification email', () => {
    it('shows resend button when email is unverified', async () => {
      await renderProfile({ user: { email_verified: false } })
      expect(screen.getByText('Resend verification email')).toBeInTheDocument()
    })

    it('does not show resend button when email is verified', async () => {
      await renderProfile({ user: { email_verified: true } })
      expect(screen.queryByText('Resend verification email')).not.toBeInTheDocument()
    })

    it('calls resendVerification and shows success toast', async () => {
      vi.mocked(api.resendVerification).mockResolvedValue({
        message: 'Verification email sent',
      } as any)

      await renderProfile({ user: { email_verified: false } })

      fireEvent.click(screen.getByText('Resend verification email'))

      await waitFor(() => {
        expect(api.resendVerification).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Verification email sent')
      })
    })

    it('shows error toast when resendVerification fails', async () => {
      vi.mocked(api.resendVerification).mockRejectedValue(new Error('Send failed'))

      await renderProfile({ user: { email_verified: false } })

      fireEvent.click(screen.getByText('Resend verification email'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to send verification email.')
      })
    })
  })

  // ─── Email Notifications Toggle ───────────────────────────────────────

  describe('email notifications toggle', () => {
    it('toggles notifications off (optimistic update)', async () => {
      vi.mocked(api.updateNotificationSettings).mockResolvedValue(undefined as any)

      await renderProfile({ user: { email_notifications: true } })

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'true')

      fireEvent.click(toggle)

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'false')
      })
      expect(api.updateNotificationSettings).toHaveBeenCalledWith(false)
    })

    it('toggles notifications on (optimistic update)', async () => {
      vi.mocked(api.updateNotificationSettings).mockResolvedValue(undefined as any)

      await renderProfile({ user: { email_notifications: false } })

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'false')

      fireEvent.click(toggle)

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'true')
      })
      expect(api.updateNotificationSettings).toHaveBeenCalledWith(true)
    })

    it('reverts toggle on API failure', async () => {
      vi.mocked(api.updateNotificationSettings).mockRejectedValue(new Error('Failed'))

      await renderProfile({ user: { email_notifications: true } })

      const toggle = screen.getByRole('switch')
      fireEvent.click(toggle)

      // Initially optimistically toggled off
      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'false')
      })

      // After API failure, reverts back to true
      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'true')
      })
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update notification settings')
    })
  })

  // ─── Delete Account ───────────────────────────────────────────────────

  describe('delete account', () => {
    it('opens delete confirmation dialog when clicking Delete account', async () => {
      await renderProfile()

      fireEvent.click(screen.getByText('Delete account'))

      await waitFor(() => {
        expect(screen.getByText('Delete your account?')).toBeInTheDocument()
      })
      expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument()
    })

    it('delete button is disabled until "DELETE" is typed', async () => {
      await renderProfile()

      fireEvent.click(screen.getByText('Delete account'))

      await waitFor(() => {
        expect(screen.getByText('Delete your account?')).toBeInTheDocument()
      })

      const deleteBtn = screen.getByText('Delete my account')
      expect(deleteBtn).toBeDisabled()

      const input = screen.getByPlaceholderText('DELETE')
      fireEvent.change(input, { target: { value: 'DEL' } })

      expect(deleteBtn).toBeDisabled()

      fireEvent.change(input, { target: { value: 'DELETE' } })

      expect(deleteBtn).not.toBeDisabled()
    })

    it('deletes account on confirm and redirects to /', async () => {
      vi.mocked(api.deleteAccount).mockResolvedValue(undefined as any)

      await renderProfile()

      fireEvent.click(screen.getByText('Delete account'))

      await waitFor(() => {
        expect(screen.getByText('Delete your account?')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('DELETE')
      fireEvent.change(input, { target: { value: 'DELETE' } })

      fireEvent.click(screen.getByText('Delete my account'))

      await waitFor(() => {
        expect(api.deleteAccount).toHaveBeenCalled()
      })
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('shows error toast when deleteAccount fails', async () => {
      vi.mocked(api.deleteAccount).mockRejectedValue(new Error('Cannot delete'))

      await renderProfile()

      fireEvent.click(screen.getByText('Delete account'))

      await waitFor(() => {
        expect(screen.getByText('Delete your account?')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('DELETE')
      fireEvent.change(input, { target: { value: 'DELETE' } })

      fireEvent.click(screen.getByText('Delete my account'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Cannot delete')
      })
    })

    it('cancels delete account dialog', async () => {
      await renderProfile()

      fireEvent.click(screen.getByText('Delete account'))

      await waitFor(() => {
        expect(screen.getByText('Delete your account?')).toBeInTheDocument()
      })

      // The Cancel button inside the delete dialog
      const dialog = screen.getByText('Delete your account?').closest('div.fixed')!
      const cancelBtn = within(dialog).getByText('Cancel')
      fireEvent.click(cancelBtn)

      await waitFor(() => {
        expect(screen.queryByText('Delete your account?')).not.toBeInTheDocument()
      })
    })

    it('shows project count warning when projects exist', async () => {
      await renderProfile()

      expect(screen.getByText(/This will also delete 1 project/)).toBeInTheDocument()
    })
  })

  // ─── Copy Profile URL / User ID ───────────────────────────────────────

  describe('copy user ID', () => {
    it('copies user ID on click', async () => {
      await renderProfile()

      const userId = screen.getByText('user-1')
      fireEvent.click(userId)

      expect(mockCopyToClipboard).toHaveBeenCalledWith('user-1', 'User ID copied')
    })
  })

  // ─── Try Again on Error ───────────────────────────────────────────────

  describe('try again on error', () => {
    it('retries loading profile when Try again is clicked', async () => {
      vi.mocked(api.getCurrentUser).mockRejectedValueOnce(new Error('Server error'))
      vi.mocked(api.getProjects).mockRejectedValueOnce(new Error('Server error'))
      vi.mocked(api.getBillingInfo).mockRejectedValueOnce(new Error('Server error'))
      vi.mocked(api.getApiKeyStatus).mockRejectedValueOnce(new Error('Server error'))
      vi.mocked(api.getMyContributions).mockRejectedValueOnce(new Error('Server error'))
      vi.mocked(api.getBillingInvoices).mockRejectedValueOnce(new Error('Server error'))

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load profile/)).toBeInTheDocument()
      })

      // Now set up success mocks for retry
      setupMocks()

      fireEvent.click(screen.getByText('Try again'))

      await waitFor(() => {
        expect(screen.getByText('Profile')).toBeInTheDocument()
      })
      // getCurrentUser called twice: first failure + retry
      expect(api.getCurrentUser).toHaveBeenCalledTimes(2)
    })
  })

  // ─── Authentication Redirect ──────────────────────────────────────────

  describe('authentication redirect', () => {
    it('redirects to login when not authenticated', async () => {
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not authenticated'))
      vi.mocked(api.getProjects).mockRejectedValue(new Error('Not authenticated'))
      vi.mocked(api.getBillingInfo).mockRejectedValue(new Error('Not authenticated'))
      vi.mocked(api.getApiKeyStatus).mockRejectedValue(new Error('Not authenticated'))
      vi.mocked(api.getMyContributions).mockRejectedValue(new Error('Not authenticated'))
      vi.mocked(api.getBillingInvoices).mockRejectedValue(new Error('Not authenticated'))

      render(<ProfilePage />)

      await waitFor(() => {
        expect(mockRedirectToLogin).toHaveBeenCalledWith('/profile')
      })
    })
  })

  // ─── Pro User Features ────────────────────────────────────────────────

  describe('pro user features', () => {
    it('shows "New project" link for pro users', async () => {
      await renderProfile({ user: { subscription_tier: 'pro' } })

      const newProjectLink = screen.getByText(/New project/)
      expect(newProjectLink.closest('a')).toHaveAttribute('href', '/new')
    })

    it('does not show "New project" link for free users', async () => {
      await renderProfile({ user: { subscription_tier: 'free' } })

      expect(screen.queryByText(/New project/)).not.toBeInTheDocument()
    })

    it('shows $19/mo for pro users', async () => {
      await renderProfile({ user: { subscription_tier: 'pro' } })
      expect(screen.getByText('$19/mo')).toBeInTheDocument()
    })

    it('shows 100 turns per task for pro users', async () => {
      await renderProfile({ user: { subscription_tier: 'pro' } })
      expect(screen.getByText('100 turns per task')).toBeInTheDocument()
    })

    it('shows 50 turns per task for free users', async () => {
      await renderProfile({ user: { subscription_tier: 'free' } })
      expect(screen.getByText('50 turns per task')).toBeInTheDocument()
    })
  })

  // ─── Compute Budget Section ───────────────────────────────────────────

  describe('compute budget', () => {
    it('shows compute budget usage', async () => {
      await renderProfile()
      expect(screen.getByText('$0.10 used')).toBeInTheDocument()
      expect(screen.getByText('$0.50 budget')).toBeInTheDocument()
    })

    it('shows remaining budget', async () => {
      await renderProfile()
      expect(screen.getByText('$0.40 remaining')).toBeInTheDocument()
    })

    it('shows usage percentage', async () => {
      await renderProfile()
      expect(screen.getByText('20% used')).toBeInTheDocument()
    })
  })

  // ─── No Projects Empty State ──────────────────────────────────────────

  describe('empty projects state', () => {
    it('shows empty state for free user with no projects', async () => {
      setupMocks({ user: { subscription_tier: 'free' } })
      vi.mocked(api.getProjects).mockResolvedValue({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      } as any)

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('No projects yet')).toBeInTheDocument()
      })
      expect(screen.getByText('Explore public projects to contribute ideas')).toBeInTheDocument()
    })

    it('shows "Upgrade to create projects" button for free user with no projects', async () => {
      setupMocks({ user: { subscription_tier: 'free' } })
      vi.mocked(api.getProjects).mockResolvedValue({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
      } as any)

      render(<ProfilePage />)

      await waitFor(() => {
        expect(screen.getByText('Upgrade to create projects')).toBeInTheDocument()
      })
    })
  })
})
