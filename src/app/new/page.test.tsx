import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockBack = vi.fn()
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/new',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/auth', () => ({
  redirectToLogin: vi.fn(),
  redirectToGitHubAuth: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  getCurrentUser: vi.fn(),
  getProjects: vi.fn(),
  getGitHubRepos: vi.fn(),
  getGitHubUser: vi.fn(),
  createGitHubRepo: vi.fn(),
  createProject: vi.fn(),
  createProCheckout: vi.fn(),
}))

import NewProjectPage from './page'
import * as api from '@/lib/api'
import * as auth from '@/lib/auth'
import { toast } from 'sonner'

// --- Shared fixtures ---

const freeUser = {
  id: 'user-1',
  username: 'testuser',
  handle: 'testuser',
  display_name: 'Test User',
  bio: null,
  github_username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'free' as const,
  is_admin: false,
  has_anthropic_key: false,
  has_github: true,
  email_verified: true,
  has_password: true,
  email_notifications: true,
}

const proUser = {
  ...freeUser,
  subscription_tier: 'pro' as const,
}

const proUserNoGitHub = {
  ...proUser,
  github_username: null,
  has_github: false,
}

const emptyProjects = { items: [], total: 0, limit: 50, offset: 0 }

const makeRepo = (overrides: Partial<{
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  language: string | null
  stargazers_count: number
  updated_at: string
}> = {}) => ({
  id: 1,
  name: 'my-repo',
  full_name: 'testuser/my-repo',
  description: 'A test repo',
  private: false,
  html_url: 'https://github.com/testuser/my-repo',
  language: 'TypeScript',
  stargazers_count: 5,
  updated_at: '2026-03-01T00:00:00Z',
  ...overrides,
})

function setupProUserWithRepos(repos = [makeRepo()], projects = emptyProjects) {
  vi.mocked(api.getCurrentUser).mockResolvedValue(proUser as any)
  vi.mocked(api.getProjects).mockResolvedValue(projects as any)
  vi.mocked(api.getGitHubRepos).mockResolvedValue(repos as any)
  vi.mocked(api.getGitHubUser).mockResolvedValue({ login: 'testuser' } as any)
}

function setupFreeUser() {
  vi.mocked(api.getCurrentUser).mockResolvedValue(freeUser as any)
  vi.mocked(api.getProjects).mockResolvedValue(emptyProjects as any)
  vi.mocked(api.getGitHubRepos).mockResolvedValue([])
  vi.mocked(api.getGitHubUser).mockResolvedValue({ login: 'testuser' } as any)
}

// --- Tests ---

describe('NewProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.location for tests that assign to it
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: '', origin: 'http://localhost:3000', assign: vi.fn() },
    })
  })

  // ==========================================
  // Loading state
  // ==========================================

  describe('loading state', () => {
    it('shows loading spinner while fetching data', () => {
      vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getProjects).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getGitHubRepos).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getGitHubUser).mockReturnValue(new Promise(() => {}))

      render(<NewProjectPage />)

      expect(screen.getByText('Loading your repositories...')).toBeInTheDocument()
    })

    it('shows animated spinner element during loading', () => {
      vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getProjects).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getGitHubRepos).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getGitHubUser).mockReturnValue(new Promise(() => {}))

      const { container } = render(<NewProjectPage />)

      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  // ==========================================
  // Auth redirect on error
  // ==========================================

  describe('auth redirect', () => {
    it('redirects to login when all API calls fail', async () => {
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Unauthorized'))
      vi.mocked(api.getProjects).mockRejectedValue(new Error('Unauthorized'))
      vi.mocked(api.getGitHubRepos).mockRejectedValue(new Error('Unauthorized'))
      vi.mocked(api.getGitHubUser).mockRejectedValue(new Error('Unauthorized'))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(auth.redirectToLogin).toHaveBeenCalledWith('/new')
      })
    })
  })

  // ==========================================
  // Free user upgrade gate
  // ==========================================

  describe('free user upgrade gate', () => {
    it('shows upgrade gate for free users', async () => {
      setupFreeUser()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Pro required')).toBeInTheDocument()
      })
      expect(screen.getByText(/Creating projects requires a Pro subscription/)).toBeInTheDocument()
    })

    it('shows upgrade button with price', async () => {
      setupFreeUser()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
      })
    })

    it('shows compare plans link', async () => {
      setupFreeUser()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(/Compare plans/)).toBeInTheDocument()
      })
      const link = screen.getByText(/Compare plans/)
      expect(link.closest('a')).toHaveAttribute('href', '/pricing')
    })

    it('clicking upgrade button calls createProCheckout and redirects', async () => {
      setupFreeUser()
      vi.mocked(api.createProCheckout).mockResolvedValue({
        checkout_url: 'https://checkout.stripe.com/session123',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Upgrade to Pro/))

      await waitFor(() => {
        expect(api.createProCheckout).toHaveBeenCalledWith({
          success_url: 'http://localhost:3000/new',
          cancel_url: 'http://localhost:3000/new',
        })
      })

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/session123')
      })
    })

    it('shows loading text while checkout is in progress', async () => {
      setupFreeUser()
      // Never-resolving promise to keep loading state
      vi.mocked(api.createProCheckout).mockReturnValue(new Promise(() => {}))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Upgrade to Pro/))

      await waitFor(() => {
        expect(screen.getByText('Redirecting to Stripe...')).toBeInTheDocument()
      })
    })

    it('shows toast on checkout failure', async () => {
      setupFreeUser()
      vi.mocked(api.createProCheckout).mockRejectedValue(new Error('Payment method required'))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Upgrade to Pro/))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Payment method required')
      })
    })

    it('re-enables upgrade button after checkout failure', async () => {
      setupFreeUser()
      vi.mocked(api.createProCheckout).mockRejectedValue(new Error('fail'))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
      })

      const btn = screen.getByText(/Upgrade to Pro/)
      fireEvent.click(btn)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      // Button should not show "Redirecting..." anymore
      await waitFor(() => {
        expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // GitHub link gate
  // ==========================================

  describe('GitHub link gate', () => {
    it('shows GitHub link gate for Pro users without GitHub', async () => {
      vi.mocked(api.getCurrentUser).mockResolvedValue(proUserNoGitHub as any)
      vi.mocked(api.getProjects).mockResolvedValue(emptyProjects as any)
      vi.mocked(api.getGitHubRepos).mockResolvedValue([])
      vi.mocked(api.getGitHubUser).mockResolvedValue(null as any)

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Link your GitHub')).toBeInTheDocument()
      })
      expect(screen.getByText(/Connect your GitHub account/)).toBeInTheDocument()
    })

    it('shows Connect GitHub button', async () => {
      vi.mocked(api.getCurrentUser).mockResolvedValue(proUserNoGitHub as any)
      vi.mocked(api.getProjects).mockResolvedValue(emptyProjects as any)
      vi.mocked(api.getGitHubRepos).mockResolvedValue([])
      vi.mocked(api.getGitHubUser).mockResolvedValue(null as any)

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Connect GitHub')).toBeInTheDocument()
      })
    })

    it('clicking Connect GitHub calls redirectToGitHubAuth', async () => {
      vi.mocked(api.getCurrentUser).mockResolvedValue(proUserNoGitHub as any)
      vi.mocked(api.getProjects).mockResolvedValue(emptyProjects as any)
      vi.mocked(api.getGitHubRepos).mockResolvedValue([])
      vi.mocked(api.getGitHubUser).mockResolvedValue(null as any)

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Connect GitHub')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Connect GitHub'))

      expect(auth.redirectToGitHubAuth).toHaveBeenCalledWith('/new')
    })
  })

  // ==========================================
  // Repo selection step (Pro user with GitHub)
  // ==========================================

  describe('repo selection step', () => {
    it('shows repo picker for Pro users with GitHub', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })
      expect(screen.getByText('my-repo')).toBeInTheDocument()
    })

    it('displays repo metadata (language, stars, description)', async () => {
      setupProUserWithRepos([
        makeRepo({ language: 'Rust', stargazers_count: 42, description: 'A Rust project' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })
      expect(screen.getByText('Rust')).toBeInTheDocument()
      expect(screen.getByText('42 stars')).toBeInTheDocument()
      expect(screen.getByText('A Rust project')).toBeInTheDocument()
    })

    it('shows Private badge for private repos', async () => {
      setupProUserWithRepos([
        makeRepo({ private: true }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })
      expect(screen.getByText('Private')).toBeInTheDocument()
    })

    it('shows multiple repos', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'repo-one', full_name: 'testuser/repo-one' }),
        makeRepo({ id: 2, name: 'repo-two', full_name: 'testuser/repo-two', language: 'Python' }),
        makeRepo({ id: 3, name: 'repo-three', full_name: 'testuser/repo-three', language: 'Go' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('repo-one')).toBeInTheDocument()
      })
      expect(screen.getByText('repo-two')).toBeInTheDocument()
      expect(screen.getByText('repo-three')).toBeInTheDocument()
    })

    it('shows "No repositories found" when repo list is empty', async () => {
      setupProUserWithRepos([])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })
      expect(screen.getByText('No repositories found')).toBeInTheDocument()
    })

    it('shows progress indicator step 1 active on select step', async () => {
      setupProUserWithRepos()

      const { container } = render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })

      // Step 1 indicator should be present
      const stepIndicators = container.querySelectorAll('.rounded-full')
      // At least the progress step circles should exist
      expect(stepIndicators.length).toBeGreaterThanOrEqual(2)
    })

    it('shows "Create new repository" button', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })
      expect(screen.getByText('Start fresh with a new GitHub repo')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Search / filter repos
  // ==========================================

  describe('repo search and filter', () => {
    it('shows search input', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument()
      })
    })

    it('filters repos by name', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'alpha-project', full_name: 'testuser/alpha-project' }),
        makeRepo({ id: 2, name: 'beta-tool', full_name: 'testuser/beta-tool' }),
        makeRepo({ id: 3, name: 'gamma-lib', full_name: 'testuser/gamma-lib' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('alpha-project')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      fireEvent.change(searchInput, { target: { value: 'beta' } })

      expect(screen.queryByText('alpha-project')).not.toBeInTheDocument()
      expect(screen.getByText('beta-tool')).toBeInTheDocument()
      expect(screen.queryByText('gamma-lib')).not.toBeInTheDocument()
    })

    it('filters repos by description', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'repo-a', full_name: 'testuser/repo-a', description: 'A web framework' }),
        makeRepo({ id: 2, name: 'repo-b', full_name: 'testuser/repo-b', description: 'A CLI tool' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('repo-a')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      fireEvent.change(searchInput, { target: { value: 'CLI' } })

      expect(screen.queryByText('repo-a')).not.toBeInTheDocument()
      expect(screen.getByText('repo-b')).toBeInTheDocument()
    })

    it('search is case-insensitive', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'MyProject', full_name: 'testuser/MyProject' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('MyProject')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      fireEvent.change(searchInput, { target: { value: 'myproject' } })

      expect(screen.getByText('MyProject')).toBeInTheDocument()
    })

    it('shows "No repositories found" when search has no matches', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'my-repo', full_name: 'testuser/my-repo' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search repositories...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      expect(screen.getByText('No repositories found')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Already-used repos (disabled state)
  // ==========================================

  describe('already connected repos', () => {
    const connectedProjects = {
      items: [{
        id: 'proj-1',
        name: 'existing-project',
        github_repo: 'testuser/connected-repo',
        owner_id: 'user-1',
      }],
      total: 1,
      limit: 50,
      offset: 0,
    }

    it('shows "Already used in" badge for connected repos', async () => {
      setupProUserWithRepos(
        [makeRepo({ id: 1, name: 'connected-repo', full_name: 'testuser/connected-repo' })],
        connectedProjects as any,
      )

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('connected-repo')).toBeInTheDocument()
      })
      expect(screen.getByText(/Already used in existing-project/)).toBeInTheDocument()
    })

    it('connected repo button is disabled', async () => {
      setupProUserWithRepos(
        [makeRepo({ id: 1, name: 'connected-repo', full_name: 'testuser/connected-repo' })],
        connectedProjects as any,
      )

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('connected-repo')).toBeInTheDocument()
      })

      const repoButton = screen.getByText('connected-repo').closest('button')
      expect(repoButton).toBeDisabled()
    })

    it('clicking a connected repo does NOT navigate to vision step', async () => {
      setupProUserWithRepos(
        [makeRepo({ id: 1, name: 'connected-repo', full_name: 'testuser/connected-repo' })],
        connectedProjects as any,
      )

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('connected-repo')).toBeInTheDocument()
      })

      const repoButton = screen.getByText('connected-repo').closest('button')!
      fireEvent.click(repoButton)

      // Should still be on select step, not vision
      expect(screen.getByText('Select a repository')).toBeInTheDocument()
      expect(screen.queryByText('Define your vision')).not.toBeInTheDocument()
    })

    it('shows both connected and available repos correctly', async () => {
      setupProUserWithRepos(
        [
          makeRepo({ id: 1, name: 'connected-repo', full_name: 'testuser/connected-repo' }),
          makeRepo({ id: 2, name: 'available-repo', full_name: 'testuser/available-repo' }),
        ],
        connectedProjects as any,
      )

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('connected-repo')).toBeInTheDocument()
      })

      // Connected repo is disabled
      const connectedButton = screen.getByText('connected-repo').closest('button')
      expect(connectedButton).toBeDisabled()

      // Available repo is enabled
      const availableButton = screen.getByText('available-repo').closest('button')
      expect(availableButton).not.toBeDisabled()
    })
  })

  // ==========================================
  // Selecting a repo -> vision step
  // ==========================================

  describe('repo selection -> vision step', () => {
    it('clicking a repo advances to vision step', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })
    })

    it('vision step shows selected repo info', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'cool-project', full_name: 'testuser/cool-project', description: 'Very cool' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('cool-project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('cool-project').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('testuser/cool-project')).toBeInTheDocument()
      })
      expect(screen.getByText('Very cool')).toBeInTheDocument()
    })

    it('vision step shows "No description" for repos without description', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'no-desc', full_name: 'testuser/no-desc', description: null }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('no-desc')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('no-desc').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('No description')).toBeInTheDocument()
      })
    })

    it('shows vision textarea with placeholder', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/A fast, minimal CLI tool/)).toBeInTheDocument()
      })
    })

    it('vision textarea accepts input', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/A fast, minimal CLI tool/)).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/A fast, minimal CLI tool/) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'Build an amazing tool' } })

      expect(textarea.value).toBe('Build an amazing tool')
    })

    it('vision textarea enforces 1000 character limit', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/A fast, minimal CLI tool/)).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/A fast, minimal CLI tool/) as HTMLTextAreaElement
      const longText = 'a'.repeat(1500)
      fireEvent.change(textarea, { target: { value: longText } })

      // The onChange slices to 1000
      expect(textarea.value.length).toBe(1000)
    })

    it('shows character count', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('0/1000')).toBeInTheDocument()
      })
    })

    it('updates character count as user types', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('0/1000')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/A fast, minimal CLI tool/)
      fireEvent.change(textarea, { target: { value: 'Hello world' } })

      expect(screen.getByText('11/1000')).toBeInTheDocument()
    })

    it('shows repo name in the vision step prompt text', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'awesome-cli', full_name: 'testuser/awesome-cli' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('awesome-cli')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('awesome-cli').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText(/What do you want/)).toBeInTheDocument()
      })
      // The repo name appears in the prompt "What do you want awesome-cli to become?"
      expect(screen.getByText('awesome-cli')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Project visibility toggle (vision step)
  // ==========================================

  describe('project visibility toggle', () => {
    async function goToVisionStep() {
      setupProUserWithRepos()
      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })
    }

    it('defaults to private project visibility', async () => {
      await goToVisionStep()

      expect(screen.getByText('Project visibility')).toBeInTheDocument()
      expect(screen.getByText(/Only you and invited members/)).toBeInTheDocument()
    })

    it('toggling visibility shows public description', async () => {
      await goToVisionStep()

      // The toggle is a switch button (role="button" with type="button") inside the
      // same section as "Project visibility". We find it by going up from the heading
      // to the rounded-lg container (3 levels: h3 -> div -> div.flex -> div.border)
      // h3 -> parent div -> parent div.flex (which contains the toggle button)
      const heading = screen.getByText('Project visibility')
      const flexContainer = heading.parentElement!.parentElement!
      const toggleButton = flexContainer.querySelector('button[type="button"]')!
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText(/Anyone can discover and contribute/)).toBeInTheDocument()
      })
    })

    it('toggling visibility twice returns to private', async () => {
      await goToVisionStep()

      const heading = screen.getByText('Project visibility')
      const flexContainer = heading.parentElement!.parentElement!
      const toggleButton = flexContainer.querySelector('button[type="button"]')!

      // Toggle to public
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getByText(/Anyone can discover and contribute/)).toBeInTheDocument()
      })

      // Toggle back to private
      fireEvent.click(toggleButton)
      await waitFor(() => {
        expect(screen.getByText(/Only you and invited members/)).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Back button navigation
  // ==========================================

  describe('back button navigation', () => {
    it('back button on vision step returns to select step', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      // Go to vision step
      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      // Click Back button (there are two - the icon+text one and the "Back" text button)
      const backButtons = screen.getAllByText('Back')
      fireEvent.click(backButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })
    })

    it('back button on create-repo step returns to select step', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      // Go to create-repo step
      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText(/We'll create this repo on GitHub/)).toBeInTheDocument()
      })

      // Click Back
      const backButtons = screen.getAllByText('Back')
      fireEvent.click(backButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })
    })

    it('Cancel button on create-repo step returns to select step', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Create new repo step
  // ==========================================

  describe('create new repo step', () => {
    it('clicking "Create new repository" navigates to create-repo step', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText(/We'll create this repo on GitHub/)).toBeInTheDocument()
      })
      expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
    })

    it('shows GitHub username prefix for repo name', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('testuser/')).toBeInTheDocument()
      })
    })

    it('repo name input accepts valid characters', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Repository name') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'my-awesome-project' } })

      expect(nameInput.value).toBe('my-awesome-project')
    })

    it('repo name input sanitizes invalid characters to dashes', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Repository name') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'my project!@#' } })

      // The onChange replaces invalid chars with '-'
      expect(nameInput.value).toBe('my-project---')
    })

    it('description input accepts text', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      })

      const descInput = screen.getByLabelText(/Description/) as HTMLInputElement
      fireEvent.change(descInput, { target: { value: 'My project description' } })

      expect(descInput.value).toBe('My project description')
    })

    it('defaults to private visibility', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Visibility')).toBeInTheDocument()
      })

      expect(screen.getByText('Only you can see this repository.')).toBeInTheDocument()
    })

    it('toggling visibility shows public text', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Visibility')).toBeInTheDocument()
      })

      const visHeading = screen.getByText('Visibility')
      const flexContainer = visHeading.parentElement!.parentElement!
      const toggleBtn = flexContainer.querySelector('button[type="button"]')!
      fireEvent.click(toggleBtn)

      await waitFor(() => {
        expect(screen.getByText('Anyone can see this repository.')).toBeInTheDocument()
      })
    })

    it('Create Repository button is disabled when name is empty', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Repository')).toBeInTheDocument()
      })

      const createBtn = screen.getByText('Create Repository').closest('button')!
      expect(createBtn).toBeDisabled()
    })

    it('Create Repository button is enabled when name is provided', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Repository name')
      fireEvent.change(nameInput, { target: { value: 'new-project' } })

      const createBtn = screen.getByText('Create Repository').closest('button')!
      expect(createBtn).not.toBeDisabled()
    })

    it('clicking Create Repository calls createGitHubRepo and advances to vision', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createGitHubRepo).mockResolvedValue({
        id: 99,
        name: 'new-project',
        full_name: 'testuser/new-project',
        description: 'A new project',
        private: true,
        html_url: 'https://github.com/testuser/new-project',
        language: null,
        stargazers_count: 0,
        updated_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      // Fill in repo details
      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'new-project' } })
      fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'A new project' } })

      // Click create
      fireEvent.click(screen.getByText('Create Repository'))

      await waitFor(() => {
        expect(api.createGitHubRepo).toHaveBeenCalledWith({
          name: 'new-project',
          description: 'A new project',
          private: true,
          auto_init: true,
        })
      })

      // Should advance to vision step
      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })
    })

    it('shows "Creating..." while repo is being created', async () => {
      setupProUserWithRepos()
      // Never resolving to keep loading state
      vi.mocked(api.createGitHubRepo).mockReturnValue(new Promise(() => {}))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'new-project' } })
      fireEvent.click(screen.getByText('Create Repository'))

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument()
      })
    })

    it('shows toast error when repo creation fails', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createGitHubRepo).mockRejectedValue(new Error('Repository already exists'))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'existing-name' } })
      fireEvent.click(screen.getByText('Create Repository'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Repository already exists')
      })
    })

    it('creates repo with public visibility when toggled', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createGitHubRepo).mockResolvedValue({
        id: 99,
        name: 'public-project',
        full_name: 'testuser/public-project',
        description: null,
        private: false,
        html_url: 'https://github.com/testuser/public-project',
        language: null,
        stargazers_count: 0,
        updated_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'public-project' } })

      // Toggle to public (default is private, so toggle once)
      const visHeading = screen.getByText('Visibility')
      const visContainer = visHeading.parentElement!.parentElement!
      const toggleBtn = visContainer.querySelector('button[type="button"]')!
      fireEvent.click(toggleBtn)

      fireEvent.click(screen.getByText('Create Repository'))

      await waitFor(() => {
        expect(api.createGitHubRepo).toHaveBeenCalledWith({
          name: 'public-project',
          description: undefined,
          private: false,
          auto_init: true,
        })
      })
    })
  })

  // ==========================================
  // Create project (form submission)
  // ==========================================

  describe('create project submission', () => {
    it('clicking Create Project calls createProject with correct data', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'cool-app', full_name: 'testuser/cool-app', description: 'A cool app' }),
      ])
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-new',
        name: 'cool-app',
        description: 'A cool app',
        github_repo: 'testuser/cool-app',
        owner_id: 'user-1',
        is_public: false,
        vision: 'Build something awesome',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('cool-app')).toBeInTheDocument()
      })

      // Select repo
      fireEvent.click(screen.getByText('cool-app').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      // Fill in vision
      const textarea = screen.getByPlaceholderText(/A fast, minimal CLI tool/)
      fireEvent.change(textarea, { target: { value: 'Build something awesome' } })

      // Create project
      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith({
          name: 'cool-app',
          description: 'A cool app',
          github_repo: 'testuser/cool-app',
          vision: 'Build something awesome',
          is_public: false,
        })
      })
    })

    it('redirects to project page after successful creation', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'cool-app', full_name: 'testuser/cool-app', description: '' }),
      ])
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-new',
        name: 'cool-app',
        description: '',
        github_repo: 'testuser/cool-app',
        owner_id: 'user-1',
        is_public: false,
        vision: '',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('cool-app')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('cool-app').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/testuser/cool-app')
      })
    })

    it('shows "Creating..." while project is being created', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createProject).mockReturnValue(new Promise(() => {}))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument()
      })
    })

    it('Create Project button is disabled while creating', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createProject).mockReturnValue(new Promise(() => {}))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      const createBtn = screen.getByText('Create Project').closest('button')!
      fireEvent.click(createBtn)

      await waitFor(() => {
        expect(screen.getByText('Creating...').closest('button')).toBeDisabled()
      })
    })

    it('shows toast error when project creation fails', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createProject).mockRejectedValue(new Error('Repo already used'))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Repo already used')
      })
    })

    it('re-enables Create Project button after failure', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createProject).mockRejectedValue(new Error('Network error'))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      // Button should show "Create Project" again (not "Creating...")
      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })
      expect(screen.getByText('Create Project').closest('button')).not.toBeDisabled()
    })

    it('creates project with public visibility when toggled', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'public-app', full_name: 'testuser/public-app', description: 'Open source' }),
      ])
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-pub',
        name: 'public-app',
        description: 'Open source',
        github_repo: 'testuser/public-app',
        owner_id: 'user-1',
        is_public: true,
        vision: 'Open source forever',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('public-app')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('public-app').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      // Type vision
      fireEvent.change(screen.getByPlaceholderText(/A fast, minimal CLI tool/), {
        target: { value: 'Open source forever' },
      })

      // Toggle project to public
      const visHeading2 = screen.getByText('Project visibility')
      const visContainer2 = visHeading2.parentElement!.parentElement!
      const toggleButton = visContainer2.querySelector('button[type="button"]')!
      fireEvent.click(toggleButton)

      // Create
      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith({
          name: 'public-app',
          description: 'Open source',
          github_repo: 'testuser/public-app',
          vision: 'Open source forever',
          is_public: true,
        })
      })
    })

    it('creates project with empty vision (vision is optional)', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'no-vision', full_name: 'testuser/no-vision', description: null }),
      ])
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-nv',
        name: 'no-vision',
        description: '',
        github_repo: 'testuser/no-vision',
        owner_id: 'user-1',
        is_public: false,
        vision: '',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('no-vision')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('no-vision').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      // Don't type anything in vision, just create
      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith({
          name: 'no-vision',
          description: '',
          github_repo: 'testuser/no-vision',
          vision: '',
          is_public: false,
        })
      })
    })
  })

  // ==========================================
  // Full flow: create new repo -> vision -> create project
  // ==========================================

  describe('full flow: new repo -> vision -> project', () => {
    it('completes full create-new-repo flow end to end', async () => {
      setupProUserWithRepos([])
      vi.mocked(api.createGitHubRepo).mockResolvedValue({
        id: 99,
        name: 'brand-new',
        full_name: 'testuser/brand-new',
        description: 'Fresh start',
        private: true,
        html_url: 'https://github.com/testuser/brand-new',
        language: null,
        stargazers_count: 0,
        updated_at: '2026-03-01T00:00:00Z',
      })
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-brand',
        name: 'brand-new',
        description: 'Fresh start',
        github_repo: 'testuser/brand-new',
        owner_id: 'user-1',
        is_public: false,
        vision: 'The next big thing',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      // Step 1: Select step -> click "Create new repository"
      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      // Step 2: Fill in create-repo form
      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'brand-new' } })
      fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Fresh start' } })
      fireEvent.click(screen.getByText('Create Repository'))

      // Step 3: Vision step after repo creation
      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })
      expect(screen.getByText('testuser/brand-new')).toBeInTheDocument()

      // Fill in vision
      fireEvent.change(screen.getByPlaceholderText(/A fast, minimal CLI tool/), {
        target: { value: 'The next big thing' },
      })

      // Step 4: Create project
      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith({
          name: 'brand-new',
          description: 'Fresh start',
          github_repo: 'testuser/brand-new',
          vision: 'The next big thing',
          is_public: false,
        })
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/testuser/brand-new')
      })
    })
  })

  // ==========================================
  // Edge cases
  // ==========================================

  describe('edge cases', () => {
    it('handles getProjects failure gracefully', async () => {
      vi.mocked(api.getCurrentUser).mockResolvedValue(proUser as any)
      vi.mocked(api.getProjects).mockRejectedValue(new Error('Network error'))
      vi.mocked(api.getGitHubRepos).mockResolvedValue([makeRepo()])
      vi.mocked(api.getGitHubUser).mockResolvedValue({ login: 'testuser' } as any)

      render(<NewProjectPage />)

      // Should still render with repos (getProjects failure caught with fallback)
      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })
      expect(screen.getByText('my-repo')).toBeInTheDocument()
    })

    it('handles getGitHubRepos failure gracefully with toast', async () => {
      vi.mocked(api.getCurrentUser).mockResolvedValue(proUser as any)
      vi.mocked(api.getProjects).mockResolvedValue(emptyProjects as any)
      vi.mocked(api.getGitHubRepos).mockRejectedValue(new Error('GitHub API down'))
      vi.mocked(api.getGitHubUser).mockResolvedValue({ login: 'testuser' } as any)

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })

      // Should show empty state since repos failed
      expect(screen.getByText('No repositories found')).toBeInTheDocument()
    })

    it('handles getGitHubUser failure (null username)', async () => {
      vi.mocked(api.getCurrentUser).mockResolvedValue(proUser as any)
      vi.mocked(api.getProjects).mockResolvedValue(emptyProjects as any)
      vi.mocked(api.getGitHubRepos).mockResolvedValue([makeRepo()])
      vi.mocked(api.getGitHubUser).mockRejectedValue(new Error('failed'))

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })

      // Navigate to create-repo step
      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      // GitHub username should be null, so prefix won't show "testuser/"
      // (it would show nothing or "null/")
    })

    it('createGitHubRepo with non-Error rejection shows generic message', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createGitHubRepo).mockRejectedValue('string error')

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'test-repo' } })
      fireEvent.click(screen.getByText('Create Repository'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create repository')
      })
    })

    it('createProject with non-Error rejection shows generic message', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createProject).mockRejectedValue('string error')

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create project')
      })
    })

    it('createProCheckout with non-Error rejection shows generic message', async () => {
      setupFreeUser()
      vi.mocked(api.createProCheckout).mockRejectedValue('string error')

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(/Upgrade to Pro/))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Checkout failed')
      })
    })

    it('does not allow double-clicking Create Project', async () => {
      setupProUserWithRepos()
      let resolveProject: (v: any) => void
      vi.mocked(api.createProject).mockImplementation(
        () => new Promise((resolve) => { resolveProject = resolve })
      )

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      // Click twice quickly
      fireEvent.click(screen.getByText('Create Project'))
      fireEvent.click(screen.getByText('Creating...').closest('button')!)

      // Should only have been called once (second click is guarded by `creating` state)
      expect(api.createProject).toHaveBeenCalledTimes(1)
    })

    it('does not allow double-clicking Create Repository on create-repo step', async () => {
      setupProUserWithRepos()
      vi.mocked(api.createGitHubRepo).mockImplementation(
        () => new Promise(() => {}) // never resolves
      )

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'test-repo' } })

      // Click Create Repository twice quickly
      fireEvent.click(screen.getByText('Create Repository'))

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument()
      })

      // Second click on the now-Creating... button
      fireEvent.click(screen.getByText('Creating...').closest('button')!)

      // Should only have been called once (handleCreateAndSelect guards with creatingRepo check)
      expect(api.createGitHubRepo).toHaveBeenCalledTimes(1)
    })

    it('uses description or empty string when repo has null description', async () => {
      setupProUserWithRepos([
        makeRepo({ name: 'null-desc', full_name: 'testuser/null-desc', description: null }),
      ])
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-nd',
        name: 'null-desc',
        description: '',
        github_repo: 'testuser/null-desc',
        owner_id: 'user-1',
        is_public: false,
        vision: '',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('null-desc')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('null-desc').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Create Project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith(
          expect.objectContaining({ description: '' })
        )
      })
    })
  })

  // ==========================================
  // Vision step character counter styling
  // ==========================================

  describe('vision character counter styling', () => {
    async function goToVisionStep() {
      setupProUserWithRepos()
      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })
    }

    it('character counter turns amber when above 900 characters', async () => {
      await goToVisionStep()

      const textarea = screen.getByPlaceholderText(/A fast, minimal CLI tool/)
      const longText = 'a'.repeat(901)
      fireEvent.change(textarea, { target: { value: longText } })

      const counter = screen.getByText('901/1000')
      expect(counter.className).toContain('text-amber-500')
    })

    it('character counter stays gray when at or below 900 characters', async () => {
      await goToVisionStep()

      const textarea = screen.getByPlaceholderText(/A fast, minimal CLI tool/)
      fireEvent.change(textarea, { target: { value: 'a'.repeat(900) } })

      const counter = screen.getByText('900/1000')
      expect(counter.className).toContain('text-gray-300')
    })

    it('character counter shows exact count at boundary of 1000', async () => {
      await goToVisionStep()

      const textarea = screen.getByPlaceholderText(/A fast, minimal CLI tool/)
      fireEvent.change(textarea, { target: { value: 'x'.repeat(1000) } })

      expect(screen.getByText('1000/1000')).toBeInTheDocument()
      const counter = screen.getByText('1000/1000')
      expect(counter.className).toContain('text-amber-500')
    })
  })

  // ==========================================
  // Search clearing and re-filtering
  // ==========================================

  describe('search clearing', () => {
    it('clearing search re-shows all repos', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'alpha', full_name: 'testuser/alpha' }),
        makeRepo({ id: 2, name: 'beta', full_name: 'testuser/beta' }),
        makeRepo({ id: 3, name: 'gamma', full_name: 'testuser/gamma' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('alpha')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search repositories...')

      // Filter to only 'alpha'
      fireEvent.change(searchInput, { target: { value: 'alpha' } })
      expect(screen.getByText('alpha')).toBeInTheDocument()
      expect(screen.queryByText('beta')).not.toBeInTheDocument()
      expect(screen.queryByText('gamma')).not.toBeInTheDocument()

      // Clear the search
      fireEvent.change(searchInput, { target: { value: '' } })

      // All repos should be visible again
      expect(screen.getByText('alpha')).toBeInTheDocument()
      expect(screen.getByText('beta')).toBeInTheDocument()
      expect(screen.getByText('gamma')).toBeInTheDocument()
    })

    it('refining search progressively narrows results', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'react-app', full_name: 'testuser/react-app' }),
        makeRepo({ id: 2, name: 'react-native', full_name: 'testuser/react-native' }),
        makeRepo({ id: 3, name: 'vue-app', full_name: 'testuser/vue-app' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search repositories...')

      // Type "react" - should show both react repos
      fireEvent.change(searchInput, { target: { value: 'react' } })
      expect(screen.getByText('react-app')).toBeInTheDocument()
      expect(screen.getByText('react-native')).toBeInTheDocument()
      expect(screen.queryByText('vue-app')).not.toBeInTheDocument()

      // Refine to "react-n" - should show only react-native
      fireEvent.change(searchInput, { target: { value: 'react-n' } })
      expect(screen.queryByText('react-app')).not.toBeInTheDocument()
      expect(screen.getByText('react-native')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Step navigation — Back button in footer
  // ==========================================

  describe('footer Back button on vision step', () => {
    it('footer Back button returns to select step', async () => {
      setupProUserWithRepos()

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('my-repo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('my-repo').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      // There are two "Back" elements on the vision step — the top one and the footer button.
      // The footer one is inside the flex gap-3 mt-8 div alongside "Create Project".
      const backButtons = screen.getAllByText('Back')
      // Click the last Back (the footer one)
      fireEvent.click(backButtons[backButtons.length - 1])

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })
    })

    it('going back from vision preserves the repos list', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'repo-one', full_name: 'testuser/repo-one' }),
        makeRepo({ id: 2, name: 'repo-two', full_name: 'testuser/repo-two' }),
      ])

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('repo-one')).toBeInTheDocument()
      })
      expect(screen.getByText('repo-two')).toBeInTheDocument()

      // Select a repo to go to vision
      fireEvent.click(screen.getByText('repo-one').closest('button')!)

      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      // Go back
      const backButtons = screen.getAllByText('Back')
      fireEvent.click(backButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })

      // Both repos should still be in the list
      expect(screen.getByText('repo-one')).toBeInTheDocument()
      expect(screen.getByText('repo-two')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Full flow: select existing repo -> vision -> create project
  // ==========================================

  describe('full flow: existing repo -> vision -> project', () => {
    it('completes full existing-repo selection flow end to end', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'existing-app', full_name: 'testuser/existing-app', description: 'My existing app' }),
      ])
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-exist',
        name: 'existing-app',
        description: 'My existing app',
        github_repo: 'testuser/existing-app',
        owner_id: 'user-1',
        is_public: false,
        vision: 'Scale it to millions',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      // Step 1: Select existing repo
      await waitFor(() => {
        expect(screen.getByText('existing-app')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('existing-app').closest('button')!)

      // Step 2: Vision step
      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })
      expect(screen.getByText('testuser/existing-app')).toBeInTheDocument()
      expect(screen.getByText('My existing app')).toBeInTheDocument()

      // Fill in vision ("Scale it to millions" = 20 chars)
      fireEvent.change(screen.getByPlaceholderText(/A fast, minimal CLI tool/), {
        target: { value: 'Scale it to millions' },
      })
      expect(screen.getByText('20/1000')).toBeInTheDocument()

      // Step 3: Create project
      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith({
          name: 'existing-app',
          description: 'My existing app',
          github_repo: 'testuser/existing-app',
          vision: 'Scale it to millions',
          is_public: false,
        })
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/testuser/existing-app')
      })
    })

    it('completes full flow with public project visibility', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'oss-tool', full_name: 'testuser/oss-tool', description: 'Open source tool' }),
      ])
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-oss',
        name: 'oss-tool',
        description: 'Open source tool',
        github_repo: 'testuser/oss-tool',
        owner_id: 'user-1',
        is_public: true,
        vision: 'Community-driven',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      // Select repo
      await waitFor(() => {
        expect(screen.getByText('oss-tool')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('oss-tool').closest('button')!)

      // Vision step
      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      // Type vision
      fireEvent.change(screen.getByPlaceholderText(/A fast, minimal CLI tool/), {
        target: { value: 'Community-driven' },
      })

      // Toggle project to public
      const visHeading = screen.getByText('Project visibility')
      const visContainer = visHeading.parentElement!.parentElement!
      const toggleButton = visContainer.querySelector('button[type="button"]')!
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(screen.getByText(/Anyone can discover and contribute/)).toBeInTheDocument()
      })

      // Create
      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith({
          name: 'oss-tool',
          description: 'Open source tool',
          github_repo: 'testuser/oss-tool',
          vision: 'Community-driven',
          is_public: true,
        })
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/testuser/oss-tool')
      })
    })
  })

  // ==========================================
  // Full flow: new repo -> vision -> project with public visibility
  // ==========================================

  describe('full flow: new repo -> vision -> project with public visibility', () => {
    it('completes new-repo flow with public project visibility end to end', async () => {
      setupProUserWithRepos([])
      vi.mocked(api.createGitHubRepo).mockResolvedValue({
        id: 100,
        name: 'open-project',
        full_name: 'testuser/open-project',
        description: 'An open project',
        private: false,
        html_url: 'https://github.com/testuser/open-project',
        language: null,
        stargazers_count: 0,
        updated_at: '2026-03-01T00:00:00Z',
      })
      vi.mocked(api.createProject).mockResolvedValue({
        id: 'proj-open',
        name: 'open-project',
        description: 'An open project',
        github_repo: 'testuser/open-project',
        owner_id: 'user-1',
        is_public: true,
        vision: 'Fully open source',
        deployed_url: null,
        deploy_status: null,
        fly_app_name: null,
        deploy_error: null,
        max_parallel_tasks: null,
        auto_improve: false,
        created_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      // Step 1: Go to create-repo step
      await waitFor(() => {
        expect(screen.getByText('Create new repository')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      // Step 2: Fill in repo details with public visibility
      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'open-project' } })
      fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'An open project' } })

      // Toggle repo visibility to public
      const visHeading = screen.getByText('Visibility')
      const visContainer = visHeading.parentElement!.parentElement!
      const repoToggle = visContainer.querySelector('button[type="button"]')!
      fireEvent.click(repoToggle)

      await waitFor(() => {
        expect(screen.getByText('Anyone can see this repository.')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create Repository'))

      await waitFor(() => {
        expect(api.createGitHubRepo).toHaveBeenCalledWith({
          name: 'open-project',
          description: 'An open project',
          private: false,
          auto_init: true,
        })
      })

      // Step 3: Vision step after repo creation
      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByPlaceholderText(/A fast, minimal CLI tool/), {
        target: { value: 'Fully open source' },
      })

      // Toggle project visibility to public
      const projVisHeading = screen.getByText('Project visibility')
      const projVisContainer = projVisHeading.parentElement!.parentElement!
      const projToggle = projVisContainer.querySelector('button[type="button"]')!
      fireEvent.click(projToggle)

      await waitFor(() => {
        expect(screen.getByText(/Anyone can discover and contribute/)).toBeInTheDocument()
      })

      // Step 4: Create project
      fireEvent.click(screen.getByText('Create Project'))

      await waitFor(() => {
        expect(api.createProject).toHaveBeenCalledWith({
          name: 'open-project',
          description: 'An open project',
          github_repo: 'testuser/open-project',
          vision: 'Fully open source',
          is_public: true,
        })
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/testuser/open-project')
      })
    })
  })

  // ==========================================
  // Newly created repo appears in list after going back
  // ==========================================

  describe('created repo appears in repo list', () => {
    it('newly created repo is added to the repo list when going back from vision', async () => {
      setupProUserWithRepos([
        makeRepo({ id: 1, name: 'original-repo', full_name: 'testuser/original-repo' }),
      ])
      vi.mocked(api.createGitHubRepo).mockResolvedValue({
        id: 99,
        name: 'new-repo',
        full_name: 'testuser/new-repo',
        description: 'Freshly created',
        private: true,
        html_url: 'https://github.com/testuser/new-repo',
        language: null,
        stargazers_count: 0,
        updated_at: '2026-03-01T00:00:00Z',
      })

      render(<NewProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('original-repo')).toBeInTheDocument()
      })

      // Go to create-repo step
      fireEvent.click(screen.getByText('Create new repository').closest('button')!)

      await waitFor(() => {
        expect(screen.getByLabelText('Repository name')).toBeInTheDocument()
      })

      // Create the new repo
      fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'new-repo' } })
      fireEvent.click(screen.getByText('Create Repository'))

      // Should advance to vision step
      await waitFor(() => {
        expect(screen.getByText('Define your vision')).toBeInTheDocument()
      })

      // Go back to select step
      const backButtons = screen.getAllByText('Back')
      fireEvent.click(backButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Select a repository')).toBeInTheDocument()
      })

      // Both original and newly created repo should be visible
      expect(screen.getByText('original-repo')).toBeInTheDocument()
      expect(screen.getByText('new-repo')).toBeInTheDocument()
    })
  })
})
